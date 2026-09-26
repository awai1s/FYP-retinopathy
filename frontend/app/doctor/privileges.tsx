import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import AppShell from "../../design/components/AppShell";
import Card from "../../design/components/card";
import colors from "../../design/tokens/colors";
import spacing from "../../design/tokens/spacing";
import typography from "../../design/tokens/typography";
import radius from "../../design/tokens/radius";
import { useThemeRefresh } from "../../providers/AppThemeProvider";
import { getDoctorHospitalAffiliations, type HospitalDoctorAffiliation } from "../../services/credentialsPrivileges";

export default function DoctorPrivilegesScreen() {
  useThemeRefresh();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<HospitalDoctorAffiliation[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError("");
      setItems(await getDoctorHospitalAffiliations());
    } catch (err: any) {
      setError(err?.message || "Unable to load hospital privileges.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <AppShell role="Doctor" title="Hospital Privileges" subtitle="Your institution-specific clinical authority">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>CREDENTIALS & AUTHORITY</Text>
        <Text style={styles.title}>My Hospital Privileges</Text>
        <Text style={styles.subtitle}>Your SuperAdmin verification is global. Each hospital independently controls what you may do inside that institution.</Text>

        {loading ? <View style={styles.center}><ActivityIndicator size="large" color={colors.teal800} /></View> : null}
        {error ? <Card><Text style={styles.error}>{error}</Text></Card> : null}
        {!loading && !items.length ? <Card><Text style={styles.empty}>You do not currently have a hospital affiliation.</Text></Card> : null}

        {items.map((item) => {
          const credential = item.credential;
          const active = (item.privileges || []).filter((priv) => priv.status === "active");
          const inactive = (item.privileges || []).filter((priv) => priv.status !== "active");
          return (
            <Card key={item.id} style={styles.card}>
              <View style={styles.headerRow}>
                <View style={styles.flex}>
                  <Text style={styles.hospital}>{item.hospitalName}</Text>
                  <Text style={styles.meta}>{item.position} • {item.department}</Text>
                  <Text style={styles.meta}>Affiliation: {item.status}</Text>
                </View>
                <Ionicons name={item.status === "active" ? "business" : "business-outline"} size={26} color={item.status === "active" ? colors.teal800 : colors.textMuted} />
              </View>

              {credential ? <View style={styles.credentialBox}><Ionicons name="shield-checkmark" size={20} color={credential.credentialState === "expired" ? colors.error : colors.success} /><View style={styles.flex}><Text style={styles.credentialTitle}>Global credential: {credential.credentialState}</Text><Text style={styles.meta}>License {credential.medicalLicenseNumber || "—"} • expires {credential.licenseExpiryDate || "—"}</Text></View></View> : null}

              <Text style={styles.sectionTitle}>Active privileges</Text>
              {active.length ? active.map((priv) => <View key={priv.code} style={styles.privRow}><Ionicons name="checkmark-circle" size={19} color={colors.success} /><View style={styles.flex}><Text style={styles.privTitle}>{priv.label}</Text><Text style={styles.meta}>{priv.expiresAt ? `Expires ${priv.expiresAt}` : "No privilege expiry set"}</Text></View></View>) : <Text style={styles.empty}>No active privileges.</Text>}

              {inactive.some((priv) => priv.status === "expired") ? <View style={styles.warningBox}><Ionicons name="warning" size={18} color={colors.warning} /><Text style={styles.warningText}>One or more hospital privileges are expired and will be denied by the backend.</Text></View> : null}
            </Card>
          );
        })}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl + 50 },
  eyebrow: { color: colors.teal800, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, letterSpacing: 1.2 },
  title: { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.bold, marginTop: 4 },
  subtitle: { color: colors.textSecondary, fontSize: typography.sizes.small, lineHeight: 20, marginTop: 5, marginBottom: spacing.lg },
  center: { minHeight: 250, alignItems: "center", justifyContent: "center" },
  card: { marginBottom: spacing.md },
  headerRow: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  flex: { flex: 1, minWidth: 0 },
  hospital: { color: colors.textPrimary, fontSize: typography.sizes.h3, fontWeight: typography.weights.bold },
  meta: { color: colors.textSecondary, fontSize: typography.sizes.xs, marginTop: 3 },
  credentialBox: { flexDirection: "row", gap: spacing.sm, alignItems: "center", backgroundColor: colors.surfaceRaised, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  credentialTitle: { color: colors.textPrimary, fontSize: typography.sizes.small, fontWeight: "800", textTransform: "capitalize" },
  sectionTitle: { color: colors.textPrimary, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold, marginTop: spacing.lg, marginBottom: spacing.xs },
  privRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  privTitle: { color: colors.textPrimary, fontSize: typography.sizes.small, fontWeight: "800" },
  warningBox: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.warningBg, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  warningText: { flex: 1, color: colors.warning, fontSize: typography.sizes.xs, fontWeight: "700" },
  empty: { color: colors.textSecondary, fontSize: typography.sizes.small },
  error: { color: colors.error, fontSize: typography.sizes.small },
});
