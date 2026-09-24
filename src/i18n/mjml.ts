//------------------------------------------------------------------------------
// The language and direction of the document. MJML writes the root <mjml>'s
// `lang` and `dir` onto <html>, which is what screen readers, hyphenation and
// RTL layout in mail clients go by -- left unset they are "und" and "auto".
// The template's own attributes win, since they may be deliberate; a `lang`
// that contradicts the locale is still reported, as it is more often a
// hardcoded leftover from before the template was localized.
//------------------------------------------------------------------------------
export function applyLocaleToMjml(
  mjml: string,
  i18n: { locale: string; dir: "ltr" | "rtl" },
): { mjml: string; warning: string | null } {
  const ROOT_RE = /<mjml\b([^>]*)>/;
  const root = mjml.match(ROOT_RE);
  if (!root) return { mjml, warning: null };

  const attrs = root[1] ?? "";
  const lang = attrs.match(/\slang="([^"]*)"/)?.[1];

  let added = "";
  let warning: string | null = null;
  if (lang === undefined) added += ` lang="${i18n.locale}"`;
  else if (lang !== i18n.locale) {
    warning =
      `the <mjml> root sets lang="${lang}". ` +
      `Use lang={mg.locale} unless the whole document really is ${lang}.`;
  }
  if (!/\sdir="/.test(attrs)) added += ` dir="${i18n.dir}"`;

  return { mjml: mjml.replace(ROOT_RE, `<mjml${attrs}${added}>`), warning };
}
