import path from "node:path";
import fs from "node:fs";
import type { Plugin } from "vite";

//------------------------------------------------------------------------------
import type { MailgrailResolvedConfig } from "../config/types.js";
import { catalogFile } from "../i18n/catalog-fs.js";

//------------------------------------------------------------------------------
// Serves the translation catalogs to the preview, as they are on disk.
//
// Only the raw JSON crosses over: the templates -- and so the source messages
// they register -- live in the browser, so that is where the catalogs are
// checked against them, with the same validateCatalogs() the build runs.
//------------------------------------------------------------------------------
const VIRTUAL_ID = "virtual:mailgrailcatalogs";
const RESOLVED_ID = "\0" + VIRTUAL_ID;

export function MailgrailCatalogsPlugin(config: MailgrailResolvedConfig): Plugin {
  const files = config.locales
    .filter((locale) => locale !== config.defaultLocale)
    .map((locale) => ({ locale, file: catalogFile(config.localesDir, locale) }));

  // A catalog that does not parse is reported in the preview rather than
  // taking the whole server down; fixing the file reloads it.
  const read = (file: string): { value: unknown } | { error: string } | null => {
    let text: string;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      return null;
    }
    try {
      return { value: JSON.parse(text) };
    } catch (err) {
      return { error: `${path.basename(file)} is not valid JSON: ${(err as Error).message}` };
    }
  };

  return {
    name: "mailgrail:catalogs",

    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },

    load(id) {
      if (id !== RESOLVED_ID) return;

      const catalogs: Record<string, unknown> = {};
      const errors: string[] = [];

      for (const { locale, file } of files) {
        // Watched even while missing, so creating the file reloads too.
        this.addWatchFile(file);

        const result = read(file);
        if (result && "error" in result) errors.push(result.error);
        catalogs[locale] = result && "value" in result ? result.value : null;
      }

      return `
export const locales = ${JSON.stringify(config.locales)};
export const defaultLocale = ${JSON.stringify(config.defaultLocale)};
export const timeZone = ${JSON.stringify(config.timeZone)};
export const strict = ${JSON.stringify(config.strictLocales)};
export const catalogs = ${JSON.stringify(catalogs)};
export const errors = ${JSON.stringify(errors)};
`;
    },

    handleHotUpdate(ctx) {
      if (!files.some(({ file }) => file === ctx.file)) return;

      const mod = ctx.server.moduleGraph.getModuleById(RESOLVED_ID);
      if (mod) {
        ctx.server.moduleGraph.invalidateModule(mod);
        return [mod];
      }
    },
  };
}
