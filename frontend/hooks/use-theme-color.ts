import { useAppTheme } from "../providers/AppThemeProvider";

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: "text" | "background" | "tint" | "icon" | "tabIconDefault" | "tabIconSelected"
) {
  const { effectiveMode, colors } = useAppTheme();
  const colorFromProps = props[effectiveMode];
  if (colorFromProps) return colorFromProps;

  switch (colorName) {
    case "background":
      return colors.background;
    case "tint":
    case "tabIconSelected":
      return colors.primary;
    case "icon":
    case "tabIconDefault":
      return colors.textMuted;
    case "text":
    default:
      return colors.textPrimary;
  }
}
