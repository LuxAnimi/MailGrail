//------------------------------------------------------------------------------
import type { ReactElement } from "react";
import { MjmlColumn } from "@faire/mjml-react";

//------------------------------------------------------------------------------
import BaseLayout from "./components/BaseLayout";
import Button from "./components/Button";
import Heading from "./components/Heading";
import MainText from "./components/MainText";
import Note from "./components/Note";
import Strong from "./components/Strong";
import Text from "./components/Text";

//------------------------------------------------------------------------------
import type {
  HtmlTemplateContext,
  TemplateDefinition,
  TextTemplateContext,
} from "../../src/cli/types";
import { t } from "../../src/dsl/index";
import type { Infer } from "../../src/dsl/schemas";
import { colors, fontSize, spacing } from "./theme";

//------------------------------------------------------------------------------
// #region doc:welcome-schema
const paramsSchema = t.object({
  username: t.string(),
  email: t.string(),
  isPro: t.boolean(),                          // boolean  — toggles the pro badge
  referralCode: t.optional(t.string()),        // optional — not required, shown when present
  plan: t.default(t.string(), "free"),         // defaulted — falls back to "free"
});
// #endregion doc:welcome-schema

//------------------------------------------------------------------------------
type Params = Infer<typeof paramsSchema>;

//------------------------------------------------------------------------------
const subjectTemplate = (mg: TextTemplateContext<Params>): string =>
  `Welcome to mailgrail, ${mg.render("username")}!`;

//------------------------------------------------------------------------------
// Branching goes through `mg` here for the same reason it does in the HTML:
// what ships is a template the engine fills in per email, so a plain `if` would
// pick its branch once, at build time, for everyone.
const textTemplate = (mg: TextTemplateContext<Params>): string =>
  `Welcome, ${mg.render("username")}! ` +
  mg.when(
    "isPro",
    () => `You are on Pro.`,
    () => `You are on the ${mg.render("plan")} plan.`,
  ) +
  ` Get started at https://mailgrail.com`;

//------------------------------------------------------------------------------
const htmlTemplate = (mg: HtmlTemplateContext<Params>): ReactElement => (
  <BaseLayout width={600}>
    <MjmlColumn>
      {/* #region doc:welcome-body */}
      <Heading>Welcome aboard.</Heading>

      <MainText>
        Hey {mg.render("username")}, your account is ready.
        <br />
        Signed in as {mg.render("email")}.
      </MainText>

      {mg.when(
        "isPro",
        () => <Note accent>★ Pro plan — unlimited projects &amp; priority support</Note>,
        () => (
          <Note>
            You are on the <Strong>{mg.render("plan")}</Strong> plan.
          </Note>
        ),
      )}
      {/* #endregion doc:welcome-body */}

      <Button href="https://mailgrail.com/app" target="_blank" rel="noreferrer">
        Open mailgrail
      </Button>

      <Text
        align="center"
        color={colors.content.quaternary}
        fontSize={fontSize.xs}
        paddingTop={spacing.s8}
        paddingBottom={spacing.s4}
      >
        Your referral code:{" "}
        <strong style={{ color: colors.content.tertiary, letterSpacing: "0.08em" }}>
          {mg.render("referralCode")}
        </strong>
        <br />
        Share it with a friend to earn free credits.
      </Text>
    </MjmlColumn>
  </BaseLayout>
);

//------------------------------------------------------------------------------
export const WelcomeEmail: TemplateDefinition<typeof paramsSchema> = {
  name: "welcome",
  sender: "welcome@mailgrail.com",
  subjectTemplate,
  htmlTemplate,
  textTemplate,
  params: paramsSchema,
};
