//----------------------------------------------------------------------------
// Inline markdown for generated strings.
//
// The manifests hold prose with `code` spans and **emphasis**. Those strings
// reach components as data rather than through the MDX pipeline, so this
// renders the two inline forms actually used -- deliberately not a markdown
// parser, which would be a dependency and an injection surface for no gain.
//
// Everything is escaped first, so the output is safe to pass to set:html.
//----------------------------------------------------------------------------
const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function inlineMarkdown(source: string): string {
  return escapeHtml(source)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}
