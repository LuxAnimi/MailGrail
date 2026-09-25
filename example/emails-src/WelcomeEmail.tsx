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
import { defineMessages } from "../../src/config/index";
import type { Infer } from "../../src/dsl/schemas";
import { colors, fontSize, spacing } from "./theme";

//------------------------------------------------------------------------------
// The English text. French and Spanish are in ./locales/<locale>.json, kept in
// line with these by `mailgrail extract`.
const messages = defineMessages("welcome", {
  subject: "Welcome to MailGrail, {username}!",
  heading: "Welcome aboard.",
  greeting: "Hey {username}, your account is ready.",
  signedInAs: "Signed in as {email}.",
  pro: "★ Pro plan — unlimited projects & priority support",
  plan: "You are on the <b>{plan}</b> plan.",
  cta: "Open MailGrail",
  referral: "Your referral code: <code>{referralCode}</code>",
  referralHint: "Share it with a friend to earn free credits.",
  textWelcome: "Welcome, {username}!",
  textPro: "You are on Pro.",
  textStart: "Get started at https://mailgrail.com",
});

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
  mg.t(messages.subject, { username: "username" });

//------------------------------------------------------------------------------
// Branching goes through `mg` here for the same reason it does in the HTML:
// what ships is a template the engine fills in per email, so a plain `if` would
// pick its branch once, at build time, for everyone.
// Tags work here too, and plain text simply keeps what they wrap.
const textTemplate = (mg: TextTemplateContext<Params>): string =>
  mg.t(messages.textWelcome, { username: "username" }) +
  " " +
  mg.when(
    "isPro",
    () => mg.t(messages.textPro),
    () => mg.t(messages.plan, { plan: "plan", b: (chunks) => chunks }),
  ) +
  " " +
  mg.t(messages.textStart);

//------------------------------------------------------------------------------
const htmlTemplate = (mg: HtmlTemplateContext<Params>): ReactElement => (
  <BaseLayout mg={mg} width={600}>
    <MjmlColumn>
      {/* #region doc:welcome-body */}
      <Heading>{mg.t(messages.heading)}</Heading>

      <MainText>
        {mg.t(messages.greeting, { username: "username" })}
        <br />
        {mg.t(messages.signedInAs, { email: "email" })}
      </MainText>

      {mg.when(
        "isPro",
        () => <Note accent>{mg.t(messages.pro)}</Note>,
        () => (
          <Note>
            {mg.t(messages.plan, {
              plan: "plan",
              b: (chunks) => <Strong>{chunks}</Strong>,
            })}
          </Note>
        ),
      )}
      {/* #endregion doc:welcome-body */}

      <Button href="https://mailgrail.com/app" target="_blank" rel="noreferrer">
        {mg.t(messages.cta)}
      </Button>

      <Text
        align="center"
        color={colors.content.tertiary}
        fontSize={fontSize.xs}
        paddingTop={spacing.s8}
        paddingBottom={spacing.s4}
      >
        {mg.t(messages.referral, {
          referralCode: "referralCode",
          code: (chunks) => (
            <strong style={{ color: colors.content.primary, letterSpacing: "0.08em" }}>
              {chunks}
            </strong>
          ),
        })}
        <br />
        {mg.t(messages.referralHint)}
      </Text>
    </MjmlColumn>
  </BaseLayout>
);

//------------------------------------------------------------------------------
export const WelcomeEmail: TemplateDefinition<typeof paramsSchema> = {
  name: "welcome",
  sender: "welcome@mailgrail.com",
  category: "Onboarding",
  subjectTemplate,
  htmlTemplate,
  textTemplate,
  params: paramsSchema,
};
