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
import { useFocusEffect, useRouter } from "expo-router";

import AppShell from "../../design/components/AppShell";
import Card from "../../design/components/card";
import Button from "../../design/components/Button";
import StatusBadge from "../../design/components/StatusBadge";
import IconContainer from "../../design/components/IconContainer";
import colors from "../../design/tokens/colors";
import spacing from "../../design/tokens/spacing";
import typography from "../../design/tokens/typography";
import radius from "../../design/tokens/radius";
import { useThemeRefresh } from "../../providers/AppThemeProvider";
import {
  getVisionVault,
  type VisionPrescription,
  type VisionVaultResponse,
} from "../../services/visionPrescriptions";
import { syncVisionPrescriptionNotifications } from "../../services/visionPrescriptionNotifications";

type Tab = "current" | "contacts" | "history" | "expiring";

const emptyVault: VisionVaultResponse = {
  currentGlasses: null,
  currentContactLens: null,
  history: [],
  expiringSoon: [],
  records: [],
};

const fmtNumber = (value: number | null | undefined, digits = 2) => {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  return `${n > 0 ? "+" : ""}${n.toFixed(digits)}`;
};

const dateLabel = (value?: string) => {
  if (!value) return "Not set";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

const expiryLabel = (item: VisionPrescription) => {
  if (!item.expiryDate) return "No expiry date";
  const days = item.daysUntilExpiry;
  if (days == null) return `Expires ${dateLabel(item.expiryDate)}`;
  if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  if (days <= 30) return `Expires in ${days} days`;
  return `Expires ${dateLabel(item.expiryDate)}`;
};

function EmptyState({ title, text, actionTitle, onAction }: { title: string; text: string; actionTitle?: string; onAction?: () => void }) {
  return (
    <Card style={styles.emptyCard}>
      <IconContainer name="glasses-outline" size={26} color={colors.teal800} backgroundColor={colors.teal100} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
      {actionTitle && onAction ? <Button title={actionTitle} icon="add-outline" size="sm" onPress={onAction} style={styles.emptyButton} /> : null}
    </Card>
  );
}

function GlassesCard({ item, onPress }: { item: VisionPrescription; onPress: () => void }) {
  const g = item.glasses || {};
  return (
    <Card variant="elevated" style={styles.primaryCard} onPress={onPress} accessibilityLabel="Open current glasses prescription">
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardHeaderMain}>
          <Text style={styles.cardEyebrow}>CURRENT GLASSES</Text>
          <Text style={styles.cardTitle}>Glasses Prescription</Text>
        </View>
        <StatusBadge status={item.expiryState === "expired" ? "ActionNeeded" : "Confirmed"} label={item.expiryState === "expired" ? "Expired" : "Current"} size="sm" />
      </View>

      <View style={styles.dateGrid}>
        <View style={styles.dateCell}><Text style={styles.metaLabel}>Issued</Text><Text style={styles.metaValue}>{dateLabel(item.issuedDate)}</Text></View>
        <View style={styles.dateCell}><Text style={styles.metaLabel}>Expires</Text><Text style={styles.metaValue}>{item.expiryDate ? dateLabel(item.expiryDate) : "Not set"}</Text></View>
      </View>

      <View style={styles.rxTable}>
        <View style={styles.rxRowHeader}>
          <Text style={[styles.rxCell, styles.rxEye]} />
          <Text style={styles.rxHeader}>SPH</Text>
          <Text style={styles.rxHeader}>CYL</Text>
          <Text style={styles.rxHeader}>AXIS</Text>
        </View>
        <View style={styles.rxRow}>
          <Text style={[styles.rxCell, styles.rxEye]}>Right</Text>
          <Text style={styles.rxCell}>{fmtNumber(g.right?.sph)}</Text>
          <Text style={styles.rxCell}>{fmtNumber(g.right?.cyl)}</Text>
          <Text style={styles.rxCell}>{g.right?.axis ?? "—"}</Text>
        </View>
        <View style={styles.rxRow}>
          <Text style={[styles.rxCell, styles.rxEye]}>Left</Text>
          <Text style={styles.rxCell}>{fmtNumber(g.left?.sph)}</Text>
          <Text style={styles.rxCell}>{fmtNumber(g.left?.cyl)}</Text>
          <Text style={styles.rxCell}>{g.left?.axis ?? "—"}</Text>
        </View>
      </View>

      <View style={styles.metricStrip}>
        <View style={styles.metric}><Text style={styles.metricLabel}>ADD</Text><Text style={styles.metricValue}>{fmtNumber(g.add)}</Text></View>
        <View style={styles.metric}><Text style={styles.metricLabel}>PD</Text><Text style={styles.metricValue}>{g.pd != null ? `${g.pd} mm` : "—"}</Text></View>
      </View>

      <View style={styles.footerRow}>
        <Text style={[styles.expiryText, item.expiryState === "expired" && styles.dangerText]}>{expiryLabel(item)}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.teal800} />
      </View>
    </Card>
  );
}

function ContactCard({ item, onPress }: { item: VisionPrescription; onPress: () => void }) {
  const c = item.contactLens || {};
  return (
    <Card variant="elevated" style={styles.primaryCard} onPress={onPress} accessibilityLabel="Open current contact lens prescription">
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardHeaderMain}>
          <Text style={styles.cardEyebrow}>CURRENT CONTACT LENSES</Text>
          <Text style={styles.cardTitle}>{c.brand || "Contact Lens Prescription"}</Text>
          <Text style={styles.cardSub}>{[c.lensType, c.replacementSchedule].filter(Boolean).join(" · ") || "Prescription details"}</Text>
        </View>
        <StatusBadge status={item.expiryState === "expired" ? "ActionNeeded" : "Confirmed"} label={item.expiryState === "expired" ? "Expired" : "Current"} size="sm" />
      </View>

      <View style={styles.contactPowerRow}>
        <View style={styles.contactPowerCell}><Text style={styles.metaLabel}>RIGHT POWER</Text><Text style={styles.powerValue}>{fmtNumber(c.rightPower)}</Text></View>
        <View style={styles.contactPowerCell}><Text style={styles.metaLabel}>LEFT POWER</Text><Text style={styles.powerValue}>{fmtNumber(c.leftPower)}</Text></View>
      </View>
      <View style={styles.metricStrip}>
        <View style={styles.metric}><Text style={styles.metricLabel}>BASE CURVE</Text><Text style={styles.metricValue}>{c.baseCurve ?? "—"}</Text></View>
        <View style={styles.metric}><Text style={styles.metricLabel}>DIAMETER</Text><Text style={styles.metricValue}>{c.diameter != null ? `${c.diameter} mm` : "—"}</Text></View>
      </View>
      <View style={styles.footerRow}>
        <Text style={[styles.expiryText, item.expiryState === "expired" && styles.dangerText]}>{expiryLabel(item)}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.teal800} />
      </View>
    </Card>
  );
}

function HistoryCard({ item, onPress }: { item: VisionPrescription; onPress: () => void }) {
  const label = item.type === "glasses" ? "Glasses Prescription" : "Contact Lens Prescription";
  return (
    <Card style={styles.historyCard} onPress={onPress} accessibilityLabel={`Open ${label}`}>
      <View style={styles.historyRow}>
        <IconContainer name={item.type === "glasses" ? "glasses-outline" : "eye-outline"} size={21} color={colors.teal800} backgroundColor={colors.teal100} />
        <View style={styles.historyMain}>
          <Text style={styles.historyTitle}>{label}</Text>
          <Text style={styles.historyMeta}>Issued {dateLabel(item.issuedDate)}{item.expiryDate ? ` · Expired/ended ${dateLabel(item.expiryDate)}` : ""}</Text>
          {item.doctorOptometrist ? <Text style={styles.historyProvider}>{item.doctorOptometrist}</Text> : null}
        </View>
        <View style={styles.historyRight}>
          {item.attachment ? <Ionicons name="attach" size={16} color={colors.teal800} /> : null}
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </View>
      </View>
    </Card>
  );
}

export default function VisionVaultScreen() {
  useThemeRefresh();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("current");
  const [vault, setVault] = useState<VisionVaultResponse>(emptyVault);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const data = await getVisionVault();
      setVault(data);
      void syncVisionPrescriptionNotifications(data.records).catch(() => undefined);
    } catch (err: any) {
      setError(err?.message || "Unable to load Vision & Lens Vault.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const tabs = useMemo(() => [
    { key: "current" as const, label: "Current" },
    { key: "contacts" as const, label: "Contact Lenses" },
    { key: "history" as const, label: `History${vault.history.length ? ` (${vault.history.length})` : ""}` },
    { key: "expiring" as const, label: `Expiring Soon${vault.expiringSoon.length ? ` (${vault.expiringSoon.length})` : ""}` },
  ], [vault.history.length, vault.expiringSoon.length]);

  const add = (type: "glasses" | "contact_lens") => router.push(`/vision-vault/add?type=${type}` as any);
  const open = (item: VisionPrescription) => router.push(`/vision-vault/${item.id}` as any);

  return (
    <AppShell role="Patient" title="Vision & Lens Vault" subtitle="Your long-term glasses and contact lens prescription history">
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.teal800} /><Text style={styles.loadingText}>Loading your vision prescriptions...</Text></View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.teal800} />}
        >
          <View style={styles.header}>
            <Text style={styles.eyebrow}>PERSONAL EYE RECORDS</Text>
            <Text style={styles.title}>Vision & Lens Vault</Text>
            <Text style={styles.subtitle}>Keep current prescriptions, source documents, expiry reminders and older records together without deleting your history.</Text>
          </View>

          {error ? <View style={styles.error}><Ionicons name="alert-circle-outline" size={18} color={colors.error} /><Text style={styles.errorText}>{error}</Text></View> : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
            {tabs.map((item) => (
              <TouchableOpacity key={item.key} onPress={() => setTab(item.key)} style={[styles.tab, tab === item.key && styles.tabActive]} accessibilityRole="button" accessibilityState={{ selected: tab === item.key }}>
                <Text style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {tab === "current" ? (
            <>
              <View style={styles.sectionHeader}>
                <View><Text style={styles.sectionTitle}>Current Glasses</Text><Text style={styles.sectionSub}>Your latest glasses prescription</Text></View>
                <Button title={vault.currentGlasses ? "Add Updated" : "Add Glasses"} icon="add-outline" size="sm" onPress={() => add("glasses")} />
              </View>
              {vault.currentGlasses ? <GlassesCard item={vault.currentGlasses} onPress={() => open(vault.currentGlasses!)} /> : <EmptyState title="No glasses prescription yet" text="Add your current prescription to start a long-term history." actionTitle="Add Glasses" onAction={() => add("glasses")} />}

              <Card style={styles.historyRuleCard}>
                <View style={styles.ruleRow}><Ionicons name="shield-checkmark-outline" size={22} color={colors.teal800} /><View style={styles.ruleMain}><Text style={styles.ruleTitle}>History is preserved automatically</Text><Text style={styles.ruleText}>When you add an updated glasses prescription, the previous record moves to History instead of being overwritten.</Text></View></View>
              </Card>
            </>
          ) : null}

          {tab === "contacts" ? (
            <>
              <View style={styles.sectionHeader}>
                <View><Text style={styles.sectionTitle}>Contact Lenses</Text><Text style={styles.sectionSub}>Power, curve, diameter and replacement schedule</Text></View>
                <Button title={vault.currentContactLens ? "Add Updated" : "Add Contact"} icon="add-outline" size="sm" onPress={() => add("contact_lens")} />
              </View>
              {vault.currentContactLens ? <ContactCard item={vault.currentContactLens} onPress={() => open(vault.currentContactLens!)} /> : <EmptyState title="No contact lens prescription" text="Add contact-lens details when you use them." actionTitle="Add Contact Lenses" onAction={() => add("contact_lens")} />}
            </>
          ) : null}

          {tab === "history" ? (
            <>
              <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Prescription History</Text><Text style={styles.sectionSub}>Older records are retained and remain viewable.</Text></View></View>
              {vault.history.length ? vault.history.map((item) => <HistoryCard key={item.id} item={item} onPress={() => open(item)} />) : <EmptyState title="History is empty" text="Older prescriptions will appear here automatically after you add an updated record." />}
            </>
          ) : null}

          {tab === "expiring" ? (
            <>
              <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Expiring Soon</Text><Text style={styles.sectionSub}>Current prescriptions due within 30 days, plus already-expired current records.</Text></View></View>
              {vault.expiringSoon.length ? vault.expiringSoon.map((item) => (
                <Card key={item.id} style={[styles.expiryCard, item.expiryState === "expired" && styles.expiredCard]} onPress={() => open(item)}>
                  <View style={styles.historyRow}>
                    <IconContainer name={item.expiryState === "expired" ? "alert-circle-outline" : "time-outline"} size={22} color={item.expiryState === "expired" ? colors.error : colors.warning} backgroundColor={item.expiryState === "expired" ? colors.errorBg : colors.warningBg} />
                    <View style={styles.historyMain}><Text style={styles.historyTitle}>{item.type === "glasses" ? "Glasses Prescription" : "Contact Lens Prescription"}</Text><Text style={[styles.expiryStrong, item.expiryState === "expired" && styles.dangerText]}>{expiryLabel(item)}</Text><Text style={styles.historyMeta}>Consider arranging an eye examination before your prescription becomes outdated.</Text></View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </View>
                </Card>
              )) : <EmptyState title="Nothing expiring soon" text="Current prescriptions with an expiry date inside the next 30 days will appear here." />}
            </>
          ) : null}

          <View style={{ height: spacing.xxxl }} />
        </ScrollView>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
  loadingText: { color: colors.textSecondary, fontSize: typography.sizes.body },
  content: { paddingBottom: spacing.xxxl + 24 },
  header: { marginBottom: spacing.lg },
  eyebrow: { color: colors.teal800, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, letterSpacing: 1.2 },
  title: { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.bold, marginTop: 4 },
  subtitle: { color: colors.textSecondary, fontSize: typography.sizes.body, lineHeight: 22, marginTop: 6 },
  error: { flexDirection: "row", gap: spacing.sm, alignItems: "center", padding: spacing.md, backgroundColor: colors.errorBg, borderRadius: radius.md, marginBottom: spacing.md },
  errorText: { flex: 1, color: colors.error, fontSize: typography.sizes.small },
  tabRow: { gap: spacing.xs, paddingBottom: spacing.md },
  tab: { minHeight: 42, paddingHorizontal: spacing.md, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.teal800, borderColor: colors.teal800 },
  tabText: { color: colors.textSecondary, fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold },
  tabTextActive: { color: colors.white },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, marginTop: spacing.sm, marginBottom: spacing.md },
  sectionTitle: { color: colors.textPrimary, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold },
  sectionSub: { color: colors.textSecondary, fontSize: typography.sizes.xs, marginTop: 3, maxWidth: 430 },
  primaryCard: { marginBottom: spacing.md },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md, alignItems: "flex-start" },
  cardHeaderMain: { flex: 1 },
  cardEyebrow: { color: colors.teal800, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, letterSpacing: 1 },
  cardTitle: { color: colors.textPrimary, fontSize: typography.sizes.h2, fontWeight: typography.weights.bold, marginTop: 3 },
  cardSub: { color: colors.textSecondary, fontSize: typography.sizes.xs, marginTop: 3 },
  dateGrid: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  dateCell: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md },
  metaLabel: { color: colors.textMuted, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, letterSpacing: 0.6 },
  metaValue: { color: colors.textPrimary, fontSize: typography.sizes.small, fontWeight: typography.weights.semibold, marginTop: 4 },
  rxTable: { marginTop: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: "hidden" },
  rxRowHeader: { flexDirection: "row", backgroundColor: colors.surfaceSecondary, paddingVertical: 9, paddingHorizontal: spacing.sm },
  rxRow: { flexDirection: "row", paddingVertical: 11, paddingHorizontal: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  rxHeader: { flex: 1, textAlign: "center", color: colors.textMuted, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold },
  rxCell: { flex: 1, textAlign: "center", color: colors.textPrimary, fontSize: typography.sizes.small, fontWeight: typography.weights.semibold },
  rxEye: { textAlign: "left", fontWeight: typography.weights.bold },
  metricStrip: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  metric: { flex: 1, backgroundColor: colors.teal50, borderRadius: radius.md, padding: spacing.md },
  metricLabel: { color: colors.teal800, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold },
  metricValue: { color: colors.textPrimary, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold, marginTop: 4 },
  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  expiryText: { color: colors.textSecondary, fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold },
  dangerText: { color: colors.error },
  contactPowerRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  contactPowerCell: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md },
  powerValue: { color: colors.textPrimary, fontSize: typography.sizes.h2, fontWeight: typography.weights.bold, marginTop: 4 },
  historyCard: { marginBottom: spacing.sm },
  historyRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  historyMain: { flex: 1, minWidth: 0 },
  historyTitle: { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.bold },
  historyMeta: { color: colors.textSecondary, fontSize: typography.sizes.xs, lineHeight: 18, marginTop: 3 },
  historyProvider: { color: colors.teal800, fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, marginTop: 3 },
  historyRight: { flexDirection: "row", alignItems: "center", gap: 5 },
  expiryCard: { marginBottom: spacing.sm, borderColor: colors.warningBorder, borderWidth: 1.25 },
  expiredCard: { borderColor: colors.errorBorder },
  expiryStrong: { color: colors.warning, fontSize: typography.sizes.small, fontWeight: typography.weights.bold, marginTop: 3 },
  emptyCard: { alignItems: "center", gap: spacing.xs, marginBottom: spacing.md },
  emptyTitle: { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.bold, textAlign: "center", marginTop: 4 },
  emptyText: { color: colors.textSecondary, fontSize: typography.sizes.small, lineHeight: 20, textAlign: "center", maxWidth: 460 },
  emptyButton: { marginTop: spacing.sm },
  historyRuleCard: { marginTop: spacing.sm, backgroundColor: colors.teal50 },
  ruleRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  ruleMain: { flex: 1 },
  ruleTitle: { color: colors.textPrimary, fontSize: typography.sizes.small, fontWeight: typography.weights.bold },
  ruleText: { color: colors.textSecondary, fontSize: typography.sizes.xs, lineHeight: 18, marginTop: 3 },
});
