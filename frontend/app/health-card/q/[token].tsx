import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";

import Card from "../../../design/components/card";
import IconContainer from "../../../design/components/IconContainer";
import colors from "../../../design/tokens/colors";
import spacing from "../../../design/tokens/spacing";
import typography from "../../../design/tokens/typography";
import radius from "../../../design/tokens/radius";
import { useThemeRefresh } from "../../../providers/AppThemeProvider";
import { getPublicHealthCard, publicReportDownloadUrl } from "../../../services/privacy";

type PublicPayload = {
  share: { id: string; type: string; expiresAt?: string; scopes?: string[] };
  data: {
    profile?: { name?: string; eyeCareId?: string; avatarInitial?: string };
    emergencyContact?: string;
    bloodGroup?: string;
    allergies?: string | string[];
    activeMedications?: any[];
    latestScreening?: any;
    latestHbA1c?: any;
    recentReports?: any[];
  };
};

export default function PublicHealthCardPage() {
  useThemeRefresh();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token || "";
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<PublicPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    if (!token) {
      setError("This Health Card link is invalid.");
      setLoading(false);
      return () => { mounted = false; };
    }
    getPublicHealthCard(token)
      .then((result) => { if (mounted) setPayload(result as PublicPayload); })
      .catch((err: any) => { if (mounted) setError(err?.message || "This Health Card share is unavailable."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [token]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.teal800} />
        <Text style={styles.loadingText}>Verifying secure Health Card...</Text>
      </View>
    );
  }

  if (!payload || error) {
    return (
      <View style={styles.center}>
        <View style={styles.errorIcon}><Ionicons name="lock-closed-outline" size={30} color={colors.error} /></View>
        <Text style={styles.errorTitle}>Health Card unavailable</Text>
        <Text style={styles.errorText}>{error || "This Health Card share is no longer available."}</Text>
      </View>
    );
  }

  const data = payload.data || {};
  const profile = data.profile || {};

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.brandRow}>
        <View style={styles.logo}><Ionicons name="eye-outline" size={24} color={colors.white} /></View>
        <View style={styles.brandMain}>
          <Text style={styles.brand}>EyeCare AI</Text>
          <Text style={styles.brandSub}>Secure Digital Health Card</Text>
        </View>
        <View style={styles.verifiedPill}><Ionicons name="shield-checkmark" size={14} color={colors.teal800} /><Text style={styles.verifiedText}>Secure link</Text></View>
      </View>

      <Card variant="elevated" style={styles.identityCard}>
        <View style={styles.identityRow}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{profile.avatarInitial || "P"}</Text></View>
          <View style={styles.identityMain}>
            <Text style={styles.patientName}>{profile.name || "EyeCare AI Patient"}</Text>
            {profile.eyeCareId ? <Text style={styles.eyeCareId}>EyeCare ID: {profile.eyeCareId}</Text> : null}
            <Text style={styles.shareMeta}>{payload.share.type === "emergency" ? "Emergency Health Card" : "Temporary Medical Share"} • Expires {formatDateTime(payload.share.expiresAt)}</Text>
          </View>
        </View>
      </Card>

      <Card style={styles.noticeCard}>
        <Ionicons name="information-circle-outline" size={22} color={colors.info} />
        <Text style={styles.noticeText}>This is a patient-controlled limited share. It is not a complete medical record and should not replace professional clinical assessment.</Text>
      </Card>

      {(data.emergencyContact || data.bloodGroup || data.allergies) ? (
        <Section title="Emergency Information" icon="medical-outline">
          {data.emergencyContact ? <InfoRow label="Emergency Contact" value={data.emergencyContact} /> : null}
          {data.bloodGroup ? <InfoRow label="Blood Group" value={data.bloodGroup} /> : null}
          {data.allergies ? <InfoRow label="Allergies" value={Array.isArray(data.allergies) ? data.allergies.join(", ") : data.allergies} /> : null}
        </Section>
      ) : null}

      {data.latestScreening ? (
        <Section title="Latest Retinal Screening" icon="eye-outline">
          <InfoRow label="DR Stage" value={data.latestScreening.stage || "Not available"} />
          {data.latestScreening.confidence !== null && data.latestScreening.confidence !== undefined ? <InfoRow label="Confidence" value={formatConfidence(data.latestScreening.confidence)} /> : null}
          <InfoRow label="Screening Date" value={formatDate(data.latestScreening.date)} />
          {data.latestScreening.status ? <InfoRow label="Status" value={data.latestScreening.status} /> : null}
        </Section>
      ) : null}

      {data.latestHbA1c ? (
        <Section title="Latest HbA1c" icon="pulse-outline">
          <InfoRow label="HbA1c" value={`${data.latestHbA1c.value ?? "—"}%`} />
          <InfoRow label="Recorded" value={formatDate(data.latestHbA1c.recordedAt)} />
        </Section>
      ) : null}

      {Array.isArray(data.activeMedications) ? (
        <Section title="Current Medication" icon="medkit-outline">
          {data.activeMedications.length ? data.activeMedications.map((med: any) => (
            <View key={med.id || `${med.name}-${med.dosage}`} style={styles.medicationItem}>
              <Text style={styles.medName}>{med.name}</Text>
              <Text style={styles.medMeta}>{[med.dosage, (med.times || []).join(" • "), med.intakeInstruction].filter(Boolean).join(" • ")}</Text>
              <Text style={styles.medSource}>{med.source === "Doctor" ? "Doctor prescription" : "Patient-added"}</Text>
            </View>
          )) : <Text style={styles.emptyText}>No active medication shared.</Text>}
        </Section>
      ) : null}

      {Array.isArray(data.recentReports) ? (
        <Section title="Recent Reports" icon="document-text-outline">
          {data.recentReports.length ? data.recentReports.map((report: any) => (
            <TouchableOpacity key={report.id} style={styles.reportRow} activeOpacity={0.8} onPress={() => Linking.openURL(publicReportDownloadUrl(token, report.id))}>
              <View style={styles.reportIcon}><Ionicons name="document-text-outline" size={19} color={colors.teal800} /></View>
              <View style={styles.reportMain}>
                <Text style={styles.reportTitle}>{report.title || report.reportType || "Medical Report"}</Text>
                <Text style={styles.reportMeta}>{[report.reportNumber, report.classification, formatDate(report.createdAt)].filter(Boolean).join(" • ")}</Text>
              </View>
              <Ionicons name="download-outline" size={20} color={colors.teal800} />
            </TouchableOpacity>
          )) : <Text style={styles.emptyText}>No recent reports shared.</Text>}
        </Section>
      ) : null}

      <View style={styles.footer}>
        <Ionicons name="lock-closed-outline" size={15} color={colors.textMuted} />
        <Text style={styles.footerText}>Access to this page is logged in the patient's EyeCare AI Privacy Center.</Text>
      </View>
    </ScrollView>
  );
}

function Section({ title, icon, children }: { title: string; icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  return (
    <Card style={styles.sectionCard}>
      <View style={styles.sectionHeading}><IconContainer name={icon} size={20} color={colors.teal800} backgroundColor={colors.teal100} /><Text style={styles.sectionTitle}>{title}</Text></View>
      <View style={styles.sectionBody}>{children}</View>
    </Card>
  );
}
function InfoRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value || "Not provided"}</Text></View>;
}
function formatDateTime(value?: string) {
  if (!value) return "Not specified";
  const d = new Date(value); if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
function formatDate(value?: string) {
  if (!value) return "Not available";
  const d = new Date(value); if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function formatConfidence(value: any) {
  const n = Number(value); if (!Number.isFinite(n)) return String(value);
  return `${n <= 1 ? Math.round(n * 100) : Math.round(n)}%`;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.pageBackground },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", padding: spacing.lg, paddingBottom: spacing.xxxl },
  center: { flex: 1, backgroundColor: colors.pageBackground, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  loadingText: { color: colors.textSecondary, fontSize: typography.sizes.body, marginTop: spacing.md },
  errorIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: colors.errorBg, alignItems: "center", justifyContent: "center" },
  errorTitle: { color: colors.textPrimary, fontSize: typography.sizes.h2, fontWeight: typography.weights.extraBold, marginTop: spacing.lg },
  errorText: { color: colors.textSecondary, fontSize: typography.sizes.body, textAlign: "center", maxWidth: 500, marginTop: spacing.sm, lineHeight: 22 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.lg },
  logo: { width: 46, height: 46, borderRadius: 16, backgroundColor: colors.teal800, alignItems: "center", justifyContent: "center" },
  brandMain: { flex: 1 },
  brand: { color: colors.textPrimary, fontSize: typography.sizes.h2, fontWeight: typography.weights.extraBold },
  brandSub: { color: colors.textSecondary, fontSize: typography.sizes.xs, marginTop: 1 },
  verifiedPill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.teal100, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  verifiedText: { color: colors.teal900, fontSize: 10, fontWeight: typography.weights.bold },
  identityCard: { marginBottom: spacing.md },
  identityRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 58, height: 58, borderRadius: 20, backgroundColor: colors.teal800, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.white, fontSize: 24, fontWeight: typography.weights.extraBold },
  identityMain: { flex: 1 },
  patientName: { color: colors.textPrimary, fontSize: typography.sizes.h2, fontWeight: typography.weights.extraBold },
  eyeCareId: { color: colors.teal800, fontSize: typography.sizes.small, fontWeight: typography.weights.bold, marginTop: 2 },
  shareMeta: { color: colors.textMuted, fontSize: typography.sizes.xs, marginTop: 4 },
  noticeCard: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, marginBottom: spacing.md, backgroundColor: colors.infoBg },
  noticeText: { flex: 1, color: colors.textSecondary, fontSize: typography.sizes.small, lineHeight: 19 },
  sectionCard: { marginBottom: spacing.md },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  sectionTitle: { color: colors.textPrimary, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.extraBold },
  sectionBody: { gap: spacing.sm },
  infoRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.lg, paddingVertical: 6 },
  infoLabel: { color: colors.textSecondary, fontSize: typography.sizes.small, flex: 1 },
  infoValue: { color: colors.textPrimary, fontSize: typography.sizes.small, fontWeight: typography.weights.bold, flex: 1, textAlign: "right" },
  medicationItem: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  medName: { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.bold },
  medMeta: { color: colors.textSecondary, fontSize: typography.sizes.xs, marginTop: 3 },
  medSource: { color: colors.teal800, fontSize: 10, fontWeight: typography.weights.bold, marginTop: 4 },
  reportRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  reportIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.teal100, alignItems: "center", justifyContent: "center" },
  reportMain: { flex: 1 },
  reportTitle: { color: colors.textPrimary, fontSize: typography.sizes.small, fontWeight: typography.weights.bold },
  reportMeta: { color: colors.textMuted, fontSize: 10, marginTop: 3 },
  emptyText: { color: colors.textSecondary, fontSize: typography.sizes.small },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: spacing.lg },
  footerText: { color: colors.textMuted, fontSize: typography.sizes.xs, textAlign: "center" },
});
