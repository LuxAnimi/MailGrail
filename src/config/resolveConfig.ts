import path from "path";

//------------------------------------------------------------------------------
import type {
  MailgrailConfig,
  MailgrailResolvedConfig,
} from "./types.js";
import {
  assertTimeZone,
  canonicalizeLocale,
  canonicalizeLocales,
} from "../i18n/locale.js";

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
export function resolveConfig(
  userConfig: Partial<MailgrailConfig>,
  configPath: string,
  baseDir: string,
): MailgrailResolvedConfig {
  const sourceDir = path.resolve(baseDir, userConfig.sourceDir ?? "./emails-src");
  const { locales, defaultLocale } = resolveLocales(userConfig);

  const resolvedConf: MailgrailResolvedConfig = {
    ...userConfig,
    baseDir: baseDir,
    sourceDir,
    outputDir: path.resolve(baseDir, userConfig.outputDir ?? "./emails-dist"),
    configPath: configPath,
    previewPort: userConfig.previewPort ?? 7777,
    templatingEngine: userConfig.templatingEngine ?? "EJS",
    moduleFormat: userConfig.moduleFormat ?? "esm",
    typescript: userConfig.typescript ?? true,
    hideAppLogo: userConfig.hideAppLogo ?? false,
    hideAppName: userConfig.hideAppName ?? false,
    hideAppDescription: userConfig.hideAppDescription ?? false,
    // null means "use the project's package.json", see readProjectInfo.
    appName: userConfig.appName ?? null,
    appDescription: userConfig.appDescription ?? null,
    locales,
    defaultLocale,
    localesDir: userConfig.localesDir
      ? path.resolve(baseDir, userConfig.localesDir)
      : path.join(sourceDir, "locales"),
    strictLocales: userConfig.strictLocales ?? false,
    timeZone: assertTimeZone(userConfig.timeZone ?? "UTC"),
  };

  return resolvedConf;
}

//------------------------------------------------------------------------------
// Tags are canonicalized here, once, so every later comparison -- catalog file
// names, the fallback chain, the emitted `Locale` union -- is between canonical
// forms.
//------------------------------------------------------------------------------
function resolveLocales(userConfig: Partial<MailgrailConfig>): {
  locales: string[];
  defaultLocale: string | null;
} {
  const locales = canonicalizeLocales(userConfig.locales ?? []);

  if (locales.length === 0) {
    if (userConfig.defaultLocale !== undefined) {
      throw new Error(
        `defaultLocale is set but locales is empty. List the locales to ` +
          `build, e.g. locales: [${JSON.stringify(userConfig.defaultLocale)}].`,
      );
    }
    return { locales, defaultLocale: null };
  }

  const defaultLocale =
    userConfig.defaultLocale === undefined
      ? locales[0]!
      : canonicalizeLocale(userConfig.defaultLocale, "defaultLocale");

  if (!locales.includes(defaultLocale)) {
    throw new Error(
      `defaultLocale ${JSON.stringify(defaultLocale)} is not one of locales ` +
        `(${locales.map((l) => JSON.stringify(l)).join(", ")}).`,
    );
  }

  return { locales, defaultLocale };
}
