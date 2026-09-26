import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import Button from "../design/components/Button";
import { useAppTheme } from "../providers/AppThemeProvider";

interface Props {
  status?: string;
  accountStatus?: string;
  decisionReason?: string;
  compact?: boolean;
}

const COPY: Record<string, { title: string; message: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending: {
    title: "ACCOUNT VERIFICATION PENDING",
    message: "Complete your professional details and documents to unlock clinical functionality.",
    icon: "time-outline",
  },
  under_review: {
    title: "VERIFICATION UNDER REVIEW",
    message: "Your credentials were submitted successfully. Clinical functionality will unlock after SuperAdmin approval.",
    icon: "hourglass-outline",
  },
  needs_changes: {
    title: "VERIFICATION CHANGES REQUIRED",
    message: "Review the requested changes, update your information, and submit the verification again.",
    icon: "create-outline",
  },
  rejected: {
    title: "VERIFICATION NOT APPROVED",
    message: "Your provider verification was not approved. Review the decision details below.",
    icon: "close-circle-outline",
  },
  verified: {
    title: "PROVIDER VERIFIED",
    message: "Your professional credentials are approved for EyeCare AI clinical access.",
    icon: "shield-checkmark-outline",
  },
};

export default function ProviderVerificationBanner({ status = "pending", accountStatus = "active", decisionReason = "", compact = false }: Props) {
  const { colors } = useAppTheme();
  const normalized = String(status || "pending").toLowerCase();
  const account = String(accountStatus || "active").toLowerCase();
  const content = account === "suspended"
    ? { title: "ACCOUNT SUSPENDED", message: "Your provider account is suspended. Clinical access remains locked until a SuperAdmin reactivates it.", icon: "ban-outline" as const }
    : account === "disabled"
      ? { title: "ACCOUNT DISABLED", message: "This provider account is disabled. Contact EyeCare AI administration for assistance.", icon: "lock-closed-outline" as const }
      : COPY[normalized] || COPY.pending;

  const positive = normalized === "verified" && account === "active";
  const surface = positive ? colors.successSurface : normalized === "rejected" || account !== "active" ? colors.errorSurface : colors.warningSurface;
  const accent = positive ? colors.success : normalized === "rejected" || account !== "active" ? colors.error : colors.warning;

  return (
    <View style={[styles.card, { backgroundColor: surface, borderColor: accent }, compact && styles.compact]}>
      <View style={styles.headerRow}>
        <View style={[styles.icon, { borderColor: accent }]}>
          <Ionicons name={content.icon} size={22} color={accent} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{content.title}</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>{content.message}</Text>
        </View>
      </View>
      {decisionReason ? (
        <View style={[styles.reasonBox, { borderColor: colors.border, backgroundColor: colors.surface }]}> 
          <Text style={[styles.reasonLabel, { color: colors.textMuted }]}>ADMIN NOTE</Text>
          <Text style={[styles.reason, { color: colors.textPrimary }]}>{decisionReason}</Text>
        </View>
      ) : null}
      {!positive && account !== "disabled" ? (
        <Button
          title={normalized === "needs_changes" || normalized === "pending" ? "Complete Verification" : "View Verification Status"}
          icon="shield-checkmark-outline"
          onPress={() => router.push("/provider-verification" as any)}
          style={styles.button}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1.5, padding: 16, marginBottom: 18 },
  compact: { padding: 13, marginBottom: 12 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  icon: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1 },
  title: { fontSize: 13, fontWeight: "800", letterSpacing: 0.6 },
  message: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  reasonBox: { marginTop: 12, borderWidth: 1, borderRadius: 12, padding: 10 },
  reasonLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  reason: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  button: { marginTop: 14 },
});
