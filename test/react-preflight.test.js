import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { assertReactPair } from "../lib/src/cli/react-preflight.js";

//------------------------------------------------------------------------------
// Fake node_modules trees. Nothing is installed or executed: the preflight only
// resolves package.json files and reads their versions.
//------------------------------------------------------------------------------
const roots = [];

function tree(packages, { under } = {}) {
  const root = under ?? fs.mkdtempSync(path.join(os.tmpdir(), "mailgrail-react-"));
  if (!under) roots.push(root);

  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "fixture", private: true }),
  );

  for (const [name, version] of Object.entries(packages)) {
    const dir = path.join(root, "node_modules", name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name, version, main: "index.js" }),
    );
    fs.writeFileSync(path.join(dir, "index.js"), "");
  }

  return root;
}

after(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
});

//------------------------------------------------------------------------------
describe("assertReactPair", () => {
  test("a matched pair is accepted and reported", () => {
    const project = tree({ react: "19.2.5", "react-dom": "19.2.5" });
    const pair = assertReactPair(project, project);

    assert.equal(pair.react.version, "19.2.5");
    assert.equal(pair.reactDom.version, "19.2.5");
  });

  test("React 18 is supported", () => {
    const project = tree({ react: "18.3.1", "react-dom": "18.3.1" });

    assert.equal(assertReactPair(project, project).react.version, "18.3.1");
  });

  // react-dom was never a declared dependency, so it could be missing entirely
  // while react was present.
  test("a missing react-dom fails with an install hint at the right major", () => {
    const project = tree({ react: "18.3.1" });

    assert.throws(() => assertReactPair(project, project), {
      message: /react-dom is not installed[\s\S]*npm install react-dom@\^18/,
    });
  });

  test("a missing react fails", () => {
    const project = tree({});

    assert.throws(() => assertReactPair(project, project), {
      message: /react is not installed/,
    });
  });

  test("mismatched majors fail", () => {
    const project = tree({ react: "19.2.5", "react-dom": "18.3.1" });

    assert.throws(() => assertReactPair(project, project), {
      message: /different major versions/,
    });
  });

  test("an unsupported major fails", () => {
    const project = tree({ react: "17.0.2", "react-dom": "17.0.2" });

    assert.throws(() => assertReactPair(project, project), {
      message: /not supported: mailgrail supports React 18 and 19/,
    });
  });

  // The failure this exists to prevent: two Reacts, where elements made by one
  // are silently rejected by the other's renderer.
  test("two copies fail, naming both paths", () => {
    const project = tree({ react: "19.2.5", "react-dom": "19.2.5" });
    const library = tree({ react: "19.2.5" });

    assert.throws(() => assertReactPair(project, library), {
      message: /Two copies of React are reachable/,
    });
  });

  // The normal installed layout: mailgrail sits inside the project's
  // node_modules, so it resolves the project's own copy.
  test("mailgrail installed inside the project shares its React", () => {
    const project = tree({ react: "19.2.5", "react-dom": "19.2.5" });
    const library = path.join(project, "node_modules", "@luxanimi", "mailgrail", "lib");
    fs.mkdirSync(library, { recursive: true });

    assert.doesNotThrow(() => assertReactPair(project, library));
  });
});
