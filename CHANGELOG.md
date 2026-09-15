# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2026-09-15

### Added

- `mailgrail build` writes a minimal `package.json` (`"type": "module"` and
  wildcard `exports`) into `outputDir` when there is none. An existing one is
  never modified. This also lets a `"type": "commonjs"` project `require()` the
  output
- `mg.when` / `mg.unless` accept string paths as a presence test: an omitted
  `t.optional(t.string())` is empty, so it is false. Number paths are still
  rejected, since `0` would read as absent
- create-mailgrail: TypeScript projects get `<sourceDir>/tsconfig.json`, a
  `typecheck-emails` script and a `typescript` devDependency, so the scaffolded
  templates are actually typechecked

### Removed

- create-mailgrail no longer warns that a CommonJS project cannot import the
  output: the emitted `package.json` makes that work

### Fixed

- `mg.render` is typed `string` rather than `ReactNode`, so
  `href={mg.render("url")}` compiles under `strict`
- The emitted `.d.ts` types `sender` as the template's literal address. A
  template without a `sender` no longer returns `sender: undefined` behind a
  `string` type -- the key is absent from both
- A relative `--configPath` no longer crashes `mailgrail build` and
  `mailgrail preview`

## [0.1.0] - 2026-09-09

### Added

**DSL**
- `t.string()` — string parameter schema
- `t.number()` — number parameter schema
- `t.boolean()` — boolean parameter schema
- `t.object(shape)` — object parameter schema with typed shape
- `t.array(element)` — array parameter schema; supports arrays of primitives, objects, and nested arrays
- `t.optional(schema)` — the parameter may be omitted; an omitted value renders
  as an empty string
- `t.default(schema, value)` — the parameter may be omitted; an omitted value
  renders `value`. Omittable on input, never undefined at render time.
  `t.default(t.optional(x), v)` composes to the same thing

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
- `templatingEngine` — select EJS (default), Handlebars, or Mustache output; also
  selects the emitted template extension (`.ejs`/`.hbs`/`.mustache`) and the engine
  the generated `.js` imports
- `hideAppName` — hide the project name in the preview UI
- `hideAppDescription` — hide the description in the preview UI
- `hideAppLogo` — hide the logo in the preview UI

**Dependencies**
- Templating engines (`ejs`, `handlebars`, `mustache`) are optional peer
  dependencies: none are installed by default, and only the one matching
  `templatingEngine` is needed. `mailgrail build` fails with an actionable
  message when it is missing.

**Output**
- Compiled `.js` inlines its template string, so the generated module runs under
  plain Node with no bundler or text loader
- Compiled `.js` normalizes its params before rendering, so `t.default` values are
  applied and a missing value never throws
- MJML 5 / `@faire/mjml-react` 4

**Type exports** (importable from `"mailgrail"`)
- `t` — the DSL builder object
- `defineConfig` — config helper
- `TemplateDefinition<S>` — type for defining a template
- `RenderTemplateContext<T>` — render context type for `htmlTemplate`
- `HtmlTemplateContext<T>` — alias for `RenderTemplateContext<T>`
- `Infer<S>` — extract the TypeScript type from a schema (also available from `"mailgrail/dsl"`)
- `Schema` — base schema interface (also available from `"mailgrail/dsl"`)

[Unreleased]: https://github.com/LuxAnimi/MailGrail/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/LuxAnimi/MailGrail/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/LuxAnimi/MailGrail/releases/tag/v0.1.0
