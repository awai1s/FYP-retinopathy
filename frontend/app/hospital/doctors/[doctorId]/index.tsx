import { Alert } from "../../../../services/alert";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { useFocusEffect, useLocalSearchParams } from "expo-router";

import AppShell from "../../../../design/components/AppShell";
import Card from "../../../../design/components/card";
import Button from "../../../../design/components/Button";
import colors from "../../../../design/tokens/colors";
import spacing from "../../../../design/tokens/spacing";
import typography from "../../../../design/tokens/typography";
import radius from "../../../../design/tokens/radius";
import { useThemeRefresh } from "../../../../providers/AppThemeProvider";
import {
  getHospitalDoctorPrivilegeDetail,
  saveHospitalDoctorPrivileges,
  updateHospitalAffiliation,
  type DoctorPrivilege,
  type HospitalDoctorAffiliation,
} from "../../../../services/credentialsPrivileges";

const pretty = (value: string) => String(value || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function HospitalDoctorPrivilegeScreen() {
  useThemeRefresh();
  const params = useLocalSearchParams<{ doctorId?: string | string[] }>();
  const doctorId = Array.isArray(params.doctorId) ? params.doctorId[0] : params.doctorId || "";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [affiliation, setAffiliation] = useState<HospitalDoctorAffiliation | null>(null);
  const [privileges, setPrivileges] = useState<DoctorPrivilege[]>([]);
  const [department, setDepartment] = useState("");
  const [position, setPosition] = useState("");
  const [joinedAt, setJoinedAt] = useState("");
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [expiries, setExpiries] = useState<Record<string, string>>({});

  const hydrate = useCallback((data: { affiliation: HospitalDoctorAffiliation; privileges: DoctorPrivilege[] }) => {
    setAffiliation(data.affiliation);
    setPrivileges(data.privileges || []);
    setDepartment(data.affiliation.department || "Ophthalmology");
    setPosition(data.affiliation.position || "Consultant");
    setJoinedAt(data.affiliation.joinedAt || "");
    setEnabled(Object.fromEntries((data.privileges || []).map((item) => [item.code, item.status === "active"])));
    setExpiries(Object.fromEntries((data.privileges || []).map((item) => [item.code, item.expiresAt || ""])));
  }, []);

  const load = useCallback(async () => {
    if (!doctorId) return;
    setLoading(true);
    try {
      hydrate(await getHospitalDoctorPrivilegeDetail(doctorId));
    } catch (err: any) {
      Alert.alert("Unable to load", err?.message || "Could not load doctor credentials and privileges.");
    } finally {
      setLoading(false);
    }
  }, [doctorId, hydrate]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const credential = affiliation?.credential;
  const credentialValid = credential?.credentialState === "valid" || credential?.credentialState === "expiring";
  const canGrant = affiliation?.status === "active" && credentialValid;
  const activeCount = useMemo(() => privileges.filter((item) => enabled[item.code]).length, [enabled, privileges]);

  const saveAffiliation = async () => {
    setSaving(true);
    try {
      const updated = await updateHospitalAffiliation(doctorId, { department, position, joinedAt });
      setAffiliation((current) => current ? { ...current, ...updated } : updated);
      Alert.alert("Saved", "Hospital affiliation details updated.");
    } catch (err: any) {
      Alert.alert("Unable to save", err?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const savePrivileges = async () => {
    setSaving(true);
    try {
      const data = await saveHospitalDoctorPrivileges(
        doctorId,
        privileges.map((item) => ({ code: item.code, enabled: Boolean(enabled[item.code]), expiresAt: expiries[item.code] || "" })),
      );
      hydrate(data);
      Alert.alert("Privileges updated", "Hospital-specific clinical authority has been saved and audited.");
    } catch (err: any) {
      Alert.alert("Unable to update privileges", err?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = (status: "active" | "inactive" | "ended") => {
    const destructive = status !== "active";
    Alert.alert(
      status === "ended" ? "End affiliation?" : status === "inactive" ? "Pause affiliation?" : "Reactivate affiliation?",
      destructive
        ? "Hospital privileges will be revoked immediately. Historical records remain unchanged."
        : "The doctor can receive hospital privileges again once credentials remain valid.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: status === "active" ? "Reactivate" : status === "ended" ? "End" : "Pause",
          style: destructive ? "destructive" : "default",
          onPress: async () => {
            try {
              setSaving(true);
              await updateHospitalAffiliation(doctorId, { status });
              await load();
            } catch (err: any) {
              Alert.alert("Unable to update", err?.message || "Please try again.");
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  if (loading || !affiliation) {
    return (
      <AppShell role="Hospital" title="Doctor Credentials" showBack showAssistant={false}>
        <View style={styles.center}><ActivityIndicator size="large" color={colors.teal800} /></View>
      </AppShell>
    );
  }

  return (
    <AppShell role="Hospital" title="Doctor Credentials" subtitle="Verified identity + hospital-specific authority" showBack showAssistant={false}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card variant="accent" style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.flex}>
              <View style={styles.inline}>
                <Text style={styles.name}>{credential?.name || "Doctor"}</Text>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              </View>
              <Text style={styles.subtitle}>{credential?.specialization || "Doctor"}</Text>
              <Text style={styles.meta}>{position} • {department}</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: affiliation.status === "active" ? colors.successBg : colors.warningBg }]}>
              <Text style={[styles.statusText, { color: affiliation.status === "active" ? colors.success : colors.warning }]}>{pretty(affiliation.status)}</Text>
            </View>
          </View>
        </Card>

        <Card style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Global Doctor Credential</Text>
            <Text style={styles.adminManaged}>SUPERADMIN MANAGED</Text>
          </View>
          <Text style={styles.helper}>The hospital can view this verified credential but cannot edit the global medical-license record.</Text>
          {[
            ["Medical License", credential?.medicalLicenseNumber || "—"],
            ["Authority", credential?.licensingAuthority || "—"],
            ["Specialization", credential?.specialization || "—"],
            ["Qualification", credential?.qualification || "—"],
            ["Issue Date", credential?.licenseIssueDate || "—"],
            ["Expiry Date", credential?.licenseExpiryDate || "—"],
          ].map(([label, value]) => <View key={label} style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>)}
          <View style={[styles.credentialBanner, { backgroundColor: credentialValid ? colors.successBg : colors.errorBg }]}>
            <Ionicons name={credentialValid ? "shield-checkmark" : "warning"} size={20} color={credentialValid ? colors.success : colors.error} />
            <Text style={[styles.credentialText, { color: credentialValid ? colors.success : colors.error }]}>
              {credential?.credentialState === "expiring" ? `Verified license expires in ${credential.licenseDaysRemaining} days` : `Credential status: ${pretty(credential?.credentialState || "unknown")}`}
            </Text>
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Hospital Affiliation</Text>
          <Text style={styles.fieldLabel}>Department</Text>
          <TextInput value={department} onChangeText={setDepartment} placeholder="Ophthalmology" placeholderTextColor={colors.textMuted} style={styles.input} />
          <Text style={styles.fieldLabel}>Position</Text>
          <TextInput value={position} onChangeText={setPosition} placeholder="Consultant" placeholderTextColor={colors.textMuted} style={styles.input} />
          <Text style={styles.fieldLabel}>Joined Date</Text>
          <TextInput value={joinedAt} onChangeText={setJoinedAt} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} style={styles.input} />
          <View style={styles.actions}><Button title="Save Affiliation" icon="save-outline" size="sm" onPress={() => void saveAffiliation()} loading={saving} />{affiliation.status === "active" ? <Button title="Pause" variant="outline" size="sm" onPress={() => changeStatus("inactive")} /> : <Button title="Reactivate" variant="outline" size="sm" onPress={() => changeStatus("active")} />}{affiliation.status !== "ended" ? <Button title="End Affiliation" variant="danger" size="sm" onPress={() => changeStatus("ended")} /> : null}</View>
        </Card>

        <Card style={styles.card}>
          <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Hospital Privileges</Text><Text style={styles.helper}>{activeCount} active of {privileges.length} catalogue permissions</Text></View><Ionicons name="key-outline" size={24} color={colors.teal800} /></View>
          {!canGrant ? <View style={styles.blocked}><Ionicons name="lock-closed" size={19} color={colors.error} /><Text style={styles.blockedText}>Privileges cannot be granted while the affiliation is inactive or the professional credential is invalid/expired.</Text></View> : null}
          {privileges.map((item) => {
            const checked = Boolean(enabled[item.code]);
            return (
              <View key={item.code} style={styles.privilegeRow}>
                <TouchableOpacity
                  disabled={!canGrant}
                  onPress={() => setEnabled((state) => ({ ...state, [item.code]: !checked }))}
                  style={styles.privilegeToggle}
                >
                  <Ionicons name={checked ? "checkbox" : "square-outline"} size={24} color={checked ? colors.teal800 : colors.textMuted} />
                  <View style={styles.flex}>
                    <Text style={styles.privilegeTitle}>{item.label}</Text>
                    <Text style={styles.helper}>{item.description}</Text>
                    {item.status === "expired" ? <Text style={styles.expired}>Expired privilege — authorization denied</Text> : null}
                  </View>
                </TouchableOpacity>
                {checked ? <View style={styles.expiryBox}><Text style={styles.fieldLabel}>Privilege expiry (optional)</Text><TextInput editable={canGrant} value={expiries[item.code] || ""} onChangeText={(value) => setExpiries((state) => ({ ...state, [item.code]: value }))} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} style={styles.input} /></View> : null}
              </View>
            );
          })}
          <Button title="Save Privileges" icon="shield-checkmark-outline" onPress={() => void savePrivileges()} loading={saving} disabled={!canGrant} style={styles.savePrivileges} />
          <Text style={styles.auditNote}>Every grant, expiry change and revocation is written to immutable hospital privilege audit history.</Text>
        </Card>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl + 60 },
  center: { minHeight: 320, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1, minWidth: 0 },
  hero: { marginBottom: spacing.md },
  heroRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  inline: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  name: { color: colors.textPrimary, fontSize: typography.sizes.h2, fontWeight: typography.weights.bold },
  subtitle: { color: colors.textSecondary, fontSize: typography.sizes.body, marginTop: 3 },
  meta: { color: colors.textMuted, fontSize: typography.sizes.xs, marginTop: 4 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  statusText: { fontSize: typography.sizes.xs, fontWeight: "900" },
  card: { marginBottom: spacing.md },
  sectionHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md },
  sectionTitle: { color: colors.textPrimary, fontSize: typography.sizes.h3, fontWeight: typography.weights.bold },
  adminManaged: { color: colors.teal800, fontSize: 10, fontWeight: "900", letterSpacing: 0.7 },
  helper: { color: colors.textSecondary, fontSize: typography.sizes.xs, lineHeight: 17, marginTop: 3 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  detailLabel: { color: colors.textMuted, fontSize: typography.sizes.xs, fontWeight: "700" },
  detailValue: { color: colors.textPrimary, fontSize: typography.sizes.small, fontWeight: "700", textAlign: "right", flex: 1 },
  credentialBanner: { flexDirection: "row", gap: spacing.sm, alignItems: "center", borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  credentialText: { flex: 1, fontSize: typography.sizes.xs, fontWeight: "800" },
  fieldLabel: { color: colors.textSecondary, fontSize: typography.sizes.xs, fontWeight: "800", marginTop: spacing.sm, marginBottom: 4 },
  input: { minHeight: 45, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, paddingHorizontal: spacing.md },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  blocked: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.errorBg, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  blockedText: { flex: 1, color: colors.error, fontSize: typography.sizes.xs, lineHeight: 17, fontWeight: "700" },
  privilegeRow: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  privilegeToggle: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  privilegeTitle: { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.bold },
  expiryBox: { marginLeft: 34, marginTop: spacing.xs },
  expired: { color: colors.error, fontSize: typography.sizes.xs, fontWeight: "800", marginTop: 4 },
  savePrivileges: { marginTop: spacing.lg },
  auditNote: { color: colors.textMuted, fontSize: typography.sizes.tiny, lineHeight: 16, marginTop: spacing.sm },
});
