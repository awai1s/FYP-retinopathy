import { Alert } from "../services/alert";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import AppShell from "../design/components/AppShell";
import Button from "../design/components/Button";
import ProviderVerificationBanner from "../components/ProviderVerificationBanner";
import { useAppTheme, useThemeRefresh } from "../providers/AppThemeProvider";
import { getProfile } from "../services/auth";
import { getUserRole, type UserRole } from "../services/storage";
import {
  getProviderVerification,
  pickVerificationDocument,
  removeProviderVerificationDocument,
  saveProviderVerificationDetails,
  submitProviderVerification,
  uploadProviderVerificationDocument,
  type ProviderVerification,
} from "../services/providerVerification";

interface FieldConfig {
  key: string;
  label: string;
  placeholder: string;
  keyboardType?: "default" | "numeric" | "email-address" | "phone-pad";
  multiline?: boolean;
}

const DOCTOR_FIELDS: FieldConfig[] = [
  { key: "fullName", label: "Full name", placeholder: "Dr. Ahmed Khan" },
  { key: "identityNumber", label: "CNIC / Identity (optional)", placeholder: "Identity number" },
  { key: "medicalLicenseNumber", label: "Medical license number", placeholder: "PMDC / licensing number" },
  { key: "licensingAuthority", label: "Licensing authority", placeholder: "Issuing authority" },
  { key: "specialization", label: "Specialization", placeholder: "Ophthalmologist" },
  { key: "qualification", label: "Qualification", placeholder: "MBBS, FCPS Ophthalmology" },
  { key: "yearsOfExperience", label: "Years of experience", placeholder: "8", keyboardType: "numeric" },
  { key: "licenseIssueDate", label: "License issue date", placeholder: "YYYY-MM-DD" },
  { key: "licenseExpiryDate", label: "License expiry date", placeholder: "YYYY-MM-DD" },
  { key: "currentHospitalClinic", label: "Current hospital / clinic (optional)", placeholder: "Eye Care Centre" },
  { key: "phone", label: "Phone", placeholder: "+92...", keyboardType: "phone-pad" },
  { key: "address", label: "Address", placeholder: "Professional address", multiline: true },
];

const HOSPITAL_FIELDS: FieldConfig[] = [
  { key: "hospitalName", label: "Hospital name", placeholder: "City Eye Hospital" },
  { key: "registrationNumber", label: "Registration number", placeholder: "Facility registration number" },
  { key: "facilityType", label: "Facility type", placeholder: "Eye Hospital / Clinic" },
  { key: "address", label: "Address", placeholder: "Facility address", multiline: true },
  { key: "city", label: "City", placeholder: "Islamabad" },
  { key: "officialEmail", label: "Official email", placeholder: "admin@hospital.com", keyboardType: "email-address" },
  { key: "phone", label: "Phone", placeholder: "+92...", keyboardType: "phone-pad" },
  { key: "responsibleContactPerson", label: "Responsible contact person", placeholder: "Administrator name" },
  { key: "registrationAuthority", label: "Registration authority", placeholder: "Issuing authority" },
  { key: "registrationExpiry", label: "Registration expiry (optional)", placeholder: "YYYY-MM-DD" },
];

const DOCUMENTS = {
  Doctor: [
    ["medical_license", "Medical License"],
    ["identity_proof", "Identity Proof"],
    ["qualification", "Degree / Qualification"],
  ],
  Hospital: [
    ["hospital_registration", "Hospital Registration Proof"],
    ["facility_license", "Facility License"],
  ],
} as const;

function statusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ProviderVerificationScreen() {
  useThemeRefresh();
  const { colors, eyeFriendly } = useAppTheme();
  const [role, setRole] = useState<"Doctor" | "Hospital" | null>(null);
  const [name, setName] = useState("Provider");
  const [verification, setVerification] = useState<ProviderVerification | null>(null);
  const [details, setDetails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const editable = verification ? ["pending", "needs_changes"].includes(verification.status) : false;
  const fields = role === "Hospital" ? HOSPITAL_FIELDS : DOCTOR_FIELDS;
  const documentConfigs = role ? DOCUMENTS[role] : [];

  const load = async () => {
    setError("");
    try {
      const currentRole = await getUserRole();
      if (currentRole !== "Doctor" && currentRole !== "Hospital") {
        if (currentRole === "SuperAdmin") router.replace("/superadmin/dashboard" as any);
        else if (currentRole === "Patient") router.replace("/tabs/dashboard" as any);
        else router.replace("/auth/login" as any);
        return;
      }
      setRole(currentRole);
      const [profile, data] = await Promise.all([getProfile(), getProviderVerification()]);
      setName(profile?.name || (currentRole === "Doctor" ? "Doctor" : "Hospital"));
      setVerification(data);
      const stringDetails: Record<string, string> = {};
      Object.entries(data.details || {}).forEach(([key, value]) => {
        stringDetails[key] = value == null ? "" : String(value);
      });
      if (currentRole === "Doctor") {
        stringDetails.fullName ||= String(profile?.name || "");
        stringDetails.medicalLicenseNumber ||= String(profile?.pmdc_number || profile?.pmdcNumber || profile?.licenseNumber || "");
        stringDetails.specialization ||= String(profile?.specialization || "");
        stringDetails.currentHospitalClinic ||= String(profile?.hospital || "");
        stringDetails.phone ||= String(profile?.phone || profile?.mobile || "");
      } else {
        stringDetails.hospitalName ||= String(profile?.hospitalName || profile?.name || "");
        stringDetails.officialEmail ||= String(profile?.email || "");
        stringDetails.phone ||= String(profile?.phone || profile?.mobile || "");
        stringDetails.address ||= String(profile?.address || "");
      }
      setDetails(stringDetails);
    } catch (err: any) {
      setError(err?.message || "Unable to load provider verification.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const missingLabels = useMemo(() => {
    if (!verification) return [];
    return [...verification.missingFields, ...verification.missingDocuments].map((item) => item.replace(/_/g, " "));
  }, [verification]);

  const saveDetails = async () => {
    if (!verification || !editable) return;
    setSaving(true);
    setError("");
    try {
      const payload: Record<string, any> = { ...details };
      if (role === "Doctor" && payload.yearsOfExperience !== "") {
        const parsed = Number(payload.yearsOfExperience);
        if (!Number.isFinite(parsed) || parsed < 0) throw new Error("Years of experience must be a valid number.");
        payload.yearsOfExperience = parsed;
      }
      const updated = await saveProviderVerificationDetails(payload);
      setVerification(updated);
      Alert.alert("Saved", "Verification details were saved successfully.");
    } catch (err: any) {
      setError(err?.message || "Unable to save verification details.");
    } finally {
      setSaving(false);
    }
  };

  const uploadDocument = async (documentType: string) => {
    if (!editable) return;
    try {
      const asset = await pickVerificationDocument();
      if (!asset) return;
      setUploading(documentType);
      setError("");
      const updated = await uploadProviderVerificationDocument(documentType, {
        uri: asset.uri,
        name: asset.name || "document",
        mimeType: asset.mimeType,
      });
      setVerification(updated);
    } catch (err: any) {
      setError(err?.message || "Unable to upload the document.");
    } finally {
      setUploading(null);
    }
  };

  const removeDocument = async (fileId: string) => {
    if (!editable) return;
    try {
      await removeProviderVerificationDocument(fileId);
      await load();
    } catch (err: any) {
      setError(err?.message || "Unable to remove the document.");
    }
  };

  const submit = async () => {
    if (!verification || !editable) return;
    setSaving(true);
    setError("");
    try {
      const updated = await submitProviderVerification();
      setVerification(updated);
      Alert.alert("Submitted", "Your verification is now under review.");
    } catch (err: any) {
      setError(err?.message || "Unable to submit provider verification.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !role) {
    return <View style={[styles.loading, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <AppShell role={role} title="Provider Verification" subtitle="Professional credential review" userName={name} showAssistant={false}>
      <ScrollView contentContainerStyle={[styles.content, eyeFriendly && styles.contentEye]} showsVerticalScrollIndicator={false}>
        {verification ? (
          <ProviderVerificationBanner
            status={verification.status}
            accountStatus={verification.accountStatus}
            decisionReason={verification.decisionReason}
          />
        ) : null}

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}> 
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Professional information</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>Complete the information exactly as it appears on your professional records.</Text>

          {fields.map((field) => (
            <View key={field.key} style={styles.fieldWrap}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>{field.label}</Text>
              <TextInput
                value={details[field.key] || ""}
                onChangeText={(value) => setDetails((previous) => ({ ...previous, [field.key]: value }))}
                placeholder={field.placeholder}
                placeholderTextColor={colors.textMuted}
                keyboardType={field.keyboardType || "default"}
                multiline={Boolean(field.multiline)}
                editable={editable}
                style={[
                  styles.input,
                  field.multiline && styles.multiline,
                  { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary },
                  !editable && { opacity: 0.72 },
                ]}
              />
            </View>
          ))}

          {editable ? <Button title={saving ? "Saving…" : "Save details"} icon="save-outline" onPress={() => void saveDetails()} loading={saving} /> : null}
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}> 
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Verification documents</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>JPEG, PNG or PDF, up to the server upload limit. Required documents must be present before submission.</Text>

          {documentConfigs.map(([type, label]) => {
            const doc = verification?.documents.find((item) => item.type === type);
            return (
              <View key={type} style={[styles.documentRow, { borderColor: colors.border }]}> 
                <View style={[styles.documentIcon, { backgroundColor: colors.surfaceRaised }]}>
                  <Ionicons name={doc ? "checkmark-circle" : "document-outline"} size={21} color={doc ? colors.success : colors.primary} />
                </View>
                <View style={styles.documentMain}>
                  <Text style={[styles.documentTitle, { color: colors.textPrimary }]}>{label}</Text>
                  <Text style={[styles.documentMeta, { color: colors.textSecondary }]} numberOfLines={1}>{doc?.filename || "Required document not uploaded"}</Text>
                </View>
                {editable ? (
                  <View style={styles.documentActions}>
                    <Button title={doc ? "Replace" : "Upload"} variant="outline" size="sm" onPress={() => void uploadDocument(type)} loading={uploading === type} />
                    {doc ? <Button title="Remove" variant="ghost" size="sm" onPress={() => void removeDocument(doc.fileId)} /> : null}
                  </View>
                ) : null}
              </View>
            );
          })}

          {editable ? (
            <Button title="Add supporting document" variant="outline" icon="add-outline" onPress={() => void uploadDocument("supporting_document")} loading={uploading === "supporting_document"} style={styles.supportingButton} />
          ) : null}

          {(verification?.documents || []).filter((item) => item.type === "supporting_document").map((doc) => (
            <View key={doc.fileId} style={[styles.supportingRow, { borderColor: colors.border }]}> 
              <Text style={[styles.documentMeta, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>{doc.filename}</Text>
              {editable ? <Button title="Remove" variant="ghost" size="sm" onPress={() => void removeDocument(doc.fileId)} /> : null}
            </View>
          ))}
        </View>

        {error ? (
          <View style={[styles.errorBox, { backgroundColor: colors.errorSurface, borderColor: colors.error }]}> 
            <Ionicons name="alert-circle-outline" size={19} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.textPrimary }]}>{error}</Text>
          </View>
        ) : null}

        {editable && verification ? (
          <View style={[styles.submitSection, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}> 
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Submit for review</Text>
            {missingLabels.length ? (
              <Text style={[styles.missingText, { color: colors.warning }]}>Still required: {missingLabels.join(", ")}</Text>
            ) : (
              <Text style={[styles.readyText, { color: colors.success }]}>✓ All required information is ready.</Text>
            )}
            <Button title="Submit Verification" icon="shield-checkmark-outline" onPress={() => void submit()} disabled={!verification.readyToSubmit || saving} loading={saving} style={styles.submitButton} />
          </View>
        ) : null}

        <View style={[styles.securityNote, { borderColor: colors.border }]}> 
          <Ionicons name="lock-closed-outline" size={17} color={colors.textMuted} />
          <Text style={[styles.securityText, { color: colors.textSecondary }]}>Clinical access is enforced by the backend. Hiding buttons is not used as a security control.</Text>
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingBottom: 48 },
  contentEye: { gap: 4 },
  section: { borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 18 },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  sectionSubtitle: { fontSize: 13, lineHeight: 19, marginTop: 4, marginBottom: 16 },
  fieldWrap: { marginBottom: 13 },
  label: { fontSize: 13, fontWeight: "700", marginBottom: 6 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 14 },
  multiline: { minHeight: 88, paddingTop: 12, textAlignVertical: "top" },
  documentRow: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, paddingVertical: 12, gap: 10 },
  documentIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  documentMain: { flex: 1, minWidth: 0 },
  documentTitle: { fontSize: 14, fontWeight: "800" },
  documentMeta: { fontSize: 12, marginTop: 3 },
  documentActions: { alignItems: "flex-end", gap: 4 },
  supportingButton: { marginTop: 14 },
  supportingRow: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, paddingVertical: 8, marginTop: 8 },
  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 18 },
  errorText: { flex: 1, fontSize: 13, lineHeight: 18 },
  submitSection: { borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 18 },
  missingText: { fontSize: 13, lineHeight: 19, marginTop: 8 },
  readyText: { fontSize: 13, fontWeight: "700", marginTop: 8 },
  submitButton: { marginTop: 14 },
  securityNote: { flexDirection: "row", gap: 8, alignItems: "flex-start", borderTopWidth: 1, paddingTop: 14 },
  securityText: { flex: 1, fontSize: 12, lineHeight: 18 },
});
