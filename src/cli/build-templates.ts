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
import { createTemplateCompiler } from "./rendering/schema-rendering.js";
import type { TemplatingEngine } from "./rendering/schema-rendering.js";
import { emitDts, emitNormalizer, pascal } from "./emit-types.js";

//------------------------------------------------------------------------------
globalThis.React = await import("react");

//------------------------------------------------------------------------------
// Engine descriptors
//
// Each supported templating engine differs in three ways: the extension of the
// emitted template file, the placeholder syntax used for the (non-HTML) subject
// and text bodies, and the runtime import + call used by the emitted `.js`.
//------------------------------------------------------------------------------
type EngineSpec = {
  /** Extension of the emitted template artifact. */
  ext: string;
  /**
   * Placeholder for a top-level param in the subject/text bodies. These are
   * plain text, not HTML, so the *unescaped* form of each engine is used.
   */
  placeholder: (key: string) => string;
  /** Bare module specifier the emitted `.js` imports at runtime. */
  module: string;
  /** Default-import binding name used in the emitted `.js`. */
  binding: string;
  /**
   * Module-level statement that does the engine's parse/compile work once, for
   * the template held in `tmpl`. Whatever it needs to keep, it keeps in `name`.
   */
  precompile: (name: string, tmpl: string) => string;
  /** Expression rendering that prepared template against `params`. */
  render: (name: string, tmpl: string) => string;
};

const ENGINES: Record<TemplatingEngine, EngineSpec> = {
  ejs: {
    ext: "ejs",
    placeholder: (key) => `<%- ${key} %>`,
    module: "ejs",
    binding: "ejs",
    precompile: (name, tmpl) => `const ${name} = ejs.compile(${tmpl});`,
    render: (name) => `${name}(params)`,
  },
  handlebars: {
    ext: "hbs",
    placeholder: (key) => `{{{${key}}}}`,
    module: "handlebars",
    binding: "Handlebars",
    precompile: (name, tmpl) => `const ${name} = Handlebars.compile(${tmpl});`,
    render: (name) => `${name}(params)`,
  },
  mustache: {
    ext: "mustache",
    placeholder: (key) => `{{& ${key}}}`,
    module: "mustache",
    binding: "Mustache",
    // Mustache has no compiled-function form; `parse` fills its internal cache
    // so `render` does not re-tokenise on every call.
    precompile: (_name, tmpl) => `Mustache.parse(${tmpl});`,
    render: (_name, tmpl) => `Mustache.render(${tmpl}, params)`,
  },
};

function resolveEngine(config: MailgrailResolvedConfig): TemplatingEngine {
  const engine = config.templatingEngine.toLowerCase() as TemplatingEngine;

  if (!(engine in ENGINES)) {
    throw new Error(
      `Unknown templatingEngine ${JSON.stringify(config.templatingEngine)}. ` +
        `Expected one of: EJS, Handlebars, Mustache.`,
    );
  }

  return engine;
}

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
export async function buildTemplates(config: MailgrailResolvedConfig) {
  await ensureDir(config.outputDir);

  const engine = resolveEngine(config);
  const spec = ENGINES[engine];

  assertEngineInstalled(spec, config);

  const templates = await loadTemplates(config.sourceDir);

  for (const template of templates) {
    const html = await compileHtml(template, engine);
    const text = compileText(template, spec);
    const subject = compileSubject(template, spec);

    // The template artifact is written for readability/debugging; the emitted
    // `.js` inlines the same string so it runs under plain Node with no
    // bundler or text loader involved.
    await fs.writeFile(
      path.join(config.outputDir, `${template.name}.${spec.ext}`),
      html,
      "utf8",
    );

    await fs.writeFile(
      path.join(config.outputDir, `${template.name}.js`),
      emitJs(template, spec, html, text, subject),
      "utf8",
    );

    if (config.typescript) {
      await fs.writeFile(
        path.join(config.outputDir, `${template.name}.d.ts`),
        emitDts(template),
        "utf8",
      );
    }
  }
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
      external: ["@faire/mjml-react"],
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
  const doc = template.htmlTemplate(ctx);
  const mjml = prepareMjml(renderToMjml(doc));

  const { html, errors } = await mjml2html(mjml, { minify: false });

  if (errors?.length) {
    throw new Error(
      `MJML error in ${template.name}:\n` +
        errors.map((e) => e.formattedMessage).join("\n"),
    );
  }

  return substitute(html);
}

//------------------------------------------------------------------------------
// Compile subject/text → template source
//
// Both are plain text rather than HTML, so each engine's unescaped placeholder
// is used; escaping here would turn an `&` in a param into `&amp;`.
//------------------------------------------------------------------------------
function paramsProxy(spec: EngineSpec) {
  return new Proxy(
    {},
    {
      get(_, key) {
        return spec.placeholder(String(key));
      },
    },
  );
}

function compileText(
  template: TemplateDefinition<any>,
  spec: EngineSpec,
): string {
  return template.textTemplate(paramsProxy(spec));
}

function compileSubject(
  template: TemplateDefinition<any>,
  spec: EngineSpec,
): string {
  return template.subjectTemplate(paramsProxy(spec));
}

//------------------------------------------------------------------------------
// Emit JS wrapper
//------------------------------------------------------------------------------
function emitJs(
  template: TemplateDefinition<any>,
  spec: EngineSpec,
  html: string,
  text: string,
  subject: string,
): string {
  const fnName = `render${pascal(template.name)}`;

  // Each template is prepared once, when the module is first imported, rather
  // than on every call. Engines differ in how much that saves -- Handlebars was
  // re-compiling the whole document per render, EJS re-parsing it -- but none of
  // them should be doing it per message, and the template cannot change at
  // runtime, so there is nothing to invalidate.
  return `
import ${spec.binding} from ${JSON.stringify(spec.module)};

const htmlTemplate = ${JSON.stringify(html)};
const textTemplate = ${JSON.stringify(text)};
const subjectTemplate = ${JSON.stringify(subject)};

${spec.precompile("renderHtml", "htmlTemplate")}
${spec.precompile("renderText", "textTemplate")}
${spec.precompile("renderSubject", "subjectTemplate")}

${emitNormalizer(template.params)}
export function ${fnName}(input) {
  const params = normalizeParams(input);

  return {
    name: ${JSON.stringify(template.name)},
    sender: ${JSON.stringify(template.sender)},
    subject: ${spec.render("renderSubject", "subjectTemplate")},
    text: ${spec.render("renderText", "textTemplate")},
    html: ${spec.render("renderHtml", "htmlTemplate")},
  };
}
`.trimStart();
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
