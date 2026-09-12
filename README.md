# MailGrail

Type-safe email templates using React and MJML. Write your templates as React components, preview them live in a browser, and compile them to portable EJS files your backend can render — with full TypeScript types for every parameter.

**[Documentation →](https://luxanimi.github.io/MailGrail/)**

The site's reference pages are generated from this repository's own compiler,
so the inferred types and compiled output shown there are what MailGrail
actually emits. This README is the short version.

## Features

- **Type-safe parameters** — define your template parameters with a compact DSL; TypeScript infers the types end-to-end
- **React + MJML** — write templates as React components using any MJML component; MailGrail handles the rendering
- **Live preview** — a Vite-powered dev server shows your templates with placeholder data, hot-reloading on every save
- **Portable output** — compiles to a template file + `.js` + `.d.ts`; the generated
  module inlines its template, so it runs under plain Node with no bundler and no
  MailGrail dependency in production
- **Multi-engine** — EJS (default), Handlebars, and Mustache output supported

---

## Quick start

```sh
npx setup-mailgrail-app@latest
```

Run this inside an existing project. It will add MailGrail to your `package.json`, create a `mailgrail.config.ts`, and scaffold a starter template.

---

## Manual installation

```sh
npm install --save-dev mailgrail
npm install @faire/mjml-react react ejs
```

`@faire/mjml-react` and `react` are MailGrail's peer dependencies — your template
files import them directly, and MailGrail resolves them from your project.

`ejs` is the **templating engine**, imported by the *compiled output* rather than
by MailGrail itself. Engines are declared as optional peer dependencies, so npm
installs none of them for you — install the one matching your `templatingEngine`:

| `templatingEngine` | install | supported |
|---|---|---|
| `"EJS"` (default) | `npm install ejs` | `^5.0.0 \|\| ^6.0.0` |
| `"Handlebars"` | `npm install handlebars` | `^4.7.0` |
| `"Mustache"` | `npm install mustache` | `^4.2.0` |

`mailgrail build` checks the configured engine is installed and fails with an
actionable message if it is not, so a missing engine surfaces at build time
rather than when an email is sent.

> **Requirements** — Node `^20.19.0 || >=22.12.0`. MailGrail is ESM-only; import it
> from an ESM module or a TypeScript project with `module: "NodeNext"`.

Create a `mailgrail.config.ts` in your project root:

```ts
import { defineConfig } from "mailgrail";

export default defineConfig({
  sourceDir: "emails-src",
  outputDir: "emails-dist",
});
```

---

## Defining a template

A template is a plain object exported from a `.tsx` file. It declares its parameters, an HTML template (React + MJML), a subject line, and a plain-text fallback.

```tsx
import type { ReactElement } from "react";
import { MjmlSection, MjmlColumn, MjmlText, MjmlButton } from "@faire/mjml-react";
import { t, type TemplateDefinition, type RenderTemplateContext } from "mailgrail";
import type { Infer } from "mailgrail/dsl";
import BaseLayout from "./components/BaseLayout";

// 1. Define your parameters
const paramsSchema = t.object({
  username: t.string(),
  confirmationUrl: t.string(),
});

type Params = Infer<typeof paramsSchema>;

// 2. Write the HTML template
// BaseLayout already wraps children in MjmlSection — start directly with MjmlColumn
const htmlTemplate = (mg: RenderTemplateContext<Params>): ReactElement => (
  <BaseLayout>
    <MjmlColumn>
      <MjmlText>Welcome, {mg.render("username")}!</MjmlText>
      <MjmlButton href={mg.render("confirmationUrl")}>
        Confirm your account
      </MjmlButton>
    </MjmlColumn>
  </BaseLayout>
);

// 3. Write the subject and plain-text version
const subjectTemplate = (params: Params): string =>
  `Welcome, ${params.username}!`;

const textTemplate = (params: Params): string =>
  `Welcome, ${params.username}! Confirm your account: ${params.confirmationUrl}`;

// 4. Export the template definition
export const ConfirmEmail: TemplateDefinition<typeof paramsSchema> = {
  name: "confirm-email",
  sender: "hello@example.com",
  params: paramsSchema,
  htmlTemplate,
  subjectTemplate,
  textTemplate,
};
```

Then export all your templates from `emails/index.ts`:

```ts
import type { TemplateDefinition } from "mailgrail";
import type { Schema } from "mailgrail/dsl";
import { ConfirmEmail } from "./ConfirmEmail";

export const templates: TemplateDefinition<Schema<any>>[] = [ConfirmEmail];
```

---

## CLI

### `mailgrail preview`

Starts the live preview server. Templates reload automatically on save.

```sh
mailgrail preview
# → http://localhost:7777
```

Options:

| Flag | Default | Description |
|---|---|---|
| `--configPath <path>` | `./mailgrail.config.ts` | Path to your config file |

### `mailgrail build`

Compiles all templates to `.ejs`, `.js`, and `.d.ts` files.

```sh
mailgrail build
```

Options:

| Flag | Default | Description |
|---|---|---|
| `--configPath <path>` | `./mailgrail.config.ts` | Path to your config file |

---

## DSL reference

Use `t.*` to describe the shape of your template parameters. MailGrail uses the schema at build time to generate TypeScript types and at preview time to generate placeholder data.

### `t.string()`

```ts
username: t.string()
// → username: string
```

### `t.number()`

```ts
invoiceTotal: t.number()
// → invoiceTotal: number
```

### `t.boolean()`

```ts
isAdmin: t.boolean()
// → isAdmin: boolean
```

### `t.object(shape)`

```ts
address: t.object({
  street: t.string(),
  city: t.string(),
  country: t.string(),
})
// → address: { street: string; city: string; country: string }
```

### `t.array(element)`

Arrays of primitives:

```ts
tags: t.array(t.string())
// → tags: string[]
```

Arrays of objects:

```ts
items: t.array(
  t.object({
    name: t.string(),
    quantity: t.number(),
    isFulfilled: t.boolean(),
  })
)
// → items: { name: string; quantity: number; isFulfilled: boolean }[]
```

Arrays of arrays:

```ts
matrix: t.array(t.array(t.string()))
// → matrix: string[][]
```

### `t.optional(schema)`

The parameter may be omitted. It renders as an empty string when it is.

```ts
nickname: t.optional(t.string())
// → nickname?: string
// omitted → renders nothing
```

Use `mg.when` to conditionally render based on an optional boolean, or guard with a null check in `subjectTemplate` and `textTemplate`.

### `t.default(schema, value)`

The parameter may be omitted, and renders `value` when it is. Omittable on
input, never undefined at render time.

```ts
role: t.default(t.string(), "user")
// → role?: string
// omitted → renders "user"
```

> **`t.optional` vs `t.default`** — both let the caller omit the key; they differ only in what appears when it is absent. Use `t.optional` when there is genuinely nothing to show (and reach for `mg.when` to branch on it), and `t.default` when there is a sensible stand-in value.

`t.default(t.optional(t.string()), "user")` is also valid and means exactly the same as `t.default(t.string(), "user")` — the nesting is never required.

> **Missing values never throw.** The generated module normalizes its input
> before rendering: every declared key is filled in, `t.default` values are
> applied, and an absent optional becomes an empty string. Without that, EJS
> would raise `ReferenceError` on a missing key while Handlebars and Mustache
> silently rendered nothing.

---

## Render context API

The `htmlTemplate` function receives a render context (`mg`) instead of raw params. This allows MailGrail to track which parameters you're using and generate the correct template placeholders in the compiled output.

> **Type safety** — all path arguments are fully typed. The TypeScript compiler will error if you pass a path that doesn't exist on your schema or use the wrong method for a given type (e.g. `mg.each` on a non-array field).

### `mg.render(path)`

Renders a scalar value. `path` can be dot-separated for nested access.

```tsx
const paramsSchema = t.object({
  username: t.string(),
  invoice: t.object({
    number: t.string(),
    total: t.number(),
  }),
});

// Top-level field
mg.render("username")

// Nested field
mg.render("invoice.number")
mg.render("invoice.total")
```

In the compiled EJS output, `mg.render("username")` becomes `<%= username %>`.

### `mg.when(path, render, otherwise?)`

Conditionally renders based on a boolean field. The `otherwise` branch is optional.

```tsx
const paramsSchema = t.object({
  isPremium: t.boolean(),
});

mg.when("isPremium",
  () => <MjmlText>You have premium access.</MjmlText>,
  () => <MjmlText>Upgrade to unlock all features.</MjmlText>
)

// Without an else branch:
mg.when("isPremium", () => <PremiumBadge />)
```

In EJS output: `<% if (isPremium) { %>...<% } else { %>...<% } %>`.

### `mg.unless(path, render, otherwise?)`

Inverse of `mg.when`. Renders when the value is falsy.

```tsx
mg.unless("isVerified", () => <VerifyBanner />)
```

### `mg.each(path, (item, index) => ReactNode)`

Iterates over an array field. The `item` argument is a scoped context for the current element.

**Array of primitives** — call `item.render()` with no argument:

```tsx
const paramsSchema = t.object({
  tags: t.array(t.string()),
});

mg.each("tags", (tag, index) => (
  <MjmlText key={index}>{tag.render()}</MjmlText>
))
```

**Array of objects** — the item context has the full `render`/`when`/`unless`/`each`/`with` API scoped to the element type:

```tsx
const paramsSchema = t.object({
  items: t.array(
    t.object({
      name: t.string(),
      quantity: t.number(),
      isFulfilled: t.boolean(),
    })
  ),
});

mg.each("items", (item, index) => (
  <tr key={index}>
    <td>{item.render("name")}</td>
    <td>{item.render("quantity")}</td>
    {item.when("isFulfilled",
      () => <td>✓</td>,
      () => <td>Pending</td>
    )}
  </tr>
))
```

**Array of arrays:**

```tsx
const paramsSchema = t.object({
  schedule: t.array(
    t.array(
      t.object({ time: t.string(), event: t.string() })
    )
  ),
});

mg.each("schedule", (day) =>
  day.each((slot) => (
    <MjmlText>{slot.render("time")}: {slot.render("event")}</MjmlText>
  ))
)
```

### `mg.with(path, (scoped) => ReactNode)`

Scopes the context to a nested object, removing the need to repeat the path prefix. Useful for deeply nested schemas.

```tsx
const paramsSchema = t.object({
  user: t.object({
    name: t.string(),
    email: t.string(),
    plan: t.object({
      name: t.string(),
      expiresAt: t.string(),
    }),
  }),
});

mg.with("user", (user) => (
  <>
    <MjmlText>Hello, {user.render("name")} ({user.render("email")})</MjmlText>
    {user.with("plan", (plan) => (
      <MjmlText>
        Your {plan.render("name")} plan expires on {plan.render("expiresAt")}.
      </MjmlText>
    ))}
  </>
))
```

### Combining everything

Here's a complete example using all render context methods:

```tsx
const paramsSchema = t.object({
  username: t.string(),
  isAdmin: t.boolean(),
  greeting: t.default(t.string(), "Hello"),
  tags: t.array(t.string()),
  orders: t.array(
    t.object({
      id: t.string(),
      total: t.number(),
      isPaid: t.boolean(),
    })
  ),
  address: t.object({
    city: t.string(),
    country: t.string(),
  }),
});

type Params = Infer<typeof paramsSchema>;

const htmlTemplate = (mg: RenderTemplateContext<Params>): ReactElement => (
  <BaseLayout>
    <MjmlSection>
      <MjmlColumn>

        {/* Render scalar values */}
        <MjmlText fontSize="24px">
          {mg.render("greeting")}, {mg.render("username")}!
        </MjmlText>

        {/* Conditional rendering */}
        {mg.when("isAdmin", () => (
          <MjmlText color="red">You have admin access.</MjmlText>
        ))}

        {/* Iterate over a primitive array */}
        <MjmlText>Your tags:</MjmlText>
        {mg.each("tags", (tag) => (
          <MjmlText>• {tag.render()}</MjmlText>
        ))}

        {/* Iterate over an object array */}
        <MjmlText fontWeight="bold">Your orders:</MjmlText>
        {mg.each("orders", (order) => (
          <MjmlText>
            Order {order.render("id")} — ${order.render("total")}
            {order.when("isPaid",
              () => <> (paid)</>,
              () => <> (pending)</>
            )}
          </MjmlText>
        ))}

        {/* Scope to a nested object */}
        {mg.with("address", (addr) => (
          <MjmlText>
            Shipping to: {addr.render("city")}, {addr.render("country")}
          </MjmlText>
        ))}

      </MjmlColumn>
    </MjmlSection>
  </BaseLayout>
);
```

---

## Config reference

```ts
import { defineConfig } from "mailgrail";

export default defineConfig({
  sourceDir: "emails-src",
  outputDir: "emails-dist",
  typescript: true,
  previewPort: 7777,
  templatingEngine: "EJS",
});
```

| Option | Type | Default | Description |
|---|---|---|---|
| `sourceDir` | `string` | `"./emails-src"` | Path to your templates directory, relative to the config file |
| `outputDir` | `string` | `"./emails-dist"` | Path for compiled output, relative to the config file |
| `previewPort` | `number` | `7777` | Port for the preview server |
| `typescript` | `boolean` | `true` | Whether to emit `.d.ts` type files |
| `templatingEngine` | `"EJS" \| "Handlebars" \| "Mustache"` | `"EJS"` | Template engine for compiled output. Also selects the template file extension (`.ejs` / `.hbs` / `.mustache`) and the module the generated `.js` imports — install that engine in your project. |
| `hideAppName` | `boolean` | `false` | Hide the project name in the preview UI |
| `hideAppDescription` | `boolean` | `false` | Hide the description in the preview UI |
| `hideAppLogo` | `boolean` | `false` | Hide the logo in the preview UI |

---

## Output format

Running `mailgrail build` produces three files per template. For a template named `"confirm-email"`:

```
emails-dist/
  confirm-email.ejs     ← full HTML with EJS placeholders
  confirm-email.js      ← render function (ESM + ejs)
  confirm-email.d.ts    ← TypeScript types
```

The template file's extension follows `templatingEngine` (`.ejs`, `.hbs` or
`.mustache`). It is written for readability and debugging — the generated `.js`
inlines the same template string, so it has no dependency on that file at runtime.

### `.d.ts` — type definitions

```ts
export type ConfirmEmailParams = {
  username: string;
  confirmationUrl: string;
};

export declare function renderConfirmEmail(params: ConfirmEmailParams): {
  name: "confirm-email";
  sender: string;
  subject: string;
  text: string;
  html: string;
};
```

### `.js` — render function

Inlines the compiled template and exposes a typed render function:

```js
import ejs from "ejs";

const htmlTemplate = "<!doctype html>...";

export function renderConfirmEmail(params) {
  return {
    name: "confirm-email",
    sender: "hello@example.com",
    subject: ejs.render("Welcome, <%- username %>!", params),
    text: ejs.render("Welcome, <%- username %>! ...", params),
    html: ejs.render(htmlTemplate, params),
  };
}
```

### Using the output in your backend

```ts
import { renderConfirmEmail } from "./emails-dist/confirm-email.js";
import nodemailer from "nodemailer";

const email = renderConfirmEmail({
  username: "Alice",
  confirmationUrl: "https://example.com/confirm?token=abc123",
});

await transporter.sendMail({
  from: email.sender,
  to: "alice@example.com",
  subject: email.subject,
  text: email.text,
  html: email.html,
});
```

The compiled output only depends on your templating engine at runtime — no MailGrail,
no React, no MJML, and no bundler. The heavy lifting happens at build time.

---

## Setup command

The fastest way to add MailGrail to an existing project:

```sh
cd your-project
npx setup-mailgrail-app@latest
```

It asks a few questions:

```
  setup-mailgrail-app

  Project directory? › .
  Language? › TypeScript
  Email source directory? › emails
  Build output directory? › emails-dist
```

Then it:
- Adds `mailgrail`, `@faire/mjml-react`, `react` and `ejs` to your `package.json`
- Adds `preview-emails` and `build-emails` scripts to your `package.json`
- Creates `mailgrail.config.ts`
- Scaffolds a starter template in `emails/`:

```
emails-src/
  index.ts
  WelcomeEmail.tsx
  components/
    BaseLayout.tsx
    theme.ts
```

---

## License

[MIT](LICENSE) © Maxime Dupuis
