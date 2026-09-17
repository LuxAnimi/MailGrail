import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  OUTPUT_DIR,
  SKIP,
  SOURCE_DIR,
  createFixtureProject,
  npm,
} from "./helpers/tarball-project.js";

//------------------------------------------------------------------------------
// The same package against React 18.
//
// The build renders templates with the project's React, so this suite exists to
// keep the supported range honest rather than declared. That the preview app
// ships no React of its own is checked on the bundle, in preview-bundle.test.js.
//------------------------------------------------------------------------------

let projectDir;

describe("published tarball, React 18", { skip: SKIP, timeout: 600_000 }, () => {
  before(() => {
    projectDir = createFixtureProject({ reactMajor: 18 });
  });

  after(() => {
    if (projectDir) fs.rmSync(projectDir, { recursive: true, force: true });
  });

  test("the project really is on React 18", () => {
    const version = (name) =>
      JSON.parse(
        fs.readFileSync(
          path.join(projectDir, "node_modules", name, "package.json"),
          "utf8",
        ),
      ).version;

    assert.match(version("react"), /^18\./);
    assert.match(version("react-dom"), /^18\./);
  });

  test("`mailgrail build` succeeds", () => {
    npm(["exec", "--", "mailgrail", "build"], projectDir);

    const out = path.join(projectDir, OUTPUT_DIR);
    for (const f of ["welcome-email.js", "welcome-email.d.ts", "index.js"]) {
      assert.ok(fs.existsSync(path.join(out, f)), `missing ${f}`);
    }
  });

  test("the compiled output renders under plain Node", async () => {
    const mod = await import(
      pathToFileURL(path.join(projectDir, OUTPUT_DIR, "welcome-email.js")).href
    );

    const email = mod.renderWelcomeEmail({
      username: "Alice",
      isAdmin: true,
      items: [{ name: "Widget" }],
    });

    assert.equal(email.subject, "Welcome, Alice!");
    assert.match(email.html, /Alice/);
    assert.match(email.html, /Widget/);
    assert.match(email.text, /You are an admin\./);
  });

  test("templates typecheck against @types/react 18", () => {
    fs.writeFileSync(
      path.join(projectDir, "tsconfig.json"),
      JSON.stringify(
        {
          // The same shape the scaffolder writes into sourceDir: templates are
          // loaded by esbuild, which resolves extensionless relative imports,
          // and NodeNext would reject the very entry point mailgrail reads.
          compilerOptions: {
            module: "ESNext",
            moduleResolution: "Bundler",
            target: "ES2022",
            jsx: "react-jsx",
            strict: true,
            noEmit: true,
            skipLibCheck: true,
          },
          include: [`${SOURCE_DIR}/**/*.ts`, `${SOURCE_DIR}/**/*.tsx`],
        },
        null,
        2,
      ),
    );

    npm(["exec", "--", "tsc", "--noEmit", "-p", "tsconfig.json"], projectDir);
  });
});
