import { Alert } from "../../../../services/alert";
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
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import AppShell from "../../../../design/components/AppShell";
import Card from "../../../../design/components/card";
import Button from "../../../../design/components/Button";
import colors from "../../../../design/tokens/colors";
import spacing from "../../../../design/tokens/spacing";
import typography from "../../../../design/tokens/typography";
import radius from "../../../../design/tokens/radius";
import { useThemeRefresh } from "../../../../providers/AppThemeProvider";
import {
  createEquipmentEvent,
  getEquipment,
  type EquipmentEventType,
  type EyeEquipment,
  type StoredEquipmentStatus,
} from "../../../../services/equipment";

const EVENT_TYPES: EquipmentEventType[] = [
  "SERVICE",
  "CALIBRATION",
  "DOWNTIME_START",
  "DOWNTIME_END",
  "REPAIR",
  "STATUS_CHANGE",
  "RETIREMENT",
];
const STATUS_OPTIONS: StoredEquipmentStatus[] = ["Operational", "Under Maintenance", "Out of Service", "Retired"];

const todayISO = () => new Date().toISOString().slice(0, 10);
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const titleFor = (type: EquipmentEventType) => ({
  SERVICE: "Add Service Record",
  CALIBRATION: "Record Calibration",
  DOWNTIME_START: "Report Downtime",
  DOWNTIME_END: "End Downtime",
  REPAIR: "Record Repair",
  STATUS_CHANGE: "Change Device Status",
  RETIREMENT: "Retire Equipment",
}[type]);

const helpFor = (type: EquipmentEventType) => ({
  SERVICE: "Record completed maintenance/service and optionally schedule the next service date.",
  CALIBRATION: "Record calibration and optionally schedule the next calibration date.",
  DOWNTIME_START: "Marks the equipment Out of Service and preserves when downtime started.",
  DOWNTIME_END: "Returns an out-of-service device to Operational and records the downtime end.",
  REPAIR: "Record repair work and choose the resulting operational state.",
  STATUS_CHANGE: "Use for operational state changes such as Under Maintenance or Out of Service.",
  RETIREMENT: "Retirement is permanent in EyeCare AI. The lifecycle history remains available read-only.",
}[type]);

export default function EquipmentEventScreen() {
  useThemeRefresh();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; type?: string }>();
  const equipmentId = String(params.id || "");
  const requested = String(params.type || "SERVICE") as EquipmentEventType;
  const initialType = EVENT_TYPES.includes(requested) ? requested : "SERVICE";

  const [equipment, setEquipment] = useState<EyeEquipment | null>(null);
  const [eventType, setEventType] = useState<EquipmentEventType>(initialType);
  const [eventDate, setEventDate] = useState(todayISO());
  const [nextDueDate, setNextDueDate] = useState("");
  const [targetStatus, setTargetStatus] = useState<StoredEquipmentStatus>(initialType === "RETIREMENT" ? "Retired" : "Operational");
  const [performedBy, setPerformedBy] = useState("");
  const [reference, setReference] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!equipmentId) return;
    getEquipment(equipmentId)
      .then((device) => {
        setEquipment(device);
        if (initialType === "SERVICE") setNextDueDate(device.nextService || "");
        if (initialType === "CALIBRATION") setNextDueDate(device.nextCalibration || "");
        if (initialType === "REPAIR") setTargetStatus("Operational");
        if (initialType === "STATUS_CHANGE") setTargetStatus(device.storedStatus === "Retired" ? "Retired" : device.storedStatus);
      })
      .catch((err: any) => setError(err?.message || "Unable to load equipment."))
      .finally(() => setLoading(false));
  }, [equipmentId, initialType]);

  useEffect(() => {
    if (eventType === "RETIREMENT") setTargetStatus("Retired");
    else if (eventType === "DOWNTIME_START") setTargetStatus("Out of Service");
    else if (eventType === "DOWNTIME_END") setTargetStatus("Operational");
  }, [eventType]);

  const needsNextDue = eventType === "SERVICE" || eventType === "CALIBRATION";
  const needsStatus = eventType === "STATUS_CHANGE" || eventType === "REPAIR";
  const showWorkFields = eventType === "SERVICE" || eventType === "CALIBRATION" || eventType === "REPAIR";

  const heading = useMemo(() => titleFor(eventType), [eventType]);

  const save = async () => {
    if (saving || !equipment) return;
    if (!validDate(eventDate)) {
      Alert.alert("Invalid Date", "Event Date must use YYYY-MM-DD format.");
      return;
    }
    if (nextDueDate && !validDate(nextDueDate)) {
      Alert.alert("Invalid Date", "Next Due Date must use YYYY-MM-DD format.");
      return;
    }
    const numericCost = cost.trim() ? Number(cost) : undefined;
    if (numericCost != null && (!Number.isFinite(numericCost) || numericCost < 0)) {
      Alert.alert("Invalid Cost", "Enter a valid non-negative number or leave Cost blank.");
      return;
    }
    if (eventType === "RETIREMENT") {
      const confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          "Retire this device?",
          "Retirement is permanent in EyeCare AI. The device and lifecycle history remain visible but cannot be reactivated.",
          [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            { text: "Retire", style: "destructive", onPress: () => resolve(true) },
          ],
          { cancelable: true, onDismiss: () => resolve(false) }
        );
      });
      if (!confirmed) return;
    }

    try {
      setSaving(true);
      await createEquipmentEvent(equipment.id, {
        eventType,
        eventDate,
        nextDueDate: needsNextDue ? nextDueDate : "",
        targetStatus: eventType === "RETIREMENT" ? "Retired" : needsStatus ? targetStatus : undefined,
        performedBy: showWorkFields ? performedBy : "",
        reference: showWorkFields ? reference : "",
        cost: showWorkFields ? numericCost : undefined,
        notes,
      });
      Alert.alert("Lifecycle Updated", `${heading} was saved successfully.`, [
        { text: "Back to Device", onPress: () => router.replace(`/hospital/equipment/${equipment.id}` as any) },
      ]);
    } catch (err: any) {
      Alert.alert("Unable to Save", err?.message || "The equipment lifecycle event could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <AppShell role="Hospital" title="Equipment Event" showBack onBackPress={() => router.back()} showAssistant={false}><View style={styles.center}><ActivityIndicator size="large" color={colors.teal800} /></View></AppShell>;
  }

  if (!equipment) {
    return <AppShell role="Hospital" title="Equipment Event" showBack onBackPress={() => router.back()} showAssistant={false}><Card style={styles.errorCard}><Text style={styles.errorText}>{error || "Equipment unavailable."}</Text></Card></AppShell>;
  }

  return (
    <AppShell role="Hospital" title={heading} showBack onBackPress={() => router.back()} showAssistant={false}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Card variant="elevated" style={styles.deviceCard}>
          <Text style={styles.eyebrow}>ASSET {equipment.assetId}</Text>
          <Text style={styles.deviceTitle}>{equipment.deviceName}</Text>
          <Text style={styles.secondary}>{equipment.type} · Current status: {equipment.status}</Text>
        </Card>

        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>Lifecycle Action</Text>
          <Text style={styles.helper}>{helpFor(eventType)}</Text>
          <View style={styles.eventChoices}>
            {EVENT_TYPES.map((item) => {
              const selected = eventType === item;
              const disabled = item === "RETIREMENT" && equipment.status === "Retired";
              return (
                <TouchableOpacity key={item} disabled={disabled} onPress={() => setEventType(item)} style={[styles.choice, selected && styles.choiceActive, disabled && styles.disabledChoice]}>
                  <Text style={[styles.choiceText, selected && styles.choiceTextActive]}>{titleFor(item).replace(/^Add |^Record |^Change Device |^Report /, "")}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Event Date *</Text>
          <TextInput value={eventDate} onChangeText={setEventDate} placeholder="2026-09-24" placeholderTextColor={colors.textMuted} style={styles.input} />
          <Text style={styles.fieldHint}>YYYY-MM-DD</Text>

          {needsNextDue ? (
            <>
              <Text style={styles.label}>Next {eventType === "SERVICE" ? "Service" : "Calibration"} Date</Text>
              <TextInput value={nextDueDate} onChangeText={setNextDueDate} placeholder="2026-12-24" placeholderTextColor={colors.textMuted} style={styles.input} />
              <Text style={styles.fieldHint}>Optional · YYYY-MM-DD</Text>
            </>
          ) : null}

          {needsStatus ? (
            <>
              <Text style={styles.label}>Resulting Status</Text>
              <View style={styles.statusChoices}>
                {STATUS_OPTIONS.filter((item) => item !== "Retired").map((item) => {
                  const selected = targetStatus === item;
                  return <TouchableOpacity key={item} onPress={() => setTargetStatus(item)} style={[styles.choice, selected && styles.choiceActive]}><Text style={[styles.choiceText, selected && styles.choiceTextActive]}>{item}</Text></TouchableOpacity>;
                })}
              </View>
            </>
          ) : null}

          {showWorkFields ? (
            <>
              <Text style={styles.label}>Performed By / Vendor</Text>
              <TextInput value={performedBy} onChangeText={setPerformedBy} placeholder="Biomedical Engineering / Vendor name" placeholderTextColor={colors.textMuted} style={styles.input} />

              <Text style={styles.label}>Reference / Work Order</Text>
              <TextInput value={reference} onChangeText={setReference} placeholder="WO-2026-014" placeholderTextColor={colors.textMuted} style={styles.input} />

              <Text style={styles.label}>Cost (optional)</Text>
              <TextInput value={cost} onChangeText={setCost} placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" style={styles.input} />
            </>
          ) : null}

          <Text style={styles.label}>Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder={eventType === "DOWNTIME_START" ? "Describe the failure or downtime reason..." : "Lifecycle notes..."}
            placeholderTextColor={colors.textMuted}
            multiline
            style={[styles.input, styles.textArea]}
          />
        </Card>

        {eventType === "RETIREMENT" ? (
          <View style={styles.dangerNotice}><Ionicons name="warning-outline" size={20} color={colors.error} /><Text style={styles.dangerText}>Retirement cannot be reversed. Use Out of Service or Under Maintenance for temporary unavailability.</Text></View>
        ) : null}

        <View style={styles.actions}>
          <Button title={saving ? "Saving..." : "Save Lifecycle Event"} icon="save-outline" onPress={() => void save()} loading={saving} disabled={saving} variant={eventType === "RETIREMENT" ? "danger" : "primary"} />
          <Button title="Cancel" variant="outline" onPress={() => router.back()} disabled={saving} />
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl + 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  deviceCard: { backgroundColor: colors.surface, marginBottom: spacing.md },
  eyebrow: { color: colors.teal800, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, letterSpacing: 1 },
  deviceTitle: { color: colors.textPrimary, fontSize: typography.sizes.h2, fontWeight: typography.weights.bold, marginTop: 3 },
  secondary: { color: colors.textSecondary, fontSize: typography.sizes.small, marginTop: 3 },
  formCard: { backgroundColor: colors.surface },
  sectionTitle: { color: colors.textPrimary, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold },
  helper: { color: colors.textSecondary, fontSize: typography.sizes.small, lineHeight: 18, marginTop: 4, marginBottom: spacing.md },
  eventChoices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.md },
  statusChoices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.md },
  choice: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 8 },
  choiceActive: { borderColor: colors.teal600, backgroundColor: colors.teal100 },
  disabledChoice: { opacity: 0.4 },
  choiceText: { color: colors.textSecondary, fontSize: typography.sizes.xs, fontWeight: typography.weights.medium },
  choiceTextActive: { color: colors.teal900, fontWeight: typography.weights.bold },
  label: { color: colors.textSecondary, fontSize: typography.sizes.xs, fontWeight: typography.weights.bold, marginTop: spacing.md, marginBottom: 6 },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, color: colors.textPrimary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: typography.sizes.body },
  textArea: { minHeight: 110, textAlignVertical: "top" },
  fieldHint: { color: colors.textMuted, fontSize: typography.sizes.tiny, marginTop: 4 },
  dangerNotice: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.errorBorder, backgroundColor: colors.errorBg, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  dangerText: { flex: 1, color: colors.error, fontSize: typography.sizes.small, fontWeight: typography.weights.medium },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg },
  errorCard: { backgroundColor: colors.errorBg, borderColor: colors.errorBorder },
  errorText: { color: colors.error, fontSize: typography.sizes.small },
});
