import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";
import ejs from "ejs";
import Handlebars from "handlebars";
import Mustache from "mustache";

import { createTemplateCompiler } from "../lib/src/cli/rendering/schema-rendering.js";

//------------------------------------------------------------------------------
// These run against the *built* output in lib/, so they also assert that the
// package compiles to something importable under plain Node ESM.
//
// The context emits opaque tokens; `substitute` swaps them for engine syntax.
// Block helpers return React nodes, so they are flattened first.
//------------------------------------------------------------------------------
const ENGINES = ["ejs", "handlebars", "mustache"];

function compile(engine, build) {
  const c = createTemplateCompiler({ engine, rootVar: "" });
  const node = build(c.ctx);
  const flat = typeof node === "string" ? node : renderToStaticMarkup(node);
  return c.substitute(flat);
}

describe("scalars", () => {
  const expected = {
    ejs: "<%= username %>",
    handlebars: "{{username}}",
    mustache: "{{username}}",
  };

  for (const engine of ENGINES) {
    test(engine, () => {
      assert.equal(compile(engine, (mg) => mg.render("username")), expected[engine]);
    });
  }

  test("dot paths are preserved", () => {
    assert.equal(compile("ejs", (mg) => mg.render("invoice.total")), "<%= invoice.total %>");
    assert.equal(compile("handlebars", (mg) => mg.render("invoice.total")), "{{invoice.total}}");
  });
});

describe("conditionals", () => {
  const when = (mg) => mg.when("isAdmin", () => "Y", () => "N");

  test("ejs", () => {
    assert.equal(compile("ejs", when), "<% if (isAdmin) { %>Y<% } else { %>N<% } %>");
  });
  test("handlebars", () => {
    assert.equal(compile("handlebars", when), "{{#if isAdmin}}Y{{else}}N{{/if}}");
  });
  test("mustache emulates else with an inverted section", () => {
    assert.equal(
      compile("mustache", when),
      "{{#isAdmin}}Y{{/isAdmin}}{{^isAdmin}}N{{/isAdmin}}",
    );
  });

  test("unless inverts", () => {
    const unless = (mg) => mg.unless("isVerified", () => "Y");
    assert.equal(compile("ejs", unless), "<% if (!(isVerified)) { %>Y<% } %>");
    assert.equal(compile("handlebars", unless), "{{#unless isVerified}}Y{{/unless}}");
    assert.equal(compile("mustache", unless), "{{^isVerified}}Y{{/isVerified}}");
  });
});

describe("each", () => {
  // Regression guard: block helpers used to concatenate their callback's
  // return value, so JSX children became the literal text "[object Object]".
  test("JSX children survive instead of becoming [object Object]", () => {
    const out = compile("handlebars", (mg) =>
      mg.each("items", (item) => ({
        type: "b",
        key: null,
        ref: null,
        props: { children: item.render("name") },
        $$typeof: Symbol.for("react.transitional.element"),
      })),
    );
    assert.ok(!out.includes("object Object"), out);
    assert.equal(out, "{{#each items}}<b>{{name}}</b>{{/each}}");
  });

  // Regression guard: the item context used to clobber `render` with the
  // primitive (zero-arg) form, so `item.render("name")` emitted the whole item.
  test("array of objects addresses fields, not the item", () => {
    assert.equal(
      compile("handlebars", (mg) => mg.each("items", (i) => i.render("name"))),
      "{{#each items}}{{name}}{{/each}}",
    );
    assert.equal(
      compile("mustache", (mg) => mg.each("items", (i) => i.render("name"))),
      "{{#items}}{{name}}{{/items}}",
    );
    assert.match(
      compile("ejs", (mg) => mg.each("items", (i) => i.render("name"))),
      /<%= __item\d+\.name %>/,
    );
  });

  test("array of primitives renders the item itself", () => {
    assert.equal(
      compile("handlebars", (mg) => mg.each("tags", (t) => t.render())),
      "{{#each tags}}{{this}}{{/each}}",
    );
    assert.equal(
      compile("mustache", (mg) => mg.each("tags", (t) => t.render())),
      "{{#tags}}{{.}}{{/tags}}",
    );
  });

  test("nested arrays iterate the current item", () => {
    assert.equal(
      compile("handlebars", (mg) => mg.each("grid", (row) => row.each((c) => c.render()))),
      "{{#each grid}}{{#each this}}{{this}}{{/each}}{{/each}}",
    );
  });

  test("item.when stays available on object items", () => {
    assert.equal(
      compile("handlebars", (mg) => mg.each("orders", (o) => o.when("isPaid", () => "paid"))),
      "{{#each orders}}{{#if isPaid}}paid{{/if}}{{/each}}",
    );
  });

  test("ejs guards against a missing array", () => {
    assert.match(compile("ejs", (mg) => mg.each("tags", (t) => t.render())), /\(tags \|\| \[\]\)/);
  });
});

describe("with", () => {
  test("scopes nested objects", () => {
    assert.equal(
      compile("handlebars", (mg) => mg.with("user", (u) => u.render("name"))),
      "{{#with user}}{{name}}{{/with}}",
    );
    assert.equal(
      compile("mustache", (mg) => mg.with("user", (u) => u.render("name"))),
      "{{#user}}{{name}}{{/user}}",
    );
    assert.match(
      compile("ejs", (mg) => mg.with("user", (u) => u.render("name"))),
      /const __scope\d+ = user; %><%= __scope\d+\.name %>/,
    );
  });
});

describe("prepareMjml", () => {
  // MJML discards bare text between structural components, but passes the
  // content of mj-text-like elements through as HTML -- where an <mj-raw>
  // would leak into the output. So markers are promoted only outside those.
  const build = (engine, fn) => {
    const c = createTemplateCompiler({ engine, rootVar: "" });
    const node = fn(c.ctx);
    return { c, flat: typeof node === "string" ? node : renderToStaticMarkup(node) };
  };

  test("block markers between components are wrapped in mj-raw", () => {
    const { c, flat } = build("handlebars", (mg) => mg.each("items", () => "X"));
    const mjml = c.prepareMjml(`<mj-column>${flat}</mj-column>`);
    assert.equal(
      c.substitute(mjml),
      "<mj-column><mj-raw>{{#each items}}</mj-raw>X<mj-raw>{{/each}}</mj-raw></mj-column>",
    );
  });

  test("block markers inside mj-text stay bare", () => {
    const { c, flat } = build("handlebars", (mg) => mg.each("items", () => "X"));
    const mjml = c.prepareMjml(`<mj-text>${flat}</mj-text>`);
    assert.equal(c.substitute(mjml), "<mj-text>{{#each items}}X{{/each}}</mj-text>");
  });

  test("value markers are never wrapped", () => {
    const { c, flat } = build("handlebars", (mg) => mg.render("username"));
    const mjml = c.prepareMjml(`<mj-column>${flat}</mj-column>`);
    assert.equal(c.substitute(mjml), "<mj-column>{{username}}</mj-column>");
  });

  test("markers inside attributes are never wrapped", () => {
    const { c, flat } = build("handlebars", (mg) => mg.render("url"));
    const mjml = c.prepareMjml(`<mj-button href="${flat}">go</mj-button>`);
    assert.equal(c.substitute(mjml), `<mj-button href="{{url}}">go</mj-button>`);
  });
});

//------------------------------------------------------------------------------
// Static text is written by the template author -- or, once it is translated,
// by whoever edits the catalog. A delimiter in it must print as itself rather
// than be evaluated against the params when the email is sent.
//------------------------------------------------------------------------------
describe("delimiters in static HTML", () => {
  const RUN = {
    ejs: (tmpl, data) => ejs.render(tmpl, data),
    handlebars: (tmpl, data) => Handlebars.compile(tmpl)(data),
    mustache: (tmpl, data) => Mustache.render(tmpl, data),
  };
  const data = { name: "<b>", secret: "LEAK" };

  for (const engine of ENGINES) {
    test(`${engine}: text and attributes are not evaluated`, () => {
      const html = compile(engine, (mg) =>
        h(
          "p",
          { title: "{{secret}} {{{secret}}} <%= secret %>" },
          "{{secret}} {{{secret}}} <%= secret %> ",
          mg.render("name"),
        ),
      );
      const out = RUN[engine](html, data);

      assert.ok(!out.includes("LEAK"), out);
      assert.ok(out.includes("&lt;b&gt;"), out);
    });

    test(`${engine}: a brace touching a value neither unescapes nor breaks it`, () => {
      const html = compile(engine, (mg) =>
        h("p", null, "{", mg.render("name"), "}"),
      );

      // The braces may come out as entities, which the mail client decodes.
      const shown = RUN[engine](html, data)
        .replace(/&#123;/g, "{")
        .replace(/&#125;/g, "}");

      assert.equal(shown, "<p>{&lt;b&gt;}</p>");
    });
  }

  test("CSS braces are left alone", () => {
    const css = ".a { color: red; }";
    assert.equal(compile("handlebars", () => css), css);
  });
});
