import { Alert } from "../../../services/alert";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import AppShell from "../../../design/components/AppShell";
import Card from "../../../design/components/card";
import Button from "../../../design/components/Button";
import StatusBadge from "../../../design/components/StatusBadge";
import colors from "../../../design/tokens/colors";
import spacing from "../../../design/tokens/spacing";
import typography from "../../../design/tokens/typography";
import radius from "../../../design/tokens/radius";
import { useThemeRefresh } from "../../../providers/AppThemeProvider";
import {
  applyMedicationReconciliationAction,
  completeMedicationReconciliation,
  getMedicationReconciliation,
  MedicationPlanInput,
  MedicationReconciliation,
  ReconciliationMedication,
} from "../../../services/medicationReconciliation";

const scheduleOptions = ["Morning", "Noon", "Evening", "Night"];

const actionId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const medSubline = (item: ReconciliationMedication) => {
  const pieces = [item.dosage, item.times?.join(" • "), item.intakeInstruction || item.instructions].filter(Boolean);
  return pieces.join(" · ") || "No dosage instructions recorded";
};

export default function MedicationReconciliationScreen() {
  useThemeRefresh();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const encounterId = Array.isArray(params.id) ? params.id[0] : params.id || "";

  const [data, setData] = useState<MedicationReconciliation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");

  const [editorMode, setEditorMode] = useState<"start" | "change" | null>(null);
  const [editingMedication, setEditingMedication] = useState<ReconciliationMedication | null>(null);
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [times, setTimes] = useState<string[]>([]);
  const [intake, setIntake] = useState("");
  const [instructions, setInstructions] = useState("");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    if (!encounterId) {
      setError("Consultation ID is missing.");
      setLoading(false);
      return;
    }
    try {
      setError("");
      const result = await getMedicationReconciliation(encounterId);
      setData(result);
      setNotes(result.notes || "");
    } catch (err: any) {
      setError(err?.message || "Unable to load medication reconciliation.");
    } finally {
      setLoading(false);
    }
  }, [encounterId]);

  useEffect(() => { void load(); }, [load]);

  const completed = data?.status === "completed";
  const reviewedIds = useMemo(() => new Set((data?.actions || []).map((item) => item.prescriptionId).filter(Boolean)), [data]);

  const resetEditor = () => {
    setEditorMode(null);
    setEditingMedication(null);
    setName("");
    setDosage("");
    setTimes([]);
    setIntake("");
    setInstructions("");
    setReason("");
  };

  const openStart = () => {
    resetEditor();
    setEditorMode("start");
  };

  const openChange = (item: ReconciliationMedication) => {
    setEditingMedication(item);
    setEditorMode("change");
    setName(item.medicationDetails || "");
    setDosage(item.dosage || "");
    setTimes(item.times || []);
    setIntake(item.intakeInstruction || "");
    setInstructions(item.instructions || "");
    setReason("");
  };

  const toggleTime = (value: string) => {
    setTimes((items) => items.includes(value) ? items.filter((item) => item !== value) : [...items, value]);
  };

  const medicationPayload = (): MedicationPlanInput => ({
    medicationDetails: name.trim(),
    dosage: dosage.trim(),
    times,
    intakeInstruction: intake.trim(),
    instructions: instructions.trim(),
  });

  const apply = async (payload: Parameters<typeof applyMedicationReconciliationAction>[1], key: string) => {
    try {
      setBusy(key);
      setError("");
      const result = await applyMedicationReconciliationAction(encounterId, payload);
      setData(result);
      resetEditor();
    } catch (err: any) {
      setError(err?.message || "Unable to save medication decision.");
    } finally {
      setBusy("");
    }
  };

  const confirmMedication = (item: ReconciliationMedication) => {
    void apply({ actionId: actionId(), action: "confirmed", prescriptionId: item.id }, `confirm:${item.id}`);
  };

  const stopMedication = (item: ReconciliationMedication) => {
    Alert.alert(
      "Stop Medication",
      `Stop ${item.medicationDetails}? The medication will remain in history and will not be deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Stop",
          style: "destructive",
          onPress: () => void apply({ actionId: actionId(), action: "stopped", prescriptionId: item.id, reason: "Stopped during consultation" }, `stop:${item.id}`),
        },
      ]
    );
  };

  const saveEditor = () => {
    if (!name.trim()) {
      Alert.alert("Medication Required", "Enter a medication name.");
      return;
    }
    const medication = medicationPayload();
    if (editorMode === "change" && editingMedication) {
      void apply({
        actionId: actionId(),
        action: "changed",
        prescriptionId: editingMedication.id,
        reason: reason.trim() || "Medication regimen changed during consultation",
        medication,
      }, `change:${editingMedication.id}`);
    } else {
      void apply({ actionId: actionId(), action: "started", reason: reason.trim(), medication }, "start");
    }
  };

  const finish = async () => {
    try {
      setBusy("complete");
      setError("");
      const result = await completeMedicationReconciliation(encounterId, notes);
      setData(result);
      Alert.alert("Medication Review Complete", "The reconciliation is saved and the consultation has been marked as medication-reviewed.", [
        { text: "Return to Consultation", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      setError(err?.message || "Unable to complete medication reconciliation.");
    } finally {
      setBusy("");
    }
  };

  if (loading) {
    return <AppShell role="Doctor" title="Medication Reconciliation" showBack onBackPress={() => router.back()}><View style={styles.center}><ActivityIndicator size="large" color={colors.teal800} /><Text style={styles.muted}>Loading medication plan...</Text></View></AppShell>;
  }

  return (
    <AppShell role="Doctor" title="Medication Reconciliation" showBack onBackPress={() => router.back()}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>CONSULTATION WORKSPACE</Text>
          <Text style={styles.title}>Medication Reconciliation</Text>
          <Text style={styles.subtitle}>Confirm the patient's current list, record changes without overwriting history, stop outdated medicines, or start a new medication.</Text>
        </View>

        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
        {completed ? <View style={styles.successBox}><Ionicons name="checkmark-circle" size={22} color={colors.success} /><Text style={styles.successText}>This medication reconciliation is complete.</Text></View> : null}

        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}><Text style={styles.label}>CURRENT ACTIVE MEDICATION</Text><StatusBadge status={completed ? "Completed" : "Review"} label={completed ? "Completed" : `${data?.medications.length || 0} active`} size="sm" /></View>
          <Text style={styles.smallMuted}>Every change creates a new historical record. Existing prescriptions are never overwritten.</Text>
        </Card>

        {(data?.medications || []).length === 0 ? (
          <Card style={styles.emptyCard}><Ionicons name="medical-outline" size={28} color={colors.textMuted} /><Text style={styles.emptyTitle}>No active medication recorded</Text><Text style={styles.smallMuted}>You can start a new medication below.</Text></Card>
        ) : (data?.medications || []).map((item) => {
          const reviewed = reviewedIds.has(item.id);
          return (
            <Card key={item.id} style={styles.medCard}>
              <View style={styles.medHeader}>
                <View style={styles.medIcon}><Ionicons name="medical-outline" size={20} color={colors.teal800} /></View>
                <View style={styles.flex}>
                  <Text style={styles.medName}>{item.medicationDetails}</Text>
                  <Text style={styles.medSub}>{medSubline(item)}</Text>
                  <Text style={styles.sourceText}>{item.source === "Patient" ? "Added by patient" : `Prescribed by ${item.doctorName || "Doctor"}`}</Text>
                </View>
                {reviewed ? <StatusBadge status="Completed" label="Reviewed" size="sm" /> : null}
              </View>
              {!completed ? <View style={styles.actionRow}>
                <Button title="Confirmed" size="sm" variant="outline" onPress={() => confirmMedication(item)} disabled={Boolean(busy)} />
                <Button title="Change" size="sm" variant="outline" onPress={() => openChange(item)} disabled={Boolean(busy)} />
                <Button title="Stop" size="sm" variant="outline" onPress={() => stopMedication(item)} disabled={Boolean(busy)} />
              </View> : null}
            </Card>
          );
        })}

        {!completed ? <Button title="Start New Medication" icon="add-outline" onPress={openStart} disabled={Boolean(busy)} /> : null}

        {editorMode && !completed ? <Card style={styles.editorCard}>
          <View style={styles.editorHeader}><Text style={styles.cardTitle}>{editorMode === "change" ? `Change ${editingMedication?.medicationDetails || "Medication"}` : "Start New Medication"}</Text><TouchableOpacity onPress={resetEditor}><Ionicons name="close" size={22} color={colors.textMuted} /></TouchableOpacity></View>
          <Text style={styles.fieldLabel}>Medication name</Text>
          <TextInput value={name} onChangeText={setName} placeholder="e.g. Metformin" placeholderTextColor={colors.textMuted} style={styles.input} />
          <Text style={styles.fieldLabel}>Dosage</Text>
          <TextInput value={dosage} onChangeText={setDosage} placeholder="e.g. 500 mg" placeholderTextColor={colors.textMuted} style={styles.input} />
          <Text style={styles.fieldLabel}>Schedule</Text>
          <View style={styles.chips}>{scheduleOptions.map((item) => { const selected = times.includes(item); return <TouchableOpacity key={item} onPress={() => toggleTime(item)} style={[styles.chip, selected && styles.chipActive]}><Text style={[styles.chipText, selected && styles.chipTextActive]}>{item}</Text></TouchableOpacity>; })}</View>
          <Text style={styles.fieldLabel}>Intake instruction</Text>
          <TextInput value={intake} onChangeText={setIntake} placeholder="e.g. After food" placeholderTextColor={colors.textMuted} style={styles.input} />
          <Text style={styles.fieldLabel}>Clinical instructions</Text>
          <TextInput value={instructions} onChangeText={setInstructions} placeholder="Additional instructions" placeholderTextColor={colors.textMuted} style={[styles.input, styles.multiline]} multiline />
          <Text style={styles.fieldLabel}>Reason / note</Text>
          <TextInput value={reason} onChangeText={setReason} placeholder="Why is this being changed or started?" placeholderTextColor={colors.textMuted} style={[styles.input, styles.multiline]} multiline />
          <View style={styles.editorActions}><Button title="Cancel" variant="outline" onPress={resetEditor} /><Button title={busy ? "Saving..." : editorMode === "change" ? "Save Changed Regimen" : "Start Medication"} onPress={saveEditor} disabled={Boolean(busy) || !name.trim()} /></View>
        </Card> : null}

        <Card style={styles.actionsCard}>
          <Text style={styles.cardTitle}>Reconciliation History</Text>
          {(data?.actions || []).length ? data?.actions.map((item, index) => (
            <View key={item.actionId || String(index)} style={[styles.historyRow, index > 0 && styles.historyBorder]}>
              <Ionicons name={item.action === "confirmed" ? "checkmark-circle-outline" : item.action === "stopped" ? "stop-circle-outline" : item.action === "changed" ? "swap-horizontal-outline" : "add-circle-outline"} size={20} color={colors.teal800} />
              <View style={styles.flex}><Text style={styles.historyTitle}>{item.action.toUpperCase()} · {item.medicationDetails || item.newMedicationDetails || "Medication"}</Text>{item.reason ? <Text style={styles.smallMuted}>{item.reason}</Text> : null}</View>
            </View>
          )) : <Text style={styles.smallMuted}>No reconciliation decisions recorded yet.</Text>}
        </Card>

        <Card style={styles.actionsCard}>
          <Text style={styles.cardTitle}>Doctor Notes</Text>
          <TextInput editable={!completed} value={notes} onChangeText={setNotes} placeholder="Optional medication reconciliation notes" placeholderTextColor={colors.textMuted} style={[styles.input, styles.notes]} multiline />
          {!completed ? <Button title={busy === "complete" ? "Completing..." : "Complete Medication Review"} icon="checkmark-done-outline" onPress={finish} disabled={Boolean(busy)} /> : null}
        </Card>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl + 30 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.sm },
  header: { marginBottom: spacing.lg },
  eyebrow: { color: colors.teal800, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, letterSpacing: 1.2 },
  title: { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.bold, marginTop: 4 },
  subtitle: { color: colors.textSecondary, fontSize: typography.sizes.body, lineHeight: 22, marginTop: 6 },
  muted: { color: colors.textSecondary },
  smallMuted: { color: colors.textSecondary, fontSize: typography.sizes.xs, lineHeight: 18 },
  errorBox: { backgroundColor: colors.errorBg, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  errorText: { color: colors.error, fontWeight: typography.weights.medium },
  successBox: { flexDirection: "row", gap: spacing.sm, alignItems: "center", backgroundColor: colors.successBg, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  successText: { color: colors.textPrimary, fontWeight: typography.weights.semibold, flex: 1 },
  summaryCard: { marginBottom: spacing.md },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  label: { color: colors.textSecondary, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, letterSpacing: 0.8 },
  medCard: { marginBottom: spacing.md },
  medHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  medIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: colors.teal100 },
  medName: { color: colors.textPrimary, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold },
  medSub: { color: colors.textSecondary, fontSize: typography.sizes.small, marginTop: 2 },
  sourceText: { color: colors.teal800, fontSize: typography.sizes.xs, marginTop: 4 },
  flex: { flex: 1 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  emptyCard: { alignItems: "center", gap: spacing.xs, marginBottom: spacing.md },
  emptyTitle: { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.bold },
  editorCard: { marginTop: spacing.md, marginBottom: spacing.md },
  editorHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  cardTitle: { color: colors.textPrimary, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold },
  fieldLabel: { color: colors.textSecondary, fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, marginTop: spacing.sm, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary, borderRadius: radius.md, minHeight: 46, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: typography.sizes.small },
  multiline: { minHeight: 76, textAlignVertical: "top" },
  notes: { minHeight: 90, textAlignVertical: "top", marginVertical: spacing.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 8, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.teal800, borderColor: colors.teal800 },
  chipText: { color: colors.textPrimary, fontSize: typography.sizes.xs, fontWeight: typography.weights.medium },
  chipTextActive: { color: colors.white },
  editorActions: { flexDirection: "row", justifyContent: "flex-end", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  actionsCard: { marginTop: spacing.md },
  historyRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingVertical: spacing.sm },
  historyBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  historyTitle: { color: colors.textPrimary, fontSize: typography.sizes.small, fontWeight: typography.weights.semibold },
});
