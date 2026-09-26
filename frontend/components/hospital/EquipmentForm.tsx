import { Alert } from "../../services/alert";
import React, { useEffect, useState } from "react";
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
import { useRouter } from "expo-router";

import AppShell from "../../design/components/AppShell";
import Card from "../../design/components/card";
import Button from "../../design/components/Button";
import colors from "../../design/tokens/colors";
import spacing from "../../design/tokens/spacing";
import typography from "../../design/tokens/typography";
import radius from "../../design/tokens/radius";
import { useThemeRefresh } from "../../providers/AppThemeProvider";
import {
  EQUIPMENT_TYPES,
  createEquipment,
  getEquipment,
  updateEquipment,
  type EquipmentPayload,
  type EquipmentType,
  type StoredEquipmentStatus,
} from "../../services/equipment";

const STATUS_OPTIONS: StoredEquipmentStatus[] = ["Operational", "Under Maintenance", "Out of Service"];

const isISODate = (value: string) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value);

const initialForm: EquipmentPayload = {
  assetId: "",
  deviceName: "",
  type: "Fundus Camera",
  manufacturer: "",
  model: "",
  serialNumber: "",
  department: "",
  location: "",
  purchaseDate: "",
  status: "Operational",
  lastService: "",
  nextService: "",
  lastCalibration: "",
  nextCalibration: "",
  notes: "",
};

function Field({ label, value, onChangeText, placeholder, multiline = false, helper }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; multiline?: boolean; helper?: string }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        style={[styles.input, multiline && styles.textArea]}
      />
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

export default function EquipmentForm({ equipmentId }: { equipmentId?: string }) {
  useThemeRefresh();
  const router = useRouter();
  const editing = Boolean(equipmentId);
  const [form, setForm] = useState<EquipmentPayload>(initialForm);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [retired, setRetired] = useState(false);

  useEffect(() => {
    if (!equipmentId) return;
    getEquipment(equipmentId)
      .then((item) => {
        setRetired(item.status === "Retired");
        setForm({
          assetId: item.assetId,
          deviceName: item.deviceName,
          type: item.type,
          manufacturer: item.manufacturer,
          model: item.model,
          serialNumber: item.serialNumber,
          department: item.department,
          location: item.location,
          purchaseDate: item.purchaseDate,
          status: item.storedStatus,
          lastService: item.lastService,
          nextService: item.nextService,
          lastCalibration: item.lastCalibration,
          nextCalibration: item.nextCalibration,
          notes: item.notes,
        });
      })
      .catch((err: any) => setLoadError(err?.message || "Unable to load equipment."))
      .finally(() => setLoading(false));
  }, [equipmentId]);

  const set = <K extends keyof EquipmentPayload>(key: K, value: EquipmentPayload[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    if (saving || retired) return;
    const assetId = form.assetId.trim();
    const deviceName = form.deviceName.trim();
    if (!assetId || !deviceName) {
      Alert.alert("Required Information", "Asset ID and Device Name are required.");
      return;
    }
    for (const [label, value] of [
      ["Purchase Date", form.purchaseDate || ""],
      ["Last Service", form.lastService || ""],
      ["Next Service", form.nextService || ""],
      ["Last Calibration", form.lastCalibration || ""],
      ["Next Calibration", form.nextCalibration || ""],
    ]) {
      if (!isISODate(value)) {
        Alert.alert("Invalid Date", `${label} must use YYYY-MM-DD format.`);
        return;
      }
    }

    try {
      setSaving(true);
      const payload: EquipmentPayload = { ...form, assetId, deviceName };
      const saved = equipmentId
        ? await updateEquipment(equipmentId, payload)
        : await createEquipment(payload);
      Alert.alert(editing ? "Equipment Updated" : "Equipment Added", `${saved.deviceName} (${saved.assetId}) is saved.`, [
        { text: "Open Device", onPress: () => router.replace(`/hospital/equipment/${saved.id}` as any) },
      ]);
    } catch (err: any) {
      Alert.alert("Unable to Save", err?.message || "The equipment record could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <AppShell role="Hospital" title={editing ? "Edit Equipment" : "Add Equipment"} showBack onBackPress={() => router.back()} showAssistant={false}><View style={styles.center}><ActivityIndicator size="large" color={colors.teal800} /></View></AppShell>;
  }

  if (loadError) {
    return <AppShell role="Hospital" title="Equipment" showBack onBackPress={() => router.back()} showAssistant={false}><Card style={styles.errorCard}><Text style={styles.errorTitle}>Equipment unavailable</Text><Text style={styles.helper}>{loadError}</Text></Card></AppShell>;
  }

  return (
    <AppShell role="Hospital" title={editing ? "Edit Equipment" : "Add Equipment"} showBack onBackPress={() => router.back()} showAssistant={false}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>EQUIPMENT MASTER RECORD</Text>
          <Text style={styles.title}>{editing ? "Update device details" : "Register ophthalmic equipment"}</Text>
          <Text style={styles.subtitle}>Service and calibration history is stored separately as lifecycle events. Editing this page does not erase event history.</Text>
        </View>

        {retired ? (
          <View style={styles.retiredBanner}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.error} />
            <Text style={styles.retiredText}>This device is retired. Its lifecycle record is preserved read-only.</Text>
          </View>
        ) : null}

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Identification</Text>
          <View style={styles.twoCol}>
            <View style={styles.col}><Field label="Asset ID *" value={form.assetId} onChangeText={(v) => set("assetId", v)} placeholder="FC-002" /></View>
            <View style={styles.col}><Field label="Device Name *" value={form.deviceName} onChangeText={(v) => set("deviceName", v)} placeholder="Fundus Camera Room 2" /></View>
          </View>
          <Text style={styles.label}>Equipment Type</Text>
          <View style={styles.choiceWrap}>
            {EQUIPMENT_TYPES.map((item) => {
              const selected = form.type === item;
              return <TouchableOpacity key={item} onPress={() => set("type", item)} style={[styles.choice, selected && styles.choiceActive]} disabled={retired}><Text style={[styles.choiceText, selected && styles.choiceTextActive]}>{item}</Text></TouchableOpacity>;
            })}
          </View>
          <View style={styles.twoCol}>
            <View style={styles.col}><Field label="Manufacturer" value={form.manufacturer || ""} onChangeText={(v) => set("manufacturer", v)} placeholder="Canon" /></View>
            <View style={styles.col}><Field label="Model" value={form.model || ""} onChangeText={(v) => set("model", v)} placeholder="XYZ" /></View>
          </View>
          <Field label="Serial Number" value={form.serialNumber || ""} onChangeText={(v) => set("serialNumber", v)} placeholder="SN-123456" />
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Facility Location</Text>
          <View style={styles.twoCol}>
            <View style={styles.col}><Field label="Department" value={form.department || ""} onChangeText={(v) => set("department", v)} placeholder="Retina Department" /></View>
            <View style={styles.col}><Field label="Location" value={form.location || ""} onChangeText={(v) => set("location", v)} placeholder="Room 204" /></View>
          </View>
          <Field label="Purchase Date" value={form.purchaseDate || ""} onChangeText={(v) => set("purchaseDate", v)} placeholder="2026-08-12" helper="YYYY-MM-DD" />
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Operational State</Text>
          <Text style={styles.label}>Base Status</Text>
          <View style={styles.choiceWrap}>
            {STATUS_OPTIONS.map((item) => {
              const selected = form.status === item;
              return <TouchableOpacity key={item} onPress={() => set("status", item)} style={[styles.choice, selected && styles.choiceActive]} disabled={retired}><Text style={[styles.choiceText, selected && styles.choiceTextActive]}>{item}</Text></TouchableOpacity>;
            })}
          </View>
          <Text style={styles.helper}>Service Due and Calibration Due are calculated automatically from the next due dates. Retire a device from its lifecycle page so a retirement event is preserved.</Text>
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Service & Calibration Schedule</Text>
          <View style={styles.twoCol}>
            <View style={styles.col}><Field label="Last Service" value={form.lastService || ""} onChangeText={(v) => set("lastService", v)} placeholder="2026-06-12" helper="YYYY-MM-DD" /></View>
            <View style={styles.col}><Field label="Next Service" value={form.nextService || ""} onChangeText={(v) => set("nextService", v)} placeholder="2026-12-12" helper="YYYY-MM-DD" /></View>
          </View>
          <View style={styles.twoCol}>
            <View style={styles.col}><Field label="Last Calibration" value={form.lastCalibration || ""} onChangeText={(v) => set("lastCalibration", v)} placeholder="2026-08-20" helper="YYYY-MM-DD" /></View>
            <View style={styles.col}><Field label="Next Calibration" value={form.nextCalibration || ""} onChangeText={(v) => set("nextCalibration", v)} placeholder="2026-11-20" helper="YYYY-MM-DD" /></View>
          </View>
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Field label="Operational Notes" value={form.notes || ""} onChangeText={(v) => set("notes", v)} placeholder="Accessories, maintenance contract, room requirements..." multiline />
        </Card>

        <View style={styles.actions}>
          <Button title={editing ? "Save Changes" : "Add Equipment"} icon="save-outline" onPress={() => void save()} loading={saving} disabled={saving || retired} />
          <Button title="Cancel" variant="outline" onPress={() => router.back()} disabled={saving} />
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl + 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { marginBottom: spacing.lg },
  eyebrow: { color: colors.teal800, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, letterSpacing: 1.2 },
  title: { color: colors.textPrimary, fontSize: typography.sizes.h2, fontWeight: typography.weights.bold, marginTop: 3 },
  subtitle: { color: colors.textSecondary, fontSize: typography.sizes.small, lineHeight: 19, marginTop: 5 },
  sectionCard: { backgroundColor: colors.surface, marginBottom: spacing.md },
  sectionTitle: { color: colors.textPrimary, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold, marginBottom: spacing.md },
  fieldGroup: { marginBottom: spacing.md },
  label: { color: colors.textSecondary, fontSize: typography.sizes.xs, fontWeight: typography.weights.bold, marginBottom: 6 },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, color: colors.textPrimary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: typography.sizes.body },
  textArea: { minHeight: 110, textAlignVertical: "top" },
  helper: { color: colors.textMuted, fontSize: typography.sizes.tiny, lineHeight: 16, marginTop: 4 },
  twoCol: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  col: { flex: 1, minWidth: 220 },
  choiceWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.md },
  choice: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 9 },
  choiceActive: { borderColor: colors.teal600, backgroundColor: colors.teal100 },
  choiceText: { color: colors.textSecondary, fontSize: typography.sizes.xs, fontWeight: typography.weights.medium },
  choiceTextActive: { color: colors.teal900, fontWeight: typography.weights.bold },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  retiredBanner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.errorBorder, backgroundColor: colors.errorBg, borderRadius: radius.md, marginBottom: spacing.md },
  retiredText: { flex: 1, color: colors.error, fontSize: typography.sizes.small, fontWeight: typography.weights.medium },
  errorCard: { backgroundColor: colors.errorBg, borderColor: colors.errorBorder },
  errorTitle: { color: colors.error, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold },
});
