import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import colors from "../tokens/colors";
import radius from "../tokens/radius";
import spacing from "../tokens/spacing";
import typography from "../tokens/typography";
import { useAppTheme } from "../../providers/AppThemeProvider";

export type StatusType =
  | "Completed"
  | "Pending"
  | "Processing"
  | "ActionNeeded"
  | "Confirmed"
  | "Cancelled"
  | "Rejected"
  | "Normal"
  | "Review";

export interface StatusBadgeProps {
  status: StatusType | string;
  label?: string;
  size?: "sm" | "md";
  style?: ViewStyle;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = "md",
  style,
}) => {
  const { eyeFriendly } = useAppTheme();
  const normalized = String(status).trim().toLowerCase();

  const config = (() => {
    switch (normalized) {
      case "completed":
      case "confirmed":
      case "normal":
        return {
          background: colors.successBg,
          foreground: colors.success,
          border: colors.successBorder,
          icon: "checkmark-circle" as const,
          label: label || (normalized === "confirmed" ? "Confirmed" : normalized === "normal" ? "Normal" : "Completed"),
        };
      case "pending":
      case "processing":
        return {
          background: colors.infoBg,
          foreground: colors.info,
          border: colors.infoBorder,
          icon: normalized === "processing" ? "sync-circle" as const : "time" as const,
          label: label || (normalized === "processing" ? "Processing" : "Pending"),
        };
      case "actionneeded":
      case "review":
      case "needs review":
        return {
          background: colors.warningBg,
          foreground: colors.warning,
          border: colors.warningBorder,
          icon: "alert-circle" as const,
          label: label || "Needs Review",
        };
      case "cancelled":
      case "rejected":
      case "error":
        return {
          background: colors.errorBg,
          foreground: colors.error,
          border: colors.errorBorder,
          icon: "close-circle" as const,
          label: label || (normalized === "cancelled" ? "Cancelled" : normalized === "error" ? "Error" : "Rejected"),
        };
      default:
        return {
          background: colors.teal50,
          foreground: colors.teal800,
          border: colors.teal200,
          icon: "information-circle" as const,
          label: label || String(status),
        };
    }
  })();

  const small = size === "sm";

  return (
    <View
      style={[
        styles.badge,
        small && styles.badgeSmall,
        eyeFriendly && styles.eyeFriendlyBadge,
        {
          backgroundColor: config.background,
          borderColor: config.border,
        },
        style,
      ]}
      accessibilityRole="text"
      accessibilityLabel={`Status: ${config.label}`}
    >
      <Ionicons name={config.icon} size={(small ? 12 : 14) + (eyeFriendly ? 2 : 0)} color={config.foreground} />
      <Text style={[styles.text, small && styles.textSmall, { color: config.foreground }]}>
        {eyeFriendly ? config.label.toUpperCase() : config.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  badgeSmall: {
    paddingHorizontal: spacing.xs + 3,
    paddingVertical: 4,
  },
  text: {
    fontFamily: typography.headingFamily,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  textSmall: {
    fontSize: typography.sizes.tiny,
  },
  eyeFriendlyBadge: { paddingHorizontal: spacing.md, paddingVertical: 8, borderWidth: 1.5 },
});

export default StatusBadge;
