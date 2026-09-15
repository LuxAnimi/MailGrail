# @luxanimi/create-mailgrail

Adds [MailGrail](https://github.com/LuxAnimi/MailGrail) to a project you already
have — type-safe email templates written as React + MJML components, compiled to
a portable template your backend renders on its own.

```sh
cd your-project
npm create @luxanimi/mailgrail
```

It runs **inside an existing project** and will not create one: if there is no
`package.json` in the directory you point it at, it stops and says so.

## What it asks

```
  create-mailgrail

  Project directory? › .
  Language? › TypeScript
  Email source directory? › emails-src
  Build output directory? › emails-dist
```

## What it does

- Adds `@faire/mjml-react`, `react` and `ejs` to `dependencies`, and `@luxanimi/mailgrail`
  (plus `@types/react` and `typescript` on a TypeScript project) to `devDependencies`
- Adds two scripts — `preview-emails` and `build-emails` — and, on a TypeScript
  project, `typecheck-emails`
- Writes a `mailgrail.config.ts`
- Scaffolds a starter template with a layout and a theme you can edit:

```
emails-src/
  index.ts
  WelcomeEmail.tsx
  components/
    BaseLayout.tsx
    theme.ts
  tsconfig.json     # TypeScript projects only; used by typecheck-emails
```

- Installs dependencies with whichever package manager you invoked it through
  (npm, pnpm, yarn or bun)

Existing files are never overwritten, and an entry already present in your
`package.json` is left exactly as it is.

## What it deliberately does not do

It does not touch your `.gitignore`, add a `prebuild` hook, or modify your
`build` script.

Whether the compiled output belongs in git, or should be generated during your
build, is a real decision — it changes how review, deploys and a clean clone's
typecheck behave, and the right answer depends on things a scaffolder cannot
see. The installer prints a link to
[wiring it into your build](https://luxanimi.github.io/MailGrail/docs/getting-started/build-integration),
which lays out both options.

## Doing it by hand

If you would rather not run a scaffolder — a locked-down environment, a
monorepo, or you just want to read the diff first —
[setting up by hand](https://luxanimi.github.io/MailGrail/docs/getting-started/manual-setup)
lists every change as a step. That page is generated from this package's own
source, so the two paths cannot drift apart.

It is also the only way to start on Handlebars or Mustache: this scaffolder
always wires EJS and never asks.

## Requirements

Node `^20.19.0 || >=22.12.0`, and an existing project with a `package.json`.

## Links

- [Documentation](https://luxanimi.github.io/MailGrail/)
- [`@luxanimi/mailgrail` on npm](https://www.npmjs.com/package/@luxanimi/mailgrail)
- [Issues](https://github.com/LuxAnimi/MailGrail/issues)

## License

[MIT](LICENSE) © Maxime Dupuis
