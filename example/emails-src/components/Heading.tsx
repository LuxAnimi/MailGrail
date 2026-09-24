import React from "react";
import Text from "./Text";
import { fontFamily, lineHeight, fontWeight, fontSize, spacing, colors } from "../theme";

type HeadingProps = React.ComponentProps<typeof Text>;

const defaultProps = {
    fontFamily: fontFamily.sans,
    fontSize: fontSize["2xl"],
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.tight,
    paddingTop: spacing.s10,
    color: colors.content.primary,
    paddingBottom: spacing.s4,
};

export default function Heading(props: HeadingProps) {
    return (
        <Text align="center" {...defaultProps} {...props}>
            {props.children}
        </Text>
    );
}
