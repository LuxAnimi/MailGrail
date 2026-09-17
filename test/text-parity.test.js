import { test, describe } from "node:test";
import assert from "node:assert/strict";

import ejs from "ejs";
import Handlebars from "handlebars";
import Mustache from "mustache";

import {
  createTextTemplateCompiler,
  TEXT_COMPILE_OPTIONS,
} from "../lib/src/cli/rendering/schema-rendering.js";
import { makeTextPreviewContext } from "../lib/src/cli/rendering/schema-previewing.js";

//------------------------------------------------------------------------------
// The same contract the HTML side has in preview-parity.test.js: what the
// preview shows and what the built template renders must be identical, here
// for all three engines.
//
//   preview: the context substitutes real values as it builds the string
//   build:   the context emits a template, which the engine then renders
//
// Whitespace is the reason this file exists per engine. Handlebars and Mustache
// drop a line holding nothing but a block tag, which is invisible in HTML and
// reshapes a plain-text body.
//------------------------------------------------------------------------------
const RENDERERS = {
  ejs: (src, params) => ejs.render(src, params),
  handlebars: (src, params) =>
    Handlebars.compile(src, TEXT_COMPILE_OPTIONS.handlebars)(params),
  mustache: (src, params) => Mustache.render(src, params),
};

function assertParity(template, params, message) {
  const preview = template(makeTextPreviewContext(params));

  for (const [engine, render] of Object.entries(RENDERERS)) {
    const c = createTextTemplateCompiler({ engine });
    const source = c.substitute(template(c.ctx));

    assert.equal(render(source, params), preview, `${engine}: ${message ?? ""}`);
  }
}

describe("subject/text preview and build agree", () => {
  test("the full context API", () => {
    const template = (mg) =>
      [
        `u=${mg.render("username")}`,
        `nested=${mg.render("profile.city")}`,
        mg.when("isAdmin", () => "ADMIN", () => "USER"),
        mg.unless("isVerified", () => "UNVERIFIED", () => "VERIFIED"),
        mg.each("tags", (tag) => `[${tag.render()}]`),
        mg.each("items", (item) => `${item.render("name")}x${item.render("qty")}`),
        mg.with("profile", (p) => `${p.render("city")},${p.render("country")}`),
      ].join(" ");

    assertParity(template, {
      username: "Alice",
      isAdmin: true,
      isVerified: false,
      tags: ["billing", "urgent"],
      items: [
        { name: "Widget", qty: 2 },
        { name: "Gadget", qty: 1 },
      ],
      profile: { city: "Montreal", country: "Canada" },
    });
  });

  // Regression guard: Handlebars and Mustache silently removed these lines, so
  // the built text lost blank lines the preview showed.
  test("multi-line blocks keep their newlines", () => {
    const template = (mg) =>
      `Hi ${mg.render("username")}\n` +
      mg.when("isPro", () => "\nYou are on Pro.\n", () => "\nYou are on free.\n") +
      `\nBye\n`;

    assertParity(template, { username: "Alice", isPro: true }, "pro");
    assertParity(template, { username: "Alice", isPro: false }, "free");
  });

  test("when/unless agree on truthiness", () => {
    const template = (mg) => mg.when("nickname", () => "has", () => "none");

    for (const nickname of ["Al", "", "0"]) {
      assertParity(template, { nickname }, `nickname=${JSON.stringify(nickname)}`);
    }
  });

  // Plain text, so the engines' escaping must be off: an apostrophe in a name
  // would otherwise ship as &#39; in the subject line.
  test("values are not HTML-escaped", () => {
    const template = (mg) => `Hi ${mg.render("username")} <${mg.render("email")}>`;

    assertParity(template, {
      username: `A & B "quoted" O'Hara <tag>`,
      email: "a&b@example.com",
    });
  });

  test("literal delimiters in static text survive", () => {
    // Mustache has no escape for `{{`, and that is a build error rather than a
    // parity difference, so it is covered in text-rendering.test.js.
    const template = (mg) => `50% <% off, ${mg.render("code")}`;
    const params = { code: "SAVE50" };

    const preview = template(makeTextPreviewContext(params));

    for (const engine of ["ejs", "handlebars"]) {
      const c = createTextTemplateCompiler({ engine });
      const source = c.substitute(template(c.ctx));
      assert.equal(RENDERERS[engine](source, params), preview, engine);
    }
  });
});
