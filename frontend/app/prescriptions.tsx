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
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  getMedicationAdherence,
  getPatientPrescriptions,
  recordMedicationAdherence,
  stopPatientPrescription,
  type MedicationAdherence,
  type MedicationDose,
  type MedicationStatus,
  type Prescription,
} from "../services/prescriptions";
import {
  cancelMedicationNotifications,
  snoozeMedicationDose,
  syncMedicationNotifications,
} from "../services/medicationNotifications";
import { useLanguage } from "../services/i18n";
import AppShell from "../design/components/AppShell";
import Card from "../design/components/card";
import Button from "../design/components/Button";
import StatusBadge from "../design/components/StatusBadge";
import colors from "../design/tokens/colors";
import spacing from "../design/tokens/spacing";
import typography from "../design/tokens/typography";
import radius from "../design/tokens/radius";
import { useThemeRefresh } from "../providers/AppThemeProvider";

const emptyAdherence: MedicationAdherence = {
  days: [], expectedPerDay: 0, overallPercent: 0, windowDays: 7,
  today: { date: "", percent: 0, completed: 0, expected: 0, taken: 0, missed: 0, skipped: 0, pending: 0 },
  todayDoses: [], records: [], missedHistory: [],
};

type Tab = "today" | "medications" | "history";

const period = (item: Prescription) => {
  if (item.startDate && item.endDate) return `${item.startDate} → ${item.endDate}`;
  return item.startDate || item.endDate || item.date || "";
};

const sourceLabel = (item: Prescription) => item.source === "Patient" ? "Added by You" : `Prescribed by ${item.doctorName || "Doctor"}`;

const doseStatusStyle = (status: MedicationStatus) => {
  if (status === "Taken") return { icon: "checkmark-circle" as const, label: "TAKEN", fg: colors.success, bg: colors.successBg };
  if (status === "Missed") return { icon: "alert-circle" as const, label: "MISSED", fg: colors.error, bg: colors.errorBg };
  if (status === "Skipped") return { icon: "remove-circle" as const, label: "SKIPPED", fg: colors.warning, bg: colors.warningBg };
  return { icon: "time-outline" as const, label: "PENDING", fg: colors.teal800, bg: colors.teal50 };
};

export default function MedicationScreen() {
  useThemeRefresh();
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>("today");
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [weekly, setWeekly] = useState<MedicationAdherence>(emptyAdherence);
  const [monthly, setMonthly] = useState<MedicationAdherence>({ ...emptyAdherence, windowDays: 30 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    setError("");
    try {
      const [rx, w, m] = await Promise.all([
        getPatientPrescriptions(), getMedicationAdherence(7), getMedicationAdherence(30),
      ]);
      setPrescriptions(rx || []); setWeekly(w); setMonthly(m);
      void syncMedicationNotifications(rx || []).catch(() => undefined);
    } catch (err: any) {
      setError(err?.message || "Unable to load medication data.");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(true); }, [load]));

  const active = useMemo(() => prescriptions.filter((item) => item.lifecycleStatus !== "Completed"), [prescriptions]);
  const completed = useMemo(() => prescriptions.filter((item) => item.lifecycleStatus === "Completed"), [prescriptions]);
  const doctorMeds = useMemo(() => active.filter((item) => item.source !== "Patient"), [active]);
  const selfMeds = useMemo(() => active.filter((item) => item.source === "Patient"), [active]);
  const skipped = useMemo(() => monthly.records.filter((item) => item.status === "Skipped").slice().reverse().slice(0, 8), [monthly]);

  const refreshAdherence = async () => {
    const [w, m] = await Promise.all([getMedicationAdherence(7), getMedicationAdherence(30)]);
    setWeekly(w); setMonthly(m);
  };

  const saveDose = async (dose: MedicationDose, status: MedicationStatus) => {
    const key = `${dose.prescriptionId}:${dose.doseKey}`;
    if (busy) return;
    try {
      setBusy(key); setError("");
      await recordMedicationAdherence(dose.prescriptionId, { status, doseKey: dose.doseKey, scheduledTime: dose.scheduledTime });
      await refreshAdherence();
    } catch (err: any) { setError(err?.message || "Unable to update this dose."); }
    finally { setBusy(""); }
  };

  const snooze = async (dose: MedicationDose) => {
    const key = `${dose.prescriptionId}:${dose.doseKey}`;
    if (busy) return;
    try {
      setBusy(key); setError("");
      const snoozedUntil = new Date(Date.now() + 10 * 60_000).toISOString();
      await recordMedicationAdherence(dose.prescriptionId, { status: "Pending", doseKey: dose.doseKey, scheduledTime: dose.scheduledTime, snoozedUntil });
      const result = await snoozeMedicationDose(dose, 10);
      if (result.supported && !result.permissionGranted) Alert.alert("Notification Permission Needed", "The dose is still pending, but the snooze reminder could not be scheduled.");
      else if (!result.supported) Alert.alert("Mobile Reminder", "Snooze notifications are available in the Android/iOS app.");
      await refreshAdherence();
    } catch (err: any) { setError(err?.message || "Unable to snooze this dose."); }
    finally { setBusy(""); }
  };

  const stopMedication = (item: Prescription) => {
    Alert.alert("Stop Medication", `Stop ${item.medicationDetails}? Its history will remain available.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Stop", style: "destructive", onPress: () => void (async () => {
        try { setBusy(item.id); await stopPatientPrescription(item.id); await cancelMedicationNotifications(item.id); await load(false); }
        catch (err: any) { setError(err?.message || "Unable to stop medication."); }
        finally { setBusy(""); }
      })() },
    ]);
  };

  const tabButton = (value: Tab, label: string) => (
    <TouchableOpacity onPress={() => setTab(value)} style={[styles.tab, tab === value && styles.tabActive]} accessibilityRole="tab" accessibilityState={{ selected: tab === value }}>
      <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  const renderPlanCard = (item: Prescription) => {
    const selfAdded = item.source === "Patient";
    return <Card key={item.id} style={styles.planCard}>
      <View style={styles.planTop}>
        <View style={styles.medIcon}><Ionicons name={selfAdded ? "person-outline" : "medkit-outline"} size={20} color={colors.teal800} /></View>
        <View style={styles.flex}>
          <Text style={styles.medName}>{item.medicationDetails}</Text>
          <Text style={styles.dosage}>{item.dosage || item.instructions || "Instructions not recorded"}</Text>
          {item.times?.length ? <Text style={styles.schedule}>{item.times.join(" • ")}</Text> : null}
          <Text style={styles.source}>{sourceLabel(item)}</Text>
          {period(item) ? <Text style={styles.meta}>{period(item)}</Text> : null}
        </View>
        <StatusBadge status="Confirmed" label="Active" size="sm" />
      </View>
      {selfAdded ? <View style={styles.manageRow}>
        <Button title="Edit" size="sm" variant="outline" onPress={() => router.push({ pathname: "/add-prescription", params: { id: item.id } } as any)} />
        <Button title={busy === item.id ? "Stopping..." : "Stop"} size="sm" variant="outline" onPress={() => stopMedication(item)} disabled={Boolean(busy)} />
      </View> : <View style={styles.lockNote}><Ionicons name="lock-closed-outline" size={15} color={colors.textMuted} /><Text style={styles.meta}>Doctor prescriptions can only be changed by a doctor during clinical care.</Text></View>}
    </Card>;
  };

  if (loading) return <AppShell role="Patient" title="Medication"><View style={styles.center}><ActivityIndicator size="large" color={colors.teal800} /><Text style={styles.meta}>Loading medication...</Text></View></AppShell>;

  const today = weekly.today || emptyAdherence.today;

  return <AppShell role="Patient" title={t("prescriptions") || "Medication"}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(false); }} tintColor={colors.teal800} />}>
      <View style={styles.header}><Text style={styles.eyebrow}>MEDICATION</Text><Text style={styles.title}>Medication</Text><Text style={styles.subtitle}>Today's doses are separated from your medication plan and long-term adherence history.</Text></View>
      {error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View> : null}

      <View style={styles.tabs}>{tabButton("today", "Today")}{tabButton("medications", "My Medications")}{tabButton("history", "History & Adherence")}</View>

      {tab === "today" ? <>
        <Card style={styles.todaySummary}>
          <View style={styles.summaryTop}><View><Text style={styles.sectionEyebrow}>TODAY'S MEDICATION</Text><Text style={styles.bigValue}>{today.completed} / {today.expected} doses completed</Text></View><View style={styles.percentCircle}><Text style={styles.percentText}>{today.percent || 0}%</Text></View></View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, today.percent || 0))}%` }]} /></View>
        </Card>
        {weekly.todayDoses.length ? weekly.todayDoses.map((dose) => {
          const status = doseStatusStyle(dose.status);
          const key = `${dose.prescriptionId}:${dose.doseKey}`;
          return <Card key={key} style={styles.doseCard}>
            <View style={styles.doseTop}><View style={styles.flex}><Text style={styles.medName}>{dose.medicationDetails}</Text><Text style={styles.dosage}>{[dose.dosage, dose.intakeInstruction].filter(Boolean).join(" · ") || "Medication dose"}</Text><Text style={styles.time}>{dose.scheduledTime}</Text></View><View style={[styles.statusPill, { backgroundColor: status.bg }]}><Ionicons name={status.icon} size={17} color={status.fg} /><Text style={[styles.statusLabel, { color: status.fg }]}>{status.label}</Text></View></View>
            {dose.snoozedUntil ? <Text style={styles.snoozeText}>Snoozed until {new Date(dose.snoozedUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text> : null}
            <View style={styles.doseActions}>
              <TouchableOpacity disabled={Boolean(busy)} onPress={() => void saveDose(dose, "Taken")} style={[styles.actionButton, styles.takenButton]}><Text style={styles.takenText}>✓ TAKEN</Text></TouchableOpacity>
              <TouchableOpacity disabled={Boolean(busy)} onPress={() => void saveDose(dose, "Missed")} style={styles.actionButton}><Text style={styles.missedText}>! MISSED</Text></TouchableOpacity>
              <TouchableOpacity disabled={Boolean(busy)} onPress={() => void saveDose(dose, "Skipped")} style={styles.actionButton}><Text style={styles.actionText}>− SKIP</Text></TouchableOpacity>
              <TouchableOpacity disabled={Boolean(busy)} onPress={() => void snooze(dose)} style={styles.actionButton}><Text style={styles.actionText}>⏰ SNOOZE</Text></TouchableOpacity>
            </View>
          </Card>;
        }) : <Card style={styles.empty}><Ionicons name="checkmark-circle-outline" size={30} color={colors.success} /><Text style={styles.emptyTitle}>No doses scheduled today</Text><Text style={styles.meta}>Your medication plan may be empty or have no scheduled dose for today.</Text></Card>}
      </> : null}

      {tab === "medications" ? <>
        <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Doctor Prescriptions</Text><Text style={styles.meta}>Clinical prescriptions are read-only for patients.</Text></View></View>
        {doctorMeds.length ? doctorMeds.map(renderPlanCard) : <Card style={styles.empty}><Text style={styles.emptyTitle}>No active doctor prescriptions</Text></Card>}

        <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>My Added Medications</Text><Text style={styles.meta}>Medicines you personally added and can manage.</Text></View><Button title="Add Medication" size="sm" icon="add-outline" onPress={() => router.push("/add-prescription" as any)} /></View>
        {selfMeds.length ? selfMeds.map(renderPlanCard) : <Card style={styles.empty}><Text style={styles.emptyTitle}>No self-added medications</Text><Text style={styles.meta}>Use Add Medication to track vitamins, drops or other medicines you take.</Text></Card>}
      </> : null}

      {tab === "history" ? <>
        <View style={styles.metricsRow}>
          <Card style={styles.metricCard}><Text style={styles.metricLabel}>7-Day Adherence</Text><Text style={styles.metricValue}>{weekly.overallPercent || 0}%</Text><Text style={styles.meta}>{weekly.days.reduce((sum, day) => sum + day.taken, 0)} taken doses</Text></Card>
          <Card style={styles.metricCard}><Text style={styles.metricLabel}>30-Day Adherence</Text><Text style={styles.metricValue}>{monthly.overallPercent || 0}%</Text><Text style={styles.meta}>{monthly.days.reduce((sum, day) => sum + day.missed, 0)} missed doses</Text></Card>
        </View>

        <Card style={styles.historyCard}><Text style={styles.sectionTitle}>7-Day Adherence</Text><View style={styles.dayBars}>{weekly.days.slice(-7).map((day) => <View key={day.date} style={styles.dayBarItem}><View style={styles.barTrack}><View style={[styles.barFill, { height: `${Math.max(4, Math.min(100, day.percent || 0))}%` }]} /></View><Text style={styles.dayLabel}>{day.date ? new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "narrow" }) : ""}</Text><Text style={styles.dayPercent}>{day.percent || 0}%</Text></View>)}</View></Card>

        <Card style={styles.historyCard}><Text style={styles.sectionTitle}>Missed Doses</Text>{monthly.missedHistory.length ? monthly.missedHistory.slice(0, 8).map((item) => <View key={item.id} style={styles.historyRow}><View style={styles.historyIcon}><Ionicons name="alert-circle-outline" size={18} color={colors.error} /></View><View style={styles.flex}><Text style={styles.historyName}>{item.medicationDetails}</Text><Text style={styles.meta}>{item.date} · {item.scheduledTime}</Text></View><Text style={styles.missedText}>MISSED</Text></View>) : <Text style={styles.meta}>No missed doses in this period.</Text>}</Card>

        <Card style={styles.historyCard}><Text style={styles.sectionTitle}>Skipped Doses</Text>{skipped.length ? skipped.map((item) => <View key={item.id} style={styles.historyRow}><View style={styles.historyIcon}><Ionicons name="remove-circle-outline" size={18} color={colors.warning} /></View><View style={styles.flex}><Text style={styles.historyName}>{prescriptions.find((rx) => rx.id === item.prescriptionId)?.medicationDetails || "Medication dose"}</Text><Text style={styles.meta}>{item.scheduledDate} · {item.scheduledTime || item.doseKey}</Text></View><Text style={styles.skipText}>SKIPPED</Text></View>) : <Text style={styles.meta}>No skipped doses in this period.</Text>}</Card>

        <Card style={styles.historyCard}><Text style={styles.sectionTitle}>Completed / Stopped Medication</Text>{completed.length ? completed.map((item) => <View key={item.id} style={styles.historyRow}><View style={styles.historyIcon}><Ionicons name={item.completionReason === "Changed" ? "swap-horizontal-outline" : item.completionReason === "Stopped" ? "stop-circle-outline" : "checkmark-circle-outline"} size={18} color={colors.teal800} /></View><View style={styles.flex}><Text style={styles.historyName}>{item.medicationDetails}</Text><Text style={styles.meta}>{sourceLabel(item)}{period(item) ? ` · ${period(item)}` : ""}</Text></View><StatusBadge status="Completed" label={item.completionReason || "Completed"} size="sm" /></View>) : <Text style={styles.meta}>No completed or stopped medications yet.</Text>}</Card>
      </> : null}
      <View style={{ height: spacing.xxxl }} />
    </ScrollView>
  </AppShell>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl + 24 }, center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.sm },
  header: { marginBottom: spacing.lg }, eyebrow: { color: colors.teal800, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, letterSpacing: 1.2 }, title: { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.bold, marginTop: 4 }, subtitle: { color: colors.textSecondary, fontSize: typography.sizes.body, lineHeight: 22, marginTop: 6 },
  error: { backgroundColor: colors.errorBg, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md }, errorText: { color: colors.error, fontWeight: typography.weights.medium },
  tabs: { flexDirection: "row", gap: spacing.xs, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: 4, marginBottom: spacing.lg }, tab: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.md, paddingHorizontal: 6 }, tabActive: { backgroundColor: colors.teal800 }, tabText: { color: colors.textSecondary, fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, textAlign: "center" }, tabTextActive: { color: colors.white },
  todaySummary: { marginBottom: spacing.md }, summaryTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, sectionEyebrow: { color: colors.teal800, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, letterSpacing: 1 }, bigValue: { color: colors.textPrimary, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold, marginTop: 4 }, percentCircle: { minWidth: 58, height: 58, borderRadius: 29, backgroundColor: colors.teal100, alignItems: "center", justifyContent: "center" }, percentText: { color: colors.teal900, fontWeight: typography.weights.bold }, progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: "hidden", marginTop: spacing.md }, progressFill: { height: "100%", backgroundColor: colors.teal800 },
  doseCard: { marginBottom: spacing.md }, doseTop: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }, flex: { flex: 1 }, medName: { color: colors.textPrimary, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold }, dosage: { color: colors.textSecondary, fontSize: typography.sizes.small, marginTop: 3 }, time: { color: colors.teal800, fontSize: typography.sizes.body, fontWeight: typography.weights.bold, marginTop: 8 }, statusPill: { flexDirection: "row", gap: 5, alignItems: "center", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999 }, statusLabel: { fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold }, snoozeText: { color: colors.info, fontSize: typography.sizes.xs, marginTop: spacing.sm }, doseActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.md }, actionButton: { minHeight: 38, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }, takenButton: { borderColor: colors.success }, actionText: { color: colors.textPrimary, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold }, takenText: { color: colors.success, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold }, missedText: { color: colors.error, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold }, skipText: { color: colors.warning, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.sm }, sectionTitle: { color: colors.textPrimary, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold }, planCard: { marginBottom: spacing.md }, planTop: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }, medIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.teal100, alignItems: "center", justifyContent: "center" }, schedule: { color: colors.textPrimary, fontSize: typography.sizes.xs, marginTop: 5 }, source: { color: colors.teal800, fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, marginTop: 5 }, meta: { color: colors.textSecondary, fontSize: typography.sizes.xs, lineHeight: 18 }, manageRow: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm, marginTop: spacing.md }, lockNote: { flexDirection: "row", gap: 6, alignItems: "center", marginTop: spacing.md }, empty: { alignItems: "center", gap: spacing.xs, marginBottom: spacing.md }, emptyTitle: { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.bold },
  metricsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }, metricCard: { flex: 1 }, metricLabel: { color: colors.textSecondary, fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold }, metricValue: { color: colors.textPrimary, fontSize: typography.sizes.h2, fontWeight: typography.weights.bold, marginVertical: 4 }, historyCard: { marginBottom: spacing.md }, dayBars: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", height: 150, marginTop: spacing.md }, dayBarItem: { alignItems: "center", flex: 1 }, barTrack: { width: 18, height: 100, borderRadius: 9, backgroundColor: colors.border, justifyContent: "flex-end", overflow: "hidden" }, barFill: { width: "100%", backgroundColor: colors.teal800, borderRadius: 9 }, dayLabel: { color: colors.textSecondary, fontSize: typography.sizes.tiny, marginTop: 5 }, dayPercent: { color: colors.textMuted, fontSize: 9, marginTop: 2 }, historyRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }, historyIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }, historyName: { color: colors.textPrimary, fontSize: typography.sizes.small, fontWeight: typography.weights.semibold },
});
