import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import AppShell from "../design/components/AppShell";
import Card from "../design/components/card";
import Button from "../design/components/Button";
import colors from "../design/tokens/colors";
import spacing from "../design/tokens/spacing";
import typography from "../design/tokens/typography";
import radius from "../design/tokens/radius";
import { useThemeRefresh } from "../providers/AppThemeProvider";
import { useNetwork } from "../providers/NetworkProvider";
import { getOfflineCacheSummary, getSavedEducationArticleIds, type OfflineCacheSummary } from "../services/offlineCache";
import { educationArticles } from "../content/educationContent";

const availabilityRows = [
  ["patient-medications", "Today's medication & instructions", "medkit-outline"],
  ["patient-appointments", "Upcoming appointments", "calendar-outline"],
  ["patient-health-card", "Emergency information & Digital Health Card", "card-outline"],
  ["patient-dashboard", "Latest screening summary", "eye-outline"],
  ["patient-education-assignments", "Doctor-recommended education list", "library-outline"],
] as const;

function formatDate(value: string | null) {
  if (!value) return "No synchronized cache yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Previously synchronized";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function OfflineModeScreen() {
  useThemeRefresh();
  const network = useNetwork();
  const [summary, setSummary] = useState<OfflineCacheSummary | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [cache, ids] = await Promise.all([getOfflineCacheSummary(), getSavedEducationArticleIds()]);
    setSummary(cache);
    setSavedIds(ids);
  }, []);

  useEffect(() => { void load(); }, [load, network.pendingActions, network.lastSyncAt]);

  const savedArticles = useMemo(
    () => savedIds.map((id) => educationArticles.find((article) => article.id === id)).filter(Boolean),
    [savedIds]
  );

  const sync = async () => {
    setBusy(true);
    try {
      await network.syncNow();
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell role="Patient" title="Offline Mode" showBack onBackPress={() => router.back()} showAssistant={false}>
      <View style={styles.hero}>
        <View style={[styles.heroIcon, network.isOnline ? styles.onlineIcon : styles.offlineIcon]}>
          <Ionicons name={network.isOnline ? "cloud-done-outline" : "cloud-offline-outline"} size={28} color={network.isOnline ? colors.success : colors.warning} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>{network.isOnline ? "CONNECTED" : "OFFLINE MODE"}</Text>
          <Text style={styles.title}>{network.isOnline ? "EyeCare AI is connected" : "Showing last synchronized information"}</Text>
          <Text style={styles.subtitle}>Last sync: {formatDate(summary?.lastSyncAt || network.lastSyncAt)}</Text>
        </View>
        {network.checking || busy ? <ActivityIndicator color={colors.teal800} /> : null}
      </View>

      {network.pendingActions > 0 ? (
        <Card variant="accent" style={styles.pendingCard}>
          <Ionicons name="sync-outline" size={22} color={colors.teal800} />
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>{network.pendingActions} medication action{network.pendingActions === 1 ? "" : "s"} stored locally</Text>
            <Text style={styles.body}>Dose updates are stored locally with unique operation IDs. They replay when the backend is reachable; any server-rejected action remains stored instead of being silently treated as confirmed.</Text>
          </View>
        </Card>
      ) : null}

      <Text style={styles.sectionTitle}>Available offline</Text>
      <View style={styles.list}>
        {availabilityRows.map(([key, label, icon]) => {
          const available = Boolean(summary?.available[key]);
          return (
            <Card key={key} style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: available ? colors.successBg : colors.surfaceSecondary }]}>
                <Ionicons name={icon} size={20} color={available ? colors.success : colors.textMuted} />
              </View>
              <Text style={styles.rowText}>{label}</Text>
              <Text style={[styles.stateText, available ? styles.ready : styles.notReady]}>{available ? "READY" : "NOT CACHED"}</Text>
            </Card>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>Saved learning</Text>
      <Card style={styles.savedCard}>
        {savedArticles.length ? savedArticles.map((article) => article ? (
          <View key={article.id} style={styles.savedRow}>
            <Ionicons name="bookmark" size={16} color={colors.teal800} />
            <Text style={styles.savedText}>{article.title.en}</Text>
          </View>
        ) : null) : <Text style={styles.body}>Open an Eye Health Library article and choose “Save offline” to keep it in your selected learning list. The curated article text itself is bundled with the app.</Text>}
      </Card>

      <Card variant="bordered" style={styles.privacyCard}>
        <Ionicons name="shield-checkmark-outline" size={22} color={colors.teal800} />
        <View style={styles.flex}>
          <Text style={styles.cardTitle}>Privacy-first cache</Text>
          <Text style={styles.body}>EyeCare AI does not automatically cache retinal images, medical PDFs, complete doctor notes, or the full clinical database. Private offline data is cleared on logout.</Text>
        </View>
      </Card>

      <Card style={styles.qrCard}>
        <Ionicons name="qr-code-outline" size={22} color={colors.warning} />
        <View style={styles.flex}>
          <Text style={styles.cardTitle}>Remote QR scans still need the backend</Text>
          <Text style={styles.body}>Your phone can show cached emergency information offline, but the secure QR intentionally remains token-based and does not embed medical data.</Text>
        </View>
      </Card>

      <Button title={network.isOnline ? "Sync now" : "Check connection"} icon="sync-outline" onPress={() => void sync()} loading={busy} disabled={busy} style={styles.syncButton} />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.xl },
  heroIcon: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  onlineIcon: { backgroundColor: colors.successBg, borderColor: colors.successBorder },
  offlineIcon: { backgroundColor: colors.warningBg, borderColor: colors.warningBorder },
  eyebrow: { color: colors.teal800, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, letterSpacing: 1.2 },
  title: { color: colors.textPrimary, fontSize: typography.sizes.h3, fontWeight: typography.weights.bold, marginTop: 2 },
  subtitle: { color: colors.textSecondary, fontSize: typography.sizes.xs, marginTop: 4 },
  pendingCard: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, marginBottom: spacing.xl },
  sectionTitle: { color: colors.textPrimary, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold, marginTop: spacing.lg, marginBottom: spacing.sm },
  list: { gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md },
  rowIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, color: colors.textPrimary, fontSize: typography.sizes.small, fontWeight: typography.weights.semibold },
  stateText: { fontSize: 10, fontWeight: typography.weights.bold, letterSpacing: 0.6 },
  ready: { color: colors.success },
  notReady: { color: colors.textMuted },
  savedCard: { gap: spacing.sm },
  savedRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 4 },
  savedText: { flex: 1, color: colors.textPrimary, fontSize: typography.sizes.small },
  privacyCard: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, marginTop: spacing.xl },
  qrCard: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, marginTop: spacing.md },
  cardTitle: { color: colors.textPrimary, fontSize: typography.sizes.small, fontWeight: typography.weights.bold },
  body: { color: colors.textSecondary, fontSize: typography.sizes.xs, lineHeight: 18, marginTop: 3 },
  syncButton: { alignSelf: "flex-start", marginTop: spacing.xl, marginBottom: spacing.xl },
});
