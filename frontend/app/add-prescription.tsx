import { Alert } from "../services/alert";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  createPatientPrescription,
  getPatientPrescription,
  getPatientPrescriptions,
  updatePatientPrescription,
} from "../services/prescriptions";
import { syncMedicationNotifications } from "../services/medicationNotifications";

import AppShell from "../design/components/AppShell";
import Card from "../design/components/card";
import Button from "../design/components/Button";
import colors from "../design/tokens/colors";
import spacing from "../design/tokens/spacing";
import typography from "../design/tokens/typography";
import radius from "../design/tokens/radius";

import { useThemeRefresh } from "../providers/AppThemeProvider";
const toDateKey = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateKey = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, month, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
};

const deriveEndDate = (startDate: string, durationWeeks: number) => {
  const start = parseDateKey(startDate);
  if (!start) return "";
  start.setDate(start.getDate() + Math.max(1, durationWeeks) * 7 - 1);
  return toDateKey(start);
};

const numberFromDosage = (value?: string) => {
  const match = String(value || "").match(/\d+(?:\.\d+)?/);
  return match ? Math.max(10, Math.round(Number(match[0]))) : 100;
};

export default function AddPrescriptionScreen() {
  useThemeRefresh();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = Boolean(id);

  const [medicationDetails, setMedicationDetails] = useState("");
  const [dosageValue, setDosageValue] = useState(100);
  const [durationValue, setDurationValue] = useState(1);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [intakeInstruction, setIntakeInstruction] = useState<
    "After Food" | "Before Food" | ""
  >("");
  const [startDate, setStartDate] = useState(() => toDateKey(new Date()));
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(editing);

  const endDate = useMemo(
    () => deriveEndDate(startDate, durationValue),
    [startDate, durationValue]
  );

  useEffect(() => {
    if (!id) return;

    let active = true;
    getPatientPrescription(id)
      .then((prescription) => {
        if (!active) return;
        if (prescription.source !== "Patient") {
          Alert.alert(
            "Cannot Edit",
            "Doctor-issued prescriptions can only be changed by the prescribing clinician."
          );
          router.back();
          return;
        }

        setMedicationDetails(prescription.medicationDetails || "");
        setDosageValue(numberFromDosage(prescription.dosage));
        setDurationValue(
          Math.max(
            1,
            Number(
              prescription.durationWeeks ||
                String(prescription.duration || "1").match(/\d+/)?.[0] ||
                1
            )
          )
        );
        setSelectedTimes(Array.isArray(prescription.times) ? prescription.times : []);
        setIntakeInstruction(
          prescription.intakeInstruction === "After Food" ||
            prescription.intakeInstruction === "Before Food"
            ? prescription.intakeInstruction
            : ""
        );
        setStartDate(prescription.startDate || prescription.date || toDateKey(new Date()));
        setNotes(prescription.notes || "");
      })
      .catch((error: any) => {
        if (active) {
          Alert.alert(
            "Unable to Load Medication",
            error?.message || "The medication could not be loaded."
          );
          router.back();
        }
      })
      .finally(() => {
        if (active) setLoadingExisting(false);
      });

    return () => {
      active = false;
    };
  }, [id, router]);

  const toggleTime = (time: string) => {
    setSelectedTimes((prev) =>
      prev.includes(time) ? prev.filter((item) => item !== time) : [...prev, time]
    );
  };

  const handleSubmit = async () => {
    if (!medicationDetails.trim()) {
      Alert.alert("Required Field", "Please enter the medication name.");
      return;
    }

    if (!parseDateKey(startDate)) {
      Alert.alert("Invalid Start Date", "Use the YYYY-MM-DD format, for example 2026-09-14.");
      return;
    }

    if (!endDate) {
      Alert.alert("Invalid Duration", "Please check the start date and duration.");
      return;
    }

    if (selectedTimes.length === 0) {
      Alert.alert(
        "Medication Time Required",
        "Select at least one time: Morning, Noon, Evening, or Night."
      );
      return;
    }

    const payload = {
      medicationDetails: medicationDetails.trim(),
      dosage: `${dosageValue} mg`,
      duration: `${durationValue} Week${durationValue > 1 ? "s" : ""}`,
      durationWeeks: durationValue,
      times: selectedTimes,
      intakeInstruction,
      startDate,
      endDate,
      notes: notes.trim(),
    };

    try {
      setSubmitting(true);

      if (id) {
        await updatePatientPrescription(id, payload);
      } else {
        await createPatientPrescription(payload);
      }

      let reminderMessage = "";
      try {
        const allPrescriptions = await getPatientPrescriptions();
        const reminderResult = await syncMedicationNotifications(allPrescriptions);

        if (!reminderResult.supported) {
          reminderMessage =
            "\n\nMedication reminders will be scheduled when you use the Android/iOS app.";
        } else if (!reminderResult.permissionGranted) {
          reminderMessage =
            "\n\nMedication saved, but notification permission is disabled on this device.";
        } else {
          reminderMessage = `\n\n${reminderResult.scheduledCount} upcoming medication reminder${
            reminderResult.scheduledCount === 1 ? "" : "s"
          } scheduled on this device.`;
        }
      } catch (notificationError) {
        console.warn("Medication saved but reminder sync failed:", notificationError);
        reminderMessage =
          "\n\nMedication saved. Reminders will be refreshed the next time you open Medication Tracker.";
      }

      Alert.alert(
        editing ? "Medication Updated" : "Medication Added",
        `${medicationDetails.trim()} was saved successfully.${reminderMessage}`,
        [{ text: "OK", onPress: () => router.replace("/prescriptions" as any) }]
      );
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not save medication.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingExisting) {
    return (
      <AppShell role="Patient" title="Edit Medication" showBack onBackPress={() => router.back()}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.teal800} />
          <Text style={styles.loadingText}>Loading medication...</Text>
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell
      role="Patient"
      title={editing ? "Edit Medication" : "Add Prescription"}
      showBack
      onBackPress={() => router.back()}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionTitle}>Medication Name</Text>
        <Card style={styles.inputCard}>
          <TextInput
            style={styles.input}
            placeholder="Enter medication name"
            placeholderTextColor={colors.textMuted}
            value={medicationDetails}
            onChangeText={setMedicationDetails}
          />
        </Card>

        <Text style={styles.sectionTitle}>Dosage</Text>
        <View style={styles.stepperContainer}>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => setDosageValue(Math.max(10, dosageValue - 10))}
          >
            <Ionicons name="remove" size={24} color={colors.teal800} />
          </TouchableOpacity>
          <View style={styles.stepperValueContainer}>
            <Text style={styles.stepperValue}>{dosageValue} mg</Text>
          </View>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => setDosageValue(dosageValue + 10)}
          >
            <Ionicons name="add" size={24} color={colors.teal800} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Duration</Text>
        <View style={styles.stepperContainer}>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => setDurationValue(Math.max(1, durationValue - 1))}
          >
            <Ionicons name="remove" size={24} color={colors.teal800} />
          </TouchableOpacity>
          <View style={styles.stepperValueContainer}>
            <Text style={styles.stepperValue}>
              {durationValue} Week{durationValue > 1 ? "s" : ""}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => setDurationValue(Math.min(520, durationValue + 1))}
          >
            <Ionicons name="add" size={24} color={colors.teal800} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Medication Dates</Text>
        <View style={styles.dateRow}>
          <Card style={[styles.inputCard, styles.dateCard]}>
            <Text style={styles.dateLabel}>START DATE</Text>
            <TextInput
              style={styles.dateInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              value={startDate}
              onChangeText={setStartDate}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={10}
            />
          </Card>
          <Card style={[styles.inputCard, styles.dateCard]}>
            <Text style={styles.dateLabel}>END DATE</Text>
            <Text style={styles.dateValue}>{endDate || "Check start date"}</Text>
          </Card>
        </View>
        <Text style={styles.helperText}>
          End date is calculated automatically from the selected duration.
        </Text>

        <Text style={styles.sectionTitle}>Medication Time</Text>
        <View style={styles.pillRow}>
          {["Morning", "Noon", "Evening", "Night"].map((time) => {
            const isSelected = selectedTimes.includes(time);
            return (
              <TouchableOpacity
                key={time}
                activeOpacity={0.8}
                onPress={() => toggleTime(time)}
                style={[styles.pill, isSelected && styles.pillSelected]}
              >
                <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                  {time}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.helperText}>
          Morning 8:00 AM • Noon 12:00 PM • Evening 6:00 PM • Night 9:00 PM
        </Text>

        <Text style={styles.sectionTitle}>To Be Taken</Text>
        <View style={styles.pillRow}>
          {["After Food", "Before Food"].map((instruction) => {
            const isSelected = intakeInstruction === instruction;
            return (
              <TouchableOpacity
                key={instruction}
                activeOpacity={0.8}
                onPress={() => setIntakeInstruction(instruction as "After Food" | "Before Food")}
                style={[styles.pill, isSelected && styles.pillSelected]}
              >
                <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                  {instruction}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Important Note</Text>
        <Card style={styles.inputCard}>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="Type here..."
            placeholderTextColor={colors.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
          />
        </Card>

        <View style={styles.actions}>
          <Button
            title={
              submitting
                ? editing
                  ? "Updating..."
                  : "Creating..."
                : editing
                  ? "Update Medication"
                  : "Create Prescription"
            }
            onPress={handleSubmit}
            disabled={submitting}
            loading={submitting}
          />
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  loadingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
    fontSize: typography.sizes.body,
  },
  content: {
    paddingBottom: spacing.xxxl + 40,
  },
  sectionTitle: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.bold,
    color: colors.teal800,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  inputCard: {
    backgroundColor: colors.surface,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  input: {
    color: colors.textPrimary,
    fontSize: typography.sizes.body,
    paddingVertical: spacing.xs,
  },
  notesInput: {
    minHeight: 80,
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.sm,
  },
  stepperBtn: {
    padding: spacing.md,
    backgroundColor: colors.teal50,
  },
  stepperValueContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValue: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  dateRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  dateCard: {
    flex: 1,
    minHeight: 72,
    justifyContent: "center",
  },
  dateLabel: {
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  dateInput: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    fontWeight: typography.weights.semibold,
    marginTop: spacing.xs,
    paddingVertical: 0,
  },
  dateValue: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    fontWeight: typography.weights.semibold,
    marginTop: spacing.xs,
  },
  helperText: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    lineHeight: 17,
    marginBottom: spacing.sm,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  pill: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  pillSelected: {
    backgroundColor: colors.teal800,
    borderColor: colors.teal800,
  },
  pillText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
  },
  pillTextSelected: {
    color: colors.white,
  },
  actions: {
    marginTop: spacing.xl,
  },
});