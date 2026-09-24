import { MjmlColumn, MjmlGroup, MjmlSection } from "@faire/mjml-react";
import Text from "./Text";
import { fontSize, colors, spacing } from "../theme";
import { metadata } from "../Metadata";
import { defineMessages } from "../../../src/config/index";
import type { Translator } from "./types";

const messages = defineMessages("footer", {
  help: "Need help? <link>Contact us</link>.",
  rights: "All rights reserved.",
});

export default function Footer({ mg }: { mg: Translator }) {
  return (
    <MjmlSection>
      <MjmlGroup>
        <MjmlColumn width="100%">
          <Text
            color={colors.content.tertiary}
            fontSize={fontSize.xs}
            align="center"
            paddingBottom={spacing.s8}
            paddingTop={spacing.s6}
          >
            <p>
              {mg.t(messages.help, {
                link: (chunks) => (
                  <a
                    href={`mailto:${metadata.contact_email}`}
                    style={{ color: colors.accent.text }}
                  >
                    {chunks}
                  </a>
                ),
              })}
            </p>
            <p style={{ marginTop: "8px" }}>
              © {new Date().getFullYear()} mailgrail. {mg.t(messages.rights)}
            </p>
          </Text>
        </MjmlColumn>
      </MjmlGroup>
    </MjmlSection>
  );
}
