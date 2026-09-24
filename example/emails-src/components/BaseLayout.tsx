import React from "react";
import {
    Mjml,
    MjmlBody,
    MjmlHead,
    MjmlFont,
    MjmlStyle,
    MjmlAttributes,
    MjmlAll,
    MjmlWrapper,
    MjmlSection,
} from "@faire/mjml-react";
import Header from "./Header";
import Footer from "./Footer";
import { colors, themeDefaults } from "../theme";

type BaseLayoutProps = {
    width?: number;
    style?: string;
    children: React.ReactNode;
};

export default function BaseLayout({ width, children, style }: BaseLayoutProps) {
    return (
        <Mjml>
            <MjmlHead>
                <MjmlFont name="neue-haas-unica" href="https://use.typekit.net/qqd8jtb.css" />
                <MjmlAttributes>
                    <MjmlAll {...themeDefaults} />
                </MjmlAttributes>
                <MjmlStyle>{`
                /* The templates are designed for light only: claiming dark support
                   would let clients put their dark text on a dark background. */
                :root {
                  color-scheme: light;
                  supported-color-schemes: light;
                }

                body {
                  -webkit-font-smoothing: antialiased;
                  min-width: 320px;
                }

                a {
                  color: inherit
                }

                /* Email specific Styles */
                ${style}
              `}</MjmlStyle>
            </MjmlHead>

            {/* Set explicitly: a transparent body shows whatever is behind it, such
                as a dark-mode canvas. */}
            <MjmlBody width={width} backgroundColor={colors.bg.email}>
                <MjmlWrapper>
                    <Header />
                    <MjmlSection>{children}</MjmlSection>
                    <Footer />
                </MjmlWrapper>
            </MjmlBody>
        </Mjml>
    );
}
