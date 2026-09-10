import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";
import ejs from "ejs";

import { createTemplateCompiler } from "../lib/src/cli/rendering/schema-rendering.js";
import { makeTemplatePreviewContext } from "../lib/src/cli/rendering/schema-previewing.js";

//------------------------------------------------------------------------------
// Preview and build are two independent implementations of the same context
// contract, and they are only ever exercised separately -- which is exactly how
// the build path once shipped `[object Object]` while the preview looked fine.
//
// These tests run one template through both and require identical HTML:
//   preview: context substitutes real values as it renders
//   build:   context emits a template, which is then rendered with the engine
//------------------------------------------------------------------------------
function bothPaths(template, params) {
  const preview = renderToStaticMarkup(
    template(makeTemplatePreviewContext(params)),
  );

  const compiler = createTemplateCompiler({ engine: "ejs" });
  const source = compiler.substitute(
    renderToStaticMarkup(template(compiler.ctx)),
  );

  return { preview, built: ejs.render(source, params), source };
}

const assertParity = (template, params, message) => {
  const { preview, built } = bothPaths(template, params);
  assert.equal(preview, built, message);
};

describe("preview/build parity", () => {
  test("the full context API agrees", () => {
    const template = (mg) =>
      h(
        "div",
        null,
        h("p", null, "u=", mg.render("username")),
        h("p", null, "nested=", mg.render("profile.city")),
        mg.when("isAdmin", () => h("b", null, "ADMIN"), () => h("i", null, "USER")),
        mg.unless("isVerified", () => h("s", null, "UNVERIFIED")),
        h("ul", null, mg.each("tags", (tag, i) => h("li", { key: i }, tag.render()))),
        h("ol", null,
          mg.each("items", (item, i) =>
            h("li", { key: i },
              item.render("name"), "/", item.render("qty"),
              item.when("inStock", () => h("em", null, "yes"), () => h("em", null, "no"))))),
        mg.with("profile", (p) =>
          h("span", null, p.render("city"), ",", p.render("country"))),
        h("table", null,
          h("tbody", null,
            mg.each("grid", (row, i) =>
              h("tr", { key: i },
                row.each((cell, j) => h("td", { key: j }, cell.render())))))),
      );

    assertParity(template, {
      username: "Alice",
      isAdmin: true,
      isVerified: false,
      tags: ["red", "blue"],
      items: [
        { name: "Widget", qty: 2, inStock: true },
        { name: "Gadget", qty: 1, inStock: false },
      ],
      profile: { city: "Montreal", country: "Canada" },
      grid: [["a", "b"], ["c"]],
    });
  });

  // Regression guard: the preview used a strict `=== true`, while every engine
  // does a truthiness test.
  describe("conditionals use truthiness, like the engines", () => {
    const template = (mg) => h("div", null, mg.when("flag", () => "YES", () => "NO"));
    const inverse = (mg) => h("div", null, mg.unless("flag", () => "YES", () => "NO"));

    for (const flag of [true, false, 1, 0, "yes", "", null, undefined]) {
      test(`when: ${JSON.stringify(flag)}`, () => {
        assertParity(template, { flag });
      });
      test(`unless: ${JSON.stringify(flag)}`, () => {
        assertParity(inverse, { flag });
      });
    }
  });

  // Regression guard: the preview hid a `with` block whose object was absent,
  // while the build normalizes it to {} and still renders the block.
  test("with: an absent object still renders its block", () => {
    const template = (mg) =>
      h("div", null, mg.with("user", (u) => h("span", null, "[", u.render("name"), "]")));

    // Only the preview side is exercised here: this harness feeds raw params to
    // the engine, whereas the real generated module normalizes an absent object
    // to {} first. What matters is that the preview does not hide the block.
    const preview = renderToStaticMarkup(template(makeTemplatePreviewContext({})));
    assert.match(preview, /<span>/, "preview dropped markup the build emits");
  });

  test("each: an empty array renders nothing in both", () => {
    const template = (mg) =>
      h("div", null, mg.each("xs", (x, i) => h("i", { key: i }, x.render())));
    assertParity(template, { xs: [] });
  });
});
