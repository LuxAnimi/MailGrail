import path from "path";
import type { ScaffoldOptions } from "./prompts.js";

//------------------------------------------------------------------------------
export function getTemplates(opts: ScaffoldOptions): Record<string, string> {
  const { sourceDir, outputDir, typescript: ts, locales } = opts;
  const localized = locales.length > 0;
  const ext = ts ? "ts" : "js";
  const extx = ts ? "tsx" : "jsx";

  const files: Record<string, string> = {};

  // mailgrail.config
  files[`mailgrail.config.${ext}`] = `import { defineConfig } from "@luxanimi/mailgrail";

export default defineConfig({
  sourceDir: "${sourceDir}",
  outputDir: "${outputDir}",${
    localized
      ? `
  // Each template is built once per language. The first is the one the
  // messages are written in, and what a missing translation falls back to.
  locales: ${JSON.stringify(locales).replace(/,/g, ", ")},`
      : ""
  }
});
`;

  // emails/index
  files[`${sourceDir}/index.${ext}`] = ts
    ? `import type { TemplateDefinition } from "@luxanimi/mailgrail";
import type { Schema } from "@luxanimi/mailgrail/dsl";
import { WelcomeEmail } from "./WelcomeEmail.js";

// Add your templates here
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const templates: TemplateDefinition<Schema<any>>[] = [WelcomeEmail];
`
    : `import { WelcomeEmail } from "./WelcomeEmail.jsx";

// Add your templates here
export const templates = [WelcomeEmail];
`;

  // WelcomeEmail template
  //
  // Relative imports say ".js" in TypeScript, which esbuild maps onto the .ts
  // or .tsx file, but it never maps ".js" onto a .jsx file -- so the JavaScript
  // variant names ".jsx" outright, or its build cannot find the template.
  files[`${sourceDir}/WelcomeEmail.${extx}`] = welcomeEmail(ts, localized);

  // Translation catalogs -- localized projects only. What `mailgrail extract`
  // would write: the source text for the first language, and an empty string,
  // meaning "not translated yet", for each message in every other one.
  if (localized) {
    const [source, ...others] = locales;
    files[`${sourceDir}/locales/${source}.json`] = catalog(WELCOME_MESSAGES);
    for (const locale of others) {
      files[`${sourceDir}/locales/${locale}.json`] = catalog(
        Object.fromEntries(Object.keys(WELCOME_MESSAGES).map((id) => [id, ""])),
      );
    }
  }

  // BaseLayout component
  files[`${sourceDir}/components/BaseLayout.${extx}`] = ts
    ? `import type { ReactNode } from "react";
import {
  Mjml,
  MjmlBody,
  MjmlHead,
  MjmlStyle,
  MjmlAttributes,
  MjmlAll,
  MjmlSection,
  MjmlWrapper,
} from "@faire/mjml-react";
import { colors } from "./theme.js";

type BaseLayoutProps = {
  children: ReactNode;
  width?: number;
};

export default function BaseLayout({ children, width = 600 }: BaseLayoutProps) {
  return (
    <Mjml>
      <MjmlHead>
        <MjmlAttributes>
          <MjmlAll
            fontFamily="Arial, sans-serif"
            fontSize="16px"
            lineHeight="1.6"
            color={colors.text}
            padding="0"
          />
        </MjmlAttributes>
        <MjmlStyle>{\`
          body { -webkit-font-smoothing: antialiased; }
          a { color: inherit; }
        \`}</MjmlStyle>
      </MjmlHead>
      <MjmlBody width={width} backgroundColor={colors.background}>
        <MjmlWrapper
          backgroundColor={colors.surface}
          paddingTop="40px"
          paddingBottom="40px"
        >
          <MjmlSection>{children}</MjmlSection>
        </MjmlWrapper>
      </MjmlBody>
    </Mjml>
  );
}
`
    : `import {
  Mjml,
  MjmlBody,
  MjmlHead,
  MjmlStyle,
  MjmlAttributes,
  MjmlAll,
  MjmlSection,
  MjmlWrapper,
} from "@faire/mjml-react";
import { colors } from "./theme.js";

export default function BaseLayout({ children, width = 600 }) {
  return (
    <Mjml>
      <MjmlHead>
        <MjmlAttributes>
          <MjmlAll
            fontFamily="Arial, sans-serif"
            fontSize="16px"
            lineHeight="1.6"
            color={colors.text}
            padding="0"
          />
        </MjmlAttributes>
        <MjmlStyle>{\`
          body { -webkit-font-smoothing: antialiased; }
          a { color: inherit; }
        \`}</MjmlStyle>
      </MjmlHead>
      <MjmlBody width={width} backgroundColor={colors.background}>
        <MjmlWrapper
          backgroundColor={colors.surface}
          paddingTop="40px"
          paddingBottom="40px"
        >
          <MjmlSection>{children}</MjmlSection>
        </MjmlWrapper>
      </MjmlBody>
    </Mjml>
  );
}
`;

  // theme
  files[`${sourceDir}/components/theme.${ext}`] = `export const colors = {
  primary: "#0066cc",
  text: "#333333",
  muted: "#888888",
  background: "#f5f5f5",
  surface: "#ffffff",
};

export const fontSize = {
  sm: "14px",
  base: "16px",
  lg: "20px",
  xl: "24px",
  "2xl": "32px",
};

export const spacing = {
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
};
`;

  // tsconfig -- TypeScript projects only
  //
  // mailgrail loads templates through esbuild, which strips types without
  // checking them, so nothing else ever runs tsc over this directory. It lives
  // in the source directory rather than the project root so it can never
  // collide with an existing tsconfig.json, and editors apply it to these files
  // because it is the nearest one. "Bundler" resolution models esbuild, which
  // is what actually resolves these imports.
  if (ts) {
    const config = path.posix.relative(sourceDir, `mailgrail.config.${ext}`);
    files[`${sourceDir}/tsconfig.json`] =
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "ESNext",
            moduleResolution: "Bundler",
            jsx: "react-jsx",
            strict: true,
            isolatedModules: true,
            skipLibCheck: true,
            noEmit: true,
          },
          include: ["**/*.ts", "**/*.tsx", config],
        },
        null,
        2,
      ) + "\n";
  }

  return files;
}

//------------------------------------------------------------------------------
// The starter template's text, by catalog id, when the project is localized.
// It is English: a project whose first language is another one rewrites it,
// which the scaffolder says in its next steps.
//------------------------------------------------------------------------------
const WELCOME_NAMESPACE = "welcome-email";

const WELCOME_TEXT = {
  subject: "Welcome, {username}!",
  heading: "Welcome, {username}!",
  body: "Thanks for signing up. Click below to get started.",
  cta: "Get Started",
  text: "Welcome, {username}! Get started: {ctaUrl}",
};

const WELCOME_MESSAGES: Record<string, string> = Object.fromEntries(
  Object.entries(WELCOME_TEXT).map(([key, text]) => [`${WELCOME_NAMESPACE}.${key}`, text]),
);

// Keys sorted, two-space indent and a final newline: byte for byte what
// `mailgrail extract` writes, so its first run changes nothing.
function catalog(entries: Record<string, string>): string {
  const sorted = Object.fromEntries(
    Object.entries(entries).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
  return JSON.stringify(sorted, null, 2) + "\n";
}

//------------------------------------------------------------------------------
// The starter template, in TypeScript or JavaScript, with its text either
// inline or in messages rendered through `mg.t`.
//------------------------------------------------------------------------------
function welcomeEmail(ts: boolean, localized: boolean): string {
  const q = (text: string) => JSON.stringify(text);

  // What differs between the two: where each piece of text comes from.
  const text = localized
    ? {
        heading: `{mg.t(messages.heading, { username: "username" })}`,
        body: `{mg.t(messages.body)}`,
        cta: `{mg.t(messages.cta)}`,
        subject: `mg.t(messages.subject, { username: "username" })`,
        text: `mg.t(messages.text, { username: "username", ctaUrl: "ctaUrl" })`,
      }
    : {
        heading: `Welcome, {mg.render("username")}!`,
        body: `Thanks for signing up. Click below to get started.`,
        cta: `Get Started`,
        subject: `\`Welcome, \${mg.render("username")}!\``,
        text: `\`Welcome, \${mg.render("username")}! Get started: \${mg.render("ctaUrl")}\``,
      };

  const messages = localized
    ? `
// The text, in the first of the config's locales. Translations live in
// locales/<locale>.json; run \`mailgrail extract\` after changing these.
const messages = defineMessages(${q(WELCOME_NAMESPACE)}, {
${Object.entries(WELCOME_TEXT)
  .map(([key, value]) => `  ${key}: ${q(value)},`)
  .join("\n")}
});
`
    : "";

  const htmlBody = `  <BaseLayout>
    <MjmlColumn>
      <MjmlText fontSize="24px" fontWeight="bold">
        ${text.heading}
      </MjmlText>
      <MjmlText>
        ${text.body}
      </MjmlText>
      <MjmlButton href={mg.render("ctaUrl")}>
        ${text.cta}
      </MjmlButton>
    </MjmlColumn>
  </BaseLayout>`;

  const definition = `  name: "welcome-email",
  sender: "hello@example.com",
  params: paramsSchema,
  htmlTemplate,
  subjectTemplate,
  textTemplate,`;

  if (ts) {
    return `import type { ReactElement } from "react";
import { MjmlColumn, MjmlButton, MjmlText } from "@faire/mjml-react";
import {
  t,${localized ? "\n  defineMessages," : ""}
  type TemplateDefinition,
  type RenderTemplateContext,
  type TextTemplateContext,
} from "@luxanimi/mailgrail";
import type { Infer } from "@luxanimi/mailgrail/dsl";
import BaseLayout from "./components/BaseLayout.js";

const paramsSchema = t.object({
  username: t.string(),
  ctaUrl: t.string(),
});

type Params = Infer<typeof paramsSchema>;
${messages}
const htmlTemplate = (mg: RenderTemplateContext<Params>): ReactElement => (
${htmlBody}
);

const subjectTemplate = (mg: TextTemplateContext<Params>): string =>
  ${text.subject};

const textTemplate = (mg: TextTemplateContext<Params>): string =>
  ${text.text};

export const WelcomeEmail: TemplateDefinition<typeof paramsSchema> = {
${definition}
};
`;
  }

  return `import { MjmlColumn, MjmlButton, MjmlText } from "@faire/mjml-react";
import { t${localized ? ", defineMessages" : ""} } from "@luxanimi/mailgrail";
import BaseLayout from "./components/BaseLayout.jsx";

const paramsSchema = t.object({
  username: t.string(),
  ctaUrl: t.string(),
});
${messages}
const htmlTemplate = (mg) => (
${htmlBody}
);

const subjectTemplate = (mg) => ${text.subject};

const textTemplate = (mg) =>
  ${text.text};

export const WelcomeEmail = {
${definition}
};
`;
}
