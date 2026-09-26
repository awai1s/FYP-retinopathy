import { Platform } from "react-native";

/**
 * Font stacks use platform fonts only, so there is no extra font bundle to load.
 * Headings deliberately use a more distinctive system face than body copy.
 */
const bodyFamily = Platform.select({
  ios: "System",
  android: "sans-serif",
  web: '"Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  default: "sans-serif",
});

const headingFamily = Platform.select({
  ios: "Avenir Next",
  android: "sans-serif-medium",
  web: '"Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  default: "sans-serif",
});

const Fonts = {
  family: bodyFamily,
  bodyFamily,
  headingFamily,

  weight: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
    extraBold: "800" as const,
  },

  h1: 32,
  h2: 25,
  h3: 20,
  title: 18,
  body: 15,
  small: 13,
  tiny: 11,

  lineHeight: {
    h1: 39,
    h2: 32,
    h3: 27,
    title: 25,
    body: 22,
    small: 18,
    tiny: 15,
  },

  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.2,
    button: 0.1,
    eyebrow: 1.1,
  },
};

export default Fonts;
