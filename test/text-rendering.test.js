import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  createTextTemplateCompiler,
  findLeakedTokens,
} from "../lib/src/cli/rendering/schema-rendering.js";

//------------------------------------------------------------------------------
// The subject and text bodies compile through the same context as the HTML, in
// a mode that composes strings. Two things separate it from the HTML mode and
// both are asserted here: nothing is escaped, because this is plain text, and
// the static text around the values is part of the template, so a delimiter
// someone typed has to survive as itself.
//------------------------------------------------------------------------------
const ENGINES = ["ejs", "handlebars", "mustache"];

const WS = "{{&__mailgrail_ws}}";

function compile(engine, build) {
  const c = createTextTemplateCompiler({ engine });
  return c.substitute(build(c.ctx));
}

describe("text mode: values", () => {
  const expected = {
    ejs: "<%- username %>",
    handlebars: "{{{username}}}",
    mustache: "{{& username}}",
  };

  for (const engine of ENGINES) {
    test(`${engine} emits unescaped syntax`, () => {
      assert.equal(compile(engine, (mg) => mg.render("username")), expected[engine]);
    });
  }

  test("dot paths are preserved", () => {
    assert.equal(compile("ejs", (mg) => mg.render("invoice.total")), "<%- invoice.total %>");
  });

  // Regression guard: the current item ignored the unescaped flag, so a list of
  // strings came out HTML-escaped in a plain-text body.
  test("primitive items are unescaped too", () => {
    assert.match(compile("ejs", (mg) => mg.each("tags", (t) => t.render())), /<%- __item\d+ %>/);
    assert.match(compile("handlebars", (mg) => mg.each("tags", (t) => t.render())), /\{\{\{this\}\}\}/);
    assert.match(compile("mustache", (mg) => mg.each("tags", (t) => t.render())), /\{\{& \.\}\}/);
  });
});

describe("text mode: blocks", () => {
  const when = (mg) => mg.when("isAdmin", () => "Y", () => "N");

  test("ejs", () => {
    assert.equal(compile("ejs", when), "<% if (isAdmin) { %>Y<% } else { %>N<% } %>");
  });

  test("handlebars", () => {
    assert.equal(compile("handlebars", when), "{{#if isAdmin}}Y{{else}}N{{/if}}");
  });

  // Mustache has no `ignoreStandalone`, so every block tag is preceded by a
  // variable tag: the line is no longer standalone and keeps its newline.
  test("mustache block tags carry the standalone sentinel", () => {
    assert.equal(
      compile("mustache", when),
      `${WS}{{#isAdmin}}Y${WS}{{/isAdmin}}{{^isAdmin}}N${WS}{{/isAdmin}}`,
    );
  });

  test("a callback that returns something other than a string throws", () => {
    for (const engine of ENGINES) {
      assert.throws(
        () => compile(engine, (mg) => mg.when("isAdmin", () => 42)),
        /compose plain strings/,
      );
      assert.throws(
        () => compile(engine, (mg) => mg.when("isAdmin", () => undefined)),
        /returned nothing/,
      );
    }
  });
});

describe("text mode: literal delimiters in static text", () => {
  test("ejs escapes an opening tag", () => {
    assert.equal(compile("ejs", (mg) => `50% <% off ${mg.render("code")}`), "50% <%% off <%- code %>");
  });

  test("handlebars escapes braces", () => {
    assert.equal(compile("handlebars", (mg) => `{{literal}} ${mg.render("code")}`), "\\{{literal}} {{{code}}}");
  });

  // A static run ending in a backslash would otherwise escape the tag that
  // follows, printing `{{{code}}}` instead of the value.
  test("handlebars keeps a trailing backslash from escaping the value", () => {
    assert.equal(compile("handlebars", (mg) => `path\\${mg.render("code")}`), "path\\\\{{{code}}}");
  });

  test("mustache has no escape, so it fails loudly", () => {
    assert.throws(
      () => compile("mustache", (mg) => `{{literal}} ${mg.render("code")}`),
      /no escape for a literal/,
    );
  });
});

describe("findLeakedTokens", () => {
  test("catches a token whose case was changed", () => {
    assert.equal(findLeakedTokens("HELLO MAILGRAILX0XTOKEN"), "MAILGRAILX0XTOKEN");
  });

  // The word itself is not a token: the example templates say "join mailgrail".
  test("does not fire on the word mailgrail", () => {
    assert.equal(findLeakedTokens("Alice invited you to join mailgrail"), null);
  });

  test("clean output passes", () => {
    assert.equal(findLeakedTokens("Welcome, <%- username %>!"), null);
  });
});
