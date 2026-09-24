//------------------------------------------------------------------------------
// Catalog validation. Pure -- no filesystem -- so the preview runs exactly the
// checks the build does, in the browser; reading the files is catalog-fs.ts.
//------------------------------------------------------------------------------
import { parse, TYPE } from "@formatjs/icu-messageformat-parser";
import type { MessageFormatElement } from "@formatjs/icu-messageformat-parser";

//------------------------------------------------------------------------------
import type { RegisteredMessage } from "./messages.js";

//------------------------------------------------------------------------------
export type MessageAst = MessageFormatElement[];

export interface CatalogOptions {
  locales: string[];
  defaultLocale: string;
  strict: boolean;
}

export interface CatalogResult {
  /**
   * locale -> id -> parsed message. Every source id is present for every
   * locale: a missing translation has already been replaced by the source.
   */
  messages: Map<string, Map<string, MessageAst>>;
  /** locale -> how many of the source messages it really translates. */
  coverage: Map<string, { translated: number; total: number }>;
  /** locale -> ids showing the default locale's text for want of a translation. */
  fallbacks: Map<string, Set<string>>;
  warnings: string[];
}

//------------------------------------------------------------------------------
// A catalog as read from disk: null when the file does not exist.
//------------------------------------------------------------------------------
export type RawCatalogs = Map<string, unknown>;

//------------------------------------------------------------------------------
export class CatalogError extends Error {
  constructor(readonly problems: string[]) {
    const shown = problems.slice(0, 20);
    const more = problems.length - shown.length;

    super(
      `Translations have ${problems.length} problem` +
        `${problems.length === 1 ? "" : "s"}:\n\n` +
        shown.map((p) => `  - ${p}`).join("\n") +
        (more > 0 ? `\n  ... and ${more} more` : ""),
    );
  }
}

//------------------------------------------------------------------------------
// Checks every catalog against the source messages, and parses both.
//
// Some problems always fail the build -- a message that does not parse, or
// that names something the template cannot supply. Incompleteness only fails
// it with `strictLocales`; otherwise it warns, and the source text stands in.
//------------------------------------------------------------------------------
export function validateCatalogs(
  sources: RegisteredMessage[],
  raw: RawCatalogs,
  opts: CatalogOptions,
): CatalogResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const incomplete = (problem: string) =>
    (opts.strict ? errors : warnings).push(problem);

  const messages = new Map<string, Map<string, MessageAst>>();
  const coverage = new Map<string, { translated: number; total: number }>();
  const fallbacks = new Map<string, Set<string>>();

  //----------------------------------------------------------------------------
  // The source messages, in the default locale.
  const sourceAsts = new Map<string, MessageAst>();
  const sourceSigs = new Map<string, Signature>();
  const sourceIds = new Set(sources.map((s) => s.id));

  for (const { id, defaultMessage } of sources) {
    const where = `${opts.defaultLocale} ${id} (source)`;
    const ast = parseMessage(normalizeText(defaultMessage, where, warnings), where, errors);
    if (!ast) continue;

    sourceAsts.set(id, ast);
    sourceSigs.set(id, signatureOf(ast));
    checkPluralCategories(ast, opts.defaultLocale, where, incomplete);
  }

  messages.set(opts.defaultLocale, sourceAsts);
  coverage.set(opts.defaultLocale, { translated: sources.length, total: sources.length });

  //----------------------------------------------------------------------------
  for (const locale of opts.locales) {
    if (locale === opts.defaultLocale) continue;

    const file = `${locale}.json`;
    const catalog = raw.get(locale);
    const parsed = new Map<string, MessageAst>();
    let translated = 0;

    if (catalog === null || catalog === undefined) {
      if (sources.length > 0) {
        incomplete(`${file} does not exist; run \`mailgrail extract\` to create it.`);
      }
    } else if (typeof catalog !== "object" || Array.isArray(catalog)) {
      errors.push(`${file} must be a JSON object of message id -> ICU string.`);
    } else {
      const entries = catalog as Record<string, unknown>;

      for (const [id, value] of Object.entries(entries)) {
        const where = `${locale} ${id}`;

        if (!sourceIds.has(id)) {
          warnings.push(`${where}: no source message has this id (stale; \`mailgrail extract --prune\` removes it).`);
          continue;
        }

        // Its source did not parse, which is already an error.
        if (!sourceSigs.has(id)) continue;

        if (typeof value !== "string") {
          errors.push(`${where}: must be a string, got ${value === null ? "null" : typeof value}.`);
          continue;
        }

        // An empty string is how `extract` marks "not translated yet".
        if (value === "") continue;

        const ast = parseMessage(normalizeText(value, where, warnings), where, errors);
        if (!ast) continue;

        const ok = compareSignatures(sourceSigs.get(id)!, signatureOf(ast), where, errors, warnings);
        checkPluralCategories(ast, locale, where, incomplete);

        if (ok) {
          parsed.set(id, ast);
          translated++;
        }
      }
    }

    // Anything still missing falls back to the source text.
    const missing: string[] = [];
    for (const [id, ast] of sourceAsts) {
      if (parsed.has(id)) continue;
      parsed.set(id, ast);
      missing.push(id);
    }
    fallbacks.set(locale, new Set(missing));

    // A missing file was already reported as a whole.
    if (catalog && missing.length > 0) {
      incomplete(
        `${file} is missing ${missing.length} translation` +
          `${missing.length === 1 ? "" : "s"}: ` +
          missing.slice(0, 5).join(", ") +
          (missing.length > 5 ? ", ..." : "") +
          ` (the ${opts.defaultLocale} text is used instead).`,
      );
    }

    messages.set(locale, parsed);
    coverage.set(locale, { translated, total: sourceAsts.size });
  }

  if (errors.length > 0) throw new CatalogError(errors);

  return { messages, coverage, fallbacks, warnings };
}

//------------------------------------------------------------------------------
// Parsing
//------------------------------------------------------------------------------
function parseMessage(
  text: string,
  where: string,
  errors: string[],
): MessageAst | null {
  try {
    return parse(text, {
      shouldParseSkeletons: true,
      requiresOtherClause: true,
      captureLocation: true,
    });
  } catch (err) {
    const e = err as Error & { location?: { start: { offset: number } } };
    const at = e.location ? ` at offset ${e.location.start.offset}` : "";
    errors.push(`${where}: ${describeParseError(e.message)}${at}: ${JSON.stringify(text)}`);
    return null;
  }
}

function describeParseError(code: string): string {
  switch (code) {
    case "MISSING_OTHER_CLAUSE":
      return "plural and select need an `other` branch";
    case "UNCLOSED_TAG":
    case "UNMATCHED_CLOSING_TAG":
      return "tags are not balanced";
    default:
      return `invalid ICU message (${code})`;
  }
}

//------------------------------------------------------------------------------
// Text hygiene
//
// Catalogs come from editors and translation platforms, so they carry what
// those put in: decomposed accents from macOS, byte-order marks, zero-width
// spaces pasted from a web page, bidi controls. Accents are recomposed; the
// invisible characters are reported, since some are deliberate (ZWJ/ZWNJ are
// needed by Persian and Indic scripts and are left alone, as are NBSP and
// NNBSP, which French typography uses before `:` and `!`).
//------------------------------------------------------------------------------
const SUSPICIOUS: [RegExp, string][] = [
  [/\uFEFF/, "a byte-order mark (U+FEFF)"],
  [/\u200B/, "a zero-width space (U+200B)"],
  [/[\u202A-\u202E\u2066-\u2069]/, "a bidi control character (U+202A-202E / U+2066-2069)"],
  // eslint-disable-next-line no-control-regex
  [/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/, "a control character"],
];

function normalizeText(text: string, where: string, warnings: string[]): string {
  for (const [re, what] of SUSPICIOUS) {
    if (re.test(text)) warnings.push(`${where}: contains ${what}.`);
  }
  return text.normalize("NFC");
}

//------------------------------------------------------------------------------
// Signatures: what a message asks of the template
//------------------------------------------------------------------------------
interface Signature {
  args: Set<string>;
  tags: Set<string>;
}

export function signatureOf(ast: MessageAst): Signature {
  const sig: Signature = { args: new Set(), tags: new Set() };

  const walk = (nodes: MessageAst) => {
    for (const node of nodes) {
      switch (node.type) {
        case TYPE.argument:
        case TYPE.number:
        case TYPE.date:
        case TYPE.time:
          sig.args.add(node.value);
          break;
        case TYPE.plural:
        case TYPE.select:
          sig.args.add(node.value);
          for (const option of Object.values(node.options)) walk(option.value);
          break;
        case TYPE.tag:
          sig.tags.add(node.value);
          walk(node.children);
          break;
      }
    }
  };

  walk(ast);
  return sig;
}

//------------------------------------------------------------------------------
// A translation may use less than its source -- a language can drop a name
// the sentence does not need -- but never more: the template only supplies
// what the source asks for, so an extra argument would have no value to show.
//------------------------------------------------------------------------------
function compareSignatures(
  source: Signature,
  translation: Signature,
  where: string,
  errors: string[],
  warnings: string[],
): boolean {
  let ok = true;

  for (const [kind, s, t] of [
    ["argument", source.args, translation.args],
    ["tag", source.tags, translation.tags],
  ] as const) {
    for (const name of t) {
      if (!s.has(name)) {
        errors.push(`${where}: uses ${kind} \`${name}\`, which the source message does not have.`);
        ok = false;
      }
    }
    for (const name of s) {
      if (!t.has(name)) {
        warnings.push(`${where}: does not use ${kind} \`${name}\` from the source message.`);
      }
    }
  }

  return ok;
}

//------------------------------------------------------------------------------
// ICU only insists on `other`. A language's own plural rules decide which
// other branches a correct translation needs: English has one/other, Polish
// one/few/many/other, Arabic all six. Leaving one out is not a syntax error --
// the `other` text is shown instead, and it is usually wrong.
//------------------------------------------------------------------------------
function checkPluralCategories(
  ast: MessageAst,
  locale: string,
  where: string,
  report: (problem: string) => void,
): void {
  const walk = (nodes: MessageAst) => {
    for (const node of nodes) {
      if (node.type === TYPE.plural) {
        const required = new Intl.PluralRules(locale, {
          type: node.pluralType ?? "cardinal",
        }).resolvedOptions().pluralCategories;
        const missing = required.filter((c) => !(c in node.options));

        if (missing.length > 0) {
          report(
            `${where}: plural \`${node.value}\` has no ${missing.join(", ")} ` +
              `branch, which ${locale} needs (${required.join(", ")}).`,
          );
        }
      }

      if (node.type === TYPE.plural || node.type === TYPE.select) {
        for (const option of Object.values(node.options)) walk(option.value);
      } else if (node.type === TYPE.tag) {
        walk(node.children);
      }
    }
  };

  walk(ast);
}
