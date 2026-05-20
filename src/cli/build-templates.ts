import type { MailgrailResolvedConfig } from "@/config/types.js";
import path from "node:path";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";

//------------------------------------------------------------------------------
import { build } from "esbuild";
import { renderToMjml } from "@faire/mjml-react/utils/renderToMjml.js";
import mjml2html from "mjml";

//------------------------------------------------------------------------------
import type { TemplateDefinition } from "./types.js";
import type { AnySchema, ObjectSchema } from "@/dsl/types.js";
import { makeTemplateRenderContext } from "./rendering/schema-rendering.js";

//------------------------------------------------------------------------------
globalThis.React = await import("react");

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
export async function buildTemplates(config: MailgrailResolvedConfig) {
  await ensureDir(config.outputDir);

  const templates = await loadTemplates(config.sourceDir);

  for (const template of templates) {
    const htmlEjs = await compileHtmlEjs(template);
    const textEjs = compileTextEjs(template);
    const subjEjs = compileSubjEjs(template);

    await fs.writeFile(
      path.join(config.outputDir, `${template.name}.ejs`),
      htmlEjs,
      "utf8",
    );

    await fs.writeFile(
      path.join(config.outputDir, `${template.name}.js`),
      emitJs(template, textEjs, subjEjs),
      "utf8",
    );

    await fs.writeFile(
      path.join(config.outputDir, `${template.name}.d.ts`),
      emitDts(template),
      "utf8",
    );
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
async function loadTemplates(dir: string): Promise<TemplateDefinition<any>[]> {
  const tmpFile = path.join(dir, ".mailgrail.codegen.mjs");

  const result = await build({
    entryPoints: [path.join(dir, "index.ts")],
    outfile: tmpFile,
    bundle: true,
    platform: "node",
    format: "esm",
    metafile: true,
    sourcemap: false,
    external: ["@faire/mjml-react"],
  });

  console.log(result.metafile.outputs["emails/.mailgrail.codegen.mjs"].exports);

  const mod = await import(pathToFileURL(tmpFile).href);
  await fs.unlink(tmpFile);

  if (!Array.isArray(mod.templates)) {
    throw new Error("index.ts must export `templates` array");
  }

  return mod.templates;
}

//------------------------------------------------------------------------------
// Compile HTML → EJS
//------------------------------------------------------------------------------
async function compileHtmlEjs(template: TemplateDefinition<any>): Promise<string> {
  const ctx = makeTemplateRenderContext<any>({
    engine: "ejs",
  });
  const doc = template.htmlTemplate(ctx);
  const mjml = renderToMjml(doc);
  const { html, errors } = await mjml2html(mjml, { minify: false });

  if (errors?.length) {
    throw new Error(
      `MJML error in ${template.name}:\n` +
        errors.map((e) => e.formattedMessage).join("\n"),
    );
  }

  return html;
}

//------------------------------------------------------------------------------
// Compile text → EJS
//------------------------------------------------------------------------------
function compileTextEjs(template: TemplateDefinition<any>): string {
  const proxy = new Proxy(
    {},
    {
      get(_, key) {
        return `<%= ${String(key)} %>`;
      },
    },
  );

  return template.textTemplate(proxy);
}

//------------------------------------------------------------------------------
// Compile subject → EJS
//------------------------------------------------------------------------------
function compileSubjEjs(template: TemplateDefinition<any>): string {
  const proxy = new Proxy(
    {},
    {
      get(_, key) {
        return `<%= ${String(key)} %>`;
      },
    },
  );

  return template.subjectTemplate(proxy);
}

//------------------------------------------------------------------------------
// Emit JS wrapper
//------------------------------------------------------------------------------
function emitJs(
  template: TemplateDefinition<any>,
  textEjs: string,
  subjEjs: string,
): string {
  const fnName = `render${pascal(template.name)}`;

  return `
import ejs from "ejs";
import htmlTemplate from "./${template.name}.ejs";

export function ${fnName}(params) {
  return {
    name: ${JSON.stringify(template.name)},
    sender: ${JSON.stringify(template.sender)},
    subject: ejs.render(${JSON.stringify(subjEjs)}, params),
    text: ejs.render(${JSON.stringify(textEjs)}, params),
    html: ejs.render(htmlTemplate, params),
  };
}
`.trimStart();
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
function isOptional(schema: AnySchema): boolean {
  switch (schema.kind) {
    case "optional":
      return true;
    case "default":
      return isOptional(schema.inner);
    default:
      return false;
  }
}

//------------------------------------------------------------------------------
function emitObjectType(schema: ObjectSchema<any>): string {
  const lines = Object.entries(schema.shape).map(([key, value]) => {
    const optional = isOptional(value as AnySchema) ? "?" : "";
    return `  ${key}${optional}: ${emitValueType(value as AnySchema)};`;
  });

  return `{\n${lines.join("\n")}\n}`;
}

//------------------------------------------------------------------------------
export function emitValueType(schema: AnySchema): string {
  switch (schema.kind) {
    case "string":
      return "string";

    case "number":
      return "number";

    case "array":
      return `${emitValueType(schema.element)}[]`;

    case "default":
      return emitValueType(schema.inner);

    case "optional":
      // optionality handled at property level
      return emitValueType(schema.inner);

    case "object":
      return emitObjectType(schema);

    default:
      return "unknown";
  }
}
