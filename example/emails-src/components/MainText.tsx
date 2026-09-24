import React from "react";
import Text from "./Text";
import { fontSize, spacing, colors } from "../theme";

type MainTextProps = React.ComponentProps<typeof Text>;

const defaultProps = {
    color: colors.content.secondary,
    fontSize: fontSize.sm,
    paddingTop: spacing.s2,
    paddingBottom: spacing.s4,
};

export default function MainText(props: MainTextProps) {
    return (
        <Text align="center" {...defaultProps} {...props}>
            {props.children}
        </Text>
    );
}
