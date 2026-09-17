import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { readProjectInfo } from "../lib/src/cli/project-info.js";

//------------------------------------------------------------------------------
const roots = [];

function project(contents, nested) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mailgrail-project-"));
  roots.push(root);

  if (contents !== null) {
    fs.writeFileSync(
      path.join(root, "package.json"),
      typeof contents === "string" ? contents : JSON.stringify(contents),
    );
  }

  if (nested) {
    const dir = path.join(root, nested.dir);
    fs.mkdirSync(dir, { recursive: true });

    if (nested.contents) {
      fs.writeFileSync(
        path.join(dir, "package.json"),
        JSON.stringify(nested.contents),
      );
    }

    return dir;
  }

  return root;
}

after(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
});

//------------------------------------------------------------------------------
describe("readProjectInfo", () => {
  test("reads the name and description", () => {
    const dir = project({ name: "acme-api", description: "Billing service" });

    assert.deepEqual(readProjectInfo(dir), {
      name: "acme-api",
      description: "Billing service",
    });
  });

  test("walks up when the directory has no package.json", () => {
    const dir = project({ name: "acme-api" }, { dir: "packages/emails" });

    assert.equal(readProjectInfo(dir).name, "acme-api");
  });

  // A monorepo package names itself; the workspace root is the wrong answer.
  test("the nearest package.json wins", () => {
    const dir = project(
      { name: "acme-monorepo" },
      { dir: "packages/api", contents: { name: "@acme/api" } },
    );

    assert.equal(readProjectInfo(dir).name, "@acme/api");
  });

  test("missing fields read as null", () => {
    const dir = project({ private: true });

    assert.deepEqual(readProjectInfo(dir), { name: null, description: null });
  });

  test("a non-string or empty name reads as null", () => {
    assert.equal(readProjectInfo(project({ name: 42 })).name, null);
    assert.equal(readProjectInfo(project({ name: "  " })).name, null);
  });

  // Stopping matters: a parent's name would be a confident wrong answer.
  test("a malformed package.json gives nothing, not the parent's name", () => {
    const dir = project({ name: "acme-monorepo" }, { dir: "packages/api" });
    fs.writeFileSync(path.join(dir, "package.json"), "{ not json");

    assert.deepEqual(readProjectInfo(dir), { name: null, description: null });
  });
});
