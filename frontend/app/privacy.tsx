import { Alert } from "../services/alert";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";

import AppShell from "../design/components/AppShell";
import Card from "../design/components/card";
import Button from "../design/components/Button";
import IconContainer from "../design/components/IconContainer";
import StatusBadge from "../design/components/StatusBadge";
import colors from "../design/tokens/colors";
import spacing from "../design/tokens/spacing";
import typography from "../design/tokens/typography";
import radius from "../design/tokens/radius";
import { useThemeRefresh } from "../providers/AppThemeProvider";
import { getAccessLogs, getPrivacySummary, PrivacySummary, QrShare, revokeAllQrShares, revokeQrShare } from "../services/privacy";
import { revokeConnection } from "../services/connections";
import { getConsent, setConsent } from "../services/consent";

export default function PrivacyAccessScreen() {
  useThemeRefresh();
  const [summary, setSummary] = useState<PrivacySummary | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [screeningConsent, setScreeningConsentState] = useState(false);
  const [qrConsent, setQrConsent] = useState(true);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const [privacy, access, screening, qr] = await Promise.all([
        getPrivacySummary(),
        getAccessLogs(50, 0),
        getConsent("screening", false),
        getConsent("qr_sharing", true),
      ]);
      setSummary(privacy);
      setLogs(access.logs || []);
      setScreeningConsentState(screening);
      setQrConsent(qr);
    } catch (error: any) {
      Alert.alert("Privacy Center unavailable", error?.message || "Unable to load privacy information.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const activeShares = useMemo(() => (summary?.shares || []).filter((share) => share.status === "active"), [summary]);
  const historicalShares = useMemo(() => (summary?.shares || []).filter((share) => share.status !== "active"), [summary]);

  const updateConsent = async (scope: "screening" | "qr_sharing", granted: boolean) => {
    setBusy(`consent:${scope}`);
    try {
      await setConsent(scope, granted);
      if (scope === "screening") setScreeningConsentState(granted);
      if (scope === "qr_sharing") {
        setQrConsent(granted);
        if (!granted) {
          await revokeAllQrShares();
        }
      }
      await load();
    } catch (error: any) {
      Alert.alert("Unable to update consent", error?.message || "Please try again.");
    } finally {
      setBusy("");
    }
  };

  const removeProvider = (connectionId: string, name: string) => {
    Alert.alert(
      "Remove connected provider?",
      `${name} will no longer have general access to your current clinical records. Historical medical records are not deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setBusy(`connection:${connectionId}`);
            try {
              await revokeConnection(connectionId, "patient_privacy_center_revocation");
              await load();
            } catch (error: any) {
              Alert.alert("Unable to remove provider", error?.message || "Please try again.");
            } finally {
              setBusy("");
            }
          },
        },
      ]
    );
  };

  const revokeShare = (share: QrShare) => {
    Alert.alert("Revoke QR share?", "The QR/link will stop working immediately. Its historical record remains visible here.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Revoke",
        style: "destructive",
        onPress: async () => {
          setBusy(`share:${share.id}`);
          try {
            await revokeQrShare(share.id, "patient_privacy_center_revocation");
            await load();
          } catch (error: any) {
            Alert.alert("Unable to revoke share", error?.message || "Please try again.");
          } finally {
            setBusy("");
          }
        },
      },
    ]);
  };

  if (loading || !summary) {
    return (
      <AppShell role="Patient" title="Privacy & Access" showBack onBackPress={() => router.back()} showAssistant={false}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.teal800} />
          <Text style={styles.loadingText}>Loading your privacy activity...</Text>
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell role="Patient" title="Privacy & Access" subtitle="See who accessed what, when and how" showBack onBackPress={() => router.back()} showAssistant={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.teal800} />}
      >
        <Card variant="elevated" style={styles.heroCard}>
          <View style={styles.heroRow}>
            <IconContainer name="shield-checkmark-outline" size={28} color={colors.teal800} backgroundColor={colors.teal100} />
            <View style={styles.heroMain}>
              <Text style={styles.heroTitle}>Your data access at a glance</Text>
              <Text style={styles.heroText}>Clinical access history records metadata only: who accessed a category, how they accessed it and when. It does not copy the medical content they viewed.</Text>
            </View>
          </View>
          <View style={styles.statRow}>
            <PrivacyStat value={String(logs.length)} label="Recent events" />
            <PrivacyStat value={String(summary.connectedProviders.length)} label="Connected providers" />
            <PrivacyStat value={String(activeShares.length)} label="Active QR shares" />
          </View>
        </Card>

        <SectionHeader title="Recent Access" subtitle="Meaningful clinical access events. Access history cannot be deleted by the patient." />
        {logs.length ? logs.map((item) => (
          <Card key={item.id} style={styles.activityCard}>
            <View style={styles.activityRow}>
              <IconContainer
                name={item.accessChannel === "QR" ? "qr-code-outline" : "eye-outline"}
                size={20}
                color={item.accessChannel === "QR" ? colors.info : colors.teal800}
                backgroundColor={item.accessChannel === "QR" ? colors.infoBg : colors.teal100}
              />
              <View style={styles.activityMain}>
                <Text style={styles.activityActor}>{item.actorName || "Unknown"}</Text>
                <Text style={styles.activityAction}>{item.actionLabel}</Text>
                <Text style={styles.activityMeta}>{formatDateTime(item.createdAt)} • Via {formatChannel(item.accessChannel)}</Text>
              </View>
            </View>
          </Card>
        )) : <Card><Text style={styles.emptyText}>No clinical access activity has been recorded yet.</Text></Card>}

        <SectionHeader title="Connected Providers" subtitle="Accepted Phase 10D care connections that currently authorize clinical access." />
        {summary.connectedProviders.length ? summary.connectedProviders.map((provider) => (
          <Card key={provider.connectionId} style={styles.providerCard}>
            <View style={styles.providerRow}>
              <IconContainer name="medical-outline" size={22} color={colors.teal800} backgroundColor={colors.teal100} />
              <View style={styles.providerMain}>
                <View style={styles.nameRow}>
                  <Text style={styles.providerName}>{provider.name}</Text>
                  {provider.verified ? <StatusBadge status="Confirmed" label="Verified" size="sm" /> : null}
                </View>
                <Text style={styles.providerMeta}>{provider.specialization || "Doctor"}{provider.hospital ? ` • ${provider.hospital}` : ""}</Text>
                <Text style={styles.providerMeta}>Connected since {formatDate(provider.connectedSince)}</Text>
              </View>
              <Button title={busy === `connection:${provider.connectionId}` ? "Removing..." : "Remove"} size="sm" variant="outline" disabled={Boolean(busy)} onPress={() => removeProvider(provider.connectionId, provider.name)} />
            </View>
          </Card>
        )) : <Card><Text style={styles.emptyText}>No connected providers.</Text></Card>}

        <SectionHeader title="QR Sharing" subtitle="Active, expired and revoked Digital Health Card shares." actionLabel="Health Card" onAction={() => router.push("/health-card" as any)} />
        {activeShares.length ? activeShares.map((share) => <ShareCard key={share.id} share={share} busy={busy === `share:${share.id}`} onRevoke={() => revokeShare(share)} />) : <Card><Text style={styles.emptyText}>No active QR shares.</Text></Card>}
        {historicalShares.length ? (
          <Card style={styles.historyCard}>
            <Text style={styles.historyTitle}>SHARE HISTORY</Text>
            {historicalShares.slice(0, 12).map((share, index) => (
              <View key={share.id} style={[styles.historyRow, index < Math.min(historicalShares.length, 12) - 1 && styles.historyDivider]}>
                <Text style={styles.historyName}>{share.type === "emergency" ? "Emergency QR" : "Temporary Medical QR"}</Text>
                <Text style={styles.historyMeta}>{share.status.toUpperCase()} • {formatDateTime(share.expiresAt)}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        <SectionHeader title="Consent Settings" subtitle="Patient-owned privacy preferences stored with your profile." />
        <Card style={styles.consentCard}>
          <ConsentRow
            title="Retinal screening storage"
            description="Allow retinal screening results to be saved for longitudinal care and analytics."
            value={screeningConsent}
            disabled={busy === "consent:screening"}
            onToggle={() => void updateConsent("screening", !screeningConsent)}
          />
          <View style={styles.consentDivider} />
          <ConsentRow
            title="Digital Health Card QR sharing"
            description="Allow new Emergency or Temporary Health Card shares. Turning this off revokes all active QR shares."
            value={qrConsent}
            disabled={busy === "consent:qr_sharing"}
            onToggle={() => void updateConsent("qr_sharing", !qrConsent)}
          />
        </Card>
      </ScrollView>
    </AppShell>
  );
}

function PrivacyStat({ value, label }: { value: string; label: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function SectionHeader({ title, subtitle, actionLabel, onAction }: { title: string; subtitle: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionMain}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionSub}>{subtitle}</Text></View>
      {actionLabel && onAction ? <Button title={actionLabel} size="sm" variant="ghost" onPress={onAction} /> : null}
    </View>
  );
}

function ShareCard({ share, busy, onRevoke }: { share: QrShare; busy: boolean; onRevoke: () => void }) {
  return (
    <Card style={styles.shareCard}>
      <View style={styles.shareRow}>
        <IconContainer name={share.type === "emergency" ? "medical-outline" : "time-outline"} size={21} color={share.type === "emergency" ? colors.error : colors.info} backgroundColor={share.type === "emergency" ? colors.errorBg : colors.infoBg} />
        <View style={styles.shareMain}>
          <Text style={styles.shareTitle}>{share.type === "emergency" ? "Emergency QR" : "Temporary Medical QR"}</Text>
          <Text style={styles.shareMeta}>Expires {formatDateTime(share.expiresAt)} • Used {share.usedCount} time{share.usedCount === 1 ? "" : "s"}</Text>
          <Text style={styles.shareScopes}>{formatShareScopes(share.scopes)}</Text>
        </View>
        <Button title={busy ? "Revoking..." : "Revoke"} size="sm" variant="outline" disabled={busy} onPress={onRevoke} />
      </View>
    </Card>
  );
}

function ConsentRow({ title, description, value, disabled, onToggle }: { title: string; description: string; value: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity style={styles.consentRow} activeOpacity={0.8} disabled={disabled} onPress={onToggle} accessibilityRole="switch" accessibilityState={{ checked: value, disabled }}>
      <View style={styles.consentMain}><Text style={styles.consentTitle}>{title}</Text><Text style={styles.consentText}>{description}</Text></View>
      <View style={[styles.switch, value && styles.switchOn]}><View style={[styles.knob, value && styles.knobOn]} /></View>
    </TouchableOpacity>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
function formatDate(value?: string | null) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function formatChannel(value?: string) {
  const text = String(value || "Unknown").replace(/_/g, " ");
  return text === "care connection" ? "Care Connection" : text === "QR" ? "QR" : text.replace(/\b\w/g, (m) => m.toUpperCase());
}
function formatShareScopes(scopes: string[]) {
  const values = new Set(scopes || []);
  const labels: string[] = [];
  if (["profile.basic", "profile.emergency_contact", "profile.blood_group", "profile.allergies"].some((scope) => values.has(scope))) labels.push("Profile");
  if (values.has("screening.latest")) labels.push("Latest Screening");
  if (values.has("medications.active")) labels.push("Current Medication");
  if (values.has("health_metrics.latest")) labels.push("Latest HbA1c");
  if (values.has("reports.recent")) labels.push("Recent Reports");
  return labels.length ? labels.join(" • ") : "No clinical fields selected";
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl + 50 },
  loadingCenter: { minHeight: 420, alignItems: "center", justifyContent: "center" },
  loadingText: { color: colors.textSecondary, fontSize: typography.sizes.body, marginTop: spacing.md },
  heroCard: { marginBottom: spacing.xl },
  heroRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  heroMain: { flex: 1 },
  heroTitle: { color: colors.textPrimary, fontSize: typography.sizes.h2, fontWeight: typography.weights.extraBold },
  heroText: { color: colors.textSecondary, fontSize: typography.sizes.small, lineHeight: 20, marginTop: 4 },
  statRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg, flexWrap: "wrap" },
  stat: { flex: 1, minWidth: 105, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md },
  statValue: { color: colors.textPrimary, fontSize: typography.sizes.h2, fontWeight: typography.weights.extraBold },
  statLabel: { color: colors.textSecondary, fontSize: typography.sizes.xs, marginTop: 2 },
  sectionHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: spacing.md, marginTop: spacing.xl, marginBottom: spacing.sm },
  sectionMain: { flex: 1 },
  sectionTitle: { color: colors.textPrimary, fontSize: typography.sizes.h2, fontWeight: typography.weights.extraBold },
  sectionSub: { color: colors.textSecondary, fontSize: typography.sizes.small, lineHeight: 19, marginTop: 3 },
  activityCard: { marginBottom: spacing.sm },
  activityRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  activityMain: { flex: 1 },
  activityActor: { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.bold },
  activityAction: { color: colors.textSecondary, fontSize: typography.sizes.small, marginTop: 2 },
  activityMeta: { color: colors.textMuted, fontSize: typography.sizes.xs, marginTop: 3 },
  providerCard: { marginBottom: spacing.sm },
  providerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  providerMain: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  providerName: { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.bold },
  providerMeta: { color: colors.textSecondary, fontSize: typography.sizes.xs, marginTop: 3 },
  shareCard: { marginBottom: spacing.sm },
  shareRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  shareMain: { flex: 1 },
  shareTitle: { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.bold },
  shareMeta: { color: colors.textSecondary, fontSize: typography.sizes.xs, marginTop: 3 },
  shareScopes: { color: colors.textMuted, fontSize: 10, marginTop: 4 },
  historyCard: { marginTop: spacing.md },
  historyTitle: { color: colors.teal800, fontSize: 10, fontWeight: typography.weights.extraBold, letterSpacing: 1 },
  historyRow: { paddingVertical: spacing.sm },
  historyDivider: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  historyName: { color: colors.textPrimary, fontSize: typography.sizes.small, fontWeight: typography.weights.bold },
  historyMeta: { color: colors.textMuted, fontSize: typography.sizes.xs, marginTop: 2 },
  consentCard: { marginBottom: spacing.xl },
  consentRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  consentMain: { flex: 1 },
  consentTitle: { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.bold },
  consentText: { color: colors.textSecondary, fontSize: typography.sizes.xs, lineHeight: 17, marginTop: 3 },
  consentDivider: { height: 1, backgroundColor: colors.borderLight, marginVertical: spacing.sm },
  switch: { width: 46, height: 26, borderRadius: 13, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, padding: 2 },
  switchOn: { backgroundColor: colors.teal800, borderColor: colors.teal800 },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.white },
  knobOn: { alignSelf: "flex-end" },
  emptyText: { color: colors.textSecondary, fontSize: typography.sizes.small, textAlign: "center" },
});
