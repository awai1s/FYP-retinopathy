import { Alert } from "../../services/alert";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  createDoctorFollowUp,
  createDoctorNote,
  getDoctorAlerts,
} from "../../services/doctorTools";
import { useLanguage } from "../../services/i18n";

import AppShell from "../../design/components/AppShell";
import Card from "../../design/components/card";
import IconContainer from "../../design/components/IconContainer";
import StatusBadge from "../../design/components/StatusBadge";
import Button from "../../design/components/Button";
import colors from "../../design/tokens/colors";
import spacing from "../../design/tokens/spacing";
import typography from "../../design/tokens/typography";
import radius from "../../design/tokens/radius";

import { useThemeRefresh } from "../../providers/AppThemeProvider";
export default function DoctorToolsScreen() {
  useThemeRefresh();
  const { t } = useLanguage();

  const [alerts, setAlerts] = useState<any[]>([]);
  const [patientId, setPatientId] = useState("");
  const [note, setNote] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [followUpReason, setFollowUpReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      setAlerts(await getDoctorAlerts());
    } catch (err: any) {
      setError(err?.message || t("unableToLoadDoctorAlerts") || "Unable to load doctor alerts.");
    } finally {
      setLoading(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const saveNote = async () => {
    if (!patientId.trim() || !note.trim()) {
      setError(t("enterPatientAndNote") || "Please enter patient ID and clinical note.");
      return;
    }
    setSaving(true);
    setError("");

    try {
      await createDoctorNote(patientId.trim(), note.trim());
      setNote("");
      Alert.alert(t("noteSaved") || "Note Saved", t("patientNoteSaved") || "Patient clinical note has been recorded.");
    } catch (err: any) {
      setError(err?.message || t("unableToSaveNote") || "Unable to save note.");
    } finally {
      setSaving(false);
    }
  };

  const saveFollowUp = async () => {
    if (!patientId.trim() || !dueDate.trim() || !followUpReason.trim()) {
      setError(t("enterPatientDueDateReason") || "Please enter patient ID, due date, and follow-up reason.");
      return;
    }
    setSaving(true);
    setError("");

    try {
      await createDoctorFollowUp(patientId.trim(), dueDate.trim(), followUpReason.trim());
      setFollowUpReason("");
      Alert.alert(t("followUpCreated") || "Follow-up Set", t("followUpSaved") || "Patient follow-up task created.");
    } catch (err: any) {
      setError(err?.message || t("unableToCreateFollowUp") || "Unable to create follow-up.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell role="Doctor" title={t("clinicalTools") || "Clinical Tools"} showBack onBackPress={() => router.back()}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.headerGroup}>
          <Text style={styles.eyebrow}>CLINICAL WORKFLOW</Text>
          <Text style={styles.title}>{t("clinicalTools") || "Clinician Utilities"}</Text>
          <Text style={styles.subtitle}>
            {t("clinicalToolsDescription") || "Manage high-risk patient alerts, document care notes, and schedule follow-ups."}
          </Text>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={20} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* High Risk Alerts Section */}
        <Text style={styles.sectionHeaderTitle}>{t("alerts") || "High-Risk Clinical Alerts"}</Text>
        {loading ? (
          <ActivityIndicator color={colors.teal800} style={styles.loader} />
        ) : alerts.length === 0 ? (
          <Card style={styles.emptyCard}>
            <IconContainer name="shield-checkmark-outline" size={24} color={colors.teal800} backgroundColor={colors.teal100} />
            <Text style={styles.emptyTitle}>{t("noHighRiskAlerts") || "No High Risk Alerts"}</Text>
            <Text style={styles.emptySub}>No stored high-risk screening alerts are available for connected patients.</Text>
          </Card>
        ) : (
          alerts.map((alertItem) => (
            <Card key={alertItem.id} variant="accent" style={styles.alertCard}>
              <View style={styles.alertRow}>
                <IconContainer name="warning-outline" size={22} color={colors.warning} backgroundColor={colors.warningBg} />
                <View style={styles.alertMain}>
                  <Text style={styles.alertTitleText}>{alertItem.stage || alertItem.prediction || "Screening Alert"}</Text>
                  <Text style={styles.alertSubText}>Patient ID: {alertItem.patientId || "Unspecified"}</Text>
                </View>
                <StatusBadge status="High Risk" size="sm" />
              </View>
            </Card>
          ))
        )}

        {/* Clinical Note Section */}
        <Text style={styles.sectionHeaderTitle}>{t("patientCareNote") || "Document Clinical Note"}</Text>
        <Card style={styles.formCard}>
          <Text style={styles.fieldLabel}>{t("patientId") || "Patient ID"}</Text>
          <TextInput
            style={styles.textInput}
            value={patientId}
            onChangeText={setPatientId}
            placeholder="Enter Patient ID string"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.fieldLabel}>{t("writeClinicalNote") || "Clinical Note Details"}</Text>
          <TextInput
            style={[styles.textInput, styles.multilineInput]}
            value={note}
            onChangeText={setNote}
            placeholder="Write clinical observations, exam notes, or treatment plan..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <Button
            title={saving ? (t("saving") || "Saving...") : (t("saveClinicalNote") || "Save Clinical Note")}
            icon="create-outline"
            onPress={saveNote}
            disabled={saving}
            loading={saving}
            style={styles.submitBtn}
          />
        </Card>

        {/* Follow-up Scheduler Section */}
        <Text style={styles.sectionHeaderTitle}>{t("followUp") || "Schedule Patient Follow-up"}</Text>
        <Card style={styles.formCard}>
          <Text style={styles.fieldLabel}>{t("dueDate") || "Follow-up Due Date"}</Text>
          <TextInput
            style={styles.textInput}
            value={dueDate}
            onChangeText={setDueDate}
            placeholder="YYYY-MM-DD (e.g. 2026-09-15)"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.fieldLabel}>{t("followUpReason") || "Follow-up Clinical Reason"}</Text>
          <TextInput
            style={[styles.textInput, styles.multilineInput]}
            value={followUpReason}
            onChangeText={setFollowUpReason}
            placeholder="Reason for repeat fundus exam, OCT scan, or referral check..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <Button
            title={saving ? (t("saving") || "Saving...") : (t("createFollowUp") || "Create Follow-up Order")}
            icon="calendar-outline"
            onPress={saveFollowUp}
            disabled={saving}
            loading={saving}
            style={styles.submitBtn}
          />
        </Card>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.xxxl + 40,
  },
  headerGroup: {
    marginBottom: spacing.lg,
  },
  eyebrow: {
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
    color: colors.teal800,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  title: {
    fontSize: typography.sizes.h1,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    marginTop: 4,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.errorBg,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.sizes.small,
  },
  sectionHeaderTitle: {
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  loader: {
    marginVertical: spacing.md,
  },
  emptyCard: {
    padding: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  emptySub: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 2,
  },
  alertCard: {
    backgroundColor: colors.warningBg,
    marginBottom: spacing.sm,
  },
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  alertMain: {
    flex: 1,
    marginLeft: spacing.md,
    paddingRight: spacing.xs,
  },
  alertTitleText: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  alertSubText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  formCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.teal800,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: colors.pageBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  multilineInput: {
    minHeight: 80,
  },
  submitBtn: {
    marginTop: spacing.xs,
  },
});
