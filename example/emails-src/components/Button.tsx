import React from "react";
import { MjmlButton } from "@faire/mjml-react";

import {
  colors,
  fontSize,
  borderRadius,
  lineHeight,
  fontWeight,
  fontFamily,
  spacing,
} from "../theme";

type ButtonProps = React.ComponentProps<typeof MjmlButton> & {
  cssClass?: string;
};

export default function Button(props: ButtonProps) {
  return (
    <>
      <MjmlButton
        lineHeight={lineHeight.tight}
        fontSize={fontSize.md}
        fontWeight={fontWeight.normal}
        fontFamily={fontFamily.mono}
        innerPadding="16px 32px 18px"
        borderRadius={borderRadius.base}
        border="1px solid #fff"
        align="center"
        paddingBottom={spacing.s10}
        paddingTop={spacing.s8}
        backgroundColor={colors.bg.ground}
        color="#fff"
        {...props}
      />
    </>
  );
}
