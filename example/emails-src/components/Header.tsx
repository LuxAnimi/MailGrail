import { MjmlColumn, MjmlGroup, MjmlSection } from "@faire/mjml-react";
import Text from "./Text";
import { fontSize, fontWeight, fontFamily, colors, spacing } from "../theme";

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
            color={colors.content.primary}
          >
            mailgrail
          </Text>
        </MjmlColumn>
      </MjmlGroup>
    </MjmlSection>
  );
}
