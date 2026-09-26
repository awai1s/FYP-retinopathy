import { Alert } from "../../services/alert";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, router } from "expo-router";

import {
  getDoctorAppointments,
  updateAppointmentStatus,
  Appointment,
} from "../../services/appointment";
import { startConsultation } from "../../services/consultations";
import { useLanguage } from "../../services/i18n";

import AppShell from "../../design/components/AppShell";
import Card from "../../design/components/card";
import IconContainer from "../../design/components/IconContainer";
import StatusBadge from "../../design/components/StatusBadge";
import Button from "../../design/components/Button";
import colors from "../../design/tokens/colors";
import spacing from "../../design/tokens/spacing";
import typography from "../../design/tokens/typography";
import radius from "../../design/tokens/radius";
import { useThemeRefresh } from "../../providers/AppThemeProvider";

export default function DoctorAppointmentsScreen() {
  useThemeRefresh();
  const { t } = useLanguage();
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await getDoctorAppointments());
    } catch (error: any) {
      Alert.alert(
        t("unableToLoadAppointments") || "Error",
        error?.message || t("pleaseTryAgain") || "Unable to load appointments."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const changeStatus = async (item: Appointment, status: "Confirmed" | "Rejected") => {
    try {
      setBusyId(item.id);
      await updateAppointmentStatus(item.id, status);
      await load();
    } catch (error: any) {
      Alert.alert(
        t("unableToUpdateAppointment") || "Update Error",
        error?.message || t("pleaseTryAgain") || "Unable to update status."
      );
    } finally { setBusyId(null); }
  };

  const openConsultation = async (item: Appointment) => {
    try {
      setBusyId(item.id);
      if (item.encounterId) {
        router.push(`/doctor/consultation/${item.encounterId}` as any);
        return;
      }
      const encounter = await startConsultation(item.id);
      router.push(`/doctor/consultation/${encounter.id}` as any);
    } catch (error: any) {
      Alert.alert("Unable to start consultation", error?.message || "Please verify the appointment and care connection, then try again.");
    } finally { setBusyId(null); }
  };

  if (loading) {
    return (
      <AppShell role="Doctor" title={t("doctorAppointments") || "Doctor Schedule"}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={colors.teal800} size="large" />
          <Text style={styles.loadingText}>Loading appointment queue...</Text>
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell role="Doctor" title={t("doctorAppointments") || "Clinical Appointments"} showBack onBackPress={() => router.back()}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.teal800} />}
      >
        <View style={styles.headerGroup}>
          <Text style={styles.eyebrow}>PATIENT VISIT QUEUE</Text>
          <Text style={styles.title}>{t("doctorAppointments") || "Manage Consultations"}</Text>
          <Text style={styles.subtitle}>Confirm requested visits, then open the Consultation Cockpit to document the actual clinical encounter.</Text>
          <Button title="Consultation Records" variant="outline" icon="document-text-outline" size="sm" onPress={() => router.push("/doctor/consultations" as any)} style={styles.recordsButton} />
        </View>

        {items.length === 0 ? (
          <Card style={styles.emptyCard}>
            <IconContainer name="calendar-outline" size={32} color={colors.textMuted} backgroundColor={colors.teal50} />
            <Text style={styles.emptyTitle}>{t("noAppointmentsWaiting") || "No Appointments"}</Text>
            <Text style={styles.emptySub}>No patient visits are currently in your appointment queue.</Text>
          </Card>
        ) : null}

        <View style={styles.list}>
          {items.map((item) => {
            const hasDraft = item.encounterStatus === "draft" || item.encounterStatus === "in_progress";
            const completedEncounter = item.encounterStatus === "completed";
            return (
              <Card key={item.id} style={styles.apptCard}>
                <View style={styles.cardHeaderRow}>
                  <IconContainer name="person-outline" size={24} color={colors.teal800} backgroundColor={colors.teal100} />
                  <View style={styles.cardMain}>
                    <Text style={styles.patientName}>{item.patientName || t("patient") || "Patient Record"}</Text>
                    <Text style={styles.metaText}>{item.date} · {item.time}</Text>
                  </View>
                  <StatusBadge status={item.status} size="sm" />
                </View>

                {item.reason ? <View style={styles.reasonBox}><Text style={styles.reasonLabel}>REASON FOR CONSULTATION</Text><Text style={styles.reasonText}>{item.reason}</Text></View> : null}

                {hasDraft ? <View style={styles.draftBox}><Text style={styles.draftTitle}>Consultation Draft Found</Text><Text style={styles.draftText}>The clinical encounter has already started and is autosaved.</Text></View> : null}

                {item.status === "Pending" ? (
                  <View style={styles.actionRow}>
                    <Button title={t("confirm") || "Confirm Visit"} icon="checkmark-circle-outline" onPress={() => void changeStatus(item, "Confirmed")} loading={busyId === item.id} style={styles.flexBtn} />
                    <Button title={t("reject") || "Decline"} variant="outline" icon="close-circle-outline" onPress={() => void changeStatus(item, "Rejected")} disabled={busyId === item.id} style={styles.flexBtn} />
                  </View>
                ) : null}

                {item.status === "Confirmed" ? (
                  <Button
                    title={hasDraft ? "Continue Consultation" : "Start Consultation"}
                    icon={hasDraft ? "arrow-forward-outline" : "medical-outline"}
                    onPress={() => void openConsultation(item)}
                    loading={busyId === item.id}
                    style={styles.completeBtn}
                  />
                ) : null}

                {item.status === "Completed" && completedEncounter && item.encounterId ? (
                  <Button title="View Clinical Summary" variant="outline" icon="document-text-outline" onPress={() => router.push(`/doctor/consultation/${item.encounterId}` as any)} style={styles.completeBtn} />
                ) : null}
              </Card>
            );
          })}
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  loadingText: { marginTop: spacing.md, color: colors.textSecondary, fontSize: typography.sizes.body },
  scrollContent: { paddingBottom: spacing.xxxl + 40 },
  headerGroup: { marginBottom: spacing.lg },
  eyebrow: { fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, color: colors.teal800, letterSpacing: 1.2, marginBottom: 2 },
  title: { fontSize: typography.sizes.h1, fontWeight: typography.weights.bold, color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: typography.sizes.body, color: colors.textSecondary, marginTop: 4 },
  recordsButton: { marginTop: spacing.md },
  emptyCard: { padding: spacing.xxl, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  emptyTitle: { fontSize: typography.sizes.h3, fontWeight: typography.weights.bold, color: colors.textPrimary, marginTop: spacing.md },
  emptySub: { fontSize: typography.sizes.body, color: colors.textSecondary, textAlign: "center", marginTop: 4 },
  list: { gap: spacing.md },
  apptCard: { backgroundColor: colors.surface },
  cardHeaderRow: { flexDirection: "row", alignItems: "center" },
  cardMain: { flex: 1, marginLeft: spacing.md, paddingRight: spacing.xs },
  patientName: { fontSize: typography.sizes.body, fontWeight: typography.weights.bold, color: colors.textPrimary },
  metaText: { fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: 2 },
  reasonBox: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.teal50 },
  reasonLabel: { fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, color: colors.teal800, letterSpacing: 0.5, marginBottom: 2 },
  reasonText: { fontSize: typography.sizes.small, color: colors.textSecondary },
  draftBox: { marginTop: spacing.sm, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.teal200, backgroundColor: colors.teal50 },
  draftTitle: { color: colors.teal800, fontSize: typography.sizes.small, fontWeight: typography.weights.bold },
  draftText: { color: colors.textSecondary, fontSize: typography.sizes.xs, marginTop: 2 },
  actionRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  flexBtn: { flex: 1 },
  completeBtn: { marginTop: spacing.md },
});
