import { MjmlColumn, MjmlGroup, MjmlSection } from "@faire/mjml-react";
import Text from "./Text";
import { fontSize, fontWeight, fontFamily, colors, spacing } from "../theme";
import { metadata } from "../Metadata";

export default function Header() {
  return (
    <MjmlSection
      paddingLeft={spacing.s7}
      paddingRight={spacing.s7}
      paddingTop={spacing.s5}
      paddingBottom={spacing.s6}
      backgroundColor={colors.bg.ground}
    >
      <MjmlGroup>
        <MjmlColumn width="100%">
          <Text
            align="center"
            fontSize={fontSize.lg}
            fontWeight={fontWeight.bold}
            fontFamily={fontFamily.mono}
            color={colors.content.onDark}
          >
            {/* A table is what keeps an image and text side by side in every
                client: Outlook ignores the CSS that would align them inline. */}
            <table role="presentation" align="center" cellPadding={0} cellSpacing={0}>
              <tbody>
                <tr>
                  <td style={{ verticalAlign: "middle", paddingRight: spacing.s3 }}>
                    {/* The name sits right beside it, so the logo is decorative. */}
                    <img
                      src={metadata.logo_dark_url}
                      alt=""
                      width={32}
                      height={32}
                      style={{ display: "block", border: 0 }}
                    />
                  </td>
                  <td style={{ verticalAlign: "middle" }}>MailGrail</td>
                </tr>
              </tbody>
            </table>
          </Text>
        </MjmlColumn>
      </MjmlGroup>
    </MjmlSection>
  );
}
