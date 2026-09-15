import path from "path";
import type { ScaffoldOptions } from "./prompts.js";

//------------------------------------------------------------------------------
export function getTemplates(opts: ScaffoldOptions): Record<string, string> {
  const { sourceDir, outputDir, typescript: ts } = opts;
  const ext = ts ? "ts" : "js";
  const extx = ts ? "tsx" : "jsx";

  const files: Record<string, string> = {};

  // mailgrail.config
  files[`mailgrail.config.${ext}`] = `import { defineConfig } from "@luxanimi/mailgrail";

export default defineConfig({
  sourceDir: "${sourceDir}",
  outputDir: "${outputDir}",
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
    : `import { WelcomeEmail } from "./WelcomeEmail.js";

// Add your templates here
export const templates = [WelcomeEmail];
`;

  // WelcomeEmail template
  files[`${sourceDir}/WelcomeEmail.${extx}`] = ts
    ? `import type { ReactElement } from "react";
import { MjmlColumn, MjmlButton, MjmlText } from "@faire/mjml-react";
import { t, type TemplateDefinition, type RenderTemplateContext } from "@luxanimi/mailgrail";
import type { Infer } from "@luxanimi/mailgrail/dsl";
import BaseLayout from "./components/BaseLayout.js";

const paramsSchema = t.object({
  username: t.string(),
  ctaUrl: t.string(),
});

type Params = Infer<typeof paramsSchema>;

const htmlTemplate = (mg: RenderTemplateContext<Params>): ReactElement => (
  <BaseLayout>
    <MjmlColumn>
      <MjmlText fontSize="24px" fontWeight="bold">
        Welcome, {mg.render("username")}!
      </MjmlText>
      <MjmlText>
        Thanks for signing up. Click below to get started.
      </MjmlText>
      <MjmlButton href={mg.render("ctaUrl")}>
        Get Started
      </MjmlButton>
    </MjmlColumn>
  </BaseLayout>
);

const subjectTemplate = (params: Params): string =>
  \`Welcome, \${params.username}!\`;

const textTemplate = (params: Params): string =>
  \`Welcome, \${params.username}! Get started: \${params.ctaUrl}\`;

export const WelcomeEmail: TemplateDefinition<typeof paramsSchema> = {
  name: "welcome-email",
  sender: "hello@example.com",
  params: paramsSchema,
  htmlTemplate,
  subjectTemplate,
  textTemplate,
};
`
    : `import { MjmlColumn, MjmlButton, MjmlText } from "@faire/mjml-react";
import { t } from "@luxanimi/mailgrail";
import BaseLayout from "./components/BaseLayout.js";

const paramsSchema = t.object({
  username: t.string(),
  ctaUrl: t.string(),
});

const htmlTemplate = (mg) => (
  <BaseLayout>
    <MjmlColumn>
      <MjmlText fontSize="24px" fontWeight="bold">
        Welcome, {mg.render("username")}!
      </MjmlText>
      <MjmlText>
        Thanks for signing up. Click below to get started.
      </MjmlText>
      <MjmlButton href={mg.render("ctaUrl")}>
        Get Started
      </MjmlButton>
    </MjmlColumn>
  </BaseLayout>
);

const subjectTemplate = (params) => \`Welcome, \${params.username}!\`;

const textTemplate = (params) =>
  \`Welcome, \${params.username}! Get started: \${params.ctaUrl}\`;

export const WelcomeEmail = {
  name: "welcome-email",
  sender: "hello@example.com",
  params: paramsSchema,
  htmlTemplate,
  subjectTemplate,
  textTemplate,
};
`;

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
