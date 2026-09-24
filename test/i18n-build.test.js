import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildTemplates } from "../lib/src/cli/build-templates.js";
import { resolveConfig } from "../lib/src/config/resolveConfig.js";

//------------------------------------------------------------------------------
// The whole build, on a fixture project: esbuild loads the templates, MJML
// renders them once per locale, and the emitted modules are imported and run.
// The unit tests stop short of MJML; this is where `lang`/`dir`, and blocks
// inside <mj-text>, meet the real thing.
//------------------------------------------------------------------------------
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.join(HERE, "fixtures", "i18n-project");
const tmp = await fs.mkdtemp(path.join(HERE, ".tmp-i18n-build-"));
after(() => fs.rm(tmp, { recursive: true, force: true }));

const PARAMS = {
  name: "Zoé",
  ref: "A-42",
  count: 3,
  total: 1234.5,
  url: "https://shop.test/orders/A-42",
  lines: [
    { title: "Pen", qty: 1 },
    { title: "Ink", qty: 2 },
  ],
};

async function build(engine, overrides = {}) {
  const outputDir = path.join(tmp, engine);
  const config = resolveConfig(
    {
      sourceDir: "emails-src",
      outputDir,
      templatingEngine: engine,
      locales: ["en", "fr", "ar"],
      ...overrides,
    },
    path.join(PROJECT, "mailgrail.config.ts"),
    PROJECT,
  );

  const result = await buildTemplates(config);
  const index = await import(pathToFileURL(path.join(outputDir, "index.js")).href);
  return { result, index, outputDir };
}

//------------------------------------------------------------------------------
// Built one after another, up front: the message registry is process-wide, so
// builds running concurrently would clear it under each other.
const ENGINE_NAMES = ["EJS", "Handlebars", "Mustache"];
const builds = {};
for (const engine of ENGINE_NAMES) builds[engine] = await build(engine);

for (const engine of ENGINE_NAMES) {
  describe(engine, () => {
    const { result, index, outputDir } = builds[engine];

    test("renders every locale, with lang and dir on <html>", () => {
      const en = index.renderOrder(PARAMS);
      const fr = index.renderOrder(PARAMS, { locale: "fr-CA" });
      const ar = index.renderOrder(PARAMS, { locale: "ar" });

      assert.match(en.html, /<html lang="en" dir="ltr"/);
      assert.match(fr.html, /<html lang="fr" dir="ltr"/);
      assert.match(ar.html, /<html lang="ar" dir="rtl"/);

      assert.equal(en.subject, "Order A-42 confirmed");
      assert.equal(fr.subject, "Commande A-42 confirmée");
      assert.equal(fr.locale, "fr");

      assert.equal(
        fr.text,
        "Bonjour Zoé,\nVous avez commandé 3 articles.\nTotal : 1\u202f234,50\u00a0€",
      );
      assert.ok(en.html.includes("You ordered 3 items."), en.html);
      assert.ok(fr.html.includes("Écrivez-nous</a>"), fr.html);
      assert.ok(ar.html.includes("اتصل بنا</a>"), ar.html);
    });

    test("plural arms and loops survive MJML", () => {
      const one = index.renderOrder({ ...PARAMS, count: 1 });
      assert.ok(one.html.includes("You ordered 1 item."), one.html);
      assert.ok(!one.html.includes("items."), one.html);

      assert.ok(one.html.includes("Pen × 1"), one.html);
      assert.ok(one.html.includes("Ink × 2"), one.html);
    });

    test("a missing translation falls back to the default locale's text", () => {
      const ar = index.renderOrder(PARAMS, { locale: "ar" });
      assert.ok(ar.html.includes("Pen × 1"), ar.html);

      assert.match(result.warnings.join("\n"), /ar\.json is missing 1 translation: order\.line/);
      assert.deepEqual(result.coverage.get("ar"), { translated: 6, total: 7 });
    });

    test("the index and types expose the locales", async () => {
      assert.deepEqual(index.locales, ["en", "fr", "ar"]);
      assert.equal(index.defaultLocale, "en");
      assert.equal(index.resolveLocale("ar-EG"), "ar");

      const dts = await fs.readFile(path.join(outputDir, "order.d.ts"), "utf8");
      assert.match(dts, /export type Locale = "en" \| "fr" \| "ar";/);
      assert.match(dts, /options\?: RenderOptions/);

      const ext = { EJS: "ejs", Handlebars: "hbs", Mustache: "mustache" }[engine];
      for (const locale of ["en", "fr", "ar"]) {
        await fs.access(path.join(outputDir, `order.${locale}.${ext}`));
      }
    });
  });
}

//------------------------------------------------------------------------------
test("strictLocales turns the missing translation into an error", async () => {
  await assert.rejects(
    build("EJS", { strictLocales: true, outputDir: path.join(tmp, "strict") }),
    /ar\.json is missing 1 translation/,
  );
});
