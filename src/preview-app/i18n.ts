import { useMemo, useSyncExternalStore } from "react";
import * as initialCatalogs from "virtual:mailgrailcatalogs";

//------------------------------------------------------------------------------
import { CatalogError, validateCatalogs } from "@/i18n/catalog";
import { textDirection } from "@/i18n/locale";
import { registeredMessages } from "@/i18n/messages";
import { PSEUDO_LOCALE } from "@/i18n/pseudo";
import type { PreviewI18n } from "@/cli/rendering/schema-previewing";

//------------------------------------------------------------------------------
// The catalogs, as the server last read them. Editing one hot-reloads it, the
// same way editing a template does.
//------------------------------------------------------------------------------
type Catalogs = typeof initialCatalogs;

let current: Catalogs = initialCatalogs;
const listeners = new Set<() => void>();

function useCatalogs(): Catalogs {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}

if (import.meta.hot) {
  import.meta.hot.accept("virtual:mailgrailcatalogs", (mod) => {
    if (!mod) return;
    current = mod as unknown as Catalogs;
    for (const l of listeners) l();
  });
}

//------------------------------------------------------------------------------
export interface LocaleOption {
  value: string;
  label: string;
}

export interface PreviewLocales {
  options: LocaleOption[];
  defaultLocale: string;
  /** The context settings for one option. */
  resolve: (value: string) => PreviewI18n;
  /** Problems that stop a translation from being used; it shows its source. */
  errors: string[];
  /** Problems the build only warns about (or fails on, with strictLocales). */
  warnings: string[];
  strict: boolean;
}

//------------------------------------------------------------------------------
// Checked here, in the browser, because this is where the templates -- and the
// source messages they register -- are loaded. Always leniently: a strict
// build would stop at the first missing translation, but a preview that shows
// the rest, with the gaps marked, is more use while translating.
//
// `templates` is only a dependency: a template reload re-registers its
// messages, so the check has to run again.
//------------------------------------------------------------------------------
export function usePreviewLocales(templates: unknown): PreviewLocales | null {
  const catalogs = useCatalogs();

  return useMemo(() => {
    const { locales, defaultLocale, timeZone, strict } = catalogs;
    if (!defaultLocale || locales.length === 0) return null;

    const errors = [...catalogs.errors];
    let result: ReturnType<typeof validateCatalogs> | null = null;

    try {
      result = validateCatalogs(
        registeredMessages(),
        new Map(Object.entries(catalogs.catalogs)),
        { locales, defaultLocale, strict: false },
      );
    } catch (err) {
      if (err instanceof CatalogError) errors.push(...err.problems);
      else errors.push(err instanceof Error ? err.message : String(err));
    }

    const options: LocaleOption[] = [
      ...locales.map((locale) => {
        const coverage = result?.coverage.get(locale);
        const gap = coverage ? coverage.total - coverage.translated : 0;
        return {
          value: locale,
          label: gap > 0 ? `${locale} (${gap} missing)` : locale,
        };
      }),
      { value: PSEUDO_LOCALE, label: `${PSEUDO_LOCALE} (pseudo)` },
    ];

    const resolve = (value: string): PreviewI18n => {
      if (value === PSEUDO_LOCALE) {
        return {
          locale: defaultLocale,
          dir: textDirection(defaultLocale),
          timeZone,
          messages: result?.messages.get(defaultLocale),
          pseudo: true,
        };
      }

      return {
        locale: value,
        dir: textDirection(value),
        timeZone,
        messages: result?.messages.get(value),
        fallbacks: result?.fallbacks.get(value),
      };
    };

    return {
      options,
      defaultLocale,
      resolve,
      errors,
      warnings: result?.warnings ?? [],
      strict,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogs, templates]);
}
