//------------------------------------------------------------------------------
// Extract the layered brand mark from src/preview-app/assets/mailgrail.ai
//
// The .ai is a PDF-compatible Illustrator file. Page 1 is the dark artwork,
// page 2 the light variant; both are the same geometry. This turns page 1 into
// a small, layered SVG whose colours are driven by CSS custom properties.
//
// One-off asset pipeline, NOT part of the site build -- it needs poppler's
// `pdftocairo` on PATH. Re-run it only when the .ai changes:
//
//   node website/scripts/extract-logo.mjs
//
// Two things the naive extraction gets wrong, both handled below:
//
//   1. Paint order. The gold `#FFC840` *filled* path is a thick backing outline
//      tracing envelope + grail. In the source it sits under a raster glow and
//      reads as a halo. Emitted last, it paints straight over the white
//      envelope and silently destroys the two-tone mark. It is dropped here and
//      reproduced in CSS with a radial-gradient, which also saves ~4 KB.
//   2. Colour. pdftocairo writes `rgb(84.313965%, ...)`; those are converted to
//      hex so the layers can be recoloured through `var(--logo-*)`.
//------------------------------------------------------------------------------
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");

const SOURCE = path.join(repo, "src/preview-app/assets/mailgrail.ai");
const OUT = path.join(repo, "website/public/logo/mailgrail.svg");

// Layer assignment by stroke colour, in paint order.
const LAYERS = [
  { id: "mg-construction", hex: "#414142", varName: "--logo-construction" },
  { id: "mg-envelope", hex: "#D7DADD", varName: "--logo-envelope" },
  { id: "mg-grail", hex: "#FFC840", varName: "--logo-grail" },
];

const GROUND = "#231F20"; // background rect in the source; not part of the mark

const pctToHex = (value) => {
  const m = /rgb\(([\d.]+)%,\s*([\d.]+)%,\s*([\d.]+)%\)/.exec(value ?? "");
  if (!m) return null;
  const channel = (p) =>
    Math.round((Number(p) * 255) / 100)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return `#${channel(m[1])}${channel(m[2])}${channel(m[3])}`;
};

const attr = (tag, name) => {
  const m = new RegExp(`\\b${name}="([^"]*)"`).exec(tag);
  return m ? m[1] : null;
};

//------------------------------------------------------------------------------
const tmp = mkdtempSync(path.join(tmpdir(), "mailgrail-logo-"));

try {
  const svgPath = path.join(tmp, "page1.svg");
  execFileSync("pdftocairo", ["-svg", "-f", "1", "-l", "1", SOURCE, svgPath]);

  const raw = readFileSync(svgPath, "utf8");

  // clipPath children are geometry, not artwork -- they carry clip-rule.
  const buckets = new Map(LAYERS.map((l) => [l.id, []]));
  let dropped = 0;

  for (const tag of raw.match(/<path\b[^>]*\/>/g) ?? []) {
    if (attr(tag, "clip-rule")) continue;

    const d = attr(tag, "d");
    if (!d) continue;

    const stroke = pctToHex(attr(tag, "stroke"));
    const fillRaw = attr(tag, "fill");
    const fill = fillRaw && fillRaw !== "none" ? pctToHex(fillRaw) : null;

    if (fill === GROUND) continue; // background plate
    if (fill && !stroke) {
      dropped++; // the gold backing shape -- see note 1 above
      continue;
    }

    const layer = LAYERS.find((l) => l.hex === stroke);
    if (!layer) continue;

    const transform = attr(tag, "transform");
    const parts = [`d="${d.replace(/\s+/g, " ").trim()}"`];
    if (transform) parts.push(`transform="${transform}"`);
    buckets.get(layer.id).push(`      <path ${parts.join(" ")}/>`);
  }

  const body = LAYERS.map(
    (l) =>
      `    <g id="${l.id}" stroke="var(${l.varName}, ${l.hex})">\n` +
      `${buckets.get(l.id).join("\n")}\n` +
      `    </g>`,
  ).join("\n");

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1408 1408" fill="none"\n` +
    `     stroke-width="12" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="10"\n` +
    `     role="img" aria-label="mailgrail">\n` +
    `${body}\n` +
    `</svg>\n`;

  writeFileSync(OUT, svg, "utf8");

  const counts = LAYERS.map(
    (l) => `${l.id}=${buckets.get(l.id).length}`,
  ).join(" ");
  console.log(`wrote ${path.relative(repo, OUT)} (${svg.length} bytes)`);
  console.log(`  ${counts}  dropped-backing=${dropped}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
