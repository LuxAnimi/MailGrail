import React from "react";
import { colors } from "../theme";

type StrongProps = {
    /** Defaults to the emphasis colour every call site was reaching for. */
    color?: string;
} & React.ComponentProps<"strong">;

// Bold alone does not carry in an email: clients render the body copy at a
// weight where a bold run inside a paragraph barely separates from it, so the
// emphasis is colour as much as weight. That pairing was being written out by
// hand at every call site, which is how one of them ends up a shade off.
export default function Strong({
    color = colors.content.secondary,
    style,
    children,
    ...props
}: StrongProps) {
    return (
        <strong style={{ color, ...style }} {...props}>
            {children}
        </strong>
    );
}
