//------------------------------------------------------------------------------
// The emitted modules: one per template, plus the index that ties them
// together, plus the package.json that tells Node how to read them.
//
// Pure string transforms, like ./emit-types.js -- no React, no mjml, no
// esbuild, nothing touching the filesystem.
//------------------------------------------------------------------------------
import type { TemplateDefinition } from "./types.js";
import type { EngineSpec, ModuleFormat } from "./engines.js";
import { emitLocaleType, emitNormalizer } from "./emit-types.js";
import type { TemplateEntry } from "./emit-types.js";
import type { Derivation } from "../i18n/icu.js";
import { __mgResolveLocale, RUNTIME_SOURCE } from "../i18n/runtime.js";

const RESOLVE_LOCALE_SOURCE = __mgResolveLocale;

//------------------------------------------------------------------------------
const importEngine = (spec: EngineSpec, format: ModuleFormat): string =>
  format === "cjs"
    ? `const ${spec.binding} = require(${JSON.stringify(spec.module)});`
    : `import ${spec.binding} from ${JSON.stringify(spec.module)};`;

//------------------------------------------------------------------------------
// CJS exports are written as plain `exports.x = x` assignments rather than an
// `Object.assign` or a re-exported object: that is the shape cjs-module-lexer
// recognises, which is what lets an ESM consumer do a named import from the
// CommonJS output.
//------------------------------------------------------------------------------
const exportNames = (names: string[], format: ModuleFormat): string =>
  format === "cjs"
    ? names.map((name) => `exports.${name} = ${name};`).join("\n")
    : `export { ${names.join(", ")} };`;

//------------------------------------------------------------------------------
const prologue = (format: ModuleFormat): string =>
  format === "cjs" ? `"use strict";\n\n` : "";

//------------------------------------------------------------------------------
export type LocalizedParts = {
  /** locale -> its compiled templates. */
  parts: Map<string, { html: string; text: string; subject: string }>;
  defaultLocale: string;
  timeZone: string;
  derivations: readonly Derivation[];
};

export function emitTemplateModule(
  args: {
    template: TemplateDefinition<any>;
    entry: TemplateEntry;
    spec: EngineSpec;
    format: ModuleFormat;
  } & (
    | { html: string; text: string; subject: string; localized?: undefined }
    | { localized: LocalizedParts }
  ),
): string {
  if (args.localized) return emitLocalizedModule({ ...args, localized: args.localized });

  const { template, entry, spec, format, html, text, subject } = args;

  // Left out, rather than emitted as `sender: undefined`, when the template has
  // none -- so the returned object matches its .d.ts (see emitDts).
  const sender =
    template.sender === undefined
      ? ""
      : `    sender: ${JSON.stringify(template.sender)},\n`;

  // ESM exports the declaration itself, which is what the output has looked
  // like since the first release. CommonJS assigns afterwards instead: a plain
  // `exports.x = x` is the shape cjs-module-lexer recognises, which is what
  // lets an ESM consumer still do a named import from it.
  const declaration = format === "cjs" ? "function " : "export function ";
  const moduleExport =
    format === "cjs" ? `\n${exportNames([entry.fnName], format)}\n` : "";

  // Each template is prepared once, when the module is first imported, rather
  // than on every call. Engines differ in how much that saves -- Handlebars was
  // re-compiling the whole document per render, EJS re-parsing it -- but none of
  // them should be doing it per message, and the template cannot change at
  // runtime, so there is nothing to invalidate.
  return `${prologue(format)}${importEngine(spec, format)}

const htmlTemplate = ${JSON.stringify(html)};
const textTemplate = ${JSON.stringify(text)};
const subjectTemplate = ${JSON.stringify(subject)};

${spec.precompile("renderHtml", "htmlTemplate")}
${spec.precompileText("renderText", "textTemplate")}
${spec.precompileText("renderSubject", "subjectTemplate")}

${emitNormalizer(template.params)}
${declaration}${entry.fnName}(input) {
  const params = normalizeParams(input);

  return {
    name: ${JSON.stringify(template.name)},
${sender}    subject: ${spec.render("renderSubject", "subjectTemplate")},
    text: ${spec.render("renderText", "textTemplate")},
    html: ${spec.render("renderHtml", "htmlTemplate")},
  };
}
${moduleExport}`;
}

//------------------------------------------------------------------------------
// A localized template: every locale's templates, and the runtime helpers its
// messages need (see i18n/runtime.ts), inlined like everything else so the
// module still runs with no MailGrail and no i18n library installed.
//------------------------------------------------------------------------------
function emitLocalizedModule(args: {
  template: TemplateDefinition<any>;
  entry: TemplateEntry;
  spec: EngineSpec;
  format: ModuleFormat;
  localized: LocalizedParts;
}): string {
  const { template, entry, spec, format, localized } = args;

  const sender =
    template.sender === undefined
      ? ""
      : `    sender: ${JSON.stringify(template.sender)},\n`;

  const declaration = format === "cjs" ? "function " : "export function ";
  const moduleExport =
    format === "cjs" ? `\n${exportNames([entry.fnName], format)}\n` : "";

  const table = [...localized.parts]
    .map(
      ([locale, { html, text, subject }]) =>
        `  ${JSON.stringify(locale)}: {\n` +
        `    html: ${JSON.stringify(html)},\n` +
        `    text: ${JSON.stringify(text)},\n` +
        `    subject: ${JSON.stringify(subject)},\n` +
        `  },`,
    )
    .join("\n");

  // Only the locales emails are actually sent in get prepared, each the first
  // time one is -- compiling every language up front would make importing the
  // module cost more the more languages it supports.
  return `${prologue(format)}${importEngine(spec, format)}

const TEMPLATES = {
${table}
};

const LOCALES = ${JSON.stringify([...localized.parts.keys()])};
const DEFAULT_LOCALE = ${JSON.stringify(localized.defaultLocale)};
const DEFAULT_TIME_ZONE = ${JSON.stringify(localized.timeZone)};

${RUNTIME_SOURCE}

const prepared = new Map();

function prepare(locale) {
  let render = prepared.get(locale);
  if (render) return render;

  const htmlTemplate = TEMPLATES[locale].html;
  const textTemplate = TEMPLATES[locale].text;
  const subjectTemplate = TEMPLATES[locale].subject;

  ${spec.precompile("renderHtml", "htmlTemplate")}
  ${spec.precompileText("renderText", "textTemplate")}
  ${spec.precompileText("renderSubject", "subjectTemplate")}

  render = (params) => ({
    subject: ${spec.render("renderSubject", "subjectTemplate")},
    text: ${spec.render("renderText", "textTemplate")},
    html: ${spec.render("renderHtml", "htmlTemplate")},
  });
  prepared.set(locale, render);
  return render;
}

${emitNormalizer(template.params, localized.derivations)}
${declaration}${entry.fnName}(input, options) {
  const locale = __mgResolveLocale(options?.locale, LOCALES, DEFAULT_LOCALE);
  const params = normalizeParams(input, locale, options?.timeZone ?? DEFAULT_TIME_ZONE);
  const out = prepare(locale)(params);

  return {
    name: ${JSON.stringify(template.name)},
    locale,
${sender}    // A subject is one header line; a line break in a param would end it.
    subject: out.subject.replace(/[\\r\\n]+/g, " "),
    text: out.text,
    html: out.html,
  };
}
${moduleExport}`;
}

//------------------------------------------------------------------------------
// The index exists so a backend does not have to hand-write the mapping from a
// template name to its render function -- the naming rule is MailGrail's, and
// restating it in application code is exactly the sort of thing that goes stale
// when a template is renamed.
//------------------------------------------------------------------------------
export function emitIndexJs(
  entries: TemplateEntry[],
  format: ModuleFormat,
  locales: readonly string[] | null = null,
  defaultLocale?: string,
): string {
  const imports = entries
    .map((entry) =>
      format === "cjs"
        ? `const { ${entry.fnName} } = require("./${entry.file}.js");`
        : `import { ${entry.fnName} } from "./${entry.file}.js";`,
    )
    .join("\n");

  const map = entries
    .map((entry) => `  ${JSON.stringify(entry.name)}: ${entry.fnName},`)
    .join("\n");

  const templates = `Object.freeze({\n${map}\n})`;

  const localeExports =
    locales === null
      ? ""
      : `
const locales = Object.freeze(${JSON.stringify(locales)});
const defaultLocale = ${JSON.stringify(defaultLocale)};

// What every render function does with its \`locale\` option, for callers
// that want to know the outcome up front -- to store it, or to pick a sender.
${String(RESOLVE_LOCALE_SOURCE)}

function resolveLocale(requested) {
  return __mgResolveLocale(requested, locales, defaultLocale);
}

${exportNames(["locales", "defaultLocale", "resolveLocale"], format)}
`;

  return `${prologue(format)}${imports}

${exportNames(
  entries.map((entry) => entry.fnName),
  format,
)}

${
  format === "cjs"
    ? `exports.templates = ${templates};`
    : `export const templates = ${templates};`
}
${localeExports}`;
}

//------------------------------------------------------------------------------
// One declaration file for both formats: TypeScript reads the module kind from
// the package `type` beside it, which is what `outputPackageJson` writes.
//------------------------------------------------------------------------------
export function emitIndexDts(
  entries: TemplateEntry[],
  locales: readonly string[] | null = null,
): string {
  const imports = entries
    .map(
      (entry) =>
        `import { ${entry.fnName}, type ${entry.typeName} } from "./${entry.file}.js";`,
    )
    .join("\n");

  const map = entries
    .map(
      (entry) =>
        `  readonly ${JSON.stringify(entry.name)}: typeof ${entry.fnName};`,
    )
    .join("\n");

  return `${imports}

export { ${entries.map((entry) => entry.fnName).join(", ")} };
export type { ${entries.map((entry) => entry.typeName).join(", ")} };

export declare const templates: {
${map}
};

export type TemplateName = keyof typeof templates;
${
  locales === null
    ? ""
    : `
${emitLocaleType(locales)}

export declare const locales: readonly Locale[];
export declare const defaultLocale: Locale;
/** The built locale a render call would use for \`requested\`. */
export declare function resolveLocale(requested: string | undefined): Locale;
`
}`;
}

//------------------------------------------------------------------------------
// What to do about a package.json that is already there.
//
// It is never rewritten -- a hand-written one is a decision already made -- but
// it decides how Node reads every file the build writes, so a `type` that
// contradicts the format is fatal: the modules would not load at all. A missing
// "." export only warns, since relative imports still work and files written by
// earlier versions have no "." at all.
//------------------------------------------------------------------------------
export function checkOutputPackageJson(args: {
  file: string;
  format: ModuleFormat;
  existing: Record<string, unknown>;
  expected: Record<string, unknown>;
}): string[] {
  const { file, format, existing, expected } = args;

  // Node treats a package.json with no `type` as CommonJS.
  const declared =
    typeof existing["type"] === "string" ? existing["type"] : undefined;
  const actual = declared ?? "commonjs";

  if (actual !== expected["type"]) {
    throw new Error(
      `${file} says "type": ${JSON.stringify(actual)}` +
        `${declared === undefined ? " (the default, since it has no type field)" : ""}` +
        `, but moduleFormat is ${JSON.stringify(format)}.\n` +
        `The emitted modules would not load. Set "type": ` +
        `${JSON.stringify(expected["type"])} there, or delete the file and ` +
        `build again.`,
    );
  }

  const exports = existing["exports"];
  const warnings: string[] = [];

  if (
    exports !== null &&
    typeof exports === "object" &&
    !Array.isArray(exports) &&
    (exports as Record<string, unknown>)["."] === undefined
  ) {
    const entry = (expected["exports"] as Record<string, unknown>)["."];

    warnings.push(
      `${file} has no "." export, so the generated index is reachable only ` +
        `by a relative import or as "<name>/index". Add:\n\n` +
        `  ".": ${JSON.stringify(entry)}`,
    );
  }

  return warnings;
}

//------------------------------------------------------------------------------
// The package.json written beside the output.
//
// `type` is what makes Node read the emitted files as the format they are in,
// whatever the enclosing project declares. The `exports` map is the
// non-obvious step between a successful build and importing the output as a
// package of its own: `"."` reaches the index, `"./*"` any single template.
// No `name` -- that is the project's call.
//------------------------------------------------------------------------------
export function outputPackageJson(
  format: ModuleFormat,
  typescript: boolean,
): Record<string, unknown> {
  const target = (js: string, dts: string) =>
    typescript ? { types: dts, default: js } : js;

  return {
    type: format === "cjs" ? "commonjs" : "module",
    exports: {
      ".": target("./index.js", "./index.d.ts"),
      "./*": target("./*.js", "./*.d.ts"),
    },
  };
}
