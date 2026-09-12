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
      "function, and its type declarations. Commit them or generate them in CI, " +
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
];
