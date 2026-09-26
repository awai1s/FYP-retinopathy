import { Alert } from "../../../services/alert";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";

import AppShell from "../../../design/components/AppShell";
import Button from "../../../design/components/Button";
import { useAppTheme, useThemeRefresh } from "../../../providers/AppThemeProvider";
import {
  decideProviderVerification,
  downloadAdminVerificationDocument,
  getProviderVerificationById,
  updateSuperAdminDoctorCredential,
} from "../../../services/superadmin";
import type { ProviderVerification } from "../../../services/providerVerification";

function pretty(key: string) {
  return String(key || "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function VerificationDetailScreen() {
  useThemeRefresh();
  const { colors } = useAppTheme();
  const { id } = useLocalSearchParams();
  const verificationId = String(id || "");
  const [data, setData] = useState<ProviderVerification | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [credentialSaving, setCredentialSaving] = useState(false);
  const [credentialReason, setCredentialReason] = useState("");
  const [credentialForm, setCredentialForm] = useState({
    medicalLicenseNumber: "", licensingAuthority: "", specialization: "", qualification: "", licenseIssueDate: "", licenseExpiryDate: "",
  });

  const load = async () => {
    try {
      setError("");
      const loaded = await getProviderVerificationById(verificationId);
      setData(loaded);
      if (loaded.role === "Doctor") {
        setCredentialForm({
          medicalLicenseNumber: String(loaded.details?.medicalLicenseNumber || ""),
          licensingAuthority: String(loaded.details?.licensingAuthority || ""),
          specialization: String(loaded.details?.specialization || ""),
          qualification: String(loaded.details?.qualification || ""),
          licenseIssueDate: String(loaded.details?.licenseIssueDate || ""),
          licenseExpiryDate: String(loaded.details?.licenseExpiryDate || ""),
        });
      }
    } catch (err: any) {
      setError(err?.message || "Unable to load verification.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, [verificationId]);

  const act = async (decision: "verify" | "request_changes" | "reject" | "suspend" | "reactivate" | "disable") => {
    if (reason.trim().length < 2) {
      Alert.alert("Reason required", "Enter a short reason for every verification decision.");
      return;
    }
    setActing(decision);
    try {
      const updated = await decideProviderVerification(verificationId, decision, reason.trim());
      setData(updated);
      setReason("");
      Alert.alert("Updated", `Decision recorded: ${pretty(decision)}.`);
    } catch (err: any) {
      Alert.alert("Unable to update", err?.message || "The decision could not be saved.");
    } finally {
      setActing(null);
    }
  };

  const saveCredential = async () => {
    if (!data?.provider?.id) return;
    if (credentialReason.trim().length < 3) {
      Alert.alert("Reason required", "Enter a reason for changing the verified professional credential.");
      return;
    }
    setCredentialSaving(true);
    try {
      await updateSuperAdminDoctorCredential(data.provider.id, { ...credentialForm, reason: credentialReason.trim() });
      setCredentialReason("");
      await load();
      Alert.alert("Credential updated", "The global doctor credential was updated and written to credential audit history.");
    } catch (err: any) {
      Alert.alert("Unable to update credential", err?.message || "Please try again.");
    } finally {
      setCredentialSaving(false);
    }
  };

  if (loading) return <View style={[styles.loading, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <AppShell role="SuperAdmin" title="Verification Review" subtitle="Professional credential decision" showBack showAssistant={false}>
      <ScrollView contentContainerStyle={styles.content}>
        {error ? <Text style={{ color: colors.error }}>{error}</Text> : null}
        {data ? (
          <>
            <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}>
              <View style={[styles.heroIcon, { backgroundColor: colors.surfaceRaised }]}><Ionicons name={data.role === "Doctor" ? "medical-outline" : "business-outline"} size={26} color={colors.primary} /></View>
              <View style={styles.heroMain}>
                <Text style={[styles.name, { color: colors.textPrimary }]}>{data.provider?.name || data.details?.fullName || data.details?.hospitalName || "Provider"}</Text>
                <Text style={[styles.meta, { color: colors.textSecondary }]}>{data.role} • {data.provider?.email}</Text>
                <Text style={[styles.status, { color: data.status === "verified" ? colors.success : data.status === "rejected" ? colors.error : colors.warning }]}>{pretty(data.status)} • {pretty(data.accountStatus)}</Text>
              </View>
            </View>

            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Professional information</Text>
              {Object.entries(data.details || {}).map(([key, value]) => (
                <View key={key} style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{pretty(key)}</Text>
                  <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{String(value || "—")}</Text>
                </View>
              ))}
            </View>

            {data.role === "Doctor" && data.status === "verified" ? (
              <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Global Doctor Credential Maintenance</Text>
                <Text style={[styles.helper, { color: colors.textSecondary }]}>This is the canonical SuperAdmin-managed medical-license record. Hospitals can view it but cannot edit it.</Text>
                {[
                  ["medicalLicenseNumber", "Medical License Number"],
                  ["licensingAuthority", "Licensing Authority"],
                  ["specialization", "Specialization"],
                  ["qualification", "Qualification"],
                  ["licenseIssueDate", "License Issue Date (YYYY-MM-DD)"],
                  ["licenseExpiryDate", "License Expiry Date (YYYY-MM-DD)"],
                ].map(([key, label]) => (
                  <View key={key}>
                    <Text style={[styles.credentialLabel, { color: colors.textSecondary }]}>{label}</Text>
                    <TextInput
                      value={(credentialForm as any)[key]}
                      onChangeText={(value) => setCredentialForm((state) => ({ ...state, [key]: value }))}
                      placeholder={label}
                      placeholderTextColor={colors.textMuted}
                      style={[styles.credentialInput, { color: colors.textPrimary, backgroundColor: colors.background, borderColor: colors.border }]}
                    />
                  </View>
                ))}
                <Text style={[styles.credentialLabel, { color: colors.textSecondary }]}>Reason for credential change</Text>
                <TextInput value={credentialReason} onChangeText={setCredentialReason} multiline placeholder="Required audit reason" placeholderTextColor={colors.textMuted} style={[styles.reasonInput, { color: colors.textPrimary, backgroundColor: colors.background, borderColor: colors.border }]} />
                <Button title="Update Verified Credential" icon="shield-checkmark-outline" onPress={() => void saveCredential()} loading={credentialSaving} />
              </View>
            ) : null}

            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Documents</Text>
              {data.missingFields.length || data.missingDocuments.length ? (
                <Text style={[styles.helper, { color: colors.warning }]}>Incomplete: {[...data.missingFields, ...data.missingDocuments].map(pretty).join(", ")}</Text>
              ) : null}
              {!data.documents.length ? <Text style={{ color: colors.textSecondary, marginTop: 8 }}>No verification documents uploaded.</Text> : null}
              {data.documents.map((doc) => (
                <View key={doc.fileId} style={[styles.documentRow, { borderBottomColor: colors.border }]}>
                  <Ionicons name="document-text-outline" size={20} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.documentTitle, { color: colors.textPrimary }]}>{pretty(doc.type)}</Text>
                    <Text style={[styles.documentMeta, { color: colors.textSecondary }]}>{doc.filename}</Text>
                  </View>
                  <Button title="Download" size="sm" variant="outline" onPress={() => void downloadAdminVerificationDocument(data.id, doc.fileId, doc.filename).catch((err) => Alert.alert("Download failed", err.message))} />
                </View>
              ))}
            </View>

            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>SuperAdmin decision</Text>
              <Text style={[styles.helper, { color: colors.textSecondary }]}>Every action requires a reason and is written to immutable verification audit history.</Text>
              <TextInput value={reason} onChangeText={setReason} multiline placeholder="Reason / review note" placeholderTextColor={colors.textMuted} style={[styles.reasonInput, { color: colors.textPrimary, backgroundColor: colors.background, borderColor: colors.border }]} />

              {data.status !== "verified" && (data.status !== "under_review" || !data.readyToSubmit) ? <Text style={[styles.helper, { color: colors.warning }]}>Approval becomes available after the provider submits all required information and documents for review.</Text> : null}
              <View style={styles.actions}>
                {data.status !== "verified" ? <Button title="Approve & Verify" icon="checkmark-circle-outline" onPress={() => void act("verify")} loading={acting === "verify"} disabled={!!acting || data.status !== "under_review" || !data.readyToSubmit} /> : null}
                {data.status !== "verified" ? <Button title="Request Changes" variant="outline" icon="create-outline" onPress={() => void act("request_changes")} loading={acting === "request_changes"} disabled={!!acting} /> : null}
                {data.status !== "verified" ? <Button title="Reject" variant="danger" icon="close-circle-outline" onPress={() => void act("reject")} loading={acting === "reject"} disabled={!!acting} /> : null}
                {data.accountStatus !== "active" ? (
                  <Button title="Reactivate" variant="outline" icon="refresh-outline" onPress={() => void act("reactivate")} loading={acting === "reactivate"} disabled={!!acting} />
                ) : (
                  <Button title="Suspend" variant="danger" icon="ban-outline" onPress={() => void act("suspend")} loading={acting === "suspend"} disabled={!!acting} />
                )}
                {data.accountStatus !== "disabled" ? (
                  <Button title="Disable Account" variant="danger" icon="lock-closed-outline" onPress={() => void act("disable")} loading={acting === "disable"} disabled={!!acting} />
                ) : null}
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingBottom: 50 },
  hero: { flexDirection: "row", alignItems: "center", gap: 13, borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 16 },
  heroIcon: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  heroMain: { flex: 1 },
  name: { fontSize: 19, fontWeight: "900" },
  meta: { fontSize: 12, marginTop: 2 },
  status: { fontSize: 12, fontWeight: "800", marginTop: 6 },
  section: { borderWidth: 1, borderRadius: 18, padding: 15, marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontWeight: "900" },
  detailRow: { paddingVertical: 10, borderBottomWidth: 1 },
  detailLabel: { fontSize: 11, fontWeight: "800" },
  detailValue: { fontSize: 14, marginTop: 3 },
  documentRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderBottomWidth: 1 },
  documentTitle: { fontSize: 13, fontWeight: "800" },
  documentMeta: { fontSize: 11, marginTop: 2 },
  helper: { fontSize: 12, lineHeight: 18, marginTop: 5 },
  credentialLabel: { fontSize: 11, fontWeight: "800", marginTop: 10, marginBottom: 4 },
  credentialInput: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10 },
  reasonInput: { minHeight: 94, borderWidth: 1, borderRadius: 12, padding: 11, marginTop: 12, textAlignVertical: "top" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 14 },
});
