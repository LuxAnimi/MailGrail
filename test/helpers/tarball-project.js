import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

//------------------------------------------------------------------------------
// Shared setup for the tarball suites.
//
// Each one packs the real package and installs it into a throwaway project.
// That is the only place install-shaped failures are visible: a missing runtime
// dependency, an unresolvable specifier inside a shipped `.d.ts`, anything that
// assumes a default `sourceDir`. The React 18 suite reuses all of it, so the
// two differ only in the React they install.
//
// Set MAILGRAIL_SKIP_TARBALL_TEST=1 to skip both (they run a real npm install).
//------------------------------------------------------------------------------
export const SKIP = process.env.MAILGRAIL_SKIP_TARBALL_TEST === "1";
// This file sits in test/helpers/, so the repo root is two levels up. Getting
// this wrong points `npm pack` at a directory with no package.json.
export const repoRoot = path.resolve(import.meta.dirname, "..", "..");

// A deliberately non-default source directory: `templates`, not `emails`.
export const SOURCE_DIR = "templates";
export const OUTPUT_DIR = "out";

// `npm publish --dry-run` exports its own flags to lifecycle scripts as
// npm_config_*, so the `npm pack` below inherits dry-run: it still reports a
// filename in its JSON but writes no tarball, and the install then fails on a
// file that never existed. Standalone `npm test` is unaffected, which is what
// makes it confusing -- the suite only breaks when run through a publish, which
// is precisely when you are relying on it.
export const npm = (args, cwd) => {
  const env = { ...process.env };
  delete env["npm_config_dry_run"];
  return execFileSync("npm", args, { cwd, encoding: "utf8", stdio: "pipe", env });
};

export function writeFixture(dir, engine, previewPort = 7913) {
  fs.mkdirSync(path.join(dir, SOURCE_DIR), { recursive: true });

  fs.writeFileSync(
    path.join(dir, "mailgrail.config.ts"),
    `import { defineConfig } from "@luxanimi/mailgrail";

export default defineConfig({
  sourceDir: ${JSON.stringify(SOURCE_DIR)},
  outputDir: ${JSON.stringify(OUTPUT_DIR)},
  templatingEngine: ${JSON.stringify(engine)},
  previewPort: ${previewPort},
});
`,
  );

  fs.writeFileSync(
    path.join(dir, SOURCE_DIR, "WelcomeEmail.tsx"),
    `import type { ReactElement } from "react";
import { Mjml, MjmlBody, MjmlSection, MjmlColumn, MjmlText } from "@faire/mjml-react";
import { t, type TemplateDefinition, type RenderTemplateContext, type TextTemplateContext } from "@luxanimi/mailgrail";
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
  subjectTemplate: (mg: TextTemplateContext<Params>) =>
    \`Welcome, \${mg.render("username")}!\`,
  textTemplate: (mg: TextTemplateContext<Params>) =>
    \`Welcome, \${mg.render("username")}! \` +
    mg.when("isAdmin", () => "You are an admin.", () => "") +
    mg.each("items", (item) => \`\\n- \${item.render("name")}\`),
};
`,
  );

  fs.writeFileSync(
    path.join(dir, SOURCE_DIR, "OptionsEmail.tsx"),
    `import type { ReactElement } from "react";
import { Mjml, MjmlBody, MjmlSection, MjmlColumn, MjmlText } from "@faire/mjml-react";
import { t, type TemplateDefinition, type RenderTemplateContext, type TextTemplateContext } from "@luxanimi/mailgrail";
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
          {mg.when("nickname", () => (
            <MjmlText>has-nickname</MjmlText>
          ))}
        </MjmlColumn>
      </MjmlSection>
    </MjmlBody>
  </Mjml>
);

// No sender: the emitted type and the module must both leave it out.
export const OptionsEmail: TemplateDefinition<typeof paramsSchema> = {
  name: "options-email",
  params: paramsSchema,
  htmlTemplate,
  subjectTemplate: (mg: TextTemplateContext<Params>) =>
    \`Hi \${mg.render("username")}\`,
  textTemplate: (mg: TextTemplateContext<Params>) =>
    \`Hi \${mg.render("username")}\` +
    mg.when("nickname", () => " (has-nickname)", () => ""),
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

//------------------------------------------------------------------------------
// A throwaway project with the packed tarball installed.
//------------------------------------------------------------------------------
export function createFixtureProject({ engine = "EJS", reactMajor = 19 } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mailgrail-smoke-"));

  // Pack the real thing. `npm pack` does not re-trigger prepublishOnly.
  npm(["pack", "--pack-destination", dir], repoRoot);

  const tarballs = fs.readdirSync(dir).filter((f) => f.endsWith(".tgz"));
  if (tarballs.length !== 1) {
    throw new Error(
      `expected one tarball in ${dir}, found: [${tarballs.join(", ")}]`,
    );
  }

  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify(
      { name: "smoke-fixture", version: "1.0.0", private: true, type: "module" },
      null,
      2,
    ),
  );

  writeFixture(dir, engine);

  npm(
    [
      "install",
      path.join(dir, tarballs[0]),
      "@faire/mjml-react@^4.0.0",
      `react@^${reactMajor}`,
      `react-dom@^${reactMajor}`,
      "ejs@^5",
      "typescript@^6",
      `@types/react@^${reactMajor}`,
    ],
    dir,
  );

  return dir;
}
