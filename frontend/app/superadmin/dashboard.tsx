import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import AppShell from "../../design/components/AppShell";
import Card from "../../design/components/card";
import { useAppTheme, useThemeRefresh } from "../../providers/AppThemeProvider";
import { getProfile } from "../../services/auth";
import { getSuperAdminDashboard, type SuperAdminDashboardCounts } from "../../services/superadmin";

const emptyCounts: SuperAdminDashboardCounts = { pending: 0, underReview: 0, needsChanges: 0, verified: 0, suspended: 0, doctors: 0, hospitals: 0 };

export default function SuperAdminDashboard() {
  useThemeRefresh();
  const { colors } = useAppTheme();
  const [name, setName] = useState("SuperAdmin");
  const [counts, setCounts] = useState(emptyCounts);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const [profile, data] = await Promise.all([getProfile(), getSuperAdminDashboard()]);
        setName(profile?.name || "SuperAdmin");
        setCounts(data);
      } catch (err: any) {
        setError(err?.message || "Unable to load SuperAdmin dashboard.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cards = [
    { label: "Doctors", value: counts.doctors, icon: "medical-outline" as const, route: "/superadmin/verifications?role=Doctor" },
    { label: "Hospitals", value: counts.hospitals, icon: "business-outline" as const, route: "/superadmin/verifications?role=Hospital" },
    { label: "Verification Queue", value: counts.pending + counts.underReview, icon: "shield-checkmark-outline" as const, route: "/superadmin/verifications?status=pending,under_review" },
    { label: "Verified Accounts", value: counts.verified, icon: "checkmark-circle-outline" as const, route: "/superadmin/verifications?status=verified" },
    { label: "Suspended Accounts", value: counts.suspended, icon: "ban-outline" as const, route: "/superadmin/verifications?accountStatus=suspended" },
    { label: "Audit History", value: null, icon: "time-outline" as const, route: "/superadmin/audit" },
  ];

  if (loading) return <View style={[styles.loading, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <AppShell role="SuperAdmin" title="Verification Dashboard" subtitle="EyeCare AI provider governance" userName={name} showAssistant={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>SUPERADMIN DASHBOARD</Text>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Provider verification & account governance</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Review professional credentials, request changes, approve legitimate providers, and suspend account access when required.</Text>
        </View>

        {error ? <View style={[styles.error, { backgroundColor: colors.errorSurface, borderColor: colors.error }]}><Text style={{ color: colors.textPrimary }}>{error}</Text></View> : null}

        <View style={styles.metricGrid}>
          {[
            ["Pending Verification", counts.pending],
            ["Under Review", counts.underReview],
            ["Needs Changes", counts.needsChanges],
            ["Verified Providers", counts.verified],
            ["Suspended", counts.suspended],
          ].map(([label, value]) => (
            <View key={String(label)} style={[styles.metric, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{value}</Text>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{label}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Administration</Text>
        <View style={styles.cards}>
          {cards.map((item) => (
            <Card key={item.label} onPress={() => router.push(item.route as any)} style={styles.card}>
              <View style={[styles.icon, { backgroundColor: colors.surfaceRaised }]}><Ionicons name={item.icon} size={23} color={colors.primary} /></View>
              <View style={styles.cardMain}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{item.label}</Text>
                <Text style={[styles.cardSub, { color: colors.textSecondary }]}>{item.value == null ? "Review immutable verification decisions" : `${item.value} account${item.value === 1 ? "" : "s"}`}</Text>
              </View>
              <Ionicons name="chevron-forward" size={19} color={colors.textMuted} />
            </Card>
          ))}
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingBottom: 48 },
  header: { marginBottom: 18 },
  eyebrow: { fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  title: { fontSize: 25, fontWeight: "900", marginTop: 5 },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  error: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 14 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  metric: { minWidth: 132, flexGrow: 1, borderWidth: 1, borderRadius: 16, padding: 14 },
  metricValue: { fontSize: 25, fontWeight: "900" },
  metricLabel: { fontSize: 12, marginTop: 3 },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginBottom: 12 },
  cards: { gap: 10 },
  card: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 45, height: 45, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cardMain: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: "800" },
  cardSub: { fontSize: 12, marginTop: 3 },
});
