//------------------------------------------------------------------------------
import type { ReactElement } from "react";
import { MjmlColumn } from "@faire/mjml-react";

//------------------------------------------------------------------------------
import BaseLayout from "./components/BaseLayout";
import Button from "./components/Button";
import Heading from "./components/Heading";
import MainText from "./components/MainText";
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
import { colors, fontSize, fontWeight, spacing } from "./theme";

//------------------------------------------------------------------------------
const paramsSchema = t.object({
  inviteUrl: t.string(),
  invitedBy: t.object({                        // object — nested sender info
    name: t.string(),
    email: t.string(),
  }),
  isAdmin: t.boolean(),                        // boolean — shows admin badge when true
  perks: t.array(t.string()),                  // array of string — feature list
  expiresIn: t.default(t.number(), 7),         // defaulted number — falls back to 7 days
});

//------------------------------------------------------------------------------
type Params = Infer<typeof paramsSchema>;

//------------------------------------------------------------------------------
const subjectTemplate = (mg: TextTemplateContext<Params>): string =>
  `${mg.render("invitedBy.name")} invited you to join mailgrail`;

//------------------------------------------------------------------------------
const textTemplate = (mg: TextTemplateContext<Params>): string =>
  `You've been invited by ${mg.render("invitedBy.name")} (${mg.render(
    "invitedBy.email",
  )}). Accept at ${mg.render("inviteUrl")}. Expires in ${mg.render(
    "expiresIn",
  )} days.`;

//------------------------------------------------------------------------------
const htmlTemplate = (mg: HtmlTemplateContext<Params>): ReactElement => (
  <BaseLayout width={600}>
    <MjmlColumn>
      <Heading>You're invited.</Heading>

      {mg.with("invitedBy", (sender) => (
        <MainText>
          {sender.render("name")}{" "}
          <span style={{ color: colors.content.quaternary }}>
            ({sender.render("email")})
          </span>
          <br />
          wants you to join them on mailgrail.
        </MainText>
      ))}

      {mg.when("isAdmin", () => (
        <Text
          align="center"
          color={colors.accent[500]}
          fontSize={fontSize.sm}
          fontWeight={fontWeight.bold}
          paddingTop={spacing.s5}
          paddingBottom={spacing.s2}
        >
          ★ You are being invited as an admin
        </Text>
      ))}

      <Text
        align="left"
        color={colors.content.tertiary}
        fontSize={fontSize.sm}
        paddingTop={spacing.s5}
        paddingLeft={spacing.s7}
        paddingRight={spacing.s7}
      >
        <ul style={{ margin: 0, paddingLeft: "1.2em" }}>
          {mg.each("perks", (perk, index) => (
            <li key={index} style={{ marginBottom: "6px", color: colors.content.secondary }}>
              {perk.render()}
            </li>
          ))}
        </ul>
      </Text>

      <Button href={mg.render("inviteUrl")} target="_blank" rel="noreferrer">
        Accept Invitation
      </Button>

      <Text
        align="center"
        color={colors.content.quaternary}
        fontSize={fontSize.xs}
        paddingTop={spacing.s6}
        paddingBottom={spacing.s4}
      >
        This invitation expires in{" "}
        <Strong color={colors.content.tertiary}>
          {mg.render("expiresIn")} days
        </Strong>
        .
      </Text>
    </MjmlColumn>
  </BaseLayout>
);

//------------------------------------------------------------------------------
export const TeamInviteEmail: TemplateDefinition<typeof paramsSchema> = {
  name: "team-invite",
  sender: "team@mailgrail.com",
  subjectTemplate,
  htmlTemplate,
  textTemplate,
  params: paramsSchema,
};
