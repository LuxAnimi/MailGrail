export const colors = {
  bg: { ground: "#080a12", overground: "white" },
  accent: {
    500: "#FFC800",
    reverse: "#C98B04",
  },
  content: {
    primary: "#e3e5ed",
    secondary: "#c9cff2",
    tertiary: "#606897",
    quaternary: "#474c66",
    primaryDark: "#161927",
    white: "#fff",
  },
  border: { secondary: "#C9CFF2" },
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
