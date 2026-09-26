import { Platform } from "react-native";

export const Colors = {
  light: {
    text: "#0F172A",
    background: "#F5F7FB",
    tint: "#6D28FF",
    icon: "#64748B",
    tabIconDefault: "#64748B",
    tabIconSelected: "#6D28FF",
  },
  dark: {
    text: "#F8FAFC",
    background: "#0B1026",
    tint: "#8B5CF6",
    icon: "#CBD5E1",
    tabIconDefault: "#94A3B8",
    tabIconSelected: "#FFFFFF",
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "System",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "sans-serif",
    serif: "serif",
    rounded: "sans-serif",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
  },
});