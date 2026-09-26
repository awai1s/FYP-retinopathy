import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useNetwork } from "../../providers/NetworkProvider";
import colors from "../../design/tokens/colors";
import spacing from "../../design/tokens/spacing";
import radius from "../../design/tokens/radius";

function formatSync(value: string | null) {
  if (!value) return "No synchronized cache yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Previously synchronized";
  return `Last sync ${date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
}

export default function OfflineStatusBanner() {
  const { isOnline, pendingActions, lastSyncAt } = useNetwork();
  if (isOnline) return null;
  return (
    <Pressable style={styles.banner} onPress={() => router.push("/offline" as any)} accessibilityRole="button" accessibilityLabel="Open Offline Mode details">
      <View style={styles.icon}><Ionicons name="cloud-offline-outline" size={18} color={colors.warning} /></View>
      <View style={styles.main}>
        <Text style={styles.title}>OFFLINE MODE</Text>
        <Text style={styles.subtitle}>{formatSync(lastSyncAt)}{pendingActions ? ` • ${pendingActions} stored action${pendingActions === 1 ? "" : "s"}` : ""}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { marginHorizontal: spacing.md, marginTop: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.warningBorder, backgroundColor: colors.warningBg, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  icon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  main: { flex: 1 },
  title: { color: colors.textPrimary, fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
  subtitle: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
});
