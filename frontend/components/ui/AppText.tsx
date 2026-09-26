import React from "react";
import { StyleProp, StyleSheet, Text, TextProps, TextStyle } from "react-native";
import Colors from "../../constants/Colors";
import Fonts from "../../constants/Fonts";

interface Props extends TextProps {
  variant?: "h1" | "h2" | "h3" | "title" | "body" | "small" | "tiny" | "button" | "eyebrow";
  color?: string;
  weight?: keyof typeof Fonts.weight;
  style?: StyleProp<TextStyle>;
}

export default function AppText({
  variant = "body",
  color = Colors.textPrimary,
  weight,
  style,
  ...props
}: Props) {
  const defaultWeight =
    weight ||
    (variant === "h1" || variant === "h2"
      ? "bold"
      : variant === "h3" || variant === "title" || variant === "button"
        ? "semibold"
        : "regular");

  const isHeading = ["h1", "h2", "h3", "title", "button", "eyebrow"].includes(variant);

  return (
    <Text
      {...props}
      style={[
        styles.base,
        isHeading ? styles.headingFamily : styles.bodyFamily,
        variantStyles[variant],
        { color, fontWeight: Fonts.weight[defaultWeight] },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: { includeFontPadding: false },
  bodyFamily: { fontFamily: Fonts.bodyFamily },
  headingFamily: { fontFamily: Fonts.headingFamily },
  h1: { fontSize: Fonts.h1, lineHeight: Fonts.lineHeight.h1, letterSpacing: Fonts.letterSpacing.tight },
  h2: { fontSize: Fonts.h2, lineHeight: Fonts.lineHeight.h2, letterSpacing: Fonts.letterSpacing.tight },
  h3: { fontSize: Fonts.h3, lineHeight: Fonts.lineHeight.h3, letterSpacing: -0.15 },
  title: { fontSize: Fonts.title, lineHeight: Fonts.lineHeight.title },
  body: { fontSize: Fonts.body, lineHeight: Fonts.lineHeight.body },
  small: { fontSize: Fonts.small, lineHeight: Fonts.lineHeight.small },
  tiny: { fontSize: Fonts.tiny, lineHeight: Fonts.lineHeight.tiny },
  button: { fontSize: Fonts.body, lineHeight: 20, letterSpacing: Fonts.letterSpacing.button },
  eyebrow: { fontSize: 10, lineHeight: 14, letterSpacing: Fonts.letterSpacing.eyebrow, textTransform: "uppercase" },
});

const variantStyles = {
  h1: styles.h1,
  h2: styles.h2,
  h3: styles.h3,
  title: styles.title,
  body: styles.body,
  small: styles.small,
  tiny: styles.tiny,
  button: styles.button,
  eyebrow: styles.eyebrow,
};
