import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Colors from "../../constants/Colors";
import Sizes from "../../constants/Sizes";

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: "default" | "soft" | "dark";
}

export default function AppCard({ children, style, variant = "default" }: Props) {
  return <View style={[styles.base, styles[variant], style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Sizes.radius.xl,
    padding: Sizes.padding.lg,
    borderWidth: 1,
  },
  default: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 3,
  },
  soft: {
    backgroundColor: Colors.surfaceMuted,
    borderColor: Colors.border,
  },
  dark: {
    backgroundColor: Colors.navySurface,
    borderColor: Colors.borderOnDark,
  },
});
