import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  OUTPUT_DIR,
  SKIP,
  SOURCE_DIR,
  createFixtureProject,
  npm,
  writeFixture,
} from "./helpers/tarball-project.js";

let projectDir;

describe("published tarball", { skip: SKIP, timeout: 600_000 }, () => {
  before(() => {
    projectDir = createFixtureProject();
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

  // Regression guard: a relative --configPath reached createRequire as a
  // relative path, which it rejects, so the build crashed before compiling.
  test("`--configPath` accepts a relative path", () => {
    fs.rmSync(path.join(projectDir, OUTPUT_DIR, "welcome-email.js"));
    npm(["exec", "--", "mailgrail", "build", "--configPath", "mailgrail.config.ts"], projectDir);
    assert.ok(fs.existsSync(path.join(projectDir, OUTPUT_DIR, "welcome-email.js")));
  });

  test("outputDir gets a package.json, and a hand-written one is kept", () => {
    const pkgPath = path.join(projectDir, OUTPUT_DIR, "package.json");
    const emitted = fs.readFileSync(pkgPath, "utf8");
    const pkg = JSON.parse(emitted);

    assert.equal(pkg.type, "module");
    assert.deepEqual(pkg.exports["."], { types: "./index.d.ts", default: "./index.js" });
    assert.deepEqual(pkg.exports["./*"], { types: "./*.d.ts", default: "./*.js" });

    const handWritten = JSON.stringify({ name: "@acme/emails", type: "module" });
    fs.writeFileSync(pkgPath, handWritten);
    try {
      npm(["exec", "--", "mailgrail", "build"], projectDir);
      assert.equal(fs.readFileSync(pkgPath, "utf8"), handWritten);
    } finally {
      fs.writeFileSync(pkgPath, emitted);
    }
  });

  // Regression guard: the .d.ts always declared `sender: string`, while a
  // template without one returned `sender: undefined` at runtime.
  test("sender is typed as what the module actually returns", async () => {
    const out = path.join(projectDir, OUTPUT_DIR);

    const welcome = fs.readFileSync(path.join(out, "welcome-email.d.ts"), "utf8");
    assert.match(welcome, /sender: "hello@example\.com";/);

    const options = fs.readFileSync(path.join(out, "options-email.d.ts"), "utf8");
    assert.doesNotMatch(options, /sender/);

    const mod = await import(pathToFileURL(path.join(out, "options-email.js")).href);
    assert.ok(!("sender" in mod.renderOptionsEmail({ username: "Alice" })));
  });

  // 0.2.0: subject and text compile through the render context, so a branch is
  // part of the emitted template rather than a decision made once at build
  // time. Before, both received placeholder strings and every branch was taken.
  test("subject and text compile branches and loops, not build-time results", async () => {
    const mod = await import(
      pathToFileURL(path.join(projectDir, OUTPUT_DIR, "welcome-email.js")).href
    );

    const admin = mod.renderWelcomeEmail({
      username: "Alice",
      isAdmin: true,
      items: [{ name: "Widget" }, { name: "Gadget" }],
    });
    const plain = mod.renderWelcomeEmail({
      username: "Bob",
      isAdmin: false,
      items: [],
    });

    // One compiled template, two different emails.
    assert.match(admin.text, /You are an admin\./);
    assert.doesNotMatch(plain.text, /You are an admin\./);
    assert.match(admin.text, /- Widget\n?- Gadget|- Widget[\s\S]*- Gadget/);
    assert.doesNotMatch(plain.text, /- /);
    assert.equal(plain.subject, "Welcome, Bob!");

    // And the template itself is engine syntax, not a rendered value.
    const source = fs.readFileSync(
      path.join(projectDir, OUTPUT_DIR, "welcome-email.js"),
      "utf8",
    );
    assert.match(source, /const textTemplate = ".*<% if \(isAdmin\)/);
  });

  test("the generated index re-exports every template and a typed map", async () => {
    const out = path.join(projectDir, OUTPUT_DIR);

    const mod = await import(pathToFileURL(path.join(out, "index.js")).href);

    assert.equal(typeof mod.renderWelcomeEmail, "function");
    assert.equal(typeof mod.renderOptionsEmail, "function");
    assert.deepEqual(Object.keys(mod.templates), ["welcome-email", "options-email"]);
    assert.equal(mod.templates["welcome-email"], mod.renderWelcomeEmail);
    assert.ok(Object.isFrozen(mod.templates));

    const dts = fs.readFileSync(path.join(out, "index.d.ts"), "utf8");
    assert.match(dts, /readonly "welcome-email": typeof renderWelcomeEmail;/);
    assert.match(dts, /export type TemplateName = keyof typeof templates;/);
  });

  // The naming rule is mailgrail's, so a name it cannot express has to fail
  // here rather than emit two templates into one file.
  test("template names that collide fail the build", () => {
    const indexFile = path.join(projectDir, SOURCE_DIR, "index.ts");
    const original = fs.readFileSync(indexFile, "utf8");
    const extra = path.join(projectDir, SOURCE_DIR, "Collide.tsx");

    fs.writeFileSync(
      extra,
      `import type { ReactElement } from "react";
import { Mjml, MjmlBody, MjmlSection, MjmlColumn, MjmlText } from "@faire/mjml-react";
import { t, type TemplateDefinition, type RenderTemplateContext, type TextTemplateContext } from "@luxanimi/mailgrail";
import type { Infer } from "@luxanimi/mailgrail/dsl";

const paramsSchema = t.object({ username: t.string() });
type Params = Infer<typeof paramsSchema>;

// "welcomeEmail" and "welcome-email" both compile to renderWelcomeEmail.
export const Collide: TemplateDefinition<typeof paramsSchema> = {
  name: "welcomeEmail",
  params: paramsSchema,
  htmlTemplate: (mg: RenderTemplateContext<Params>): ReactElement => (
    <Mjml><MjmlBody><MjmlSection><MjmlColumn><MjmlText>{mg.render("username")}</MjmlText></MjmlColumn></MjmlSection></MjmlBody></Mjml>
  ),
  subjectTemplate: (mg: TextTemplateContext<Params>) => mg.render("username"),
  textTemplate: (mg: TextTemplateContext<Params>) => mg.render("username"),
};
`,
    );

    fs.writeFileSync(
      indexFile,
      original
        .replace(
          'import { OptionsEmail } from "./OptionsEmail";',
          'import { OptionsEmail } from "./OptionsEmail";\nimport { Collide } from "./Collide";',
        )
        .replace("[WelcomeEmail, OptionsEmail]", "[WelcomeEmail, OptionsEmail, Collide]"),
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

      assert.ok(failed, "build should fail on colliding template names");
      assert.match(output, /both compile to `renderWelcomeEmail`/);
    } finally {
      fs.writeFileSync(indexFile, original);
      fs.rmSync(extra, { force: true });
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

    // The text body branches and iterates through the context, so what ships
    // is a template the engine fills in per email -- not a decision made once
    // at build time.
    assert.match(email.text, /Welcome, Alice! You are an admin\./);
    assert.match(email.text, /- Widget/);
    assert.match(email.text, /- Gadget/);
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

  test("`moduleFormat: cjs` emits CommonJS a backend can require()", () => {
    const config = path.join(projectDir, "mailgrail.config.ts");
    const original = fs.readFileSync(config, "utf8");
    const cjsDir = "out-cjs";

    const withCjs = original
      .replace(/outputDir: "[^"]*"/, `outputDir: "${cjsDir}"`)
      .replace("});", '  moduleFormat: "cjs",\n});');

    try {
      fs.writeFileSync(config, withCjs);
      npm(["exec", "--", "mailgrail", "build"], projectDir);

      const out = path.join(projectDir, cjsDir);
      const pkg = JSON.parse(fs.readFileSync(path.join(out, "package.json"), "utf8"));
      assert.equal(pkg.type, "commonjs");

      const js = fs.readFileSync(path.join(out, "welcome-email.js"), "utf8");
      assert.match(js, /const ejs = require\("ejs"\);/);
      assert.match(js, /exports\.renderWelcomeEmail = renderWelcomeEmail;/);

      fs.writeFileSync(
        path.join(projectDir, "cjs-consumer.cjs"),
        `const { templates, renderWelcomeEmail } = require("./${cjsDir}/index.js");
const email = renderWelcomeEmail({ username: "Alice", isAdmin: false, items: [] });
if (email.subject !== "Welcome, Alice!") throw new Error("subject: " + email.subject);
if (typeof templates["welcome-email"] !== "function") throw new Error("no map entry");
`,
      );

      npm(["exec", "--", "node", "cjs-consumer.cjs"], projectDir);

      // The emitted package.json says commonjs. Building the same directory as
      // ESM would leave modules Node refuses to load, so it has to fail.
      fs.writeFileSync(
        config,
        original.replace(/outputDir: "[^"]*"/, `outputDir: "${cjsDir}"`),
      );

      let failed = false;
      let output = "";
      try {
        npm(["exec", "--", "mailgrail", "build"], projectDir);
      } catch (err) {
        failed = true;
        output = `${err.stdout ?? ""}${err.stderr ?? ""}`;
      }

      assert.ok(failed, "a type mismatch should fail the build");
      assert.match(output, /moduleFormat is "esm"/);
      assert.match(output, /delete the file and build again/);
    } finally {
      fs.writeFileSync(config, original);
      fs.rmSync(path.join(projectDir, cjsDir), { recursive: true, force: true });
      fs.rmSync(path.join(projectDir, "cjs-consumer.cjs"), { force: true });
      npm(["exec", "--", "mailgrail", "build"], projectDir);
    }
  });

  // Node >= 20.19 can require() ESM, and the package's export conditions have
  // to let it rather than answering ERR_PACKAGE_PATH_NOT_EXPORTED.
  test("the package entry points load under require()", () => {
    fs.writeFileSync(
      path.join(projectDir, "require-entries.cjs"),
      `const mg = require("@luxanimi/mailgrail");
const dsl = require("@luxanimi/mailgrail/dsl");
if (typeof mg.defineConfig !== "function") throw new Error("defineConfig missing");
if (typeof dsl.t.string !== "function") throw new Error("t.string missing");
`,
    );

    npm(["exec", "--", "node", "require-entries.cjs"], projectDir);
  });

  // Next.js and friends still resolve types the old way, which ignores
  // `exports` entirely: typesVersions is the only thing that answers them.
  test("the subpath types resolve under the older node resolution", () => {
    fs.writeFileSync(
      path.join(projectDir, "node10.ts"),
      `import type { Infer, Schema } from "@luxanimi/mailgrail/dsl";
import type { TemplateDefinition } from "@luxanimi/mailgrail/types";

export type Params = Infer<Schema<{ username: string }>>;
export type Def = TemplateDefinition<Schema<any>>;
`,
    );

    fs.writeFileSync(
      path.join(projectDir, "tsconfig.node10.json"),
      JSON.stringify(
        {
          compilerOptions: {
            module: "commonjs",
            moduleResolution: "node",
            target: "ES2022",
            strict: true,
            noEmit: true,
            skipLibCheck: true,
            ignoreDeprecations: "6.0",
          },
          include: ["node10.ts"],
        },
        null,
        2,
      ),
    );

    npm(["exec", "--", "tsc", "--noEmit", "-p", "tsconfig.node10.json"], projectDir);
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

    // Strict-mode regressions a consumer hits while writing a template, not
    // while importing one. A plain <a> rather than an MJML component, so the
    // check does not also depend on @faire/mjml-react's own declarations.
    fs.writeFileSync(
      path.join(projectDir, "consumer-template.tsx"),
      `import type { ReactElement } from "react";
import { t, type RenderTemplateContext, type TextTemplateContext } from "@luxanimi/mailgrail";
import type { Infer } from "@luxanimi/mailgrail/dsl";
import { renderWelcomeEmail } from "./${OUTPUT_DIR}/welcome-email.js";
import { renderOptionsEmail } from "./${OUTPUT_DIR}/options-email.js";

const schema = t.object({
  url: t.string(),
  nickname: t.optional(t.string()),
  count: t.number(),
  links: t.array(t.string()),
});
type P = Infer<typeof schema>;

export const template = (mg: RenderTemplateContext<P>): ReactElement => (
  <div>
    <a href={mg.render("url")}>render fits a string attribute</a>
    {mg.each("links", (link) => <a href={link.render()}>so does an item</a>)}
    {mg.when("nickname", () => <p>Hi {mg.render("nickname")}</p>)}
    {/* @ts-expect-error -- a number is not a condition: 0 would read as absent */}
    {mg.when("count", () => <p>never</p>)}
  </div>
);

export const subject = (mg: TextTemplateContext<P>): string =>
  \`Hi \${mg.render("nickname")}\` + mg.when("nickname", () => "!", () => "");

// @ts-expect-error -- subject and text receive a context, not the parameters
export const oldStyle: (mg: TextTemplateContext<P>) => string = (p: P) => p.url;

export const sender: "hello@example.com" = renderWelcomeEmail({
  username: "a",
  isAdmin: false,
  items: [],
}).sender;

// @ts-expect-error -- options-email declares no sender, and returns none
renderOptionsEmail({ username: "a" }).sender;
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
          include: ["consumer.ts", "consumer-template.tsx", `${OUTPUT_DIR}/**/*.d.ts`],
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

    // `when` on an optional string is a presence test
    assert.match(mod.renderOptionsEmail({ username: "Alice", nickname: "Al" }).html, /has-nickname/);
    assert.doesNotMatch(mod.renderOptionsEmail({ username: "Alice" }).html, /has-nickname/);
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
    // The installed bin, run directly rather than through `npm exec`: on CI,
    // npm exits on SIGTERM without passing it on, and the orphaned server keeps
    // the port and keeps writing into node_modules.
    const bin = path.join(
      projectDir, "node_modules", "@luxanimi", "mailgrail", "lib", "bin", "mailgrail.js",
    );
    const child = spawn(process.execPath, [bin, "preview"], {
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

      // Whose preview this is, in the tab strip. The fixture package is named
      // "smoke-fixture".
      assert.match(await index.text(), /<title>smoke-fixture · MailGrail<\/title>/);

      for (const id of ["virtual:mailgrailconfig", "virtual:mailgrailtemplates"]) {
        const res = await get(`http://localhost:${port}/@id/${id}`);
        assert.ok(res && res.status === 200, `${id} did not resolve`);
      }

      assert.ok(!/Could not resolve/.test(log), `vite reported a resolve error:\n${log}`);
    } finally {
      // SIGTERM is a request, not an event: Vite closes gracefully, and until
      // it has, the port is held and its dep cache is still being written.
      if (child.exitCode === null && child.signalCode === null) {
        const exited = new Promise((resolve) => child.once("exit", resolve));
        child.kill("SIGTERM");
        const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
        await exited;
        clearTimeout(timer);
      }
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

    // The index is the artifact that matters; only its types are optional.
    assert.ok(fs.existsSync(path.join(out, "index.js")));
    assert.ok(!fs.existsSync(path.join(out, "index.d.ts")));
  });
});
