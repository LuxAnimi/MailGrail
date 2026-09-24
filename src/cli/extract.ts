import { parseArgs } from "node:util";
import fs from "node:fs/promises";

//------------------------------------------------------------------------------
import { loadMailgrailConfig } from "../config/loadConfig.js";
import type { MailgrailResolvedConfig } from "../config/types.js";
import { catalogFile, readCatalogs } from "../i18n/catalog-fs.js";
import {
  assertNoMessageConflicts,
  clearRegisteredMessages,
  registeredMessages,
} from "../i18n/messages.js";
import type { RegisteredMessage } from "../i18n/messages.js";
import { loadTemplates } from "./build-templates.js";

//------------------------------------------------------------------------------
function parseExtractArgs(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      configPath: { type: "string" },
      prune: { type: "boolean", default: false },
    },
  });

  return { configPath: values.configPath, prune: values.prune ?? false };
}

//------------------------------------------------------------------------------
export interface ExtractReport {
  locale: string;
  added: number;
  pruned: number;
  untranslated: number;
  stale: number;
}

//------------------------------------------------------------------------------
export async function runExtract(argv: string[]) {
  const { configPath, prune } = parseExtractArgs(argv);
  const config = await loadMailgrailConfig(configPath);

  if (config.defaultLocale === null) {
    throw new Error(
      `extract needs \`locales\` in ${config.configPath}, ` +
        `e.g. locales: ["en", "fr"].`,
    );
  }

  clearRegisteredMessages();
  await loadTemplates(config.sourceDir);
  assertNoMessageConflicts();

  const reports = await extractCatalogs(config, registeredMessages(), prune);

  console.log(`Catalogs written to ${config.localesDir}`);
  for (const r of reports) {
    const parts = [
      `${r.added} added`,
      `${r.untranslated} untranslated`,
      prune ? `${r.pruned} pruned` : `${r.stale} stale`,
    ];
    console.log(`  ${r.locale.padEnd(10)} ${parts.join(", ")}`);
  }
}

//------------------------------------------------------------------------------
// Writes the source catalog for the default locale, and brings every other
// catalog in line with it: a new message is added as "" (untranslated), an
// existing translation is never touched, and a message that no longer exists
// is only removed with --prune -- a key renamed in code would otherwise throw
// its translations away without anyone deciding to.
//------------------------------------------------------------------------------
export async function extractCatalogs(
  config: MailgrailResolvedConfig,
  sources: RegisteredMessage[],
  prune: boolean,
): Promise<ExtractReport[]> {
  const defaultLocale = config.defaultLocale!;
  const ids = new Set(sources.map((s) => s.id));

  // Read everything before writing anything, so a malformed catalog stops
  // the command with every file as it was.
  const raw = await readCatalogs(config.localesDir, {
    locales: config.locales,
    defaultLocale,
    strict: false,
  });

  await fs.mkdir(config.localesDir, { recursive: true });

  await writeCatalog(
    catalogFile(config.localesDir, defaultLocale),
    Object.fromEntries(sources.map((s) => [s.id, s.defaultMessage])),
  );

  const reports: ExtractReport[] = [];

  for (const locale of config.locales) {
    if (locale === defaultLocale) continue;

    const existing = raw.get(locale) ?? {};
    if (typeof existing !== "object" || Array.isArray(existing)) {
      throw new Error(
        `${catalogFile(config.localesDir, locale)} must be a JSON object.`,
      );
    }

    const entries = { ...(existing as Record<string, unknown>) };
    const report: ExtractReport = {
      locale,
      added: 0,
      pruned: 0,
      untranslated: 0,
      stale: 0,
    };

    for (const id of ids) {
      if (!(id in entries)) {
        entries[id] = "";
        report.added++;
      }
      if (entries[id] === "") report.untranslated++;
    }

    for (const id of Object.keys(entries)) {
      if (ids.has(id)) continue;
      if (prune) {
        delete entries[id];
        report.pruned++;
      } else {
        report.stale++;
      }
    }

    await writeCatalog(catalogFile(config.localesDir, locale), entries);
    reports.push(report);
  }

  return reports;
}

//------------------------------------------------------------------------------
// Sorted keys and a trailing newline, so a catalog diffs cleanly whether it was
// last written by this command, an editor, or a translation platform's sync.
//------------------------------------------------------------------------------
async function writeCatalog(file: string, entries: Record<string, unknown>) {
  const sorted = Object.fromEntries(
    Object.entries(entries).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
  await fs.writeFile(file, JSON.stringify(sorted, null, 2) + "\n", "utf8");
}
