import { Alert } from "../services/alert";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  createAppointment,
  getDoctorAvailability,
} from "../services/appointment";
import {
  getConnections,
  type Connection,
} from "../services/connections";
import { useLanguage } from "../services/i18n";

import AppShell from "../design/components/AppShell";
import Card from "../design/components/card";
import IconContainer from "../design/components/IconContainer";
import Button from "../design/components/Button";
import colors from "../design/tokens/colors";
import spacing from "../design/tokens/spacing";
import typography from "../design/tokens/typography";
import radius from "../design/tokens/radius";

import { useThemeRefresh } from "../providers/AppThemeProvider";
import { useNetwork } from "../providers/NetworkProvider";
type BookingDoctor = {
  id: string;
  name: string;
  specialty?: string;
};

const buildUpcomingDates = (count = 7) => {
  const items: string[] = [];
  const start = new Date();
  start.setHours(12, 0, 0, 0);
  for (let i = 0; i < count; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    items.push(date.toISOString().slice(0, 10));
  }
  return items;
};

const dates = buildUpcomingDates(7);

export default function BookAppointmentScreen() {
  useThemeRefresh();
  const { isOnline } = useNetwork();
  const router = useRouter();
  const params = useLocalSearchParams();
  const requestedDoctorId = Array.isArray(params.doctorId) ? params.doctorId[0] : params.doctorId;
  const { t } = useLanguage();

  const [doctors, setDoctors] = useState<BookingDoctor[]>([]);
  const [times, setTimes] = useState<string[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);

  const [selectedDoctor, setSelectedDoctor] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setDoctors([]);
      setLoadingDoctors(false);
      return;
    }
    getConnections()
      .then(({ connections }) => {
        const accepted = connections.filter(
          (item: Connection) => item.status === "accepted"
        );

        const mappedDoctors: BookingDoctor[] = accepted.map((item) => ({
          id: item.doctorId,
          name: item.person.name || "Doctor",
          specialty: item.person.specialization,
        }));

        setDoctors(mappedDoctors);

        const requested = requestedDoctorId
          ? accepted.find((item) => item.doctorId === requestedDoctorId)
          : undefined;
        if (requested) {
          setSelectedDoctor(requested.doctorId);
        } else if (!selectedDoctor && accepted[0]) {
          setSelectedDoctor(accepted[0].doctorId);
        }
      })
      .catch(() => {
        setDoctors([]);
      })
      .finally(() => {
        setLoadingDoctors(false);
      });
  }, [requestedDoctorId, isOnline]);

  useEffect(() => {
    if (!isOnline || !selectedDoctor || !selectedDate) {
      setTimes([]);
      setSelectedTime("");
      return;
    }

    getDoctorAvailability(selectedDoctor, selectedDate)
      .then((availableTimes) => {
        setTimes(availableTimes);
        setSelectedTime((currentTime) =>
          availableTimes.includes(currentTime) ? currentTime : ""
        );
      })
      .catch(() => {
        setTimes([]);
        setSelectedTime("");
      });
  }, [selectedDoctor, selectedDate, isOnline]);

  const handleBookAppointment = async () => {
    if (!isOnline) {
      Alert.alert("Internet required", "Appointment slots can change while you are offline. Reconnect before sending a booking request; EyeCare AI will never show an appointment as confirmed until the server accepts it.");
      return;
    }
    if (!selectedDoctor) {
      Alert.alert(t("selectDoctor") || "Select Doctor", t("selectDoctorError") || "Please select a doctor.");
      return;
    }

    if (!selectedDate) {
      Alert.alert(t("selectDate") || "Select Date", t("selectDateError") || "Please select a visit date.");
      return;
    }

    if (!selectedTime) {
      Alert.alert(t("selectTime") || "Select Time", t("selectTimeError") || "Please select a time slot.");
      return;
    }

    if (!reason.trim()) {
      Alert.alert(t("reasonRequired") || "Reason Required", t("reasonRequiredMessage") || "Please describe the reason for your visit.");
      return;
    }

    try {
      setSubmitting(true);

      await createAppointment({
        doctorId: selectedDoctor,
        date: selectedDate,
        time: selectedTime,
        reason: reason.trim(),
      });

      Alert.alert(
        t("appointmentRequested") || "Appointment Requested",
        t("appointmentRequestedMessage") || "Your appointment request has been submitted.",
        [
          {
            text: t("viewAppointments") || "View Appointments",
            onPress: () => router.replace("/appointments" as any),
          },
        ]
      );
    } catch (error: any) {
      console.error("Book appointment error:", error);
      Alert.alert(t("unableToBook") || "Booking Error", error?.message || t("unableToBookAppointment") || "Could not book appointment.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedDoctorData = doctors.find((doc) => doc.id === selectedDoctor);

  return (
    <AppShell role="Patient" title={t("bookAppointment") || "Book Appointment"} showBack onBackPress={() => router.back()}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerGroup}>
          <Text style={styles.eyebrow}>CARE SCHEDULING</Text>
          <Text style={styles.title}>{t("bookAppointment") || "Book Consultation"}</Text>
          <Text style={styles.subtitle}>{t("scheduleVisit") || "Select a clinician, date, and time slot to book your appointment."}</Text>
        </View>

        {!isOnline ? (
          <Card style={styles.offlineCard}>
            <Ionicons name="cloud-offline-outline" size={22} color={colors.warning} />
            <View style={styles.offlineMain}>
              <Text style={styles.offlineTitle}>Booking needs an internet connection</Text>
              <Text style={styles.offlineText}>You can view synchronized upcoming appointments offline, but new bookings are not queued because a time slot may be taken by someone else.</Text>
            </View>
          </Card>
        ) : null}

        {/* Doctor Selection */}
        <Text style={styles.sectionHeaderTitle}>{t("selectDoctor") || "1. Select Doctor"}</Text>
        {loadingDoctors ? (
          <ActivityIndicator size="small" color={colors.teal800} style={styles.loader} />
        ) : doctors.length === 0 ? (
          <Card style={styles.emptyDoctorCard} onPress={() => router.push("/connections" as any)}>
            <IconContainer name="person-add-outline" size={24} color={colors.teal800} backgroundColor={colors.teal100} />
            <View style={styles.emptyDoctorMain}>
              <Text style={styles.emptyDoctorTitle}>{t("noConnectedDoctors") || "No Connected Doctors Found"}</Text>
              <Text style={styles.emptyDoctorSub}>{t("openMyDoctors") || "Tap here to connect with a doctor first."}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Card>
        ) : (
          doctors.map((doctor) => {
            const isSelected = selectedDoctor === doctor.id;
            return (
              <TouchableOpacity
                key={doctor.id}
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedDoctor(doctor.id);
                  setSelectedTime("");
                }}
              >
                <Card style={[styles.doctorCard, isSelected && styles.selectedDoctorCard]}>
                  <View style={styles.doctorRow}>
                    <IconContainer name="medical-outline" size={22} color={isSelected ? colors.white : colors.teal800} backgroundColor={isSelected ? colors.teal800 : colors.teal100} />
                    <View style={styles.doctorInfoCol}>
                      <Text style={[styles.doctorNameText, isSelected && styles.selectedText]}>{doctor.name}</Text>
                      <Text style={[styles.doctorSpecialtyText, isSelected && styles.selectedSubText]}>{doctor.specialty || "Ophthalmologist"}</Text>
                    </View>
                    <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                      {isSelected && <View style={styles.radioDot} />}
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })
        )}

        {/* Date Selection */}
        <Text style={styles.sectionHeaderTitle}>{t("selectDate") || "2. Select Date"}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.datesRow}>
          {dates.map((date) => {
            const isSelected = selectedDate === date;
            const dateObj = new Date(`${date}T00:00:00`);
            const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });
            const dayNum = dateObj.getDate();
            const monthName = dateObj.toLocaleDateString("en-US", { month: "short" });

            return (
              <TouchableOpacity
                key={date}
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedDate(date);
                  setSelectedTime("");
                }}
              >
                <Card style={[styles.dateChip, isSelected && styles.selectedDateChip]}>
                  <Text style={[styles.dayNameText, isSelected && styles.selectedSubText]}>{dayName}</Text>
                  <Text style={[styles.dayNumText, isSelected && styles.selectedText]}>{dayNum}</Text>
                  <Text style={[styles.monthNameText, isSelected && styles.selectedSubText]}>{monthName}</Text>
                </Card>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Time Slots */}
        <Text style={styles.sectionHeaderTitle}>{t("selectTime") || "3. Select Available Time"}</Text>
        <View style={styles.timeGrid}>
          {!selectedDate ? (
            <Text style={styles.helperText}>{t("selectDateFirst") || "Please select a date above to view available slots."}</Text>
          ) : times.length === 0 ? (
            <Text style={styles.helperText}>{t("noAvailability") || "No slots currently published for this date."}</Text>
          ) : (
            times.map((time) => {
              const isSelected = selectedTime === time;
              return (
                <TouchableOpacity
                  key={time}
                  activeOpacity={0.8}
                  onPress={() => setSelectedTime(time)}
                  style={[styles.timeBtn, isSelected && styles.selectedTimeBtn]}
                >
                  <Text style={[styles.timeBtnText, isSelected && styles.selectedText]}>{time}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Reason Input */}
        <Text style={styles.sectionHeaderTitle}>{t("reasonForVisit") || "4. Reason for Visit"}</Text>
        <Card style={styles.reasonCard}>
          <TextInput
            style={styles.reasonInput}
            placeholder={t("reasonPlaceholder") || "Describe symptoms, eye conditions, or consultation needs..."}
            placeholderTextColor={colors.textMuted}
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </Card>

        {/* Summary Card */}
        <Card variant="elevated" style={styles.summaryCard}>
          <Text style={styles.summaryCardTitle}>{t("appointmentSummary") || "Booking Summary"}</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t("doctor") || "Doctor"}:</Text>
            <Text style={styles.summaryVal}>{selectedDoctorData?.name || (t("notSelected") || "Not Selected")}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t("date") || "Date"}:</Text>
            <Text style={styles.summaryVal}>{selectedDate || (t("notSelected") || "Not Selected")}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t("time") || "Time"}:</Text>
            <Text style={styles.summaryVal}>{selectedTime || (t("notSelected") || "Not Selected")}</Text>
          </View>
        </Card>

        {/* Submit */}
        <Button
          title={submitting ? "Submitting Booking..." : (t("confirmAppointment") || "Confirm Appointment")}
          icon="checkmark-circle-outline"
          onPress={handleBookAppointment}
          loading={submitting}
          disabled={submitting || !isOnline}
          style={styles.submitBtn}
        />
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  offlineCard: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, backgroundColor: colors.warningBg, borderWidth: 1, borderColor: colors.warningBorder, marginBottom: spacing.lg },
  offlineMain: { flex: 1 },
  offlineTitle: { color: colors.textPrimary, fontSize: typography.sizes.small, fontWeight: typography.weights.bold },
  offlineText: { color: colors.textSecondary, fontSize: typography.sizes.xs, lineHeight: 18, marginTop: 3 },
  scrollContent: {
    paddingBottom: spacing.xxxl + 40,
  },
  headerGroup: {
    marginBottom: spacing.lg,
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
  sectionHeaderTitle: {
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  loader: {
    marginVertical: spacing.md,
  },
  emptyDoctorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  emptyDoctorMain: {
    flex: 1,
    marginLeft: spacing.md,
  },
  emptyDoctorTitle: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  emptyDoctorSub: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  doctorCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  selectedDoctorCard: {
    backgroundColor: colors.teal800,
    borderColor: colors.teal900,
  },
  doctorRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  doctorInfoCol: {
    flex: 1,
    marginLeft: spacing.md,
  },
  doctorNameText: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  doctorSpecialtyText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  selectedText: {
    color: colors.white,
  },
  selectedSubText: {
    color: colors.teal100,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircleSelected: {
    borderColor: colors.white,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.white,
  },
  datesRow: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dateChip: {
    width: 76,
    height: 90,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  selectedDateChip: {
    backgroundColor: colors.teal800,
    borderColor: colors.teal900,
  },
  dayNameText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    fontWeight: typography.weights.semibold,
  },
  dayNumText: {
    fontSize: typography.sizes.h2,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginVertical: 2,
  },
  monthNameText: {
    fontSize: typography.sizes.tiny,
    color: colors.textMuted,
  },
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  helperText: {
    fontSize: typography.sizes.small,
    color: colors.textMuted,
    paddingVertical: spacing.xs,
  },
  timeBtn: {
    width: "30%",
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  selectedTimeBtn: {
    backgroundColor: colors.teal800,
    borderColor: colors.teal900,
  },
  timeBtnText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  reasonCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.lg,
  },
  reasonInput: {
    minHeight: 100,
    color: colors.textPrimary,
    fontSize: typography.sizes.body,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.lg,
  },
  summaryCardTitle: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: typography.sizes.small,
    color: colors.textMuted,
  },
  summaryVal: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.bold,
    color: colors.teal900,
  },
  submitBtn: {
    marginTop: spacing.xs,
  },
});
