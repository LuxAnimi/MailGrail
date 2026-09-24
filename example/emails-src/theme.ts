// Neutral greys only. Every text colour meant for the white body reads at 4.5:1
// or better against it (WCAG AA); the rest are for the dark header and buttons.
export const colors = {
  bg: { ground: "#0a0a0a", overground: "white", email: "#ffffff" },
  accent: {
    // The brand yellow, for dark backgrounds: on white it reads at 1.5:1.
    500: "#FFC800",
    // The same hue, dark enough to be text on white (5.5:1).
    text: "#8a6100",
  },
  content: {
    // Headings, figures and emphasis (18.9:1).
    primary: "#111111",
    // Body copy (10.4:1).
    secondary: "#404040",
    // Quiet copy: footnotes, secondary details (5.7:1).
    tertiary: "#666666",
    // Text on the dark header.
    onDark: "#f5f5f5",
    white: "#fff",
  },
  border: { secondary: "#e0e0e0" },
};

export const fontSize = {
  xxs: "10px",
  xs: "12px",
  sm: "15px",
  base: "16px",
  md: "18px",
  lg: "20px",
  xl: "24px",
  "2xl": "32px",
  "3xl": "40px",
};

export const lineHeight = {
  tight: "115%",
  base: "150%",
  relaxed: "185%",
};

export const fontWeight = {
  light: "300",
  normal: "400",
  bold: "500",
};

export const borderRadius = {
  sm: 8,
  base: 4,
  full: 9999,
};

export const fontFamily = {
  sans: '"Manrope Variable", Roboto, sans-serif',
  mono: '"Inter Variable", Roboto, sans-serif',
};

export const spacing = {
  s0: 0,
  s1: 4,
  s2: 2,
  s3: 8,
  s4: 12,
  s5: 16,
  s6: 20,
  s7: 24,
  s8: 32,
  s9: 40,
  s10: 48,
  s11: 56,
};

export const screens = {
  xs: "480px",
  sm: "640px",
};

export const themeDefaults = {
  fontFamily: fontFamily.mono,
  lineHeight: lineHeight.base,
  fontWeight: fontWeight.normal,
  fontSize: fontSize.base,
  color: colors.content.primary,
  padding: "0",
};
