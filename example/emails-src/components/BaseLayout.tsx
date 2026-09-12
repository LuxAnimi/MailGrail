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
import { themeDefaults } from "../theme";

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
                :root {
                  color-scheme: light dark;
                  supported-color-schemes: light dark;
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

            <MjmlBody width={width}>
                <MjmlWrapper>
                    <Header />
                    <MjmlSection>{children}</MjmlSection>
                    <Footer />
                </MjmlWrapper>
            </MjmlBody>
        </Mjml>
    );
}
