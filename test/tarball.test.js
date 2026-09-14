import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

//------------------------------------------------------------------------------
// Packs the real tarball and installs it into a throwaway project.
//
// This is the only place the install-shaped failures are visible: running from
// the repo hides missing runtime dependencies, unresolvable published `.d.ts`
// specifiers, and anything that assumes a default `sourceDir`.
//
// Set MAILGRAIL_SKIP_TARBALL_TEST=1 to skip (it runs a real `npm install`).
//------------------------------------------------------------------------------
const SKIP = process.env.MAILGRAIL_SKIP_TARBALL_TEST === "1";
const repoRoot = path.resolve(import.meta.dirname, "..");

// A deliberately non-default source directory: `templates`, not `emails`.
const SOURCE_DIR = "templates";
const OUTPUT_DIR = "out";

let projectDir;

// `npm publish --dry-run` exports its own flags to lifecycle scripts as
// npm_config_*, so the `npm pack` below inherits dry-run: it still reports a
// filename in its JSON but writes no tarball, and the install then fails on a
// file that never existed. Standalone `npm test` is unaffected, which is what
// makes it confusing -- the suite only breaks when run through a publish, which
// is precisely when you are relying on it.
const npm = (args, cwd) => {
  const env = { ...process.env };
  delete env["npm_config_dry_run"];
  return execFileSync("npm", args, { cwd, encoding: "utf8", stdio: "pipe", env });
};

function writeFixture(dir, engine) {
  fs.mkdirSync(path.join(dir, SOURCE_DIR), { recursive: true });

  fs.writeFileSync(
    path.join(dir, "mailgrail.config.ts"),
    `import { defineConfig } from "@luxanimi/mailgrail";

export default defineConfig({
  sourceDir: ${JSON.stringify(SOURCE_DIR)},
  outputDir: ${JSON.stringify(OUTPUT_DIR)},
  templatingEngine: ${JSON.stringify(engine)},
  previewPort: 7913,
});
`,
  );

  fs.writeFileSync(
    path.join(dir, SOURCE_DIR, "WelcomeEmail.tsx"),
    `import type { ReactElement } from "react";
import { Mjml, MjmlBody, MjmlSection, MjmlColumn, MjmlText } from "@faire/mjml-react";
import { t, type TemplateDefinition, type RenderTemplateContext } from "@luxanimi/mailgrail";
import type { Infer } from "@luxanimi/mailgrail/dsl";

const paramsSchema = t.object({
  username: t.string(),
  isAdmin: t.boolean(),
  items: t.array(t.object({ name: t.string() })),
});

type Params = Infer<typeof paramsSchema>;

const htmlTemplate = (mg: RenderTemplateContext<Params>): ReactElement => (
  <Mjml>
    <MjmlBody>
      <MjmlSection>
        <MjmlColumn>
          <MjmlText>Welcome, {mg.render("username")}!</MjmlText>
          {mg.when("isAdmin", () => (
            <MjmlText>You are an admin</MjmlText>
          ))}
          {mg.each("items", (item) => (
            <MjmlText>{item.render("name")}</MjmlText>
          ))}
        </MjmlColumn>
      </MjmlSection>
    </MjmlBody>
  </Mjml>
);

export const WelcomeEmail: TemplateDefinition<typeof paramsSchema> = {
  name: "welcome-email",
  sender: "hello@example.com",
  params: paramsSchema,
  htmlTemplate,
  subjectTemplate: (params: Params) => \`Welcome, \${params.username}!\`,
  textTemplate: (params: Params) => \`Welcome, \${params.username}!\`,
};
`,
  );

  fs.writeFileSync(
    path.join(dir, SOURCE_DIR, "OptionsEmail.tsx"),
    `import type { ReactElement } from "react";
import { Mjml, MjmlBody, MjmlSection, MjmlColumn, MjmlText } from "@faire/mjml-react";
import { t, type TemplateDefinition, type RenderTemplateContext } from "@luxanimi/mailgrail";
import type { Infer } from "@luxanimi/mailgrail/dsl";

const paramsSchema = t.object({
  username: t.string(),
  nickname: t.optional(t.string()),
  role: t.default(t.string(), "user"),
  // the nested spelling must stay equivalent to the flat one
  team: t.default(t.optional(t.string()), "no team"),
});

type Params = Infer<typeof paramsSchema>;

const htmlTemplate = (mg: RenderTemplateContext<Params>): ReactElement => (
  <Mjml>
    <MjmlBody>
      <MjmlSection>
        <MjmlColumn>
          <MjmlText>
            [{mg.render("username")}][{mg.render("nickname")}][{mg.render("team")}][{mg.render("role")}]
          </MjmlText>
        </MjmlColumn>
      </MjmlSection>
    </MjmlBody>
  </Mjml>
);

export const OptionsEmail: TemplateDefinition<typeof paramsSchema> = {
  name: "options-email",
  sender: "hello@example.com",
  params: paramsSchema,
  htmlTemplate,
  subjectTemplate: (params: Params) => \`Hi \${params.username}\`,
  textTemplate: (params: Params) => \`Hi \${params.username}\`,
};
`,
  );

  fs.writeFileSync(
    path.join(dir, SOURCE_DIR, "index.ts"),
    `import type { TemplateDefinition } from "@luxanimi/mailgrail";
import type { Schema } from "@luxanimi/mailgrail/dsl";
import { WelcomeEmail } from "./WelcomeEmail";
import { OptionsEmail } from "./OptionsEmail";

export const templates: TemplateDefinition<Schema<any>>[] = [WelcomeEmail, OptionsEmail];
`,
  );
}

describe("published tarball", { skip: SKIP, timeout: 600_000 }, () => {
  before(() => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mailgrail-smoke-"));
    projectDir = tmp;

    // Pack the real thing. `npm pack` does not re-trigger prepublishOnly.
    const packed = JSON.parse(npm(["pack", "--json", "--pack-destination", tmp], repoRoot));
    const tarball = path.join(tmp, packed[0].filename);

    fs.writeFileSync(
      path.join(tmp, "package.json"),
      JSON.stringify({ name: "smoke-fixture", version: "1.0.0", private: true, type: "module" }, null, 2),
    );

    writeFixture(tmp, "EJS");

    npm(["install", tarball, "@faire/mjml-react@^4.0.0", "react@^19", "ejs@^5", "typescript@^6", "@types/react@^19"], tmp);
  });

  after(() => {
    if (projectDir) fs.rmSync(projectDir, { recursive: true, force: true });
  });

  test("`mailgrail build` succeeds with a non-default sourceDir", () => {
    npm(["exec", "--", "mailgrail", "build"], projectDir);

    const out = path.join(projectDir, OUTPUT_DIR);
    for (const f of ["welcome-email.ejs", "welcome-email.js", "welcome-email.d.ts"]) {
      assert.ok(fs.existsSync(path.join(out, f)), `missing ${f}`);
    }
  });

  test("no temp codegen file is left in the source directory", () => {
    const stray = fs
      .readdirSync(path.join(projectDir, SOURCE_DIR))
      .filter((f) => f.startsWith(".mailgrail"));
    assert.deepEqual(stray, []);
  });

  test("compiled output runs under plain Node, with no bundler", async () => {
    const mod = await import(
      pathToFileURL(path.join(projectDir, OUTPUT_DIR, "welcome-email.js")).href
    );

    const email = mod.renderWelcomeEmail({
      username: "Alice",
      isAdmin: true,
      items: [{ name: "Widget" }, { name: "Gadget" }],
    });

    assert.equal(email.name, "welcome-email");
    assert.equal(email.sender, "hello@example.com");
    assert.equal(email.subject, "Welcome, Alice!");
    assert.match(email.html, /Alice/);
    // the array-of-objects path must address the field, not the whole item
    assert.match(email.html, /Widget/);
    assert.match(email.html, /Gadget/);
  });

  // Regression guard: `t.boolean()` had no case in the type emitter and fell
  // through to `unknown`; nested object types were emitted unindented.
  test("generated .d.ts types every DSL kind correctly", () => {
    const dts = fs.readFileSync(
      path.join(projectDir, OUTPUT_DIR, "welcome-email.d.ts"),
      "utf8",
    );

    assert.match(dts, /isAdmin: boolean;/, "t.boolean() must not emit unknown");
    assert.ok(!dts.includes("unknown"), `unexpected 'unknown' in:\n${dts}`);

    // array of objects, indented one level in
    assert.match(dts, /items: \{\n {4}name: string;\n {2}\}\[\];/, dts);
  });

  test("optional and default are omittable on input", () => {
    const dts = fs.readFileSync(
      path.join(projectDir, OUTPUT_DIR, "options-email.d.ts"),
      "utf8",
    );

    assert.match(dts, /username: string;/); // required stays required
    assert.match(dts, /nickname\?: string;/); // optional
    assert.match(dts, /role\?: string;/); // default now implies optional input
    assert.match(dts, /team\?: string;/); // default(optional(...)) composes
  });

  test("published types resolve for a consumer", () => {
    fs.writeFileSync(
      path.join(projectDir, "consumer.ts"),
      `import { defineConfig, t } from "@luxanimi/mailgrail";
import type { Infer } from "@luxanimi/mailgrail/dsl";

const schema = t.object({ username: t.string() });
type P = Infer<typeof schema>;

export const check: P = { username: "alice" };
export const conf = defineConfig({ sourceDir: "templates" });
`,
    );

    fs.writeFileSync(
      path.join(projectDir, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            module: "NodeNext",
            moduleResolution: "NodeNext",
            target: "ES2022",
            jsx: "react-jsx",
            strict: true,
            noEmit: true,
            skipLibCheck: false,
          },
          include: ["consumer.ts", `${OUTPUT_DIR}/**/*.d.ts`],
        },
        null,
        2,
      ),
    );

    // skipLibCheck:false means an unresolvable specifier inside the shipped
    // .d.ts files fails here.
    npm(["exec", "--", "tsc", "--noEmit", "-p", "tsconfig.json"], projectDir);
  });

  test("`templatingEngine: Handlebars` changes extension, syntax and runtime", () => {
    writeFixture(projectDir, "Handlebars");
    npm(["install", "handlebars@^4"], projectDir);
    npm(["exec", "--", "mailgrail", "build"], projectDir);

    const out = path.join(projectDir, OUTPUT_DIR);
    assert.ok(fs.existsSync(path.join(out, "welcome-email.hbs")));

    const js = fs.readFileSync(path.join(out, "welcome-email.js"), "utf8");
    assert.match(js, /import Handlebars from "handlebars"/);
    assert.match(js, /Handlebars\.compile/);

    const hbs = fs.readFileSync(path.join(out, "welcome-email.hbs"), "utf8");
    assert.match(hbs, /\{\{username\}\}/);
    assert.match(hbs, /\{\{#each items\}\}/);
  });

  // Regression guard: the emitted module used to pass params straight to the
  // engine, so an omitted `t.optional` threw a ReferenceError under EJS and
  // `t.default` never applied its value.
  test("optional and default params are normalized", async () => {
    const mod = await import(
      pathToFileURL(path.join(projectDir, OUTPUT_DIR, "options-email.js")).href
    );

    const fields = (params) => {
      const m = mod.renderOptionsEmail(params).html.match(/\[([^\]]*)\]\[([^\]]*)\]\[([^\]]*)\]\[([^\]]*)\]/);
      assert.ok(m, "rendered html did not contain the marker row");
      return { username: m[1], nickname: m[2], team: m[3], role: m[4] };
    };

    assert.deepEqual(fields({ username: "Alice", nickname: "Al", team: "Core", role: "admin" }), {
      username: "Alice",
      nickname: "Al",
      team: "Core",
      role: "admin",
    });

    // omitting every non-required field must not throw
    assert.deepEqual(fields({ username: "Alice" }), {
      username: "Alice",
      nickname: "", // optional renders empty
      team: "no team", // default(optional(...)) composes to the same thing
      role: "user", // default supplies its value
    });
  });

  // Templating engines are optional peer dependencies, resolved from the
  // consumer's project by the *generated* module. A missing one must fail at
  // build time with an actionable message, not when an email is sent.
  test("a missing templating engine fails the build clearly", () => {
    const config = path.join(projectDir, "mailgrail.config.ts");
    const original = fs.readFileSync(config, "utf8");

    // Hide the package rather than `npm uninstall` it. npm 10 leaves handlebars
    // on disk to satisfy mailgrail's optional peer edge, so the uninstall
    // silently does nothing, the build succeeds and this test fails -- on CI
    // only, while passing locally on npm 11. A rename is unambiguous, offline
    // and instant.
    const installed = path.join(projectDir, "node_modules", "handlebars");
    const hidden = `${installed}.hidden`;
    fs.renameSync(installed, hidden);

    fs.writeFileSync(
      config,
      original.replace(/templatingEngine: "[A-Za-z]*"/, 'templatingEngine: "Handlebars"'),
    );

    try {
      let failed = false;
      let output = "";

      try {
        npm(["exec", "--", "mailgrail", "build"], projectDir);
      } catch (err) {
        failed = true;
        output = `${err.stdout ?? ""}${err.stderr ?? ""}`;
      }

      assert.ok(failed, "build should fail when the engine is missing");
      assert.match(output, /handlebars.*not installed/s);
      assert.match(output, /npm install handlebars/);
      // the actionable message must not be buried in a stack trace
      assert.ok(!/\bat \w+ \(/.test(output), `stack trace leaked:\n${output}`);
    } finally {
      fs.writeFileSync(config, original);
      fs.renameSync(hidden, installed);
    }
  });

  // Regression guard: `vite`/`@vitejs/plugin-react` used to be devDependencies,
  // so this crashed with ERR_MODULE_NOT_FOUND on a real install; and Vite's dep
  // scanner used to choke on the plugin-provided virtual modules.
  test("`mailgrail preview` serves the app and its virtual modules", async () => {
    const port = 7913;
    const child = spawn("npm", ["exec", "--", "mailgrail", "preview"], {
      cwd: projectDir,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let log = "";
    child.stdout.on("data", (d) => (log += d));
    child.stderr.on("data", (d) => (log += d));

    const get = async (url) => {
      try {
        return await fetch(url);
      } catch {
        return null;
      }
    };

    try {
      let index = null;
      for (let i = 0; i < 100 && !index; i++) {
        if (child.exitCode !== null) break;
        index = await get(`http://localhost:${port}/`);
        if (!index) await new Promise((r) => setTimeout(r, 200));
      }

      assert.ok(index, `preview server never came up. log:\n${log}`);
      assert.equal(index.status, 200);

      for (const id of ["virtual:mailgrailconfig", "virtual:mailgrailtemplates"]) {
        const res = await get(`http://localhost:${port}/@id/${id}`);
        assert.ok(res && res.status === 200, `${id} did not resolve`);
      }

      assert.ok(!/Could not resolve/.test(log), `vite reported a resolve error:\n${log}`);
    } finally {
      child.kill("SIGTERM");
    }
  });

  test("`typescript: false` suppresses .d.ts emission", () => {
    const conf = path.join(projectDir, "mailgrail.config.ts");
    fs.writeFileSync(
      conf,
      fs.readFileSync(conf, "utf8").replace("});", "  typescript: false,\n});"),
    );

    fs.rmSync(path.join(projectDir, OUTPUT_DIR), { recursive: true, force: true });
    npm(["exec", "--", "mailgrail", "build"], projectDir);

    const out = path.join(projectDir, OUTPUT_DIR);
    assert.ok(fs.existsSync(path.join(out, "welcome-email.js")));
    assert.ok(!fs.existsSync(path.join(out, "welcome-email.d.ts")));
  });
});
