import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";

import { t } from "../lib/src/dsl/index.js";
import { ENGINES } from "../lib/src/cli/engines.js";
import { planTemplateEntries } from "../lib/src/cli/emit-types.js";
import { emitTemplateModule } from "../lib/src/cli/emit-module.js";
import {
  createTemplateCompiler,
  createTextTemplateCompiler,
} from "../lib/src/cli/rendering/schema-rendering.js";
import {
  makeTemplatePreviewContext,
  makeTextPreviewContext,
} from "../lib/src/cli/rendering/schema-previewing.js";
import { validateCatalogs } from "../lib/src/i18n/catalog.js";
import { Derivations } from "../lib/src/i18n/icu.js";
import { textDirection } from "../lib/src/i18n/locale.js";

//------------------------------------------------------------------------------
// End to end, short of MJML: each template is compiled once per locale, the
// real module is emitted, written next to this file (so it resolves the
// engines from the project), imported, and rendered. What these check is what
// ships: the engine output for a real email, in every engine.
//------------------------------------------------------------------------------
const ENGINE_NAMES = ["ejs", "handlebars", "mustache"];
const HERE = path.dirname(fileURLToPath(import.meta.url));
const tmp = await fs.mkdtemp(path.join(HERE, ".tmp-i18n-"));
after(() => fs.rm(tmp, { recursive: true, force: true }));

let serial = 0;

async function build(engine, template, { sources, catalogs, locales }) {
  const defaultLocale = locales[0];
  const { messages } = validateCatalogs(sources, new Map(Object.entries(catalogs)), {
    locales,
    defaultLocale,
    strict: false,
  });

  const derivations = new Derivations();
  const parts = new Map();

  for (const locale of locales) {
    const i18n = { locale, dir: textDirection(locale), messages: messages.get(locale), derivations };

    const html = createTemplateCompiler({ engine, i18n });
    const text = createTextTemplateCompiler({ engine, i18n });
    const subject = createTextTemplateCompiler({ engine, i18n });

    parts.set(locale, {
      html: html.substitute(renderToStaticMarkup(template.html(html.ctx))),
      text: text.substitute(template.text?.(text.ctx) ?? ""),
      subject: subject.substitute(template.subject?.(subject.ctx) ?? ""),
    });
  }

  const source = emitTemplateModule({
    template: { name: "test", params: template.params },
    entry: planTemplateEntries([{ name: "test" }])[0],
    spec: ENGINES[engine],
    format: "esm",
    localized: { parts, defaultLocale, timeZone: "UTC", derivations: derivations.list },
  });

  const file = path.join(tmp, `${engine}-${++serial}.mjs`);
  await fs.writeFile(file, source);
  const { renderTest } = await import(pathToFileURL(file).href);
  return renderTest;
}

const msg = (id, defaultMessage) => ({ id, defaultMessage });

// Mail clients decode entities, and engines disagree on which characters they
// escape and how (&#39; vs &#x27;), so compare what a reader would see.
const shown = (html) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;|&#34;|&#x22;/g, '"')
    .replace(/&#39;|&#x27;|&#x60;|&#96;/g, (m) => (m.includes("60") || m.includes("96") ? "`" : "'"))
    .replace(/&#x3D;|&#61;/g, "=")
    .replace(/&#x2F;|&#47;/g, "/")
    .replace(/&amp;/g, "&");

//------------------------------------------------------------------------------
for (const engine of ENGINE_NAMES) {
  describe(engine, () => {
    //--------------------------------------------------------------------------
    test("interpolation, per locale, escaped in HTML and not in text", async () => {
      const welcome = msg("c.welcome", "Welcome, {name}!");
      const render = await build(
        engine,
        {
          params: t.object({ name: t.string() }),
          html: (mg) => h("p", null, mg.t(welcome, { name: "name" })),
          text: (mg) => mg.t(welcome, { name: "name" }),
          subject: (mg) => mg.t(welcome, { name: "name" }),
        },
        {
          sources: [welcome],
          catalogs: { fr: { "c.welcome": "Bienvenue, {name} !" } },
          locales: ["en", "fr"],
        },
      );

      const en = render({ name: "<b>O'Brien</b>" });
      assert.equal(en.locale, "en");
      assert.ok(en.html.includes("&lt;b&gt;"), en.html);
      assert.equal(shown(en.html), "Welcome, <b>O'Brien</b>!");
      assert.equal(en.text, "Welcome, <b>O'Brien</b>!");

      const fr = render({ name: "Zoé" }, { locale: "fr" });
      assert.equal(fr.locale, "fr");
      assert.equal(fr.text, "Bienvenue, Zoé !");
      assert.equal(fr.subject, "Bienvenue, Zoé !");
    });

    //--------------------------------------------------------------------------
    test("locale resolution falls back and never throws", async () => {
      const hi = msg("c.hi", "Hi");
      const render = await build(
        engine,
        { params: t.object({}), html: (mg) => h("p", null, mg.t(hi)), text: (mg) => mg.t(hi) },
        {
          sources: [hi],
          catalogs: { fr: { "c.hi": "Salut" }, pl: { "c.hi": "Cześć" } },
          locales: ["en", "fr", "pl"],
        },
      );

      assert.equal(render({}, { locale: "fr-CA" }).locale, "fr");
      assert.equal(render({}, { locale: "FR_ca" }).locale, "fr");
      assert.equal(render({}, { locale: "de-DE,pl;q=0.8,fr;q=0.5" }).locale, "pl");
      assert.equal(render({}, { locale: "de" }).locale, "en");
      assert.equal(render({}, { locale: "not a tag" }).locale, "en");
      assert.equal(render({}).text, "Hi");
      assert.equal(render({}, { locale: "pl" }).text, "Cześć");
    });

    //--------------------------------------------------------------------------
    test("plurals follow each locale's rules, with exact matches first", async () => {
      const items = msg("c.items", "{count, plural, =0 {no items} one {# item} other {# items}}");
      const render = await build(
        engine,
        {
          params: t.object({ count: t.number() }),
          html: (mg) => h("p", null, mg.t(items, { count: "count" })),
          text: (mg) => mg.t(items, { count: "count" }),
        },
        {
          sources: [items],
          catalogs: {
            pl: {
              "c.items":
                "{count, plural, =0 {brak} one {# przedmiot} few {# przedmioty} many {# przedmiotów} other {# przedmiotu}}",
            },
            ar: {
              "c.items":
                "{count, plural, zero {لا عناصر} one {عنصر واحد} two {عنصران} few {# عناصر} many {# عنصرًا} other {# عنصر}}",
            },
          },
          locales: ["en", "pl", "ar"],
        },
      );

      const text = (count, locale) => render({ count }, { locale }).text;

      assert.equal(text(0, "en"), "no items");
      assert.equal(text(1, "en"), "1 item");
      assert.equal(text(1234, "en"), "1,234 items");

      assert.equal(text(0, "pl"), "brak");
      assert.equal(text(1, "pl"), "1 przedmiot");
      assert.equal(text(3, "pl"), "3 przedmioty");
      assert.equal(text(5, "pl"), "5 przedmiotów");
      assert.equal(text(22, "pl"), "22 przedmioty");
      assert.equal(text(1.5, "pl"), "1,5 przedmiotu");

      assert.equal(text(2, "ar"), "عنصران");
      // Which digits "ar" uses depends on the Node's CLDR version.
      const ar = (n) => new Intl.NumberFormat("ar").format(n);
      assert.equal(text(3, "ar"), `${ar(3)} عناصر`);
      assert.equal(text(11, "ar"), `${ar(11)} عنصرًا`);

      assert.equal(shown(render({ count: 5 }, { locale: "pl" }).html), "5 przedmiotów");
    });

    //--------------------------------------------------------------------------
    test("messages inside each and with read their own element's values", async () => {
      const line = msg("c.line", "{name}: {qty, plural, one {# unit} other {# units}}");
      const city = msg("c.city", "Ships to {city}");
      const render = await build(
        engine,
        {
          params: t.object({
            items: t.array(t.object({ name: t.string(), qty: t.number() })),
            address: t.object({ city: t.string() }),
          }),
          html: (mg) =>
            h(
              "div",
              null,
              mg.each("items", (item, i) =>
                h("p", { key: i }, item.t(line, { name: "name", qty: "qty" })),
              ),
              mg.with("address", (a) => h("p", null, a.t(city, { city: "city" }))),
            ),
          text: (mg) =>
            mg.each("items", (item) => item.t(line, { name: "name", qty: "qty" }) + ";"),
        },
        {
          sources: [line, city],
          catalogs: {
            fr: {
              "c.line": "{name} : {qty, plural, one {# unité} many {# d’unités} other {# unités}}",
              "c.city": "Livré à {city}",
            },
          },
          locales: ["en", "fr"],
        },
      );

      const params = {
        items: [
          { name: "Pen", qty: 1 },
          { name: "Ink", qty: 3 },
        ],
        address: { city: "Montréal" },
      };

      assert.equal(render(params).text, "Pen: 1 unit;Ink: 3 units;");
      assert.equal(render(params, { locale: "fr" }).text, "Pen : 1 unité;Ink : 3 unités;");
      assert.equal(
        shown(render(params, { locale: "fr" }).html),
        "Pen : 1 unitéInk : 3 unitésLivré à Montréal",
      );
    });

    //--------------------------------------------------------------------------
    test("select picks by value", async () => {
      const status = msg(
        "c.status",
        "{status, select, shipped {On its way} in_progress {Being packed} other {Received}}",
      );
      const render = await build(
        engine,
        {
          params: t.object({ status: t.string() }),
          html: (mg) => h("p", null, mg.t(status, { status: "status" })),
          text: (mg) => mg.t(status, { status: "status" }),
        },
        { sources: [status], catalogs: {}, locales: ["en"] },
      );

      assert.equal(render({ status: "shipped" }).text, "On its way");
      assert.equal(render({ status: "in_progress" }).text, "Being packed");
      assert.equal(render({ status: "lost" }).text, "Received");
    });

    //--------------------------------------------------------------------------
    test("rich-text tags wrap translated text in the template's markup", async () => {
      const terms = msg("c.terms", "Read our <link>terms</link>.");
      const render = await build(
        engine,
        {
          params: t.object({ url: t.string() }),
          html: (mg) =>
            h(
              "p",
              null,
              mg.t(terms, {
                link: (chunks) => h("a", { href: mg.render("url") }, chunks),
              }),
            ),
          text: (mg) =>
            mg.t(terms, { link: (chunks) => `${chunks} (${mg.render("url")})` }),
        },
        {
          sources: [terms],
          catalogs: { fr: { "c.terms": "Lisez nos <link>conditions</link>." } },
          locales: ["en", "fr"],
        },
      );

      const fr = render({ url: "https://x.test/?a=1&b=2" }, { locale: "fr" });
      assert.match(fr.html, /^<p>Lisez nos <a href="[^"]+">conditions<\/a>\.<\/p>$/);
      assert.equal(shown(fr.html.match(/href="([^"]+)"/)[1]), "https://x.test/?a=1&b=2");
      assert.equal(fr.text, "Lisez nos conditions (https://x.test/?a=1&b=2).");
    });

    //--------------------------------------------------------------------------
    test("a hostile translation stays text", async () => {
      const hi = msg("c.hi", "Hello {name}");
      const render = await build(
        engine,
        {
          params: t.object({ name: t.string(), secret: t.string() }),
          html: (mg) => h("p", null, mg.t(hi, { name: "name" })),
        },
        {
          sources: [hi],
          // Quoted, as ICU requires for literal tags and braces; unquoted, the
          // tag is a validation error and the braces a syntax error.
          catalogs: { fr: { "c.hi": "'<script>'x'</script>' '{{secret}}' '{{{secret}}}' <%= secret %> {name}" } },
          locales: ["en", "fr"],
        },
      );

      const out = render({ name: "N", secret: "LEAK" }, { locale: "fr" }).html;
      assert.ok(!out.includes("LEAK"), out);
      assert.ok(!out.includes("<script>"), out);
    });

    //--------------------------------------------------------------------------
    test("numbers and dates are formatted per locale, in an explicit time zone", async () => {
      const total = msg("c.total", "Total: {amount, number, ::currency/EUR}, due {due, date, long}");
      const render = await build(
        engine,
        {
          params: t.object({ amount: t.number(), due: t.date() }),
          html: (mg) => h("p", null, mg.t(total, { amount: "amount", due: "due" })),
          text: (mg) => mg.t(total, { amount: "amount", due: "due" }),
        },
        {
          sources: [total],
          catalogs: { fr: { "c.total": "Total : {amount, number, ::currency/EUR}, échéance le {due, date, long}" } },
          locales: ["en", "fr"],
        },
      );

      const params = { amount: 1234.5, due: "2026-03-01T02:00:00Z" };

      assert.equal(render(params).text, "Total: €1,234.50, due March 1, 2026");
      assert.equal(
        render(params, { locale: "fr" }).text,
        "Total : 1\u202f234,50\u00a0€, échéance le 1 mars 2026",
      );
      // 02:00 UTC is still the previous day in Montréal.
      assert.equal(
        render(params, { timeZone: "America/Montreal" }).text,
        "Total: €1,234.50, due February 28, 2026",
      );
      // A Date and epoch milliseconds work as well as an ISO string.
      assert.equal(render({ ...params, due: new Date(params.due) }).text, render(params).text);
      assert.equal(render({ ...params, due: Date.parse(params.due) }).text, render(params).text);
      // Missing values render as nothing rather than "NaN" or "Invalid Date".
      assert.equal(render({}).text, "Total: , due ");
      assert.equal(render({ amount: "x", due: "not a date" }).text, "Total: , due ");
    });

    //--------------------------------------------------------------------------
    test("a line break in a param cannot split the subject", async () => {
      const subject = msg("c.subject", "Order {ref}");
      const render = await build(
        engine,
        {
          params: t.object({ ref: t.string() }),
          html: () => h("p", null, "x"),
          subject: (mg) => mg.t(subject, { ref: "ref" }),
        },
        { sources: [subject], catalogs: {}, locales: ["en"] },
      );

      assert.equal(render({ ref: "42\r\nBcc: evil@x.test" }).subject, "Order 42 Bcc: evil@x.test");
    });
  });
}

//------------------------------------------------------------------------------
// The preview evaluates messages itself, with the same walk and the same
// runtime helpers; this holds it to what the built module renders.
//------------------------------------------------------------------------------
describe("preview/build parity for messages", async () => {
  const m = {
    hi: msg("p.hi", "Hi {name}, <b>welcome</b>!"),
    items: msg("p.items", "{count, plural, =0 {nothing} one {# thing} other {# things}}"),
    status: msg("p.status", "{status, select, paid {Paid} other {Pending}}"),
    total: msg("p.total", "{amount, number, ::currency/EUR} on {due, date, medium}"),
    line: msg("p.line", "{title}: {qty, plural, one {# unit} other {# units}}"),
  };
  const catalogs = {
    fr: {
      "p.hi": "Salut {name}, <b>bienvenue</b> !",
      "p.items": "{count, plural, =0 {rien} one {# chose} many {# de choses} other {# choses}}",
      "p.status": "{status, select, paid {Payé} other {En attente}}",
      "p.total": "{amount, number, ::currency/EUR} le {due, date, medium}",
      "p.line": "{title} : {qty, plural, one {# unité} many {# d’unités} other {# unités}}",
    },
  };
  const locales = ["en", "fr", "pl"];
  const sources = Object.values(m);
  const { messages } = validateCatalogs(sources, new Map(Object.entries(catalogs)), {
    locales,
    defaultLocale: "en",
    strict: false,
  });

  const html = (mg) =>
    h(
      "div",
      null,
      h("p", null, mg.t(m.hi, { name: "name", b: (c) => h("b", null, c) })),
      h("p", null, mg.t(m.items, { count: "count" })),
      h("p", null, mg.t(m.status, { status: "status" })),
      h("p", null, mg.t(m.total, { amount: "amount", due: "due" })),
      mg.each("lines", (line, i) => h("p", { key: i }, line.t(m.line, { title: "title", qty: "qty" }))),
    );
  const text = (mg) =>
    mg.t(m.items, { count: "count" }) + "|" + mg.t(m.total, { amount: "amount", due: "due" });

  const params = t.object({
    name: t.string(),
    count: t.number(),
    status: t.string(),
    amount: t.number(),
    due: t.date(),
    lines: t.array(t.object({ title: t.string(), qty: t.number() })),
  });
  const render = await build("ejs", { params, html, text }, { sources, catalogs, locales });

  const cases = [
    { name: "Ada", count: 0, status: "paid", amount: 9.5, due: "2026-01-31T12:00:00Z", lines: [] },
    { name: "Bo", count: 1, status: "x", amount: 1234567.891, due: "2026-07-04T00:30:00Z", lines: [{ title: "A", qty: 1 }] },
    { name: "Cy", count: 22, status: "paid", amount: 0, due: "2026-12-25T23:59:00Z", lines: [{ title: "B", qty: 5 }, { title: "C", qty: 2 }] },
  ];

  for (const locale of locales) {
    for (const [i, values] of cases.entries()) {
      test(`${locale} #${i}`, () => {
        const i18n = { locale, dir: "ltr", timeZone: "UTC", messages: messages.get(locale) };
        const built = render(values, { locale });

        assert.equal(renderToStaticMarkup(html(makeTemplatePreviewContext(values, i18n))), built.html);
        assert.equal(text(makeTextPreviewContext(values, i18n)), built.text);
      });
    }
  }
});

//------------------------------------------------------------------------------
describe("mg.t errors", () => {
  const compile = (template, i18n) => {
    const c = createTemplateCompiler({ engine: "ejs", i18n });
    return renderToStaticMarkup(template(c.ctx));
  };
  const i18n = () => ({ locale: "en", dir: "ltr", messages: new Map(), derivations: new Derivations() });

  test("without locales in the config", () => {
    assert.throws(() => compile((mg) => h("p", null, mg.t(msg("a.b", "x")))), /needs `locales`/);
  });

  test("a missing argument names the message and the argument", () => {
    assert.throws(
      () => compile((mg) => h("p", null, mg.t(msg("a.b", "Hi {name}"))), i18n()),
      /mg\.t\("a\.b"\) in en: the message uses \{name\}/,
    );
  });

  test("a tag without a function", () => {
    assert.throws(
      () => compile((mg) => h("p", null, mg.t(msg("a.b", "<b>x</b>"))), i18n()),
      /has a <b> tag/,
    );
  });

  test("param names the generated module uses are reserved", () => {
    assert.throws(() => t.object({ __mg_d1: t.string() }), /is reserved/);
  });

  test("locale and dir are exposed", () => {
    const c = createTemplateCompiler({ engine: "ejs", i18n: { ...i18n(), locale: "ar", dir: "rtl" } });
    assert.equal(c.ctx.locale, "ar");
    assert.equal(c.ctx.dir, "rtl");
    assert.equal(createTemplateCompiler({ engine: "ejs" }).ctx.locale, "und");
  });
});
