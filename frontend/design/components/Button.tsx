import React, { useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import colors from "../tokens/colors";
import radius from "../tokens/radius";
import spacing from "../tokens/spacing";
import typography from "../tokens/typography";
import shadows from "../tokens/shadows";
import { useAppTheme } from "../../providers/AppThemeProvider";

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: "left" | "right";
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "left",
  loading = false,
  disabled = false,
  style,
  textStyle,
  accessibilityLabel,
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const { eyeFriendly, reduceMotion } = useAppTheme();
  const isDisabled = disabled || loading;

  const animateTo = (toValue: number) => {
    if (reduceMotion) {
      scale.setValue(1);
      return;
    }
    Animated.spring(scale, { toValue, useNativeDriver: true, friction: 7, tension: 150 }).start();
  };

  const handlePress = () => {
    if (isDisabled) return;
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const iconColor = variant === "primary" ? colors.navyInk : variant === "danger" ? colors.white : variant === "secondary" ? colors.teal900 : colors.teal800;
  const textColor = iconColor;
  const eyeFriendlySize: ViewStyle | undefined = eyeFriendly
    ? size === "sm"
      ? { minHeight: 48, paddingHorizontal: spacing.lg, paddingVertical: 10 }
      : size === "lg"
        ? { minHeight: 64, paddingHorizontal: spacing.xl + 2, paddingVertical: spacing.md + 2 }
        : { minHeight: 56, paddingHorizontal: spacing.xl, paddingVertical: spacing.md }
    : undefined;
  const iconSize = (size === "sm" ? 16 : size === "lg" ? 20 : 19) + (eyeFriendly ? 2 : 0);

  return (
    <Animated.View
      style={[
        styles.outer,
        variant === "primary" && !eyeFriendly && !reduceMotion && styles.primaryGlow,
        isDisabled && styles.noGlow,
        { transform: [{ scale }] },
        style,
      ]}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={() => animateTo(0.975)}
        onPressOut={() => animateTo(1)}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.baseBtn,
          sizeStyles[size],
          eyeFriendlySize,
          variantStyles[variant],
          pressed && !isDisabled && styles.pressed,
          isDisabled && styles.disabledBtn,
        ]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || title}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
      >
        {variant === "primary" ? (
          <LinearGradient
            colors={[colors.neonAqua, "#36D7C7", colors.neonBlue]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View style={styles.contentRow}>
          {loading ? (
            <ActivityIndicator size="small" color={textColor} />
          ) : (
            <>
              {icon && iconPosition === "left" ? <Ionicons name={icon} size={iconSize} color={iconColor} /> : null}
              <Text
                style={[
                  styles.baseText,
                  { color: textColor },
                  size === "sm" && styles.smText,
                  size === "lg" && styles.lgText,
                  eyeFriendly && styles.eyeFriendlyText,
                  textStyle,
                ]}
              >
                {title}
              </Text>
              {icon && iconPosition === "right" ? <Ionicons name={icon} size={iconSize} color={iconColor} /> : null}
            </>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
};

const sizeStyles = StyleSheet.create({
  sm: { minHeight: 38, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2 },
  md: { minHeight: 50, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 3 },
  lg: { minHeight: 58, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
});

const variantStyles = StyleSheet.create({
  primary: { borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", backgroundColor: colors.teal600 },
  secondary: { backgroundColor: colors.teal50, borderColor: colors.teal200, borderWidth: 1 },
  outline: { backgroundColor: colors.surface, borderColor: colors.teal700, borderWidth: 1.25 },
  ghost: { backgroundColor: "transparent", borderColor: "transparent", borderWidth: 1 },
  danger: { backgroundColor: colors.error, borderColor: colors.error, borderWidth: 1 },
});

const styles = StyleSheet.create({
  outer: { alignSelf: "flex-start", borderRadius: radius.md },
  primaryGlow: { ...shadows.neon },
  noGlow: { shadowOpacity: 0, elevation: 0 },
  baseBtn: { borderRadius: radius.md, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  pressed: { opacity: 0.94 },
  disabledBtn: { opacity: 0.48 },
  contentRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  baseText: { fontFamily: typography.headingFamily, fontSize: typography.sizes.body, fontWeight: typography.weights.bold, letterSpacing: 0.1 },
  smText: { fontSize: typography.sizes.small },
  lgText: { fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold },
  eyeFriendlyText: { letterSpacing: 0.2 },
});

export default Button;
