//------------------------------------------------------------------------------
// mailgrail.config.ts, documented.
//
// Descriptions only. Every default is read by actually calling `resolveConfig`,
// which is the single place they live -- the README's hand-copied table already
// drifted (it claims sourceDir defaults to "emails"; resolveConfig says
// "./emails"), which is the whole reason this file does not restate them.
//------------------------------------------------------------------------------

export type ConfigDoc = {
  /** Must match a key of MailgrailConfig — coverage is asserted both ways. */
  id: string;
  type: string;
  summary: string;
  description?: string;
};

export const configDocs: ConfigDoc[] = [
  {
    id: "sourceDir",
    type: "string",
    summary: "Where your templates live, relative to the config file.",
    description:
      "Must contain an entry point — `index.ts`, `index.tsx`, `index.js` or " +
      "`index.jsx` — exporting a `templates` array.",
  },
  {
    id: "outputDir",
    type: "string",
    summary: "Where compiled output is written, relative to the config file.",
    description:
      "Three files per template land here: the readable template, the render " +
      "function, and its type declarations, plus an `index` re-exporting all of " +
      "them and a `package.json`. Commit them or generate them in CI, " +
      "whichever suits — they are the artifact your backend imports.",
  },
  {
    id: "previewPort",
    type: "number",
    summary: "Port for `mailgrail preview`.",
  },
  {
    id: "typescript",
    type: "boolean",
    summary: "Whether to emit a `.d.ts` beside each compiled template.",
    description:
      "Turn it off for a JavaScript project; the `.js` render function is " +
      "emitted either way.",
  },
  {
    id: "templatingEngine",
    type: '"EJS" | "Handlebars" | "Mustache"',
    summary: "Which engine the compiled output targets.",
    description:
      "Also selects the template file extension and the module the generated " +
      "`.js` imports at run time. `mailgrail build` checks that engine is " +
      "installed and fails with an actionable message if it is not, so a missing " +
      "engine surfaces at build time rather than when an email is sent.",
  },
  {
    id: "moduleFormat",
    type: '"esm" | "cjs"',
    summary: "Module system the compiled output is written in.",
    description:
      "`esm` emits `import`/`export`, `cjs` emits `require`/`exports` for a " +
      "CommonJS backend. The `package.json` written beside the output declares " +
      "the matching `type`, and the build fails if a `package.json` already " +
      "there contradicts it — the two disagreeing is what makes Node refuse to " +
      "load the files at all.",
  },
  {
    id: "hideAppName",
    type: "boolean",
    summary: "Hide the project name in the preview UI.",
  },
  {
    id: "hideAppDescription",
    type: "boolean",
    summary: "Hide the project description in the preview UI.",
  },
  {
    id: "hideAppLogo",
    type: "boolean",
    summary: "Hide the logo in the preview UI.",
  },
  {
    id: "appName",
    type: "string",
    summary: "Title shown in the preview sidebar and browser tab.",
    description:
      "Defaults to the `name` in the nearest `package.json`. Ignored when " +
      "`hideAppName` is set.",
  },
  {
    id: "appDescription",
    type: "string",
    summary: "Subtitle shown under the title in the preview sidebar.",
    description:
      "Defaults to the `description` in the nearest `package.json`. Ignored " +
      "when `hideAppDescription` is set.",
  },
  {
    id: "locales",
    type: "string[]",
    summary: "The locales to build, as BCP 47 tags.",
    description:
      "Each template is built once per locale. Leave it unset and localization " +
      "is off: the build emits one unlocalized set, exactly as without it. Tags " +
      "are canonicalized, so `en_us` and `en-US` name the same locale. The " +
      "**Localization** guide walks through a full setup.",
  },
  {
    id: "defaultLocale",
    type: "string",
    summary: "The locale the source messages are written in.",
    description:
      "Defaults to the first of `locales`, and must be one of them. It is the " +
      "language `defineMessages()` is written in, what a missing translation " +
      "falls back to, and what a render function uses when asked for a locale " +
      "it was not built for. Setting it without `locales` fails the build.",
  },
  {
    id: "localesDir",
    type: "string",
    summary: "Where the translation catalogs live, relative to the config file.",
    description:
      "Defaults to a `locales` folder inside `sourceDir`. It holds one " +
      "`<locale>.json` per locale, which `mailgrail extract` creates and keeps " +
      "in line with the source messages.",
  },
  {
    id: "strictLocales",
    type: "boolean",
    summary: "Fail the build on incomplete translations.",
    description:
      "A missing translation, or a missing catalog file, normally warns, and " +
      "the default-locale text stands in for it. With this on, it fails the " +
      "build instead; turn it on in CI once your catalogs are complete. Broken " +
      "translations -- a message that does not parse, or uses an argument the " +
      "source does not have -- fail the build either way, and stale entries " +
      "only ever warn.",
  },
  {
    id: "timeZone",
    type: "string",
    summary: "The IANA time zone dates are formatted in.",
    description:
      "The default for every render function; a call can override it with " +
      "`{ timeZone }`. The build fails on a zone the running Node does not " +
      "know, rather than letting the first email that formats a date throw.",
  },
  {
    id: "previewDevices",
    type: "PreviewDevice[]",
    summary: "The devices the preview can frame an email at.",
    description:
      "Each is `{ type, width, label? }`, where `type` is `\"desktop\"`, " +
      "`\"tablet\"` or `\"mobile\"`. A desktop fills the preview and takes no " +
      "`width`; the others are framed at their `width` in pixels. `label` " +
      "defaults to the type's name. Unset, the preview offers a desktop, a " +
      "768px tablet and a 375px phone.",
  },
];
