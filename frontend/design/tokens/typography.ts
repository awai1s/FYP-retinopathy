/** EyeCare AI typography tokens. */
import { Platform, TextStyle } from "react-native";

export const typography = {
  fontFamily: Platform.select({
    ios: "System",
    android: "sans-serif",
    web: '"Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    default: "sans-serif",
  }),
  headingFamily: Platform.select({
    ios: "Avenir Next",
    android: "sans-serif-medium",
    web: '"Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    default: "sans-serif",
  }),

  sizes: {
    tiny: 10,
    xs: 12,
    small: 13,
    body: 15,
    subtitle: 17,
    h3: 20,
    h2: 24,
    h1: 30,
    display: 36,
  },

  weights: {
    regular: "400" as TextStyle["fontWeight"],
    medium: "500" as TextStyle["fontWeight"],
    semibold: "600" as TextStyle["fontWeight"],
    bold: "700" as TextStyle["fontWeight"],
    extraBold: "800" as TextStyle["fontWeight"],
  },

  lineHeights: { tight: 1.2, normal: 1.45, relaxed: 1.65 },
};

export default typography;
