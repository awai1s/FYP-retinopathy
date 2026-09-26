import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import AppShell from "../../design/components/AppShell";
import Card from "../../design/components/card";
import StatusBadge from "../../design/components/StatusBadge";
import colors from "../../design/tokens/colors";
import spacing from "../../design/tokens/spacing";
import typography from "../../design/tokens/typography";
import { useThemeRefresh } from "../../providers/AppThemeProvider";
import { getConsultation, PatientVisitSummary } from "../../services/consultations";

const actionLabel: Record<string, string> = {
  none: "No immediate action",
  follow_up: "Follow-up",
  new_screening: "New screening",
  referral: "Referral",
  medication_change: "Medication change",
  further_investigation: "Further investigation",
};

const formatDate = (value?: string | null) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export default function VisitSummaryScreen() {
  useThemeRefresh();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id || "";
  const [summary, setSummary] = useState<PatientVisitSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) { setError("Visit ID is missing."); setLoading(false); return; }
    getConsultation(id)
      .then((item) => setSummary(item as PatientVisitSummary))
      .catch((err: any) => setError(err?.message || "Unable to load visit summary."))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <AppShell role="Patient" title="Visit Summary" showBack onBackPress={() => router.back()}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {loading ? <View style={styles.center}><ActivityIndicator size="large" color={colors.teal800} /><Text style={styles.muted}>Loading visit summary...</Text></View> : null}
        {error ? <Card><Text style={styles.error}>{error}</Text></Card> : null}
        {summary ? <>
          <View style={styles.headerRow}><View style={styles.flex}><Text style={styles.eyebrow}>COMPLETED VISIT</Text><Text style={styles.title}>{summary.doctorName}</Text><Text style={styles.muted}>{formatDate(summary.completedAt)}</Text></View><StatusBadge status="Completed" size="sm" /></View>

          <Card style={styles.card}><Text style={styles.label}>REASON</Text><Text style={styles.value}>{summary.reasonForVisit || "Consultation"}</Text></Card>

          <Card style={styles.card}><Text style={styles.heading}>Medication Review</Text><Text style={styles.value}>{summary.medicationReview?.reviewed ? "✓ Medication list reviewed" : "Medication review not recorded"}</Text>{summary.medicationReview?.notes ? <Text style={styles.muted}>{summary.medicationReview.notes}</Text> : null}{summary.medicationReconciliation?.actions?.length ? <View style={{ marginTop: spacing.sm }}>{summary.medicationReconciliation.actions.map((item, index) => <View key={`${item.action}-${index}`} style={styles.item}><Text style={styles.value}>{item.action.toUpperCase()} · {item.medicationDetails || item.newMedicationDetails || "Medication"}</Text>{item.newMedicationDetails && item.medicationDetails ? <Text style={styles.muted}>New regimen: {item.newMedicationDetails}</Text> : null}{item.reason ? <Text style={styles.muted}>{item.reason}</Text> : null}</View>)}</View> : null}</Card>

          <Card style={styles.card}><Text style={styles.heading}>Instructions</Text><Text style={styles.value}>{summary.patientInstructions || "No patient instructions recorded."}</Text></Card>

          <Card style={styles.card}><Text style={styles.heading}>Next Action</Text><Text style={styles.value}>{actionLabel[summary.nextAction?.type] || summary.nextAction?.type || "Not recorded"}</Text>{summary.nextAction?.details ? <Text style={styles.muted}>{summary.nextAction.details}</Text> : null}{summary.followUp?.required ? <View style={styles.followRow}><Ionicons name="calendar-outline" size={18} color={colors.teal800} /><Text style={styles.value}>Follow-up: {summary.followUp.dueDate || "Date not set"} · {summary.followUp.reason || "Follow-up"}</Text></View> : null}</Card>

          {summary.procedures?.length ? <Card style={styles.card}><Text style={styles.heading}>Procedures</Text>{summary.procedures.map((item, index) => <View key={`${item.procedureType}-${index}`} style={styles.item}><Text style={styles.value}>{item.procedureType}</Text><Text style={styles.muted}>{item.outcome || "Outcome not recorded"}</Text></View>)}</Card> : null}

          {summary.educationAssignments?.length ? <Card style={styles.card}><Text style={styles.heading}>Recommended Education</Text>{summary.educationAssignments.map((item) => <View key={item.topicKey} style={styles.education}><Ionicons name="book-outline" size={18} color={colors.teal800} /><Text style={styles.value}>{item.title}</Text></View>)}</Card> : null}

          {summary.addenda?.length ? <Card style={styles.card}><Text style={styles.heading}>Clinical Addenda</Text>{summary.addenda.map((item) => <View key={item.id} style={styles.item}><Text style={styles.value}>{item.text}</Text><Text style={styles.muted}>{item.doctorName} · {formatDate(item.createdAt)}</Text></View>)}</Card> : null}

          <Text style={styles.notice}>This summary reflects the completed consultation record. Contact your healthcare professional if you need clarification about medical advice or follow-up.</Text>
        </> : null}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl + 50 },
  center: { minHeight: 260, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, marginBottom: spacing.lg },
  flex: { flex: 1 },
  eyebrow: { color: colors.teal800, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, letterSpacing: 1.1 },
  title: { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.bold, marginTop: 2 },
  muted: { color: colors.textSecondary, fontSize: typography.sizes.small, marginTop: 3 },
  error: { color: colors.error, fontSize: typography.sizes.body },
  card: { marginBottom: spacing.md, backgroundColor: colors.surface },
  label: { color: colors.teal800, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, letterSpacing: 0.7 },
  heading: { color: colors.textPrimary, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold, marginBottom: spacing.sm },
  value: { color: colors.textPrimary, fontSize: typography.sizes.body },
  followRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm, backgroundColor: colors.teal50, padding: spacing.sm, borderRadius: 10 },
  item: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  education: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs },
  notice: { color: colors.textMuted, fontSize: typography.sizes.xs, lineHeight: 18, marginTop: spacing.sm },
});
