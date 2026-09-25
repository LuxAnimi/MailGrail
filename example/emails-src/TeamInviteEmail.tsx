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
import { defineMessages } from "../../src/config/index";
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
// `days` is a plural, so "1 day" and "7 days" both come out right -- and French
// and Spanish get their own plural rules, not English's.
const messages = defineMessages("team-invite", {
  subject: "{name} invited you to join MailGrail",
  heading: "You’re invited.",
  invitedBy:
    "{name} <muted>({email})</muted><line>wants you to join them on MailGrail.</line>",
  admin: "★ You are being invited as an admin",
  cta: "Accept invitation",
  expires:
    "This invitation expires in <b>{days, plural, one {# day} other {# days}}</b>.",
  text:
    "You’ve been invited by {name} ({email}). Accept at {url}. " +
    "{days, plural, one {Expires in # day.} other {Expires in # days.}}",
});

//------------------------------------------------------------------------------
type Params = Infer<typeof paramsSchema>;

//------------------------------------------------------------------------------
const subjectTemplate = (mg: TextTemplateContext<Params>): string =>
  mg.t(messages.subject, { name: "invitedBy.name" });

//------------------------------------------------------------------------------
const textTemplate = (mg: TextTemplateContext<Params>): string =>
  mg.t(messages.text, {
    name: "invitedBy.name",
    email: "invitedBy.email",
    url: "inviteUrl",
    days: "expiresIn",
  });

//------------------------------------------------------------------------------
const htmlTemplate = (mg: HtmlTemplateContext<Params>): ReactElement => (
  <BaseLayout mg={mg} width={600}>
    <MjmlColumn>
      <Heading>{mg.t(messages.heading)}</Heading>

      {/* Paths inside `with` are relative to it, for `t` as for `render`. The
          line break is a tag, so a translation can move it with the words. */}
      {mg.with("invitedBy", (sender) => (
        <MainText>
          {sender.t(messages.invitedBy, {
            name: "name",
            email: "email",
            muted: (chunks) => (
              <span style={{ color: colors.content.tertiary }}>{chunks}</span>
            ),
            line: (chunks) => (
              <>
                <br />
                {chunks}
              </>
            ),
          })}
        </MainText>
      ))}

      {mg.when("isAdmin", () => (
        <Text
          align="center"
          color={colors.accent.text}
          fontSize={fontSize.sm}
          fontWeight={fontWeight.bold}
          paddingTop={spacing.s5}
          paddingBottom={spacing.s2}
        >
          {mg.t(messages.admin)}
        </Text>
      ))}

      <Text
        align="left"
        color={colors.content.secondary}
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
        {mg.t(messages.cta)}
      </Button>

      <Text
        align="center"
        color={colors.content.tertiary}
        fontSize={fontSize.xs}
        paddingTop={spacing.s6}
        paddingBottom={spacing.s4}
      >
        {mg.t(messages.expires, {
          days: "expiresIn",
          b: (chunks) => <Strong>{chunks}</Strong>,
        })}
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
