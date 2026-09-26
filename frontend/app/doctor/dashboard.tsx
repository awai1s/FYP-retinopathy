import React, { useCallback, useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { getUserRole } from "../../services/storage";
import { getProfile } from "../../services/auth";
import { getDoctorAppointments, Appointment } from "../../services/appointment";
import { startConsultation } from "../../services/consultations";
import { useLanguage } from "../../services/i18n";
import { getConversations } from "../../services/messages";
import AppShell from "../../design/components/AppShell";
import Card from "../../design/components/card";
import IconContainer from "../../design/components/IconContainer";
import StatusBadge from "../../design/components/StatusBadge";
import Button from "../../design/components/Button";
import ProviderVerificationBanner from "../../components/ProviderVerificationBanner";
import { getProviderVerification, type ProviderVerification } from "../../services/providerVerification";
import { getDoctorWatchlist, type DoctorWatchlistEntry } from "../../services/watchlist";
import colors from "../../design/tokens/colors";
import spacing from "../../design/tokens/spacing";
import typography from "../../design/tokens/typography";

import { useThemeRefresh } from "../../providers/AppThemeProvider";

const watchlistReviewLabel = (value?: string | null) => {
  if (!value) return "Review not scheduled";
  const target = new Date(`${value}T00:00:00`);
  if (Number.isNaN(target.getTime())) return value;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diff = Math.round((targetDay.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return "Review overdue";
  if (diff === 0) return "Review Today";
  if (diff === 1) return "Review Tomorrow";
  return target.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export default function DoctorDashboard() {
  useThemeRefresh();
  const { t } = useLanguage();
  const [doctorName, setDoctorName] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [verification, setVerification] = useState<ProviderVerification | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<DoctorWatchlistEntry[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const role = await getUserRole();
        if (role !== "Doctor") {
          if (role === "Patient") router.replace("/tabs/dashboard" as any);
          else if (role === "Hospital") router.replace("/hospital/dashboard" as any);
          else if (role === "SuperAdmin") router.replace("/superadmin/dashboard" as any);
          else router.replace("/auth/login" as any);
          return;
        }

        const profile = await getProfile();
        setDoctorName(profile.name || "Doctor");
        const verificationData = await getProviderVerification();
        setVerification(verificationData);

        const restricted = verificationData.status !== "verified" || verificationData.accountStatus !== "active";
        if (restricted) return;

        try {
          const appts = await getDoctorAppointments();
          setAppointments(appts);
        } catch (err) {
          console.warn("Failed to load doctor appointments:", err);
        }

        try {
          const messageData = await getConversations();
          setUnreadMessages((messageData.conversations || []).reduce((total, item) => total + (item.unreadCount || 0), 0));
        } catch (err) {
          console.warn("Doctor dashboard messages fetch fallback:", err);
        }

        try {
          const watchlistData = await getDoctorWatchlist(4);
          setWatchlist(watchlistData.watchlist || []);
        } catch (err) {
          console.warn("Doctor dashboard watchlist fetch fallback:", err);
        }
      } catch {
        router.replace("/auth/login" as any);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (verification?.status !== "verified" || verification?.accountStatus !== "active") return;
      getDoctorWatchlist(4)
        .then((data) => setWatchlist(data.watchlist || []))
        .catch((err) => console.warn("Doctor dashboard watchlist refresh fallback:", err));
    }, [verification?.status, verification?.accountStatus])
  );

  const actionCards = [
    {
      icon: "search-outline" as const,
      color: colors.teal800,
      bgColor: colors.teal100,
      title: t("searchPatient") || "Search Patient",
      description: t("searchPatientDescription") || "Find patient profile, screenings, and history",
      route: "/doctor/search-patient",
    },
    {
      icon: "document-text-outline" as const,
      color: colors.warning,
      bgColor: colors.warningBg,
      title: t("aiReports") || "AI Reports Summary",
      description: t("aiReportsDescription") || "Review AI grading & patient risk diagnoses",
      route: "/doctor-summary",
    },
    {
      icon: "medical-outline" as const,
      color: colors.teal700,
      bgColor: colors.teal50,
      title: "Clinical Tools",
      description: "Review alerts & record patient care actions",
      route: "/doctor/tools",
    },
    {
      icon: "people-outline" as const,
      color: colors.info,
      bgColor: colors.infoBg,
      title: "My Connected Patients",
      description: "Manage active consultations & care connections",
      route: "/doctor/connections",
    },
    {
      icon: "bookmark-outline" as const,
      color: colors.warning,
      bgColor: colors.warningBg,
      title: "Case Watchlist",
      description: "Return quickly to important cases and review reminders",
      route: "/doctor/watchlist",
    },
    {
      icon: "calendar-outline" as const,
      color: colors.teal900,
      bgColor: colors.teal100,
      title: t("appointments") || "Appointments",
      description: t("appointmentsDescription") || "View today's schedule & pending requests",
      route: "/doctor/appointments",
    },
    {
      icon: "clipboard-outline" as const,
      color: colors.teal800,
      bgColor: colors.teal50,
      title: "Consultation Cockpit",
      description: "Continue drafts and review completed clinical encounters",
      route: "/doctor/consultations",
    },
    {
      icon: "chatbubbles-outline" as const,
      color: colors.teal800,
      bgColor: colors.teal50,
      title: t("messages") || "Messages",
      description: "Chat securely with connected patients",
      route: "/messages",
      badge: unreadMessages,
    },
    {
      icon: "notifications-outline" as const,
      color: colors.info,
      bgColor: colors.infoBg,
      title: t("notifications") || "Notifications",
      description: t("notificationsDescription") || "Check urgent clinical alerts & updates",
      route: "/notifications",
    },
  ];

  const openConsultation = async (appointment: Appointment) => {
    try {
      setStartingId(appointment.id);
      if (appointment.encounterId) {
        router.push(`/doctor/consultation/${appointment.encounterId}` as any);
        return;
      }
      const encounter = await startConsultation(appointment.id);
      router.push(`/doctor/consultation/${encounter.id}` as any);
    } catch (err: any) {
      console.warn("Unable to start consultation:", err);
    } finally {
      setStartingId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.teal800} />
      </View>
    );
  }

  if (verification && (verification.status !== "verified" || verification.accountStatus !== "active")) {
    return (
      <AppShell role="Doctor" title="Doctor Portal" userName={`Dr. ${doctorName}`} showAssistant={false}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.welcomeContainer}>
            <Text style={styles.greetingEyebrow}>CLINICIAN ACCOUNT</Text>
            <Text style={styles.welcomeTitle}>Welcome, Dr. {doctorName}</Text>
            <Text style={styles.welcomeSubtitle}>Clinical tools remain locked until provider verification is approved.</Text>
          </View>
          <ProviderVerificationBanner status={verification.status} accountStatus={verification.accountStatus} decisionReason={verification.decisionReason} />
          <Text style={styles.sectionTitle}>Available while verification is pending</Text>
          <View style={styles.cardsGrid}>
            <Card onPress={() => router.push("/provider-verification" as any)} style={styles.actionCard}>
              <Text style={styles.cardTitle}>Provider Verification</Text>
              <Text style={styles.cardDesc}>Complete professional details, upload credentials, and track the review decision.</Text>
            </Card>
            <Card onPress={() => router.push("/doctor/profile" as any)} style={styles.actionCard}>
              <Text style={styles.cardTitle}>Profile</Text>
              <Text style={styles.cardDesc}>Review your account and professional profile information.</Text>
            </Card>
            <Card onPress={() => router.push("/notifications" as any)} style={styles.actionCard}>
              <Text style={styles.cardTitle}>Notifications</Text>
              <Text style={styles.cardDesc}>See verification updates and administrative messages.</Text>
            </Card>
            <Card onPress={() => router.push("/settings" as any)} style={styles.actionCard}>
              <Text style={styles.cardTitle}>Appearance & Accessibility</Text>
              <Text style={styles.cardDesc}>Theme, Eye-Friendly Mode, text size, and motion preferences.</Text>
            </Card>
          </View>
        </ScrollView>
      </AppShell>
    );
  }

  const pendingCount = appointments.filter((a) => a.status === "Pending").length;
  const confirmedCount = appointments.filter((a) => a.status === "Confirmed").length;

  return (
    <AppShell role="Doctor" title="Doctor Portal" userName={`Dr. ${doctorName}`}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Welcome Banner */}
        <View style={styles.welcomeContainer}>
          <Text style={styles.greetingEyebrow}>{t("doctorPortal") || "CLINICIAN DASHBOARD"}</Text>
          <Text style={styles.welcomeTitle}>
            {t("welcome") || "Welcome"}, Dr. {doctorName}
          </Text>
          <Text style={styles.welcomeSubtitle}>
            Overview of todays appointments, patient screenings, and clinical tasks.
          </Text>
        </View>

        {/* Doctor Summary Overview */}
        <Card variant="elevated" style={styles.statsBanner}>
          <Text style={styles.sectionHeader}>TODAYS OVERVIEW</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Total Schedule</Text>
              <Text style={styles.statValue}>{appointments.length}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Confirmed</Text>
              <Text style={styles.statValue}>{confirmedCount}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Pending Review</Text>
              <Text style={styles.statValue}>{pendingCount}</Text>
            </View>
          </View>
        </Card>

        {/* Quick Search Hero Card */}
        <Card variant="accent" style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={styles.heroTextContent}>
              <Text style={styles.heroTitle}>Patient Search</Text>
              <Text style={styles.heroDesc}>
                Quickly locate patient records, retinal image history, or issue new prescriptions.
              </Text>
              <Button
                title={t("searchPatient") || "Search Patient"}
                icon="search-outline"
                onPress={() => router.push("/doctor/search-patient" as any)}
                style={styles.heroBtn}
              />
            </View>
            <IconContainer
              name="search-outline"
              size={30}
              color={colors.teal900}
              backgroundColor={colors.surface}
            />
          </View>
        </Card>

        {/* Doctor Features */}
        <Text style={styles.sectionTitle}>Doctor Management & Tools</Text>
        <View style={styles.cardsGrid}>
          {actionCards.map((card) => (
            <Card
              key={card.route + card.title}
              onPress={() => router.push(card.route as any)}
              style={styles.actionCard}
              accessibilityLabel={`${card.title}. ${card.description}`}
            >
              <View style={styles.cardHeaderRow}>
                <View style={styles.iconSlot}>
                  <IconContainer
                    name={card.icon}
                    size={24}
                    color={card.color}
                    backgroundColor={card.bgColor}
                  />
                  {typeof card.badge === "number" && card.badge > 0 ? <View style={styles.unreadBadge}><Text style={styles.unreadBadgeText}>{card.badge > 99 ? "99+" : card.badge}</Text></View> : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>

              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardDesc}>{card.description}</Text>
            </Card>
          ))}
        </View>

        {/* Private Doctor Watchlist Preview */}
        <View style={styles.watchlistSection}>
          <View style={styles.sectionTitleRow}>
            <View>
              <Text style={styles.sectionEyebrow}>PRIVATE CASE MANAGEMENT</Text>
              <Text style={styles.sectionTitleNoMargin}>Watchlist</Text>
            </View>
            <Button title="View All" variant="outline" size="sm" icon="bookmark-outline" onPress={() => router.push("/doctor/watchlist" as any)} />
          </View>

          {watchlist.length ? (
            watchlist.map((item) => (
              <Card key={item.id} style={[styles.watchlistCard, item.priority === "important" && styles.watchlistImportant]}>
                <View style={styles.watchlistRow}>
                  <View style={styles.watchlistMain}>
                    <View style={styles.watchlistNameRow}>
                      <Text style={styles.patientName}>{item.patientName}</Text>
                      {item.priority === "important" ? (
                        <View style={styles.importantPill}>
                          <Ionicons name="alert-circle" size={12} color={colors.warning} />
                          <Text style={styles.importantPillText}>IMPORTANT</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.watchlistReason} numberOfLines={2}>{item.reason}</Text>
                    <Text style={styles.watchlistReview}>{watchlistReviewLabel(item.reviewDate)}</Text>
                    {!item.accessAvailable ? <Text style={styles.watchlistLocked}>Clinical access revoked — bookmark retained privately.</Text> : null}
                  </View>
                  <Button
                    title={item.accessAvailable ? "Open" : "Locked"}
                    size="sm"
                    variant={item.accessAvailable ? "outline" : "ghost"}
                    icon={item.accessAvailable ? "folder-open-outline" : "lock-closed-outline"}
                    disabled={!item.accessAvailable}
                    onPress={() => router.push({ pathname: "/doctor/patient-profile", params: { patientId: item.patientId } } as any)}
                  />
                </View>
              </Card>
            ))
          ) : (
            <Card style={styles.watchlistEmpty}>
              <Text style={styles.watchlistEmptyTitle}>No cases bookmarked yet</Text>
              <Text style={styles.watchlistEmptyText}>Add a connected patient to your private watchlist when you want a reminder to review the case again.</Text>
            </Card>
          )}
        </View>

        {/* Appointments Preview */}
        {appointments.length > 0 && (
          <View style={styles.appointmentsSection}>
            <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
            {appointments.slice(0, 3).map((appt) => (
              <Card key={appt.id} style={styles.apptCard}>
                <View style={styles.apptRow}>
                  <View style={styles.apptInfo}>
                    <Text style={styles.patientName}>{appt.patientName || "Patient"}</Text>
                    <Text style={styles.apptTime}>
                      {appt.date} at {appt.time}
                    </Text>
                    {appt.reason ? <Text style={styles.apptReason}>{appt.reason}</Text> : null}
                  </View>
                  <StatusBadge status={appt.status} />
                </View>
                {appt.status === "Confirmed" ? (
                  <Button
                    title={appt.encounterId ? "Continue Consultation" : "Start Consultation"}
                    icon={appt.encounterId ? "arrow-forward-outline" : "medical-outline"}
                    size="sm"
                    loading={startingId === appt.id}
                    onPress={() => void openConsultation(appt)}
                    style={styles.consultBtn}
                  />
                ) : null}
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.pageBackground,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  welcomeContainer: {
    marginBottom: spacing.lg,
  },
  greetingEyebrow: {
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
    color: colors.teal800,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  welcomeTitle: {
    fontSize: typography.sizes.h1,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  welcomeSubtitle: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    marginTop: 4,
  },
  statsBanner: {
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
  },
  sectionHeader: {
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
    color: colors.teal800,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: spacing.sm,
  },
  statItem: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginBottom: 2,
  },
  statValue: {
    fontSize: typography.sizes.h2,
    fontWeight: typography.weights.bold,
    color: colors.teal900,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.borderLight,
  },
  heroCard: {
    marginBottom: spacing.xl,
    backgroundColor: colors.teal50,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroTextContent: {
    flex: 1,
    paddingRight: spacing.md,
  },
  heroTitle: {
    fontSize: typography.sizes.h3,
    fontWeight: typography.weights.bold,
    color: colors.teal900,
    marginBottom: 4,
  },
  heroDesc: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  heroBtn: {
    alignSelf: "flex-start",
  },
  sectionTitle: {
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  cardsGrid: {
    gap: spacing.md,
  },
  actionCard: {
    backgroundColor: colors.surface,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  iconSlot: { position: "relative" },
  unreadBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: colors.teal800,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.xs,
  },
  unreadBadgeText: {
    color: colors.white,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
  },
  cardDesc: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  watchlistSection: {
    marginTop: spacing.xl,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sectionEyebrow: {
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
    color: colors.teal800,
    letterSpacing: 1,
    marginBottom: 2,
  },
  sectionTitleNoMargin: {
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  watchlistCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  watchlistImportant: {
    borderWidth: 1,
    borderColor: colors.warning,
  },
  watchlistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  watchlistMain: {
    flex: 1,
    minWidth: 0,
  },
  watchlistNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  importantPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 999,
    backgroundColor: colors.warningBg,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  importantPillText: {
    color: colors.warning,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
  },
  watchlistReason: {
    color: colors.textSecondary,
    fontSize: typography.sizes.small,
    marginTop: 3,
  },
  watchlistReview: {
    color: colors.teal800,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    marginTop: 5,
  },
  watchlistLocked: {
    color: colors.warning,
    fontSize: typography.sizes.tiny,
    marginTop: 4,
  },
  watchlistEmpty: {
    backgroundColor: colors.surface,
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  watchlistEmptyTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
  },
  watchlistEmptyText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.small,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
  appointmentsSection: {
    marginTop: spacing.xl,
  },
  apptCard: {
    marginBottom: spacing.sm,
  },
  apptRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  apptInfo: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  patientName: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  apptTime: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  apptReason: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 4,
  },
  consultBtn: {
    marginTop: spacing.sm,
  },
});
