import React from "react";
import Text from "./Text";
import { colors, fontSize, fontWeight, spacing } from "../theme";

type NoteProps = {
    /** Lift the note to the accent colour, for the one that is good news. */
    accent?: boolean;
} & React.ComponentProps<typeof Text>;

const defaultProps = {
    fontSize: fontSize.sm,
    paddingTop: spacing.s5,
    paddingBottom: spacing.s3,
};

// Accent moves two properties at once. Keeping them together is what stops two
// notes that should read as a pair from drifting into different weights of the
// same idea.
const accentProps = {
    color: colors.accent.text,
    fontWeight: fontWeight.bold,
};

const quietProps = {
    color: colors.content.tertiary,
};

export default function Note({ accent, ...props }: NoteProps) {
    return (
        <Text
            align="center"
            {...defaultProps}
            {...(accent ? accentProps : quietProps)}
            {...props}
        >
            {props.children}
        </Text>
    );
}
