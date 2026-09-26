import { Alert } from "../../services/alert";
import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { DocumentPickerAsset } from "expo-document-picker";

import AppShell from "../../design/components/AppShell";
import Card from "../../design/components/card";
import Button from "../../design/components/Button";
import IconContainer from "../../design/components/IconContainer";
import colors from "../../design/tokens/colors";
import spacing from "../../design/tokens/spacing";
import typography from "../../design/tokens/typography";
import radius from "../../design/tokens/radius";
import { useThemeRefresh } from "../../providers/AppThemeProvider";
import {
  createVisionPrescription,
  pickVisionPrescriptionAttachment,
  uploadVisionPrescriptionAttachment,
  type VisionPrescriptionCreateInput,
  type VisionPrescriptionType,
} from "../../services/visionPrescriptions";

const todayIso = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const optionalNumber = (value: string) => {
  const raw = value.trim();
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const isIsoDate = (value: string) => {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
  const parsed = new Date(value + "T12:00:00Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

function Field({ label, value, onChangeText, placeholder, keyboardType = "default", multiline = false, hint }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "decimal-pad" | "numeric";
  multiline?: boolean;
  hint?: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        textAlignVertical={multiline ? "top" : "center"}
        style={[styles.input, multiline && styles.multiline]}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export default function AddVisionPrescriptionScreen() {
  useThemeRefresh();
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const initialType: VisionPrescriptionType = params.type === "contact_lens" ? "contact_lens" : "glasses";

  const [type, setType] = useState<VisionPrescriptionType>(initialType);
  const [issuedDate, setIssuedDate] = useState(todayIso());
  const [expiryDate, setExpiryDate] = useState("");
  const [doctorOptometrist, setDoctorOptometrist] = useState("");
  const [clinic, setClinic] = useState("");
  const [notes, setNotes] = useState("");
  const [attachment, setAttachment] = useState<DocumentPickerAsset | null>(null);

  const [rightSph, setRightSph] = useState("");
  const [rightCyl, setRightCyl] = useState("");
  const [rightAxis, setRightAxis] = useState("");
  const [leftSph, setLeftSph] = useState("");
  const [leftCyl, setLeftCyl] = useState("");
  const [leftAxis, setLeftAxis] = useState("");
  const [add, setAdd] = useState("");
  const [pd, setPd] = useState("");

  const [rightPower, setRightPower] = useState("");
  const [leftPower, setLeftPower] = useState("");
  const [baseCurve, setBaseCurve] = useState("");
  const [diameter, setDiameter] = useState("");
  const [brand, setBrand] = useState("");
  const [lensType, setLensType] = useState("");
  const [replacementSchedule, setReplacementSchedule] = useState("");

  const [saving, setSaving] = useState(false);

  const title = type === "glasses" ? "Add Glasses Prescription" : "Add Contact Lens Prescription";
  const subtitle = useMemo(() => type === "glasses"
    ? "Store sphere, cylinder, axis, ADD and PD. Leave fields blank when they are not part of your prescription."
    : "Store lens power, base curve, diameter, brand and replacement schedule.", [type]);

  const pickFile = async () => {
    try {
      const asset = await pickVisionPrescriptionAttachment();
      if (asset) setAttachment(asset);
    } catch (error: any) {
      Alert.alert("Attachment unavailable", error?.message || "Unable to select this file.");
    }
  };

  const validateNumeric = (label: string, value: string) => {
    if (!value.trim()) return true;
    if (Number.isFinite(Number(value))) return true;
    Alert.alert("Check Prescription", `${label} must be a number or left blank.`);
    return false;
  };

  const save = async () => {
    if (!isIsoDate(issuedDate)) {
      Alert.alert("Check Issued Date", "Issued Date must use YYYY-MM-DD format.");
      return;
    }
    if (expiryDate.trim() && !isIsoDate(expiryDate)) {
      Alert.alert("Check Expiry Date", "Expiry Date must use YYYY-MM-DD format or be left blank.");
      return;
    }
    if (expiryDate.trim() && new Date(`${expiryDate}T00:00:00`) < new Date(`${issuedDate}T00:00:00`)) {
      Alert.alert("Check Dates", "Expiry Date cannot be earlier than Issued Date.");
      return;
    }

    const numericFields: [string, string][] = type === "glasses"
      ? [["Right SPH", rightSph], ["Right CYL", rightCyl], ["Right Axis", rightAxis], ["Left SPH", leftSph], ["Left CYL", leftCyl], ["Left Axis", leftAxis], ["ADD", add], ["PD", pd]]
      : [["Right Power", rightPower], ["Left Power", leftPower], ["Base Curve", baseCurve], ["Diameter", diameter]];
    for (const [label, value] of numericFields) if (!validateNumeric(label, value)) return;

    const payload: VisionPrescriptionCreateInput = {
      type,
      issuedDate,
      expiryDate: expiryDate.trim() || undefined,
      doctorOptometrist: doctorOptometrist.trim() || undefined,
      clinic: clinic.trim() || undefined,
      notes: notes.trim() || undefined,
      ...(type === "glasses" ? {
        rightSph: optionalNumber(rightSph),
        rightCyl: optionalNumber(rightCyl),
        rightAxis: optionalNumber(rightAxis),
        leftSph: optionalNumber(leftSph),
        leftCyl: optionalNumber(leftCyl),
        leftAxis: optionalNumber(leftAxis),
        add: optionalNumber(add),
        pd: optionalNumber(pd),
      } : {
        rightPower: optionalNumber(rightPower),
        leftPower: optionalNumber(leftPower),
        baseCurve: optionalNumber(baseCurve),
        diameter: optionalNumber(diameter),
        brand: brand.trim() || undefined,
        lensType: lensType.trim() || undefined,
        replacementSchedule: replacementSchedule.trim() || undefined,
      }),
    };

    try {
      setSaving(true);
      const created = await createVisionPrescription(payload);
      if (attachment) {
        try {
          await uploadVisionPrescriptionAttachment(created.id, attachment);
        } catch (uploadError: any) {
          Alert.alert(
            "Prescription Saved",
            `The prescription was saved, but the attachment could not be uploaded. You can add it from the prescription details.\n\n${uploadError?.message || ""}`.trim()
          );
          router.replace(`/vision-vault/${created.id}` as any);
          return;
        }
      }
      Alert.alert("Saved", "Your vision prescription has been added to the vault.");
      router.replace(`/vision-vault/${created.id}` as any);
    } catch (error: any) {
      Alert.alert("Unable to Save", error?.message || "Could not save the vision prescription.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell role="Patient" title={title} showBack onBackPress={() => router.back()}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.eyebrow}>VISION & LENS VAULT</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        <View style={styles.segmented}>
          <TouchableOpacity onPress={() => setType("glasses")} style={[styles.segment, type === "glasses" && styles.segmentActive]} accessibilityState={{ selected: type === "glasses" }}>
            <Ionicons name="glasses-outline" size={18} color={type === "glasses" ? colors.white : colors.teal800} />
            <Text style={[styles.segmentText, type === "glasses" && styles.segmentTextActive]}>Glasses</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setType("contact_lens")} style={[styles.segment, type === "contact_lens" && styles.segmentActive]} accessibilityState={{ selected: type === "contact_lens" }}>
            <Ionicons name="eye-outline" size={18} color={type === "contact_lens" ? colors.white : colors.teal800} />
            <Text style={[styles.segmentText, type === "contact_lens" && styles.segmentTextActive]}>Contact Lenses</Text>
          </TouchableOpacity>
        </View>

        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>Prescription Dates</Text>
          <View style={styles.twoCol}>
            <View style={styles.flex}><Field label="Issued Date" value={issuedDate} onChangeText={setIssuedDate} placeholder="YYYY-MM-DD" hint="Required" /></View>
            <View style={styles.flex}><Field label="Expiry Date" value={expiryDate} onChangeText={setExpiryDate} placeholder="YYYY-MM-DD" hint="Optional" /></View>
          </View>
        </Card>

        {type === "glasses" ? (
          <Card style={styles.formCard}>
            <Text style={styles.sectionTitle}>Glasses Prescription</Text>
            <Text style={styles.sectionSub}>Enter only the values present on your prescription.</Text>
            <Text style={styles.eyeHeading}>Right Eye</Text>
            <View style={styles.threeCol}>
              <View style={styles.flex}><Field label="SPH" value={rightSph} onChangeText={setRightSph} placeholder="-1.50" keyboardType="decimal-pad" /></View>
              <View style={styles.flex}><Field label="CYL" value={rightCyl} onChangeText={setRightCyl} placeholder="-0.50" keyboardType="decimal-pad" /></View>
              <View style={styles.flex}><Field label="Axis" value={rightAxis} onChangeText={setRightAxis} placeholder="90" keyboardType="numeric" /></View>
            </View>
            <Text style={styles.eyeHeading}>Left Eye</Text>
            <View style={styles.threeCol}>
              <View style={styles.flex}><Field label="SPH" value={leftSph} onChangeText={setLeftSph} placeholder="-1.25" keyboardType="decimal-pad" /></View>
              <View style={styles.flex}><Field label="CYL" value={leftCyl} onChangeText={setLeftCyl} placeholder="-0.25" keyboardType="decimal-pad" /></View>
              <View style={styles.flex}><Field label="Axis" value={leftAxis} onChangeText={setLeftAxis} placeholder="85" keyboardType="numeric" /></View>
            </View>
            <View style={styles.twoCol}>
              <View style={styles.flex}><Field label="ADD" value={add} onChangeText={setAdd} placeholder="+1.50" keyboardType="decimal-pad" /></View>
              <View style={styles.flex}><Field label="PD (mm)" value={pd} onChangeText={setPd} placeholder="63" keyboardType="decimal-pad" /></View>
            </View>
          </Card>
        ) : (
          <Card style={styles.formCard}>
            <Text style={styles.sectionTitle}>Contact Lens Prescription</Text>
            <View style={styles.twoCol}>
              <View style={styles.flex}><Field label="Right Power" value={rightPower} onChangeText={setRightPower} placeholder="-1.50" keyboardType="decimal-pad" /></View>
              <View style={styles.flex}><Field label="Left Power" value={leftPower} onChangeText={setLeftPower} placeholder="-1.25" keyboardType="decimal-pad" /></View>
            </View>
            <View style={styles.twoCol}>
              <View style={styles.flex}><Field label="Base Curve" value={baseCurve} onChangeText={setBaseCurve} placeholder="8.6" keyboardType="decimal-pad" /></View>
              <View style={styles.flex}><Field label="Diameter (mm)" value={diameter} onChangeText={setDiameter} placeholder="14.2" keyboardType="decimal-pad" /></View>
            </View>
            <Field label="Brand" value={brand} onChangeText={setBrand} placeholder="e.g. Acuvue" />
            <Field label="Lens Type" value={lensType} onChangeText={setLensType} placeholder="e.g. Soft toric / daily disposable" />
            <Field label="Replacement Schedule" value={replacementSchedule} onChangeText={setReplacementSchedule} placeholder="e.g. Daily / 2 weeks / Monthly" />
          </Card>
        )}

        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>Provider & Notes</Text>
          <Field label="Doctor / Optometrist" value={doctorOptometrist} onChangeText={setDoctorOptometrist} placeholder="Name of prescribing professional" />
          <Field label="Clinic" value={clinic} onChangeText={setClinic} placeholder="Clinic / hospital / optical center" />
          <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional notes about this prescription" multiline />
        </Card>

        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>Original Prescription Attachment</Text>
          <Text style={styles.sectionSub}>Optional PDF, JPEG or PNG. The file stays attached to this historical record in GridFS.</Text>
          <TouchableOpacity style={styles.attachmentButton} onPress={pickFile} activeOpacity={0.8}>
            <IconContainer name="document-attach-outline" size={22} color={colors.teal800} backgroundColor={colors.teal100} />
            <View style={styles.attachmentMain}>
              <Text style={styles.attachmentTitle}>{attachment ? attachment.name : "Choose Attachment"}</Text>
              <Text style={styles.attachmentSub}>{attachment ? "Tap to choose a different file before saving" : "PDF, JPEG or PNG · up to the configured upload limit"}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </Card>

        <Card style={styles.historyNotice}>
          <View style={styles.noticeRow}>
            <Ionicons name="time-outline" size={22} color={colors.teal800} />
            <View style={styles.noticeMain}>
              <Text style={styles.noticeTitle}>Older prescriptions are never deleted</Text>
              <Text style={styles.noticeText}>Saving this as the latest {type === "glasses" ? "glasses" : "contact lens"} prescription automatically moves the previous current record into History.</Text>
            </View>
          </View>
        </Card>

        <Button title={saving ? "Saving Prescription..." : "Save to Vision Vault"} icon="save-outline" size="lg" onPress={save} loading={saving} disabled={saving} style={styles.saveButton} />
        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl + 24 },
  header: { marginBottom: spacing.lg },
  eyebrow: { color: colors.teal800, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, letterSpacing: 1.2 },
  title: { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.bold, marginTop: 4 },
  subtitle: { color: colors.textSecondary, fontSize: typography.sizes.body, lineHeight: 22, marginTop: 6 },
  segmented: { flexDirection: "row", gap: spacing.xs, backgroundColor: colors.surfaceSecondary, padding: 4, borderRadius: radius.lg, marginBottom: spacing.md },
  segment: { flex: 1, minHeight: 46, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center", borderRadius: radius.md },
  segmentActive: { backgroundColor: colors.teal800 },
  segmentText: { color: colors.textSecondary, fontSize: typography.sizes.small, fontWeight: typography.weights.bold },
  segmentTextActive: { color: colors.white },
  formCard: { marginBottom: spacing.md },
  sectionTitle: { color: colors.textPrimary, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold, marginBottom: spacing.xs },
  sectionSub: { color: colors.textSecondary, fontSize: typography.sizes.xs, lineHeight: 18, marginBottom: spacing.md },
  fieldGroup: { marginTop: spacing.sm },
  label: { color: colors.teal800, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.pageBackground, color: colors.textPrimary, paddingHorizontal: spacing.md, fontSize: typography.sizes.small },
  multiline: { minHeight: 112, paddingTop: spacing.md },
  hint: { color: colors.textMuted, fontSize: typography.sizes.tiny, marginTop: 4 },
  twoCol: { flexDirection: "row", gap: spacing.sm },
  threeCol: { flexDirection: "row", gap: spacing.xs },
  flex: { flex: 1, minWidth: 0 },
  eyeHeading: { color: colors.textPrimary, fontSize: typography.sizes.small, fontWeight: typography.weights.bold, marginTop: spacing.md },
  attachmentButton: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 64, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.pageBackground, marginTop: spacing.sm },
  attachmentMain: { flex: 1, minWidth: 0 },
  attachmentTitle: { color: colors.textPrimary, fontSize: typography.sizes.small, fontWeight: typography.weights.bold },
  attachmentSub: { color: colors.textSecondary, fontSize: typography.sizes.tiny, marginTop: 3 },
  historyNotice: { backgroundColor: colors.teal50, marginBottom: spacing.md },
  noticeRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  noticeMain: { flex: 1 },
  noticeTitle: { color: colors.textPrimary, fontSize: typography.sizes.small, fontWeight: typography.weights.bold },
  noticeText: { color: colors.textSecondary, fontSize: typography.sizes.xs, lineHeight: 18, marginTop: 3 },
  saveButton: { alignSelf: "stretch" },
});
