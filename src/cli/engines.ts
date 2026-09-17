//------------------------------------------------------------------------------
// Engine descriptors and the two build targets resolved from config.
//
// This lives apart from `build-templates.ts` for the same reason the emitters
// do: that module imports React, mjml and esbuild at the top level and awaits
// at module scope, so anything that only needs to know what an engine emits --
// the emitters, the tests, the docs generator -- would pull all of it in.
//------------------------------------------------------------------------------
import type { MailgrailResolvedConfig } from "../config/types.js";

//------------------------------------------------------------------------------
import { TEXT_COMPILE_OPTIONS } from "./rendering/schema-rendering.js";
import type { TemplatingEngine } from "./rendering/schema-rendering.js";

//------------------------------------------------------------------------------
// Each supported templating engine differs in three ways: the extension of the
// emitted template file, how a subject or text body is compiled (those are
// plain text, where the engines disagree about a line holding nothing but a
// block tag), and the runtime import + call used by the emitted module.
//------------------------------------------------------------------------------
export type EngineSpec = {
  /** Extension of the emitted template artifact. */
  ext: string;
  /** Bare module specifier the emitted module imports at runtime. */
  module: string;
  /** Default-import binding name used in the emitted module. */
  binding: string;
  /**
   * Module-level statement that does the engine's parse/compile work once, for
   * the template held in `tmpl`. Whatever it needs to keep, it keeps in `name`.
   */
  precompile: (name: string, tmpl: string) => string;
  /**
   * The same, for the subject and text bodies. The engines disagree about a
   * line holding nothing but a block tag -- see TEXT_COMPILE_OPTIONS.
   */
  precompileText: (name: string, tmpl: string) => string;
  /** Expression rendering that prepared template against `params`. */
  render: (name: string, tmpl: string) => string;
};

//------------------------------------------------------------------------------
export const ENGINES: Record<TemplatingEngine, EngineSpec> = {
  ejs: {
    ext: "ejs",
    module: "ejs",
    binding: "ejs",
    precompile: (name, tmpl) => `const ${name} = ejs.compile(${tmpl});`,
    precompileText: (name, tmpl) => `const ${name} = ejs.compile(${tmpl});`,
    render: (name) => `${name}(params)`,
  },
  handlebars: {
    ext: "hbs",
    module: "handlebars",
    binding: "Handlebars",
    precompile: (name, tmpl) => `const ${name} = Handlebars.compile(${tmpl});`,
    precompileText: (name, tmpl) =>
      `const ${name} = Handlebars.compile(${tmpl}, ${JSON.stringify(
        TEXT_COMPILE_OPTIONS.handlebars,
      )});`,
    render: (name) => `${name}(params)`,
  },
  mustache: {
    ext: "mustache",
    module: "mustache",
    binding: "Mustache",
    // Mustache has no compiled-function form; `parse` fills its internal cache
    // so `render` does not re-tokenise on every call.
    precompile: (_name, tmpl) => `Mustache.parse(${tmpl});`,
    precompileText: (_name, tmpl) => `Mustache.parse(${tmpl});`,
    render: (_name, tmpl) => `Mustache.render(${tmpl}, params)`,
  },
};

//------------------------------------------------------------------------------
export function resolveEngine(
  config: MailgrailResolvedConfig,
): TemplatingEngine {
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
// Which module system the compiled output speaks. It decides the emitted
// import and export syntax, and the `type` of the package.json written beside
// the output -- the two have to agree or Node will not load the files at all.
//------------------------------------------------------------------------------
export type ModuleFormat = "esm" | "cjs";

//------------------------------------------------------------------------------
export function resolveModuleFormat(
  config: MailgrailResolvedConfig,
): ModuleFormat {
  const format = config.moduleFormat.toLowerCase() as ModuleFormat;

  if (format !== "esm" && format !== "cjs") {
    throw new Error(
      `Unknown moduleFormat ${JSON.stringify(config.moduleFormat)}. ` +
        `Expected "esm" or "cjs".`,
    );
  }

  return format;
}
