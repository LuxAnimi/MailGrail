//------------------------------------------------------------------------------
// Locale tags, as the build sees them.
//
// Everything here runs at build time. The generated modules carry their own
// copy of the fallback rule (see emit-module.ts), since they must not import
// MailGrail when an email is sent.
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// BCP 47 canonical form, so "EN-us" and "en-US" name one set of templates. A
// tag Intl rejects ("en_US" among them) is a config error, not a locale that
// silently never matches.
//------------------------------------------------------------------------------
export function canonicalizeLocale(tag: string, what = "locale"): string {
  try {
    const [canonical] = Intl.getCanonicalLocales(tag);
    if (canonical) return canonical;
  } catch {
    // fall through to the error below
  }

  throw new Error(
    `${what} ${JSON.stringify(tag)} is not a valid BCP 47 language tag ` +
      `(expected something like "en", "fr-CA" or "zh-Hant").`,
  );
}

//------------------------------------------------------------------------------
export function canonicalizeLocales(tags: readonly string[]): string[] {
  const seen = new Set<string>();

  for (const tag of tags) {
    const canonical = canonicalizeLocale(tag, "locales entry");

    if (seen.has(canonical)) {
      throw new Error(
        `locales lists ${JSON.stringify(canonical)} more than once` +
          (canonical === tag ? "." : ` (as ${JSON.stringify(tag)}).`),
      );
    }

    seen.add(canonical);
  }

  return [...seen];
}

//------------------------------------------------------------------------------
// The tags to try, most specific first: "zh-Hant-TW" -> "zh-Hant" -> "zh".
// Truncation is the RFC 4647 lookup rule, which is what a caller passing a
// user's preference expects: a Québec user still gets French.
//------------------------------------------------------------------------------
export function fallbackChain(tag: string): string[] {
  const parts = tag.split("-");
  const chain: string[] = [];

  for (let n = parts.length; n > 0; n--) {
    // A lone single-letter subtag ("x" of a private use, "u" of an extension)
    // is never a tag on its own, so the truncation skips past it.
    if (parts[n - 1]!.length === 1) continue;
    chain.push(parts.slice(0, n).join("-"));
  }

  return chain;
}

//------------------------------------------------------------------------------
// Whether a locale is written right to left. `getTextInfo()` is the standard
// API but not in every Node this supports; older V8 exposed it as a `textInfo`
// getter. The list covers the scripts both of those would answer for.
//------------------------------------------------------------------------------
const RTL_LANGUAGES = new Set([
  "ar", "arc", "ckb", "dv", "fa", "he", "iw", "ks", "ku", "ps", "sd", "syr",
  "ug", "ur", "yi",
]);
const RTL_SCRIPTS = new Set(["Arab", "Hebr", "Thaa", "Syrc", "Nkoo", "Adlm"]);

export function textDirection(tag: string): "ltr" | "rtl" {
  const locale = new Intl.Locale(tag) as Intl.Locale & {
    getTextInfo?: () => { direction?: string };
    textInfo?: { direction?: string };
  };

  const info = locale.getTextInfo?.() ?? locale.textInfo;
  if (info?.direction === "rtl" || info?.direction === "ltr") {
    return info.direction;
  }

  // An explicit script outranks the language: "ku-Latn" is left to right.
  const script = locale.script ?? locale.maximize().script;
  if (script) return RTL_SCRIPTS.has(script) ? "rtl" : "ltr";

  return RTL_LANGUAGES.has(locale.language) ? "rtl" : "ltr";
}

//------------------------------------------------------------------------------
// A time zone the runtime does not know throws RangeError from the formatter,
// which is the only portable way to ask. The name is kept as written: Intl
// would resolve an alias ("America/Montreal" -> "America/Toronto"), which is
// the same zone but not what the user wrote in their config.
//------------------------------------------------------------------------------
export function assertTimeZone(zone: string): string {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return zone;
  } catch {
    throw new Error(
      `timeZone ${JSON.stringify(zone)} is not a time zone this Node knows ` +
        `(expected an IANA name like "UTC" or "America/Montreal").`,
    );
  }
}
