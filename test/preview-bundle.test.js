import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

//------------------------------------------------------------------------------
// The preview app is prebuilt and shipped in the tarball, then served by Vite
// from inside node_modules. It renders the *project's* templates, so it must
// not carry a React of its own: a bundled React 19 rejects elements made by a
// project's React 18, and the preview goes blank with nothing useful said.
//
// These assertions are about the shipped artifact, so they need `npm run
// build:app` to have run. CI builds before testing.
//------------------------------------------------------------------------------
const bundle = path.resolve(import.meta.dirname, "../dist-src/index.js");
const missing = !fs.existsSync(bundle);

describe("preview app bundle", { skip: missing && "run npm run build:app first" }, () => {
  const src = missing ? "" : fs.readFileSync(bundle, "utf8");

  test("React is imported, not inlined", () => {
    assert.match(src, /from\s*"react"/);
    assert.match(src, /from\s*"react-dom\/client"/);
    assert.match(src, /from\s*"react-dom\/server"/);
  });

  test("no React internals are bundled", () => {
    // These appear in React's own source and nowhere else.
    assert.doesNotMatch(src, /react\.transitional\.element/);
    assert.doesNotMatch(src, /Objects are not valid as a React child/);
  });

  // mjml-browser has no React in it, and pinning it to mailgrail's own mjml
  // keeps the preview and the build rendering the same MJML.
  test("mjml-browser stays bundled", () => {
    assert.doesNotMatch(src, /from\s*"mjml-browser"/);
  });
});
