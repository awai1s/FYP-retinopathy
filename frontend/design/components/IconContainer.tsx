import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import colors from "../tokens/colors";
import radius from "../tokens/radius";
import shadows from "../tokens/shadows";

export interface IconContainerProps {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  color?: string;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
}

export const IconContainer: React.FC<IconContainerProps> = ({
  name,
  size = 23,
  color = colors.teal800,
  backgroundColor = colors.teal100,
  style,
}) => (
  <View style={[styles.container, { backgroundColor }, style]}>
    <Ionicons name={name} size={size} color={color} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
    ...shadows.sm,
  },
});

export default IconContainer;
