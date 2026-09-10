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
import type { AnySchema, ObjectSchema } from "../dsl/types.js";
import { createTemplateCompiler } from "./rendering/schema-rendering.js";
import type { TemplatingEngine } from "./rendering/schema-rendering.js";

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
  /** Renders `template` (a JS expression) against `params`. */
  call: (template: string) => string;
};

const ENGINES: Record<TemplatingEngine, EngineSpec> = {
  ejs: {
    ext: "ejs",
    placeholder: (key) => `<%- ${key} %>`,
    module: "ejs",
    binding: "ejs",
    call: (template) => `ejs.render(${template}, params)`,
  },
  handlebars: {
    ext: "hbs",
    placeholder: (key) => `{{{${key}}}}`,
    module: "handlebars",
    binding: "Handlebars",
    call: (template) => `Handlebars.compile(${template})(params)`,
  },
  mustache: {
    ext: "mustache",
    placeholder: (key) => `{{& ${key}}}`,
    module: "mustache",
    binding: "Mustache",
    call: (template) => `Mustache.render(${template}, params)`,
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
const pascal = (str: string) =>
  str.replace(/(^\w|-\w)/g, (m) => m.replace("-", "").toUpperCase());

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

  return `
import ${spec.binding} from ${JSON.stringify(spec.module)};

const htmlTemplate = ${JSON.stringify(html)};

${emitNormalizer(template.params)}
export function ${fnName}(input) {
  const params = normalizeParams(input);

  return {
    name: ${JSON.stringify(template.name)},
    sender: ${JSON.stringify(template.sender)},
    subject: ${spec.call(JSON.stringify(subject))},
    text: ${spec.call(JSON.stringify(text))},
    html: ${spec.call("htmlTemplate")},
  };
}
`.trimStart();
}

//------------------------------------------------------------------------------
// Emit the params normalizer
//
// Templating engines disagree about missing keys -- EJS throws a ReferenceError
// while Handlebars and Mustache render nothing -- and neither knows about the
// schema's `default` values or `optional` fallbacks. So the generated module
// normalizes its input first: every declared key is present, defaults and
// fallbacks are applied, and an absent optional becomes an empty string.
//------------------------------------------------------------------------------
function emitNormalizer(schema: ObjectSchema<any>): string {
  return `function normalizeParams(params) {
  return ${normalizeExpr(schema, "params", 0)};
}
`;
}

//------------------------------------------------------------------------------
function emptyFor(schema: AnySchema): string {
  switch (schema.kind) {
    case "object":
      return "{}";
    case "array":
      return "[]";
    case "optional":
    case "default":
      return emptyFor(schema.inner);
    default:
      return '""';
  }
}

//------------------------------------------------------------------------------
function normalizeExpr(schema: AnySchema, access: string, depth = 0): string {
  switch (schema.kind) {
    case "object": {
      const o = depth === 0 ? "o" : `o${depth}`;
      const entries = Object.entries(schema.shape).map(([key, child]) => {
        const prop = JSON.stringify(key);
        return `${prop}: ${normalizeExpr(child as AnySchema, `${o}[${prop}]`, depth + 1)}`;
      });
      return `((${o}) => ({ ${entries.join(", ")} }))(${access} ?? {})`;
    }

    case "array": {
      const e = depth === 0 ? "e" : `e${depth}`;
      return `(${access} ?? []).map((${e}) => ${normalizeExpr(schema.element, e, depth + 1)})`;
    }

    case "optional": {
      // object and array supply their own empty value, so only scalars need
      // one added here -- otherwise the emitted code reads `(x ?? {}) ?? {}`.
      const empty = emptyFor(schema.inner);
      return normalizeExpr(
        schema.inner,
        empty === '""' ? `(${access} ?? "")` : access,
        depth,
      );
    }

    case "default":
      return normalizeExpr(
        schema.inner,
        `(${access} ?? ${JSON.stringify(schema.value)})`,
        depth,
      );

    default:
      return access;
  }
}

//------------------------------------------------------------------------------
// Emit DTS
//------------------------------------------------------------------------------
function emitDts(template: TemplateDefinition<any>): string {
  const typeName = `${pascal(template.name)}Params`;
  const fnName = `render${pascal(template.name)}`;
  const paramsType = emitObjectType(template.params);

  return `
export type ${typeName} = ${paramsType};

export declare function ${fnName}(
  params: ${typeName}
): {
  name: "${template.name}";
  subject: string;
  sender: string;
  html: string;
  text: string;
};
`.trimStart();
}

//------------------------------------------------------------------------------
// Emit Type
//------------------------------------------------------------------------------
// Both make the key omittable on input. `default` additionally guarantees a
// value at render time, which `normalizeParams` supplies.
function isOptional(schema: AnySchema): boolean {
  switch (schema.kind) {
    case "optional":
    case "default":
      return true;
    default:
      return false;
  }
}

//------------------------------------------------------------------------------
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function emitKey(key: string): string {
  return IDENTIFIER.test(key) ? key : JSON.stringify(key);
}

//------------------------------------------------------------------------------
function emitObjectType(schema: ObjectSchema<any>, indent = ""): string {
  const inner = `${indent}  `;

  const lines = Object.entries(schema.shape).map(([key, value]) => {
    const optional = isOptional(value as AnySchema) ? "?" : "";
    return `${inner}${emitKey(key)}${optional}: ${emitValueType(value as AnySchema, inner)};`;
  });

  return `{\n${lines.join("\n")}\n${indent}}`;
}

//------------------------------------------------------------------------------
export function emitValueType(schema: AnySchema, indent = ""): string {
  switch (schema.kind) {
    case "string":
      return "string";

    case "number":
      return "number";

    case "boolean":
      return "boolean";

    case "array":
      return `${emitValueType(schema.element, indent)}[]`;

    case "default":
      return emitValueType(schema.inner, indent);

    case "optional":
      // optionality handled at property level
      return emitValueType(schema.inner, indent);

    case "object":
      return emitObjectType(schema, indent);

    default:
      return "unknown";
  }
}
