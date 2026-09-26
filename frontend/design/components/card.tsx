import React from "react";
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import colors from "../tokens/colors";
import radius from "../tokens/radius";
import spacing from "../tokens/spacing";
import shadows from "../tokens/shadows";
import { useAppTheme } from "../../providers/AppThemeProvider";

export interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  variant?: "default" | "elevated" | "accent" | "glass" | "bordered";
  activeOpacity?: number;
  accessibilityLabel?: string;
  accessibilityRole?: "button" | "none" | "link";
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  onPress,
  variant = "default",
  accessibilityLabel,
  accessibilityRole,
}) => {
  const { eyeFriendly, reduceMotion } = useAppTheme();
  const accessibilityStyle: ViewStyle = eyeFriendly
    ? { borderWidth: 1.5, padding: spacing.lg + 2, shadowOpacity: 0, elevation: 0 }
    : reduceMotion
      ? { shadowOpacity: 0.04, elevation: 1 }
      : {};

  const content = <>{children}</>;
  const resolved = [styles.baseCard, variantStyles[variant], accessibilityStyle, style];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [resolved, pressed && !reduceMotion && styles.pressed]}
        accessibilityRole={accessibilityRole || "button"}
        accessibilityLabel={accessibilityLabel}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={resolved}>{content}</View>;
};

const variantStyles = StyleSheet.create({
  default: { backgroundColor: colors.surface, borderColor: colors.borderLight, borderWidth: 1, ...shadows.card3D },
  elevated: { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderWidth: 1, ...shadows.elevated3D },
  accent: { backgroundColor: colors.teal50, borderColor: colors.teal200, borderWidth: 1, ...shadows.sm },
  glass: { backgroundColor: "rgba(255,255,255,0.94)", borderColor: "rgba(255,255,255,0.72)", borderWidth: 1, ...shadows.card3D },
  bordered: { backgroundColor: colors.surface, borderColor: colors.teal300, borderWidth: 1.25, ...shadows.sm },
});

const styles = StyleSheet.create({
  baseCard: { borderRadius: radius.xl, padding: spacing.lg, position: "relative" },
  pressed: { opacity: 0.93, transform: [{ scale: 0.992 }] },
});

export default Card;
