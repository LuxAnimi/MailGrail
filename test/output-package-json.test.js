import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  checkOutputPackageJson,
  outputPackageJson,
} from "../lib/src/cli/emit-module.js";

//------------------------------------------------------------------------------
// The package.json beside the compiled output is written once and never
// rewritten, so everything after that first build is a check: the file decides
// how Node reads the emitted modules, and the two disagreeing is the difference
// between a working import and "require is not defined in ES module scope".
//------------------------------------------------------------------------------
const check = (existing, format = "esm") =>
  checkOutputPackageJson({
    file: "emails-dist/package.json",
    format,
    existing,
    expected: outputPackageJson(format, true),
  });

describe("checkOutputPackageJson", () => {
  test("the file the build would have written is accepted", () => {
    assert.deepEqual(check(outputPackageJson("esm", true)), []);
    assert.deepEqual(check(outputPackageJson("cjs", true), "cjs"), []);
  });

  test("a type that contradicts the format fails the build", () => {
    assert.throws(() => check({ type: "commonjs" }, "esm"), {
      message: /says "type": "commonjs".*moduleFormat is "esm"/s,
    });

    assert.throws(() => check({ type: "module" }, "cjs"), {
      message: /Set "type": "commonjs" there, or delete the file/s,
    });
  });

  // Node's own default, and the reason a hand-written file can break an ESM
  // build without ever mentioning "commonjs".
  test("a missing type field counts as commonjs", () => {
    assert.throws(() => check({}, "esm"), {
      message: /the default, since it has no type field/,
    });

    assert.deepEqual(check({}, "cjs"), []);
  });

  // Every file written by 0.1.x looks like this.
  test("warns, but does not fail, when exports has no \".\"", () => {
    const warnings = check({
      type: "module",
      exports: { "./*": { types: "./*.d.ts", default: "./*.js" } },
    });

    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /no "\." export/);
    assert.match(warnings[0], /"\.": \{"types":"\.\/index\.d\.ts","default":"\.\/index\.js"\}/);
  });

  test("no warning when the entry is already there", () => {
    assert.deepEqual(
      check({ type: "module", exports: { ".": "./index.js" } }),
      [],
    );
  });

  test("no warning when the file declares no exports at all", () => {
    assert.deepEqual(check({ type: "module" }), []);
    assert.deepEqual(check({ type: "module", exports: null }), []);
  });
});
