//------------------------------------------------------------------------------
// The runtime half of localization: what has to happen per email, because it
// depends on a value only known when the email is sent.
//
// These functions are written once and used twice. The preview calls them
// directly. The build embeds their *source* in every generated module (see
// RUNTIME_SOURCE), since the output must run with no MailGrail installed.
// So each one is self-contained -- no imports, and no free variables except
// `__mgFormatters` and each other, which RUNTIME_SOURCE also emits.
//
// Every value is tolerated: a missing or malformed one renders as something
// rather than throwing, which matches how the rest of the generated module
// treats missing params.
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// Intl formatters are costly to construct and cheap to reuse.
const __mgFormatters = new Map<string, any>();

//------------------------------------------------------------------------------
export function __mgFormatter(kind: string, locale: string, options: object): any {
  const key = kind + "\u0000" + locale + "\u0000" + JSON.stringify(options);
  let formatter = __mgFormatters.get(key);

  if (!formatter) {
    formatter =
      kind === "plural"
        ? new Intl.PluralRules(locale, options)
        : kind === "number"
          ? new Intl.NumberFormat(locale, options)
          : new Intl.DateTimeFormat(locale, options);
    __mgFormatters.set(key, formatter);
  }

  return formatter;
}

//------------------------------------------------------------------------------
// Picks one of the built locales for whatever the caller passed: a user
// preference, an Accept-Language value, nothing at all. Exact match first,
// then the RFC 4647 lookup (drop subtags from the end), then the default.
// It never throws -- an email in the default language beats no email.
//------------------------------------------------------------------------------
export function __mgResolveLocale(
  requested: unknown,
  locales: readonly string[],
  fallback: string,
): string {
  if (typeof requested !== "string" || requested === "") return fallback;

  const wanted = requested.split(",");

  for (const entry of wanted) {
    let tag = entry.split(";")[0]!.trim().replace(/_/g, "-");
    if (tag === "" || tag === "*") continue;

    try {
      tag = Intl.getCanonicalLocales(tag)[0]!;
    } catch {
      continue;
    }

    const parts = tag.split("-");
    for (let n = parts.length; n > 0; n--) {
      if (parts[n - 1]!.length === 1) continue;
      const candidate = parts.slice(0, n).join("-");
      if (locales.includes(candidate)) return candidate;
    }
  }

  return fallback;
}

//------------------------------------------------------------------------------
// An ICU plural, decided: exactly one arm key is set, so every engine can pick
// it with a plain section. Exact matches (`=0`) outrank categories, as in ICU.
// `n` is what `#` prints -- the number, formatted, less any offset.
//------------------------------------------------------------------------------
export function __mgPlural(
  locale: string,
  value: unknown,
  type: "cardinal" | "ordinal",
  offset: number,
  exact: readonly number[],
  categories: readonly string[],
): Record<string, unknown> {
  const n = typeof value === "number" ? value : Number(value);
  const out: Record<string, unknown> = {
    n: Number.isFinite(n) ? __mgFormatter("number", locale, {}).format(n - offset) : "",
  };

  const hit = exact.indexOf(n);
  if (hit !== -1) {
    out["x" + hit] = true;
    return out;
  }

  const category = Number.isFinite(n)
    ? __mgFormatter("plural", locale, { type }).select(n - offset)
    : "other";
  out[categories.includes(category) ? category : "other"] = true;
  return out;
}

//------------------------------------------------------------------------------
// An ICU select: arm `a<i>` for the i-th listed key, `other` for anything else.
// The keys are positional so an option -- "élève", say -- never has to be a
// valid Handlebars or Mustache path.
//------------------------------------------------------------------------------
export function __mgSelect(
  value: unknown,
  keys: readonly string[],
): Record<string, true> {
  const hit = value === undefined || value === null ? -1 : keys.indexOf(String(value));
  return hit === -1 ? { other: true } : { ["a" + hit]: true };
}

//------------------------------------------------------------------------------
export function __mgNumber(locale: string, value: unknown, options: object): string {
  const n = typeof value === "number" ? value : Number(value);
  if (value === "" || value === null || value === undefined || !Number.isFinite(n)) {
    return "";
  }
  return __mgFormatter("number", locale, options).format(n);
}

//------------------------------------------------------------------------------
// Dates arrive as a Date, an ISO string or epoch milliseconds. The time zone
// is always explicit: left to the server's, the same email would show a
// different day depending on where it was sent from.
//------------------------------------------------------------------------------
export function __mgDate(
  locale: string,
  timeZone: string,
  value: unknown,
  options: object,
): string {
  if (value === "" || value === null || value === undefined) return "";

  const date =
    value instanceof Date
      ? value
      : new Date(typeof value === "number" ? value : String(value));
  if (Number.isNaN(date.getTime())) return "";

  return __mgFormatter("date", locale, { ...options, timeZone }).format(date);
}

//------------------------------------------------------------------------------
// The source embedded in generated modules. Function#toString returns the
// compiled JavaScript, types already stripped by tsc.
//------------------------------------------------------------------------------
export const RUNTIME_SOURCE = [
  "const __mgFormatters = new Map();",
  __mgFormatter,
  __mgResolveLocale,
  __mgPlural,
  __mgSelect,
  __mgNumber,
  __mgDate,
]
  .map(String)
  .join("\n\n");
