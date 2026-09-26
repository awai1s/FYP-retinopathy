import { Alert } from "../../services/alert";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

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
  getVisionPrescription,
  pickVisionPrescriptionAttachment,
  shareVisionPrescriptionAttachment,
  uploadVisionPrescriptionAttachment,
  type VisionPrescription,
} from "../../services/visionPrescriptions";

const fmt = (value: number | null | undefined, digits = 2) => {
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

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value || "—"}</Text></View>;
}

export default function VisionPrescriptionDetailScreen() {
  useThemeRefresh();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const prescriptionId = String(id || "");
  const [record, setRecord] = useState<VisionPrescription | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!prescriptionId) return;
    try {
      setError("");
      setRecord(await getVisionPrescription(prescriptionId));
    } catch (err: any) {
      setError(err?.message || "Unable to load this prescription.");
    } finally {
      setLoading(false);
    }
  }, [prescriptionId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const addAttachment = async () => {
    if (!record || busy) return;
    try {
      const asset = await pickVisionPrescriptionAttachment();
      if (!asset) return;
      setBusy(true);
      const updated = await uploadVisionPrescriptionAttachment(record.id, asset);
      setRecord(updated);
      Alert.alert("Attachment Saved", "The original prescription file is now stored with this record.");
    } catch (err: any) {
      Alert.alert("Unable to Upload", err?.message || "Could not upload the attachment.");
    } finally {
      setBusy(false);
    }
  };

  const openAttachment = async () => {
    if (!record?.attachment || busy) return;
    try {
      setBusy(true);
      await shareVisionPrescriptionAttachment(record);
    } catch (err: any) {
      Alert.alert("Attachment Unavailable", err?.message || "Could not open the attachment.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <AppShell role="Patient" title="Vision Prescription" showBack onBackPress={() => router.back()}><View style={styles.center}><ActivityIndicator size="large" color={colors.teal800} /><Text style={styles.secondary}>Loading prescription...</Text></View></AppShell>;
  }

  if (!record) {
    return <AppShell role="Patient" title="Vision Prescription" showBack onBackPress={() => router.back()}><Card style={styles.errorCard}><Text style={styles.errorTitle}>Prescription unavailable</Text><Text style={styles.secondary}>{error || "This record could not be found."}</Text></Card></AppShell>;
  }

  const isGlasses = record.type === "glasses";
  const g = record.glasses || {};
  const c = record.contactLens || {};
  const expired = record.expiryState === "expired";

  return (
    <AppShell role="Patient" title={isGlasses ? "Glasses Prescription" : "Contact Lens Prescription"} showBack onBackPress={() => router.back()}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Card variant="elevated" style={styles.hero}>
          <View style={styles.heroRow}>
            <IconContainer name={isGlasses ? "glasses-outline" : "eye-outline"} size={28} color={colors.teal800} backgroundColor={colors.teal100} />
            <View style={styles.heroMain}>
              <Text style={styles.eyebrow}>{record.isCurrent ? "CURRENT PRESCRIPTION" : "PRESCRIPTION HISTORY"}</Text>
              <Text style={styles.title}>{isGlasses ? "Glasses Prescription" : (c.brand || "Contact Lens Prescription")}</Text>
              <Text style={styles.secondary}>Issued {dateLabel(record.issuedDate)}</Text>
            </View>
            <StatusBadge status={record.isCurrent && !expired ? "Confirmed" : expired ? "ActionNeeded" : "Completed"} label={record.isCurrent && !expired ? "Current" : expired ? "Expired" : "History"} size="sm" />
          </View>
        </Card>

        {isGlasses ? (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Optical Values</Text>
            <View style={styles.rxTable}>
              <View style={styles.rxHeaderRow}><Text style={[styles.rxHeader, styles.eyeCol]}></Text><Text style={styles.rxHeader}>SPH</Text><Text style={styles.rxHeader}>CYL</Text><Text style={styles.rxHeader}>AXIS</Text></View>
              <View style={styles.rxRow}><Text style={[styles.rxCell, styles.eyeCol]}>Right Eye</Text><Text style={styles.rxCell}>{fmt(g.right?.sph)}</Text><Text style={styles.rxCell}>{fmt(g.right?.cyl)}</Text><Text style={styles.rxCell}>{g.right?.axis ?? "—"}</Text></View>
              <View style={styles.rxRow}><Text style={[styles.rxCell, styles.eyeCol]}>Left Eye</Text><Text style={styles.rxCell}>{fmt(g.left?.sph)}</Text><Text style={styles.rxCell}>{fmt(g.left?.cyl)}</Text><Text style={styles.rxCell}>{g.left?.axis ?? "—"}</Text></View>
            </View>
            <View style={styles.metrics}>
              <View style={styles.metric}><Text style={styles.detailLabel}>ADD</Text><Text style={styles.metricValue}>{fmt(g.add)}</Text></View>
              <View style={styles.metric}><Text style={styles.detailLabel}>PD</Text><Text style={styles.metricValue}>{g.pd != null ? `${g.pd} mm` : "—"}</Text></View>
            </View>
          </Card>
        ) : (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Contact Lens Values</Text>
            <View style={styles.metrics}>
              <View style={styles.metric}><Text style={styles.detailLabel}>RIGHT POWER</Text><Text style={styles.metricValue}>{fmt(c.rightPower)}</Text></View>
              <View style={styles.metric}><Text style={styles.detailLabel}>LEFT POWER</Text><Text style={styles.metricValue}>{fmt(c.leftPower)}</Text></View>
            </View>
            <DetailRow label="Base Curve" value={c.baseCurve != null ? String(c.baseCurve) : "—"} />
            <DetailRow label="Diameter" value={c.diameter != null ? `${c.diameter} mm` : "—"} />
            <DetailRow label="Brand" value={c.brand || "—"} />
            <DetailRow label="Lens Type" value={c.lensType || "—"} />
            <DetailRow label="Replacement Schedule" value={c.replacementSchedule || "—"} />
          </Card>
        )}

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Prescription Information</Text>
          <DetailRow label="Issued Date" value={dateLabel(record.issuedDate)} />
          <DetailRow label="Expiry Date" value={record.expiryDate ? dateLabel(record.expiryDate) : "Not set"} />
          <DetailRow label="Doctor / Optometrist" value={record.doctorOptometrist || "Not recorded"} />
          <DetailRow label="Clinic" value={record.clinic || "Not recorded"} />
          {record.notes ? <View style={styles.notesBox}><Text style={styles.detailLabel}>NOTES</Text><Text style={styles.notes}>{record.notes}</Text></View> : null}
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Original Prescription</Text>
          {record.attachment ? (
            <TouchableOpacity style={styles.attachment} onPress={openAttachment} disabled={busy} activeOpacity={0.8}>
              <IconContainer name="document-attach-outline" size={22} color={colors.teal800} backgroundColor={colors.teal100} />
              <View style={styles.attachmentMain}><Text style={styles.attachmentTitle}>{record.attachment.filename}</Text><Text style={styles.secondary}>{busy ? "Preparing file..." : "Tap to download or share"}</Text></View>
              <Ionicons name="download-outline" size={20} color={colors.teal800} />
            </TouchableOpacity>
          ) : (
            <View>
              <Text style={styles.secondary}>No source document is attached to this record.</Text>
              <Button title={busy ? "Uploading..." : "Add Attachment"} icon="document-attach-outline" size="sm" onPress={addAttachment} loading={busy} disabled={busy} style={styles.attachButton} />
            </View>
          )}
        </Card>

        <Card style={styles.historyNotice}>
          <View style={styles.noticeRow}>
            <Ionicons name="lock-closed-outline" size={22} color={colors.teal800} />
            <View style={styles.noticeMain}><Text style={styles.noticeTitle}>Historical record protection</Text><Text style={styles.noticeText}>This vault does not delete older prescriptions. To record a changed prescription, add a new {isGlasses ? "glasses" : "contact lens"} prescription; this record will remain available in History.</Text></View>
          </View>
        </Card>

        <Button title={`Add Updated ${isGlasses ? "Glasses" : "Contact Lens"} Prescription`} icon="add-outline" onPress={() => router.push(`/vision-vault/add?type=${record.type}` as any)} style={styles.updateButton} />
        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl + 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
  errorCard: { marginTop: spacing.lg },
  errorTitle: { color: colors.error, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold, marginBottom: 4 },
  secondary: { color: colors.textSecondary, fontSize: typography.sizes.xs, lineHeight: 18 },
  hero: { marginBottom: spacing.md },
  heroRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  heroMain: { flex: 1 },
  eyebrow: { color: colors.teal800, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, letterSpacing: 1 },
  title: { color: colors.textPrimary, fontSize: typography.sizes.h2, fontWeight: typography.weights.bold, marginVertical: 4 },
  sectionCard: { marginBottom: spacing.md },
  sectionTitle: { color: colors.textPrimary, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold, marginBottom: spacing.md },
  rxTable: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: "hidden" },
  rxHeaderRow: { flexDirection: "row", backgroundColor: colors.surfaceSecondary, paddingVertical: 9, paddingHorizontal: spacing.sm },
  rxRow: { flexDirection: "row", paddingVertical: 12, paddingHorizontal: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  rxHeader: { flex: 1, textAlign: "center", color: colors.textMuted, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold },
  rxCell: { flex: 1, textAlign: "center", color: colors.textPrimary, fontSize: typography.sizes.small, fontWeight: typography.weights.semibold },
  eyeCol: { textAlign: "left", fontWeight: typography.weights.bold },
  metrics: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.xs },
  metric: { flex: 1, backgroundColor: colors.teal50, padding: spacing.md, borderRadius: radius.md },
  metricValue: { color: colors.textPrimary, fontSize: typography.sizes.h2, fontWeight: typography.weights.bold, marginTop: 4 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.lg, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailLabel: { color: colors.textMuted, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, letterSpacing: 0.4, textTransform: "uppercase" },
  detailValue: { flex: 1, textAlign: "right", color: colors.textPrimary, fontSize: typography.sizes.small, fontWeight: typography.weights.semibold },
  notesBox: { marginTop: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md },
  notes: { color: colors.textPrimary, fontSize: typography.sizes.small, lineHeight: 20, marginTop: 6 },
  attachment: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.pageBackground },
  attachmentMain: { flex: 1, minWidth: 0 },
  attachmentTitle: { color: colors.textPrimary, fontSize: typography.sizes.small, fontWeight: typography.weights.bold },
  attachButton: { marginTop: spacing.md },
  historyNotice: { backgroundColor: colors.teal50, marginBottom: spacing.md },
  noticeRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  noticeMain: { flex: 1 },
  noticeTitle: { color: colors.textPrimary, fontSize: typography.sizes.small, fontWeight: typography.weights.bold },
  noticeText: { color: colors.textSecondary, fontSize: typography.sizes.xs, lineHeight: 18, marginTop: 4 },
  updateButton: { alignSelf: "stretch" },
});
