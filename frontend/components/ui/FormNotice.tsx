import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "../../constants/Colors";
import Fonts from "../../constants/Fonts";
import Sizes from "../../constants/Sizes";

type NoticeType = "error" | "success" | "warning" | "info";

interface Props {
  message?: string;
  type?: NoticeType;
}

const config = {
  error: { icon: "alert-circle" as const, bg: Colors.dangerSoft, border: "#F5BEC4", color: Colors.danger },
  success: { icon: "checkmark-circle" as const, bg: Colors.successSoft, border: "#B8E9D9", color: Colors.success },
  warning: { icon: "warning" as const, bg: Colors.warningSoft, border: "#F2DCA2", color: Colors.warning },
  info: { icon: "information-circle" as const, bg: Colors.infoSoft, border: "#BBDCF1", color: Colors.info },
};

export default function FormNotice({ message, type = "error" }: Props) {
  if (!message) return null;
  const theme = config[type];

  return (
    <View
      style={[styles.notice, { backgroundColor: theme.bg, borderColor: theme.border }]}
      accessibilityRole="alert"
    >
      <Ionicons name={theme.icon} size={19} color={theme.color} />
      <Text style={[styles.text, { color: theme.color }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Sizes.spacing.sm,
    borderWidth: 1,
    borderRadius: Sizes.radius.md,
    paddingHorizontal: Sizes.padding.md,
    paddingVertical: Sizes.padding.sm,
    marginBottom: Sizes.spacing.md,
  },
  text: {
    flex: 1,
    fontFamily: Fonts.bodyFamily,
    fontSize: Fonts.small,
    lineHeight: 19,
    fontWeight: Fonts.weight.semibold,
  },
});
