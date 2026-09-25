//------------------------------------------------------------------------------
// Render the brand mark as PNGs for the example email templates
//
// Email clients cannot be trusted with SVG (Gmail and Outlook drop it), and an
// <img> in an email needs an absolute URL. So the example templates load these
// PNGs from the deployed site, which publishes website/public as-is:
//
//   https://luxanimi.github.io/MailGrail/logo/email/mailgrail-dark.png
//   https://luxanimi.github.io/MailGrail/logo/email/mailgrail-light.png
//
// At email sizes the construction lines of mailgrail.svg vanish and its strokes
// turn to hairlines, so this keeps only the envelope and the grail, crops to
// them and thickens the strokes. Each variant is painted on a solid background
// rather than transparent: a dark-mode client that recolours the email around
// the image cannot then leave the lines on a background they were not drawn for.
//
// One-off asset pipeline, NOT part of the site build -- it needs librsvg's
// `rsvg-convert` on PATH. Re-run it only when mailgrail.svg changes:
//
//   node website/scripts/email-logo.mjs
//------------------------------------------------------------------------------
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const logoDir = path.resolve(here, "../public/logo");
const outDir = path.join(logoDir, "email");

// The envelope and the grail both sit within 224..1184 of the 1408 viewBox.
const VIEWBOX = "144 144 1120 1120";
const STROKE_WIDTH = 36;
// Twice the size the templates show it at, for high-density screens.
const SIZE = 112;

const VARIANTS = [
  // The header's dark band (theme colors.bg.ground).
  { name: "dark", background: "#0a0a0a", envelope: "#D7DADD", grail: "#FFC840" },
  // The white body, where the footer sits. The light envelope would disappear
  // on it, and the brand yellow is too faint, so both are darkened.
  { name: "light", background: "#ffffff", envelope: "#404040", grail: "#D9A000" },
];

const source = readFileSync(path.join(logoDir, "mailgrail.svg"), "utf8");

mkdirSync(outDir, { recursive: true });
for (const v of VARIANTS) {
  const svg = source
    .replace(/viewBox="[^"]*"/, `viewBox="${VIEWBOX}"`)
    .replace(/stroke-width="[^"]*"/, `stroke-width="${STROKE_WIDTH}"`)
    .replace(/<g id="mg-construction"[\s\S]*?<\/g>\s*/, "")
    .replace("var(--logo-envelope, #D7DADD)", v.envelope)
    .replace("var(--logo-grail, #FFC840)", v.grail);

  const out = path.join(outDir, `mailgrail-${v.name}.png`);
  execFileSync(
    "rsvg-convert",
    ["-w", String(SIZE), "-h", String(SIZE), "-b", v.background, "-o", out],
    { input: svg },
  );
  console.log(`wrote ${path.relative(process.cwd(), out)}`);
}
