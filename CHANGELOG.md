# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-09-24

### Added

- Localization. List `locales` in the config and each template is built once
  per locale. Messages are written in ICU MessageFormat with
  `defineMessages()` and rendered with `mg.t()`: arguments, rich-text tags,
  plural and select, and number/date/time formatting. Plurals and formatting are
  computed per email with the built-in `Intl` APIs, so the output still needs
  nothing but the templating engine. Render functions take
  `{ locale, timeZone }`, resolve any tag or `Accept-Language` value to the
  closest built locale, and never throw
- `mailgrail extract` keeps `<localesDir>/<locale>.json` catalogs in line with
  the source messages
- Catalog validation at build time: ICU syntax, arguments and tags a
  translation cannot have, plural categories each locale needs, stale keys and
  invisible characters. Missing translations warn and fall back to the default
  locale, or fail the build with `strictLocales`
- `<html lang dir>` is set per locale; `mg.locale` and `mg.dir` are available
  to templates
- `t.date()`
- Preview: a locale picker, highlighting for untranslated messages, catalog
  hot reload, and an `en-XA` pseudo-locale
- Optional `category` on `TemplateDefinition`: the preview sidebar groups
  templates by category into collapsible sections. Preview-only, not emitted
  into the build output

### Fixed

- With Handlebars or Mustache, a literal `{{name}}` in a template's static HTML
  (text or attribute) was evaluated against the params, and a `{` placed right
  before a value turned it into an unescaped triple-stache. Static braces next to
  delimiters are now written as HTML entities
- Preview: a clicked template kept a focus ring outside its selected border,
  drawing two outlines. The ring now shows for keyboard focus only

### Changed

- A line break or other control character in a rendered subject fails the build
- Param keys starting with `__mg` are reserved
- Preview: in the desktop view the email sits in an outlined frame with a soft
  shadow, so a white email stands apart from the white page around it
- Preview: the sidebar is at most 20rem wide; a long project description or
  template name wraps instead of squeezing the preview
- Example templates: a neutral grey palette whose text colours all read at
  4.5:1 or better on white, a white body set explicitly, and a light-only
  `color-scheme`. They were styled for a dark background, and claimed dark-mode
  support their dark text could not honour

## [0.2.0] - 2026-09-17

### Breaking

- `subjectTemplate` and `textTemplate` now receive a render context instead of
  the parameters: `(mg) => \`Welcome, ${mg.render("username")}!\``. They used to
  be handed placeholder strings, so a conditional, a nested path, an array or a
  string method silently compiled to the wrong thing -- the bundled team-invite
  subject shipped as `undefined invited you to join mailgrail`. Branch with
  `mg.when` / `mg.unless` and iterate with `mg.each`, exactly as in
  `htmlTemplate`
- Reading a parameter straight off the context (`mg.username`), or transforming
  a value it returned (`mg.render("total").toUpperCase()`), now fails the build
  instead of emitting a broken template
- `react-dom` is a required peer dependency. It was always needed -- rendering a
  template to MJML goes through `react-dom/server` -- but arrived only as
  somebody else's transitive peer
- The build fails on template names that cannot be expressed in the output:
  two names compiling to the same `renderX`, names differing only in case, a
  name that is not a valid identifier, and the reserved name `index`
- The build fails when a `package.json` already in `outputDir` declares a `type`
  that contradicts `moduleFormat`; the emitted modules would not load at all
- Package entry points resolve through a `default` condition rather than
  `import`, so `require()` reaches them on Node >= 20.19

### Added

- React 18 support: `react` and `react-dom` peers are now `^18 || ^19`. The
  preview app no longer bundles a React of its own, so it renders templates with
  the project's copy; build and preview both fail early, and clearly, when react
  and react-dom mismatch or two copies are reachable
- `moduleFormat: "esm" | "cjs"` — `cjs` emits `require`/`exports` modules and a
  `package.json` declaring `"type": "commonjs"`
- `mailgrail build` writes `index.js` and `index.d.ts` into `outputDir`,
  re-exporting every render function plus a typed `templates` map from template
  name to function, and adds a `"."` entry to the emitted `package.json`
- `TextTemplateContext<T>` — the context type for subject and text templates
- `typesVersions` for `/dsl` and `/types`, so the subpaths resolve under the
  older `moduleResolution: "node"` that Next.js and similar still use
- The preview says so when the configured port is taken, instead of moving to
  the next one silently, and its header and tab title show the project's own
  name and description from `package.json`
- create-mailgrail matches the project's React major and adds `react-dom`,
  points out an existing root `tsconfig.json` or ESLint config that will want a
  word about the templates directory, and says that `outputDir` exists only
  after a build

### Fixed

- Items of a primitive array were HTML-escaped in unescaped contexts
- The preview-server docs described a header reading the project's
  `package.json`, which the preview did not do until now


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

[Unreleased]: https://github.com/LuxAnimi/MailGrail/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/LuxAnimi/MailGrail/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/LuxAnimi/MailGrail/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/LuxAnimi/MailGrail/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/LuxAnimi/MailGrail/releases/tag/v0.1.0
