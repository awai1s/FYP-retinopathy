import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import AppShell from "../../design/components/AppShell";
import Card from "../../design/components/card";
import Button from "../../design/components/Button";
import StatusBadge from "../../design/components/StatusBadge";
import colors from "../../design/tokens/colors";
import spacing from "../../design/tokens/spacing";
import typography from "../../design/tokens/typography";
import radius from "../../design/tokens/radius";
import { useThemeRefresh } from "../../providers/AppThemeProvider";
import { ClinicalEncounter, getDoctorConsultations } from "../../services/consultations";

const formatDate = (value?: string | null) => {
  if (!value) return "No timestamp";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export default function DoctorConsultationsScreen() {
  useThemeRefresh();
  const [items, setItems] = useState<ClinicalEncounter[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      setItems(await getDoctorConsultations());
    } catch (err: any) {
      setError(err?.message || "Unable to load consultations.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const active = items.filter((item) => item.status !== "completed");
  const completed = items.filter((item) => item.status === "completed");

  return (
    <AppShell role="Doctor" title="Consultations" showBack onBackPress={() => router.back()}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.teal800} />}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>CLINICAL ENCOUNTERS</Text>
          <Text style={styles.title}>Consultation Cockpit</Text>
          <Text style={styles.subtitle}>Continue saved visits and review completed clinical encounters.</Text>
        </View>

        {error ? <View style={styles.errorBox}><Ionicons name="warning-outline" size={18} color={colors.error} /><Text style={styles.errorText}>{error}</Text></View> : null}

        {loading ? <View style={styles.center}><ActivityIndicator size="large" color={colors.teal800} /><Text style={styles.subtitle}>Loading consultations...</Text></View> : null}

        {!loading ? <>
          <Text style={styles.sectionTitle}>In Progress ({active.length})</Text>
          {active.length ? active.map((item) => (
            <Card key={item.id} style={styles.card}>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Text style={styles.patient}>{item.patientName}</Text>
                  <Text style={styles.meta}>{item.reasonForVisit || "Consultation"}</Text>
                  <Text style={styles.meta}>Started {formatDate(item.startedAt)} · Revision {item.revision}</Text>
                </View>
                <StatusBadge status="Processing" label="In Progress" size="sm" />
              </View>
              <Button title="Continue Consultation" icon="arrow-forward-outline" size="sm" onPress={() => router.push(`/doctor/consultation/${item.id}` as any)} style={styles.button} />
            </Card>
          )) : <Card style={styles.empty}><Text style={styles.emptyTitle}>No consultation drafts</Text><Text style={styles.meta}>Start a confirmed visit from Doctor Appointments.</Text></Card>}

          <Text style={styles.sectionTitle}>Completed ({completed.length})</Text>
          {completed.length ? completed.map((item) => (
            <Card key={item.id} style={styles.card}>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Text style={styles.patient}>{item.patientName}</Text>
                  <Text style={styles.meta}>{item.reasonForVisit || "Consultation"}</Text>
                  <Text style={styles.meta}>Completed {formatDate(item.completedAt)}</Text>
                </View>
                <StatusBadge status="Completed" size="sm" />
              </View>
              <Button title="View Clinical Summary" variant="outline" icon="document-text-outline" size="sm" onPress={() => router.push(`/doctor/consultation/${item.id}` as any)} style={styles.button} />
            </Card>
          )) : <Card style={styles.empty}><Text style={styles.emptyTitle}>No completed consultations yet</Text></Card>}
        </> : null}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl + 50 },
  header: { marginBottom: spacing.lg },
  eyebrow: { color: colors.teal800, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, letterSpacing: 1.2 },
  title: { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.bold, marginTop: 2 },
  subtitle: { color: colors.textSecondary, fontSize: typography.sizes.body, marginTop: 4 },
  sectionTitle: { color: colors.textPrimary, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold, marginTop: spacing.lg, marginBottom: spacing.sm },
  card: { marginBottom: spacing.sm, backgroundColor: colors.surface },
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  flex: { flex: 1 },
  patient: { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.bold },
  meta: { color: colors.textSecondary, fontSize: typography.sizes.xs, marginTop: 3 },
  button: { marginTop: spacing.md },
  empty: { alignItems: "center", paddingVertical: spacing.xl },
  emptyTitle: { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.bold },
  center: { minHeight: 220, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  errorBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.errorBg, borderRadius: radius.md, padding: spacing.md },
  errorText: { color: colors.error, fontSize: typography.sizes.small, flex: 1 },
});
