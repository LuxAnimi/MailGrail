import path from "node:path";
import fs from "node:fs/promises";

//------------------------------------------------------------------------------
import { CatalogError, validateCatalogs } from "./catalog.js";
import type { CatalogOptions, CatalogResult, RawCatalogs } from "./catalog.js";
import type { RegisteredMessage } from "./messages.js";

//------------------------------------------------------------------------------
export function catalogFile(localesDir: string, locale: string): string {
  return path.join(localesDir, `${locale}.json`);
}

//------------------------------------------------------------------------------
// The default locale's file, when there is one, is the generated source
// catalog `extract` writes for translation platforms; the source of truth is
// the code, so it is not read.
//------------------------------------------------------------------------------
export async function readCatalogs(
  localesDir: string,
  opts: CatalogOptions,
): Promise<RawCatalogs> {
  const raw: RawCatalogs = new Map();

  for (const locale of opts.locales) {
    if (locale === opts.defaultLocale) continue;

    const file = catalogFile(localesDir, locale);
    let text: string;

    try {
      text = await fs.readFile(file, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      raw.set(locale, null);
      continue;
    }

    try {
      raw.set(locale, JSON.parse(text));
    } catch (err) {
      throw new CatalogError([
        `${file} is not valid JSON: ${(err as Error).message}`,
      ]);
    }
  }

  return raw;
}

//------------------------------------------------------------------------------
export async function loadCatalogs(
  localesDir: string,
  sources: RegisteredMessage[],
  opts: CatalogOptions,
): Promise<CatalogResult> {
  return validateCatalogs(sources, await readCatalogs(localesDir, opts), opts);
}

