import { MjmlColumn, MjmlGroup, MjmlSection } from "@faire/mjml-react";
import Text from "./Text";
import { fontSize, colors, spacing } from "../theme";
import { metadata } from "../Metadata";

export default function Footer() {
  return (
    <MjmlSection>
      <MjmlGroup>
        <MjmlColumn width="100%">
          <Text
            color={colors.content.quaternary}
            fontSize={fontSize.xs}
            align="center"
            paddingBottom={spacing.s8}
            paddingTop={spacing.s6}
          >
            <p>
              Need help? Contact us at{" "}
              <a
                href={`mailto:${metadata.contact_email}`}
                style={{ color: colors.accent[500] }}
              >
                {metadata.contact_email}
              </a>
            </p>
            <p style={{ marginTop: "8px" }}>
              © {new Date().getFullYear()} mailgrail. All rights reserved.
            </p>
          </Text>
        </MjmlColumn>
      </MjmlGroup>
    </MjmlSection>
  );
}
