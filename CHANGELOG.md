# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-04-11

### Added

**DSL**
- `t.string()` — string parameter schema
- `t.number()` — number parameter schema
- `t.boolean()` — boolean parameter schema
- `t.object(shape)` — object parameter schema with typed shape
- `t.array(element)` — array parameter schema; supports arrays of primitives, objects, and nested arrays
- `t.optional(schema)` — marks a parameter as optional (`T | undefined`)
- `t.default(schema, value)` — parameter with a fallback value; always non-optional at render time

**Render context API** (`RenderTemplateContext<T>`)
- `mg.render(path)` — render a scalar value; path can be dot-separated for nested access
- `mg.when(path, render, otherwise?)` — conditional rendering based on a boolean field
- `mg.unless(path, render, otherwise?)` — inverse conditional rendering
- `mg.each(path, (item, index) => ReactNode)` — iterate over an array field; item context is fully typed
- `mg.with(path, (scoped) => ReactNode)` — scope the context to a nested object

**CLI**
- `mailgrail preview` — Vite-powered live preview server with hot module replacement; renders templates with auto-generated placeholder data
- `mailgrail build` — compiles all templates to `.ejs`, `.js`, and `.d.ts` output files
- `--configPath <path>` flag on both commands to specify a custom config file location

**Configuration**
- `defineConfig()` — type-safe helper for `mailgrail.config.ts`
- `sourceDir` — configure the templates source directory
- `outputDir` — configure the compiled output directory
- `previewPort` — configure the preview server port (default `7777`)
- `typescript` — toggle `.d.ts` type file emission
- `templatingEngine` — select EJS (default), Handlebars, or Mustache output

**Type exports** (importable from `"mailgrail"`)
- `t` — the DSL builder object
- `defineConfig` — config helper
- `TemplateDefinition<S>` — type for defining a template
- `RenderTemplateContext<T>` — render context type for `htmlTemplate`
- `HtmlTemplateContext<T>` — alias for `RenderTemplateContext<T>`
- `Infer<S>` — extract the TypeScript type from a schema (also available from `"mailgrail/dsl"`)
- `Schema` — base schema interface (also available from `"mailgrail/dsl"`)

[Unreleased]: https://github.com/maxdup/mailgrail/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/maxdup/mailgrail/releases/tag/v0.1.0
