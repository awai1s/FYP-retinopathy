import { Alert } from "../../../services/alert";
import React, { useCallback, useState } from "react";
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
import { router, useFocusEffect } from "expo-router";

import AppShell from "../../../design/components/AppShell";
import Card from "../../../design/components/card";
import Button from "../../../design/components/Button";
import IconContainer from "../../../design/components/IconContainer";
import colors from "../../../design/tokens/colors";
import spacing from "../../../design/tokens/spacing";
import typography from "../../../design/tokens/typography";
import radius from "../../../design/tokens/radius";
import { useThemeRefresh } from "../../../providers/AppThemeProvider";
import {
  createHospitalAffiliation,
  getHospitalPrivilegeSummary,
  listHospitalAffiliatedDoctors,
  searchVerifiedDoctors,
  type DoctorCredential,
  type HospitalDoctorAffiliation,
  type HospitalPrivilegeSummary,
} from "../../../services/credentialsPrivileges";

const credentialColor = (state?: string) => {
  if (state === "valid") return colors.success;
  if (state === "expiring") return colors.warning;
  return colors.error;
};

export default function HospitalDoctorsScreen() {
  useThemeRefresh();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<HospitalPrivilegeSummary | null>(null);
  const [affiliations, setAffiliations] = useState<HospitalDoctorAffiliation[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DoctorCredential[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryData, doctors] = await Promise.all([
        getHospitalPrivilegeSummary(),
        listHospitalAffiliatedDoctors(),
      ]);
      setSummary(summaryData);
      setAffiliations(doctors);
    } catch (err: any) {
      Alert.alert("Unable to load", err?.message || "Could not load hospital doctor privileges.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const search = async () => {
    setSearching(true);
    try {
      setResults(await searchVerifiedDoctors(query));
    } catch (err: any) {
      Alert.alert("Search failed", err?.message || "Unable to search verified doctors.");
    } finally {
      setSearching(false);
    }
  };

  const add = async (doctor: DoctorCredential) => {
    setBusyId(doctor.doctorId);
    try {
      await createHospitalAffiliation({
        doctorId: doctor.doctorId,
        department: "Ophthalmology",
        position: "Consultant",
      });
      await load();
      setResults((items) => items.filter((item) => item.doctorId !== doctor.doctorId));
      router.push(`/hospital/doctors/${doctor.doctorId}` as any);
    } catch (err: any) {
      Alert.alert("Unable to affiliate doctor", err?.message || "Please try again.");
    } finally {
      setBusyId("");
    }
  };

  if (loading) {
    return (
      <AppShell role="Hospital" title="Doctors & Privileges" showAssistant={false}>
        <View style={styles.center}><ActivityIndicator size="large" color={colors.teal800} /></View>
      </AppShell>
    );
  }

  return (
    <AppShell role="Hospital" title="Doctors & Privileges" subtitle="Hospital affiliations and clinical authority" showAssistant={false}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>HOSPITAL GOVERNANCE</Text>
          <Text style={styles.title}>Doctor Credentials & Privileges</Text>
          <Text style={styles.subtitle}>SuperAdmin verifies professional identity. Your hospital controls only the affiliation and institution-specific privileges.</Text>
        </View>

        {summary ? (
          <Card style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>Credential Alerts</Text>
            <View style={styles.statsRow}>
              <View style={styles.stat}><Text style={styles.statValue}>{summary.activeDoctors}</Text><Text style={styles.statLabel}>Active Doctors</Text></View>
              <View style={styles.stat}><Text style={[styles.statValue, { color: colors.warning }]}>{summary.licenseExpiring60}</Text><Text style={styles.statLabel}>Licenses ≤60d</Text></View>
              <View style={styles.stat}><Text style={[styles.statValue, { color: colors.error }]}>{summary.licenseExpired}</Text><Text style={styles.statLabel}>Expired Licenses</Text></View>
              <View style={styles.stat}><Text style={[styles.statValue, { color: colors.warning }]}>{summary.privilegeExpiring30}</Text><Text style={styles.statLabel}>Privileges ≤30d</Text></View>
            </View>
            {summary.privilegeExpired ? <Text style={styles.alertText}>! {summary.privilegeExpired} privilege(s) are expired and no longer authorize procedures.</Text> : null}
          </Card>
        ) : null}

        <Text style={styles.sectionTitle}>Affiliated Doctors</Text>
        {affiliations.length ? affiliations.map((item) => (
          <TouchableOpacity key={item.id} activeOpacity={0.85} onPress={() => router.push(`/hospital/doctors/${item.doctorId}` as any)}>
            <Card style={styles.doctorCard}>
              <View style={styles.row}>
                <IconContainer name="medical-outline" size={24} color={colors.teal800} backgroundColor={colors.teal100} />
                <View style={styles.flex}>
                  <View style={styles.inline}><Text style={styles.doctorName}>{item.credential?.name || "Doctor"}</Text><Ionicons name="checkmark-circle" size={17} color={colors.success} /></View>
                  <Text style={styles.meta}>{item.position} • {item.department}</Text>
                  <Text style={[styles.credentialState, { color: credentialColor(item.credential?.credentialState) }]}>
                    License {item.credential?.credentialState === "expiring" ? `expires in ${item.credential?.licenseDaysRemaining} days` : item.credential?.credentialState || "unknown"}
                  </Text>
                  <Text style={styles.meta}>{item.activePrivilegeCount || 0} active hospital privilege(s) • {item.status}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </View>
            </Card>
          </TouchableOpacity>
        )) : <Card><Text style={styles.empty}>No affiliated doctors yet. Search verified doctors below.</Text></Card>}

        <Text style={styles.sectionTitle}>Add Verified Doctor</Text>
        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => void search()}
            placeholder="Name, specialization, or license number"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <Button title="Search" size="sm" icon="search-outline" onPress={() => void search()} loading={searching} />
        </View>

        {results.map((doctor: any) => (
          <Card key={doctor.doctorId} style={styles.searchCard}>
            <View style={styles.row}>
              <IconContainer name="person-outline" size={22} color={colors.teal800} backgroundColor={colors.teal50} />
              <View style={styles.flex}>
                <View style={styles.inline}><Text style={styles.doctorName}>{doctor.name}</Text><Ionicons name="checkmark-circle" size={17} color={colors.success} /></View>
                <Text style={styles.meta}>{doctor.specialization || "Doctor"}</Text>
                <Text style={styles.meta}>License: {doctor.medicalLicenseNumber || "Not available"}</Text>
                <Text style={[styles.credentialState, { color: credentialColor(doctor.credentialState) }]}>{doctor.credentialState === "expiring" ? `License expires in ${doctor.licenseDaysRemaining} days` : doctor.credentialState}</Text>
              </View>
              {doctor.affiliationStatus === "active" ? <Text style={styles.connected}>Affiliated</Text> : <Button title="Add" size="sm" onPress={() => void add(doctor)} loading={busyId === doctor.doctorId} />}
            </View>
          </Card>
        ))}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl + 50 },
  center: { minHeight: 320, alignItems: "center", justifyContent: "center" },
  hero: { marginBottom: spacing.lg },
  eyebrow: { color: colors.teal800, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, letterSpacing: 1.2 },
  title: { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.bold, marginTop: 3 },
  subtitle: { color: colors.textSecondary, fontSize: typography.sizes.small, lineHeight: 20, marginTop: 6 },
  sectionTitle: { color: colors.textPrimary, fontSize: typography.sizes.h3, fontWeight: typography.weights.bold, marginTop: spacing.lg, marginBottom: spacing.sm },
  summaryCard: { backgroundColor: colors.surface },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  stat: { flexGrow: 1, flexBasis: "44%", minWidth: 120, backgroundColor: colors.surfaceRaised, borderRadius: radius.md, padding: spacing.md },
  statValue: { color: colors.textPrimary, fontSize: 22, fontWeight: "900" },
  statLabel: { color: colors.textSecondary, fontSize: typography.sizes.xs, marginTop: 3 },
  alertText: { color: colors.error, fontSize: typography.sizes.xs, fontWeight: "700", marginTop: spacing.sm },
  doctorCard: { marginBottom: spacing.sm },
  searchCard: { marginBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  flex: { flex: 1, minWidth: 0 },
  inline: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
  doctorName: { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.bold },
  meta: { color: colors.textSecondary, fontSize: typography.sizes.xs, marginTop: 3 },
  credentialState: { fontSize: typography.sizes.xs, fontWeight: "800", marginTop: 4, textTransform: "capitalize" },
  empty: { color: colors.textSecondary, fontSize: typography.sizes.small },
  searchRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center", marginBottom: spacing.md },
  input: { flex: 1, minHeight: 46, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary, borderRadius: radius.md, paddingHorizontal: spacing.md },
  connected: { color: colors.success, fontSize: typography.sizes.xs, fontWeight: "800" },
});
