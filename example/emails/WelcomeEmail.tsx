//------------------------------------------------------------------------------
import type { ReactElement } from "react";
import { MjmlColumn } from "@faire/mjml-react";

//------------------------------------------------------------------------------
import BaseLayout from "./components/BaseLayout";
import Button from "./components/Button";
import Heading from "./components/Heading";
import MainText from "./components/MainText";
import Text from "./components/Text";

//------------------------------------------------------------------------------
import type { HtmlTemplateContext, TemplateDefinition } from "../../src/cli/types";
import { t } from "../../src/dsl/index";
import type { Infer } from "../../src/dsl/schemas";
import { colors, fontSize, fontWeight, spacing } from "./theme";

//------------------------------------------------------------------------------
const paramsSchema = t.object({
  username: t.string(),
  email: t.string(),
  isPro: t.boolean(),                          // boolean  — toggles the pro badge
  referralCode: t.optional(t.string()),        // optional — not required, shown when present
  plan: t.default(t.string(), "free"),         // defaulted — falls back to "free"
});

//------------------------------------------------------------------------------
type Params = Infer<typeof paramsSchema>;

//------------------------------------------------------------------------------
const subjectTemplate = (params: Params): string =>
  `Welcome to mailgrail, ${params.username}!`;

//------------------------------------------------------------------------------
const textTemplate = (params: Params): string =>
  `Welcome, ${params.username}! You are on the ${params.plan} plan. Get started at https://mailgrail.com`;

//------------------------------------------------------------------------------
const htmlTemplate = (mg: HtmlTemplateContext<Params>): ReactElement => (
  <BaseLayout width={600}>
    <MjmlColumn>
      <Heading>Welcome aboard.</Heading>

      <MainText>
        Hey {mg.render("username")}, your account is ready.
        <br />
        Signed in as {mg.render("email")}.
      </MainText>

      {mg.when(
        "isPro",
        () => (
          <Text
            align="center"
            color={colors.accent[500]}
            fontSize={fontSize.sm}
            fontWeight={fontWeight.bold}
            paddingTop={spacing.s5}
            paddingBottom={spacing.s3}
          >
            ★ Pro plan — unlimited projects &amp; priority support
          </Text>
        ),
        () => (
          <Text
            align="center"
            color={colors.content.tertiary}
            fontSize={fontSize.sm}
            paddingTop={spacing.s5}
            paddingBottom={spacing.s3}
          >
            You are on the{" "}
            <strong style={{ color: colors.content.secondary }}>
              {mg.render("plan")}
            </strong>{" "}
            plan.
          </Text>
        ),
      )}

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
