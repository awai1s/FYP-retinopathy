import { Alert } from "../services/alert";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  Appointment,
  cancelAppointment,
  getPatientAppointments,
} from "../services/appointment";
import { useLanguage } from "../services/i18n";

import AppShell from "../design/components/AppShell";
import Card from "../design/components/card";
import IconContainer from "../design/components/IconContainer";
import StatusBadge from "../design/components/StatusBadge";
import Button from "../design/components/Button";
import colors from "../design/tokens/colors";
import spacing from "../design/tokens/spacing";
import typography from "../design/tokens/typography";
import radius from "../design/tokens/radius";

import { useThemeRefresh } from "../providers/AppThemeProvider";
import { useNetwork } from "../providers/NetworkProvider";
export default function AppointmentsScreen() {
  useThemeRefresh();
  const { isOnline } = useNetwork();
  const router = useRouter();
  const { t } = useLanguage();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadAppointments = async () => {
    try {
      setError("");
      const data = await getPatientAppointments();
      setAppointments(data);
    } catch (err: any) {
      console.error("Appointments loading error:", err);
      setError(err?.message || t("unableToLoadAppointments") || "Unable to load appointments.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadAppointments();
    }, [])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAppointments();
  };

  const handleCancel = (appointment: Appointment) => {
    if (!isOnline) {
      Alert.alert("Internet required", "Cancelling an appointment changes the shared clinical schedule and cannot be confirmed while offline.");
      return;
    }
    Alert.alert(
      t("cancelAppointment") || "Cancel Appointment",
      `${t("appointmentCancelConfirmation") || "Are you sure you want to cancel your appointment with"} ${
        appointment.doctorName || t("doctor") || "Doctor"
      }?`,
      [
        { text: t("keep") || "Keep Appointment", style: "cancel" },
        {
          text: t("cancelAppointment") || "Cancel Appointment",
          style: "destructive",
          onPress: async () => {
            try {
              setCancellingId(appointment.id);
              await cancelAppointment(appointment.id);
              await loadAppointments();
              Alert.alert(
                t("appointmentCancelled") || "Appointment Cancelled",
                t("appointmentCancelledMessage") || "Your appointment has been cancelled."
              );
            } catch (err: any) {
              Alert.alert(
                t("unableToCancel") || "Unable to Cancel",
                err?.message || t("unableToCancelAppointment") || "Failed to cancel appointment."
              );
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  };

  const upcomingAppointments = appointments.filter(
    (item) => item.status === "Pending" || item.status === "Confirmed"
  );

  const pastAppointments = appointments.filter(
    (item) => item.status === "Completed" || item.status === "Cancelled" || item.status === "Rejected"
  );

  if (loading) {
    return (
      <AppShell role="Patient" title={t("appointments") || "Appointments"}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.teal800} />
          <Text style={styles.loadingText}>Loading appointments...</Text>
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell role="Patient" title={t("appointments") || "Appointments"} showBack onBackPress={() => router.back()}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.teal800} />}
      >
        <View style={styles.headerGroup}>
          <View style={styles.headerRow}>
            <View style={styles.headerTextCol}>
              <Text style={styles.eyebrow}>CLINICAL SCHEDULE</Text>
              <Text style={styles.title}>{t("appointments") || "Appointments"}</Text>
              <Text style={styles.subtitle}>{t("manageVisits") || "Schedule & manage specialist eye consultations."}</Text>
            </View>
            <Button
              title="Book Visit"
              icon="add-outline"
              size="sm"
              onPress={() => router.push("/book-appointment" as any)}
              disabled={!isOnline}
            />
          </View>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={20} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Upcoming Appointments */}
        <Text style={styles.sectionHeaderTitle}>{t("upcomingAppointments") || "Upcoming Visits"}</Text>

        {upcomingAppointments.length === 0 ? (
          <Card style={styles.emptyCard}>
            <IconContainer name="calendar-outline" size={32} color={colors.textMuted} backgroundColor={colors.teal50} />
            <Text style={styles.emptyTitle}>{t("noUpcomingAppointments") || "No Upcoming Visits"}</Text>
            <Text style={styles.emptySub}>{t("appointmentsDescription") || "Schedule a consultation with an ophthalmologist."}</Text>
            <Button
              title={t("bookAppointment") || "Book Appointment"}
              icon="calendar-outline"
              onPress={() => router.push("/book-appointment" as any)}
              disabled={!isOnline}
              style={styles.bookBtn}
            />
          </Card>
        ) : (
          upcomingAppointments.map((item) => (
            <Card key={item.id} style={styles.apptCard}>
              <View style={styles.cardHeaderRow}>
                <IconContainer name="medical-outline" size={24} color={colors.teal800} backgroundColor={colors.teal100} />
                <View style={styles.cardMainInfo}>
                  <Text style={styles.doctorName}>{item.doctorName || "Ophthalmology Specialist"}</Text>
                  <Text style={styles.reasonText}>{item.reason || "Diabetic Retinopathy Consultation"}</Text>
                </View>
                <StatusBadge status={item.status} size="sm" />
              </View>

              <View style={styles.divider} />

              <View style={styles.detailsRow}>
                <View style={styles.detailItem}>
                  <Ionicons name="calendar-outline" size={16} color={colors.teal800} />
                  <Text style={styles.detailText}>{item.date || "Not set"}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="time-outline" size={16} color={colors.teal800} />
                  <Text style={styles.detailText}>{item.time || "Not set"}</Text>
                </View>
              </View>

              {(item.status === "Pending" || item.status === "Confirmed") && !(item.encounterStatus === "draft" || item.encounterStatus === "in_progress") ? (
                <Button
                  title={cancellingId === item.id ? "Cancelling..." : (t("cancelAppointment") || "Cancel Appointment")}
                  variant="outline"
                  size="sm"
                  onPress={() => handleCancel(item)}
                  disabled={cancellingId === item.id}
                  style={styles.cancelBtn}
                />
              ) : null}

              {item.encounterStatus === "draft" || item.encounterStatus === "in_progress" ? (
                <View style={styles.visitStartedNotice}>
                  <Ionicons name="medical-outline" size={18} color={colors.teal800} />
                  <Text style={styles.visitStartedText}>Your doctor has started this consultation. The visit can no longer be cancelled from here.</Text>
                </View>
              ) : null}
            </Card>
          ))
        )}

        {/* Past Appointments */}
        {pastAppointments.length > 0 && (
          <>
            <Text style={styles.sectionHeaderTitle}>{t("appointmentHistory") || "Past Visit Records"}</Text>
            {pastAppointments.map((item) => (
              <Card key={item.id} style={styles.pastCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardMainInfo}>
                    <Text style={styles.doctorName}>{item.doctorName || "Ophthalmologist"}</Text>
                    <Text style={styles.pastDateText}>{item.date} at {item.time}</Text>
                    {item.reason ? <Text style={styles.pastReasonText}>{item.reason}</Text> : null}
                  </View>
                  <StatusBadge status={item.status} size="sm" />
                </View>
                {item.status === "Completed" && item.encounterStatus === "completed" && item.encounterId ? (
                  <Button
                    title="View Visit Summary"
                    variant="outline"
                    size="sm"
                    icon="document-text-outline"
                    onPress={() => router.push(`/visit-summary/${item.encounterId}` as any)}
                    style={styles.summaryBtn}
                  />
                ) : null}
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  loadingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
    fontSize: typography.sizes.body,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl + 40,
  },
  headerGroup: {
    marginBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTextCol: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  eyebrow: {
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
    color: colors.teal800,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  title: {
    fontSize: typography.sizes.h1,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    marginTop: 4,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.errorBg,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.sizes.small,
  },
  sectionHeaderTitle: {
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  apptCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardMainInfo: {
    flex: 1,
    marginLeft: spacing.md,
    paddingRight: spacing.xs,
  },
  doctorName: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  reasonText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.md,
  },
  detailsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  detailText: {
    fontSize: typography.sizes.small,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  cancelBtn: {
    marginTop: spacing.md,
  },
  visitStartedNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.teal50,
    borderWidth: 1,
    borderColor: colors.teal200,
  },
  visitStartedText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
  },
  summaryBtn: {
    marginTop: spacing.md,
  },
  pastCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  pastDateText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  pastReasonText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 4,
  },
  emptyCard: {
    padding: spacing.xxl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.sizes.h3,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  emptySub: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
  },
  bookBtn: {
    marginTop: spacing.md,
  },
});
