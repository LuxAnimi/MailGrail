import type { MailgrailResolvedConfig } from "../config/types.js";
import path from "node:path";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

//------------------------------------------------------------------------------
import { build } from "esbuild";
import { renderToMjml } from "@faire/mjml-react/utils/renderToMjml.js";
import mjml2html from "mjml";

//------------------------------------------------------------------------------
import type { TemplateDefinition } from "./types.js";
import {
  createTemplateCompiler,
  createTextTemplateCompiler,
  findLeakedTokens,
} from "./rendering/schema-rendering.js";
import type { TemplatingEngine } from "./rendering/schema-rendering.js";
import { guardContext } from "./rendering/context-guard.js";
import { assertReactPair } from "./react-preflight.js";
import { getLibraryDir } from "./utils.js";
import { emitDts, planTemplateEntries } from "./emit-types.js";
import type { TemplateEntry } from "./emit-types.js";
import { ENGINES, resolveEngine, resolveModuleFormat } from "./engines.js";
import type { EngineSpec, ModuleFormat } from "./engines.js";
import {
  checkOutputPackageJson,
  emitIndexDts,
  emitIndexJs,
  emitTemplateModule,
  outputPackageJson,
} from "./emit-module.js";

//------------------------------------------------------------------------------
globalThis.React = await import("react");

//------------------------------------------------------------------------------
// The generated modules import their engine from the *consumer's* project, not
// from mailgrail -- engines are optional peer dependencies. Catch a missing one
// here, at build time, rather than letting it surface when an email is sent.
//------------------------------------------------------------------------------
function assertEngineInstalled(
  spec: EngineSpec,
  config: MailgrailResolvedConfig,
): void {
  // Resolve from the project being built, since mailgrail lives in its own
  // node_modules and would not see the consumer's dependencies.
  const resolveFrom = createRequire(path.join(config.baseDir, "package.json"));

  try {
    resolveFrom.resolve(spec.module);
  } catch {
    throw new Error(
      `templatingEngine is "${config.templatingEngine}", but "${spec.module}" ` +
        `is not installed in this project.\n` +
        `The compiled templates import it at runtime, so install it with:\n\n` +
        `  npm install ${spec.module}\n`,
    );
  }
}

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
export async function buildTemplates(
  config: MailgrailResolvedConfig,
): Promise<string[]> {
  const engine = resolveEngine(config);
  const format = resolveModuleFormat(config);
  const spec = ENGINES[engine];

  assertEngineInstalled(spec, config);

  // The templates are rendered with the project's React, so check there is one
  // and only one before esbuild hands them over.
  assertReactPair(config.baseDir, getLibraryDir());

  const templates = await loadTemplates(config.sourceDir);

  // Names are planned before anything is compiled, so a name that cannot be an
  // identifier -- or that collides with another template's -- fails with the
  // output directory untouched rather than half-written.
  const entries = planTemplateEntries(templates);

  const compiled: {
    template: TemplateDefinition<any>;
    entry: TemplateEntry;
    html: string;
    text: string;
    subject: string;
  }[] = [];

  for (const [index, template] of templates.entries()) {
    compiled.push({
      template,
      entry: entries[index]!,
      html: await compileHtml(template, engine),
      text: compileTextPart(template, engine, "textTemplate"),
      subject: compileTextPart(template, engine, "subjectTemplate"),
    });
  }

  await ensureDir(config.outputDir);
  const warnings = await reconcileOutputPackageJson(config, format);

  for (const { template, entry, html, text, subject } of compiled) {
    // The template artifact is written for readability/debugging; the emitted
    // module inlines the same string so it runs under plain Node with no
    // bundler or text loader involved.
    await fs.writeFile(
      path.join(config.outputDir, `${entry.file}.${spec.ext}`),
      html,
      "utf8",
    );

    await fs.writeFile(
      path.join(config.outputDir, `${entry.file}.js`),
      emitTemplateModule({ template, entry, spec, format, html, text, subject }),
      "utf8",
    );

    if (config.typescript) {
      await fs.writeFile(
        path.join(config.outputDir, `${entry.file}.d.ts`),
        emitDts(template),
        "utf8",
      );
    }
  }

  await fs.writeFile(
    path.join(config.outputDir, "index.js"),
    emitIndexJs(entries, format),
    "utf8",
  );

  if (config.typescript) {
    await fs.writeFile(
      path.join(config.outputDir, "index.d.ts"),
      emitIndexDts(entries),
      "utf8",
    );
  }

  return warnings;
}

//------------------------------------------------------------------------------
// The package.json beside the output: written when there is none, and only
// checked when there is.
//
// A hand-written one is a decision already made, so it is never rewritten. It
// still decides how Node reads every file this build writes, so a `type` that
// contradicts `moduleFormat` is fatal: the modules would not load at all. A
// missing "." export only warns -- everything still works through relative
// imports, and files written by earlier versions have no "." at all.
//------------------------------------------------------------------------------
async function reconcileOutputPackageJson(
  config: MailgrailResolvedConfig,
  format: ModuleFormat,
): Promise<string[]> {
  const file = path.join(config.outputDir, "package.json");
  const pkg = outputPackageJson(format, config.typescript);

  try {
    // `wx` makes "is it there?" and "write it" a single operation.
    await fs.writeFile(file, JSON.stringify(pkg, null, 2) + "\n", {
      encoding: "utf8",
      flag: "wx",
    });
    return [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
  }

  const raw = await fs.readFile(file, "utf8");

  let existing: Record<string, unknown>;
  try {
    existing = JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    throw new Error(
      `${file} is not valid JSON, so the compiled output cannot be loaded: ` +
        `${(err as Error).message}`,
    );
  }

  return checkOutputPackageJson({ file, format, existing, expected: pkg });
}

//------------------------------------------------------------------------------
// Utilities
//------------------------------------------------------------------------------
async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

//------------------------------------------------------------------------------
// Load templates via esbuild
//------------------------------------------------------------------------------
const ENTRY_CANDIDATES = ["index.ts", "index.tsx", "index.js", "index.jsx"];

async function findEntryPoint(dir: string): Promise<string> {
  for (const candidate of ENTRY_CANDIDATES) {
    const entry = path.join(dir, candidate);

    try {
      await fs.access(entry);
      return entry;
    } catch {
      // try the next candidate
    }
  }

  throw new Error(
    `No template index found in ${dir}. ` +
      `Expected one of: ${ENTRY_CANDIDATES.join(", ")}.`,
  );
}

async function loadTemplates(dir: string): Promise<TemplateDefinition<any>[]> {
  const tmpFile = path.join(dir, ".mailgrail.codegen.mjs");
  const entryPoint = await findEntryPoint(dir);

  try {
    await build({
      entryPoints: [entryPoint],
      outfile: tmpFile,
      bundle: true,
      platform: "node",
      format: "esm",
      sourcemap: false,
      // React is left to the runtime import so the templates render with the
      // project's copy -- bundling it here would hand renderToStaticMarkup
      // elements made by a different React than the one it was loaded from.
      external: [
        "@faire/mjml-react",
        "react",
        "react/*",
        "react-dom",
        "react-dom/*",
      ],
    });

    const mod = await import(pathToFileURL(tmpFile).href);

    if (!Array.isArray(mod.templates)) {
      throw new Error(
        `${path.basename(entryPoint)} must export a \`templates\` array`,
      );
    }

    return mod.templates;
  } finally {
    // Always clean up, even if esbuild or the dynamic import threw — otherwise
    // the temp file is left behind in the user's source directory.
    await fs.unlink(tmpFile).catch(() => {});
  }
}

//------------------------------------------------------------------------------
// Compile HTML → template source
//------------------------------------------------------------------------------
async function compileHtml(
  template: TemplateDefinition<any>,
  engine: TemplatingEngine,
): Promise<string> {
  const { ctx, prepareMjml, substitute } = createTemplateCompiler<any>({
    engine,
  });

  // The template emits opaque tokens rather than engine syntax, so that React
  // and MJML cannot escape or discard it. The tokens are promoted to <mj-raw>
  // where MJML needs that, and swapped for real syntax once the HTML exists.
  const doc = template.htmlTemplate(
    guardContext(ctx, { template: template.name, part: "htmlTemplate" }),
  );
  const mjml = prepareMjml(renderToMjml(doc));

  const { html, errors } = await mjml2html(mjml, { minify: false });

  if (errors?.length) {
    throw new Error(
      `MJML error in ${template.name}:\n` +
        errors.map((e) => e.formattedMessage).join("\n"),
    );
  }

  return assertNoLeakedTokens(substitute(html), template.name, "htmlTemplate");
}

//------------------------------------------------------------------------------
// A marker that survived substitution means the template transformed what
// `mg.render()` gave it -- `.toUpperCase()`, `.slice()`, a number coerced. The
// value it stood for is gone, so stop rather than ship an email with
// MAILGRAILX0XTOKEN where a name should be.
//------------------------------------------------------------------------------
function assertNoLeakedTokens(
  out: string,
  name: string,
  part: "htmlTemplate" | "subjectTemplate" | "textTemplate",
): string {
  const leaked = findLeakedTokens(out);

  if (leaked) {
    throw new Error(
      `${name}: ${part} changed a value it got from mg.render(), leaving ` +
        `${leaked} in the output.\n` +
        `The context returns a placeholder the engine fills in when the email ` +
        `is sent, so it cannot be transformed at build time. Pass the value ` +
        `in already formatted instead.`,
    );
  }

  return out;
}

//------------------------------------------------------------------------------
// Compile subject/text → template source
//
// Same context as the HTML, composing strings instead of React nodes: these are
// compiled to engine templates too, so a branch or a loop has to go through
// `mg` to survive into the output. Nothing is escaped -- this is plain text,
// where `&amp;` would be a bug.
//------------------------------------------------------------------------------
function compileTextPart(
  template: TemplateDefinition<any>,
  engine: TemplatingEngine,
  part: "subjectTemplate" | "textTemplate",
): string {
  const { ctx, substitute } = createTextTemplateCompiler<any>({ engine });

  const out = template[part](
    guardContext(ctx, { template: template.name, part }),
  );

  if (typeof out !== "string") {
    throw new Error(
      `${template.name}: ${part} must return a string, got ${typeof out}.`,
    );
  }

  return assertNoLeakedTokens(substitute(out), template.name, part);
}

//------------------------------------------------------------------------------
// The emitters live in ./emit-types.js -- pure schema -> source transforms with
// no React/mjml/esbuild dependency. Re-exported here so the public surface of
// this module is unchanged.
//------------------------------------------------------------------------------
export {
  emitValueType,
  emitObjectType,
  emitDts,
  emitKey,
  isOptional,
  pascal,
} from "./emit-types.js";
