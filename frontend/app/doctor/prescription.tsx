import { Alert } from "../../services/alert";
import React, { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { createDoctorPrescription } from "../../services/prescriptions";
import AppShell from "../../design/components/AppShell";
import Card from "../../design/components/card";
import IconContainer from "../../design/components/IconContainer";
import Button from "../../design/components/Button";
import colors from "../../design/tokens/colors";
import spacing from "../../design/tokens/spacing";
import typography from "../../design/tokens/typography";
import radius from "../../design/tokens/radius";

import { useThemeRefresh } from "../../providers/AppThemeProvider";
export default function DoctorPrescriptionScreen() {
  useThemeRefresh();
  const { patientId } = useLocalSearchParams<{ patientId?: string }>();
  const [medicationDetails, setMedicationDetails] = useState("");
  const [instructions, setInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!patientId) {
      setError("A patient must be selected before creating a prescription.");
      return;
    }
    if (!medicationDetails.trim() || !instructions.trim()) {
      setError("Enter medication details and instructions.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await createDoctorPrescription({
        patientId,
        medicationDetails: medicationDetails.trim(),
        instructions: instructions.trim(),
      });
      Alert.alert("Prescription Issued", "The prescription was successfully saved to the patient record.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      setError(err?.message || "Unable to create prescription.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell role="Doctor" title="Issue Prescription" showBack onBackPress={() => router.back()}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.headerGroup}>
          <Text style={styles.eyebrow}>CLINICAL CARE</Text>
          <Text style={styles.title}>Create Prescription</Text>
          <Text style={styles.subtitle}>Issue electronic medication and dosage orders for the selected patient.</Text>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={20} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Card style={styles.formCard}>
          <Text style={styles.sectionHeaderTitle}>Patient Target</Text>
          <View style={styles.readonlyBox}>
            <Ionicons name="person-outline" size={18} color={colors.teal800} />
            <Text style={styles.readonlyText}>Patient ID: {patientId || "No patient selected"}</Text>
          </View>

          <Text style={styles.fieldLabel}>Medication Details</Text>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.textInput}
              value={medicationDetails}
              onChangeText={setMedicationDetails}
              placeholder="e.g. Metformin 500mg, Ranibizumab 0.5mg"
              placeholderTextColor={colors.textMuted}
              multiline
            />
          </View>

          <Text style={styles.fieldLabel}>Clinical Instructions</Text>
          <View style={[styles.inputBox, styles.multilineBox]}>
            <TextInput
              style={[styles.textInput, styles.multilineInput]}
              value={instructions}
              onChangeText={setInstructions}
              placeholder="How and when the patient should take or administer medication..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <Button
            title={submitting ? "Issuing..." : "Issue Prescription"}
            icon="document-text-outline"
            onPress={submit}
            disabled={submitting}
            loading={submitting}
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
  formCard: {
    backgroundColor: colors.surface,
  },
  sectionHeaderTitle: {
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  readonlyBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.teal50,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 48,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.lg,
  },
  readonlyText: {
    marginLeft: spacing.sm,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    color: colors.teal900,
  },
  fieldLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.teal800,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputBox: {
    backgroundColor: colors.pageBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  multilineBox: {
    minHeight: 110,
  },
  textInput: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
  },
  multilineInput: {
    minHeight: 90,
  },
  submitBtn: {
    marginTop: spacing.xs,
  },
});
