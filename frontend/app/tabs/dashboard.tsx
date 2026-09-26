import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { getUserRole } from "../../services/storage";
import { getProfile } from "../../services/auth";
import { getPatientDashboard, PatientDashboard as PatientDashboardData } from "../../services/patient";
import { useLanguage } from "../../services/i18n";
import { getConversations } from "../../services/messages";
import { AccessLog, getPrivacySummary } from "../../services/privacy";
import { isLikelyNetworkError } from "../../services/offlineCache";
import AppShell from "../../design/components/AppShell";
import Card from "../../design/components/card";
import IconContainer from "../../design/components/IconContainer";
import StatusBadge from "../../design/components/StatusBadge";
import Button from "../../design/components/Button";
import colors from "../../design/tokens/colors";
import spacing from "../../design/tokens/spacing";
import typography from "../../design/tokens/typography";
import radius from "../../design/tokens/radius";
import shadows from "../../design/tokens/shadows";

import { useThemeRefresh } from "../../providers/AppThemeProvider";
export default function PatientDashboard() {
  useThemeRefresh();
  const { t, language } = useLanguage();
  const isUrdu = language === "ur";
  const { width } = useWindowDimensions();
  const twoColumn = width >= 760;

  const [patientName, setPatientName] = useState("");
  const [dashboardData, setDashboardData] = useState<PatientDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [recentPrivacy, setRecentPrivacy] = useState<AccessLog[]>([]);

  const load = useCallback(async () => {
    try {
      setDashboardError("");
      const role = await getUserRole();
      if (role !== "Patient") {
        if (role === "Doctor") router.replace("/doctor/dashboard" as any);
        else if (role === "Hospital") router.replace("/hospital/dashboard" as any);
        else router.replace("/auth/login" as any);
        return;
      }

      try {
        const profile = await getProfile();
        setPatientName(profile.name || profile.username || "Patient");
      } catch (error) {
        // A valid stored patient session may still use the deliberately limited offline cache.
        if (!isLikelyNetworkError(error)) {
          router.replace("/auth/login" as any);
          return;
        }
        setPatientName((current) => current || "Patient");
      }

      try {
        setDashboardData(await getPatientDashboard());
      } catch (err: any) {
        setDashboardError(err?.message || "Some dashboard health data could not be loaded.");
      }

      try {
        const messageData = await getConversations();
        setUnreadMessages((messageData.conversations || []).reduce((total, item) => total + (item.unreadCount || 0), 0));
      } catch {
        // Messaging is optional while its backend contract is being completed.
      }

      try {
        const privacy = await getPrivacySummary();
        setRecentPrivacy((privacy.recentAccess || []).slice(0, 2));
      } catch {
        setRecentPrivacy([]);
      }
    } catch {
      router.replace("/auth/login" as any);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const firstName = useMemo(() => patientName.trim().split(/\s+/)[0] || "Patient", [patientName]);

  const actionCards = [
    { icon: "eye-outline" as const, color: colors.info, bgColor: colors.infoBg, title: t("visionTests") || "Vision tests", description: "Run guided at-home vision checks and keep results in one place.", route: "/vision-tests" },
    { icon: "git-compare-outline" as const, color: colors.teal800, bgColor: colors.teal100, title: "Vision Simulator", description: "Explore how visual changes can affect familiar scenes.", route: "/vision-simulator" },
    { icon: "library-outline" as const, color: colors.teal800, bgColor: colors.teal100, title: "Learn & Eye Health", description: "Read trusted eye-health education and doctor-recommended learning.", route: "/education" },
    { icon: "calendar-outline" as const, color: colors.teal700, bgColor: colors.teal50, title: t("appointments") || "Appointments", description: "Book and manage upcoming consultations with your care team.", route: "/appointments" },
    { icon: "location-outline" as const, color: colors.info, bgColor: colors.infoBg, title: "Clinic locator", description: "Find nearby eye hospitals and ophthalmology clinics using your location.", route: "/clinic-locator" },
    { icon: "medkit-outline" as const, color: colors.warning, bgColor: colors.warningBg, title: t("prescriptions") || "Medication", description: "Track medicines, reminders and adherence without losing dose history.", route: "/prescriptions" },
    { icon: "stats-chart-outline" as const, color: colors.teal900, bgColor: colors.teal100, title: t("analytics") || "Progress", description: "See HbA1c, risk, DR stage and medication trends over time.", route: "/analytics" },
    { icon: "people-outline" as const, color: colors.teal800, bgColor: colors.teal50, title: t("myDoctors") || "My doctors", description: "Manage approved clinicians and care connections.", route: "/connections" },
    { icon: "chatbubbles-outline" as const, color: colors.teal800, bgColor: colors.teal50, title: t("messages") || "Messages", description: "Continue secure conversations with your connected clinicians.", route: "/messages", badge: unreadMessages },
    { icon: "notifications-outline" as const, color: colors.info, bgColor: colors.infoBg, title: t("notifications") || "Notifications", description: "Review appointment, medication and care updates.", route: "/notifications" },
    { icon: "shield-checkmark-outline" as const, color: colors.teal800, bgColor: colors.teal100, title: "Privacy & Access", description: "See clinical access activity, connected providers and active QR shares.", route: "/privacy" },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingOrb}><ActivityIndicator size="large" color={colors.navyInk} /></View>
        <Text style={styles.loadingText}>Preparing your health workspace...</Text>
      </View>
    );
  }

  return (
    <AppShell role="Patient" title="EyeCare AI" subtitle="Patient health workspace" userName={patientName}>
      <View style={[styles.welcomeRow, isUrdu && styles.rtlRow]}>
        <View style={styles.welcomeTextGroup}>
          <Text style={[styles.greetingEyebrow, isUrdu && styles.urduText]}>YOUR HEALTH, AT A GLANCE</Text>
          <Text style={[styles.welcomeTitle, isUrdu && styles.urduText]}>Welcome back, {firstName}</Text>
          <Text style={[styles.welcomeSubtitle, isUrdu && styles.urduText]}>
            Track screening, diabetes risk, medicines and specialist care from one secure workspace.
          </Text>
        </View>
        <View style={styles.secureChip}>
          <Ionicons name="shield-checkmark" size={15} color={colors.teal800} />
          <Text style={styles.secureChipText}>Secure session</Text>
        </View>
      </View>

      {dashboardError ? (
        <View style={styles.warningCard}>
          <Ionicons name="cloud-offline-outline" size={20} color={colors.warning} />
          <View style={styles.warningMain}>
            <Text style={styles.warningTitle}>Some live data is unavailable</Text>
            <Text style={styles.warningText}>{dashboardError}</Text>
          </View>
          <Button title="Retry" size="sm" variant="outline" onPress={() => void load()} />
        </View>
      ) : null}

      <LinearGradient
        colors={["#06343A", "#07505A", "#087A73"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View pointerEvents="none" style={styles.heroGlow} />
        <View style={styles.heroContent}>
          <View style={styles.heroIconShell}>
            <Ionicons name="scan-outline" size={28} color={colors.navyInk} />
          </View>
          <View style={styles.heroTextContent}>
            <Text style={styles.heroEyebrow}>DIABETIC RETINOPATHY SCREENING</Text>
            <Text style={styles.heroTitle}>Ready for your next retinal check?</Text>
            <Text style={styles.heroDesc}>Upload a clear retinal image to keep your screening history and risk monitoring up to date.</Text>
            <Button title="Start screening" icon="cloud-upload-outline" iconPosition="right" onPress={() => router.push("/upload" as any)} style={styles.heroBtn} />
          </View>
        </View>
      </LinearGradient>

      <View style={styles.sectionHeadingRow}>
        <View>
          <Text style={[styles.sectionEyebrow, isUrdu && styles.urduText]}>LIVE SUMMARY</Text>
          <Text style={[styles.sectionTitle, isUrdu && styles.urduText]}>Health overview</Text>
        </View>
        <Button title="View progress" size="sm" variant="ghost" icon="arrow-forward" iconPosition="right" onPress={() => router.push("/analytics" as any)} />
      </View>

      <View style={styles.statGrid}>
        <MetricTile icon="eye-outline" label="Eye health" value={dashboardData?.stats.eyeHealth || "—"} tone="teal" />
        <MetricTile icon="scan-outline" label="Screenings" value={dashboardData?.stats.predictions || "0"} tone="blue" />
        <MetricTile icon="document-text-outline" label="Reports" value={dashboardData?.stats.reports || "0"} tone="amber" />
      </View>

      {dashboardData?.latestPrediction ? (
        <Card
          variant="elevated"
          style={styles.latestCard}
          onPress={
            dashboardData.latestPrediction.id
              ? () =>
                  router.push({
                    pathname: "/result",
                    params: { predictionId: dashboardData.latestPrediction!.id },
                  } as any)
              : undefined
          }
          accessibilityLabel="Open latest retinal screening"
        >
          <View style={[styles.latestHeader, isUrdu && styles.rtlRow]}>
            <IconContainer name="pulse-outline" size={23} color={colors.teal800} backgroundColor={colors.teal100} />
            <View style={styles.latestMain}>
              <Text style={[styles.latestEyebrow, isUrdu && styles.urduText]}>LATEST SCREENING</Text>
              <Text style={[styles.latestTitle, isUrdu && styles.urduText]}>{dashboardData.latestPrediction.stage}</Text>
              <Text style={[styles.latestMeta, isUrdu && styles.urduText]}>Confidence {dashboardData.latestPrediction.confidence} • {dashboardData.latestPrediction.date}</Text>
            </View>
            <StatusBadge status={dashboardData.latestPrediction.status} size="sm" />
          </View>
        </Card>
      ) : (
        <Card variant="bordered" style={styles.emptyScreeningCard}>
          <IconContainer name="eye-outline" backgroundColor={colors.teal50} />
          <View style={styles.emptyScreeningMain}>
            <Text style={styles.emptyScreeningTitle}>No screening result yet</Text>
            <Text style={styles.emptyScreeningText}>Your latest DR result will appear here after a retinal screening is processed.</Text>
          </View>
        </Card>
      )}

      <Card variant="bordered" style={styles.privacyCard}>
        <View style={styles.privacyHeader}>
          <View style={styles.privacyTitleRow}>
            <IconContainer name="shield-checkmark-outline" size={22} color={colors.teal800} backgroundColor={colors.teal100} />
            <View>
              <Text style={styles.privacyEyebrow}>PRIVACY ACTIVITY</Text>
              <Text style={styles.privacyTitle}>Recent access to your health information</Text>
            </View>
          </View>
          <Button title="View All Activity" size="sm" variant="ghost" onPress={() => router.push("/privacy" as any)} />
        </View>
        {recentPrivacy.length ? recentPrivacy.map((item, index) => (
          <View key={item.id} style={[styles.privacyEvent, index < recentPrivacy.length - 1 && styles.privacyEventDivider]}>
            <Ionicons name={item.accessChannel === "QR" ? "qr-code-outline" : "eye-outline"} size={18} color={item.accessChannel === "QR" ? colors.info : colors.teal800} />
            <View style={styles.privacyEventMain}>
              <Text style={styles.privacyActor}>{item.actorName}</Text>
              <Text style={styles.privacyAction}>{item.actionLabel}</Text>
              <Text style={styles.privacyMeta}>{formatPrivacyTime(item.createdAt)} • Via {item.accessChannel === "QR" ? "QR" : String(item.accessChannel || "Care Connection").replace(/_/g, " ")}</Text>
            </View>
          </View>
        )) : (
          <Text style={styles.privacyEmpty}>No clinical access activity has been recorded yet.</Text>
        )}
      </Card>

      <View style={styles.sectionHeadingSimple}>
        <Text style={[styles.sectionEyebrow, isUrdu && styles.urduText]}>CARE TOOLS</Text>
        <Text style={[styles.sectionTitle, isUrdu && styles.urduText]}>Everything you need</Text>
        <Text style={[styles.sectionSubtitle, isUrdu && styles.urduText]}>Open a tool to continue your health workflow.</Text>
      </View>

      <View style={styles.cardsGrid}>
        {actionCards.map((card) => (
          <Card
            key={card.route}
            onPress={() => router.push(card.route as any)}
            style={[styles.actionCard, twoColumn && styles.actionCardTwoColumn]}
            accessibilityLabel={`${card.title}. ${card.description}`}
          >
            <View style={[styles.cardHeaderRow, isUrdu && styles.rtlRow]}>
              <View style={styles.iconSlot}>
                <IconContainer name={card.icon} size={23} color={card.color} backgroundColor={card.bgColor} />
                {typeof card.badge === "number" && card.badge > 0 ? (
                  <View style={styles.unreadBadge}><Text style={styles.unreadBadgeText}>{card.badge > 99 ? "99+" : card.badge}</Text></View>
                ) : null}
              </View>
              <View style={styles.openIcon}><Ionicons name={isUrdu ? "arrow-back" : "arrow-forward"} size={16} color={colors.teal800} /></View>
            </View>
            <Text style={[styles.cardTitle, isUrdu && styles.urduText]}>{card.title}</Text>
            <Text style={[styles.cardDesc, isUrdu && styles.urduText]}>{card.description}</Text>
          </Card>
        ))}
      </View>
    </AppShell>
  );
}

function formatPrivacyTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "Recently";
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(diff / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function MetricTile({ icon, label, value, tone }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; tone: "teal" | "blue" | "amber" }) {
  const toneMap = {
    teal: { bg: colors.teal50, iconBg: colors.teal100, icon: colors.teal800 },
    blue: { bg: colors.infoBg, iconBg: "#DDF0FB", icon: colors.info },
    amber: { bg: colors.warningBg, iconBg: "#FCE7B1", icon: colors.warning },
  };
  const theme = toneMap[tone];
  return (
    <View style={[styles.metricTile, { backgroundColor: theme.bg }]}>
      <View style={[styles.metricIcon, { backgroundColor: theme.iconBg }]}><Ionicons name={icon} size={18} color={theme.icon} /></View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: colors.pageBackground, justifyContent: "center", alignItems: "center", gap: 14 },
  loadingOrb: { width: 66, height: 66, borderRadius: 22, backgroundColor: colors.neonAqua, alignItems: "center", justifyContent: "center", ...shadows.neon },
  loadingText: { color: colors.textSecondary, fontFamily: typography.fontFamily, fontSize: typography.sizes.body },
  welcomeRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.lg, marginBottom: spacing.xl, flexWrap: "wrap" },
  welcomeTextGroup: { flex: 1, minWidth: 240 },
  greetingEyebrow: { fontFamily: typography.headingFamily, fontSize: 9, fontWeight: typography.weights.extraBold, color: colors.teal800, letterSpacing: 1.35, marginBottom: 5 },
  welcomeTitle: { fontFamily: typography.headingFamily, fontSize: typography.sizes.h1, fontWeight: typography.weights.extraBold, color: colors.textPrimary, letterSpacing: -0.7 },
  welcomeSubtitle: { fontFamily: typography.fontFamily, fontSize: typography.sizes.body, color: colors.textSecondary, marginTop: 6, maxWidth: 620, lineHeight: 22 },
  secureChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.teal50, borderWidth: 1, borderColor: colors.teal200, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  secureChipText: { color: colors.teal800, fontFamily: typography.headingFamily, fontSize: typography.sizes.xs, fontWeight: typography.weights.bold },
  warningCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.warningBg, borderColor: colors.warningBorder, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg },
  warningMain: { flex: 1 },
  warningTitle: { color: colors.textPrimary, fontFamily: typography.headingFamily, fontSize: typography.sizes.small, fontWeight: typography.weights.bold },
  warningText: { color: colors.textSecondary, fontFamily: typography.fontFamily, fontSize: typography.sizes.xs, marginTop: 2 },
  heroCard: { borderRadius: radius.xxl, padding: spacing.xl, overflow: "hidden", marginBottom: spacing.xxl, borderWidth: 1, borderColor: "rgba(39,229,198,0.18)", ...shadows.floating },
  heroGlow: { position: "absolute", width: 210, height: 210, borderRadius: 105, backgroundColor: "rgba(39,229,198,0.12)", right: -70, top: -80 },
  heroContent: { flexDirection: "row", alignItems: "flex-start", gap: spacing.lg, flexWrap: "wrap" },
  heroIconShell: { width: 60, height: 60, borderRadius: 20, backgroundColor: colors.neonAqua, alignItems: "center", justifyContent: "center", shadowColor: colors.neonAqua, shadowOpacity: 0.32, shadowRadius: 15, elevation: 6 },
  heroTextContent: { flex: 1, minWidth: 230 },
  heroEyebrow: { color: colors.teal300, fontFamily: typography.headingFamily, fontSize: 9, fontWeight: typography.weights.extraBold, letterSpacing: 1.25, marginBottom: 5 },
  heroTitle: { color: colors.white, fontFamily: typography.headingFamily, fontSize: typography.sizes.h2, fontWeight: typography.weights.extraBold, letterSpacing: -0.45 },
  heroDesc: { color: colors.teal100, fontFamily: typography.fontFamily, fontSize: typography.sizes.small, lineHeight: 19, marginTop: 6, marginBottom: spacing.lg, maxWidth: 650 },
  heroBtn: { alignSelf: "flex-start" },
  sectionHeadingRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: spacing.md, marginBottom: spacing.md },
  sectionHeadingSimple: { marginTop: spacing.xxl, marginBottom: spacing.md },
  sectionEyebrow: { color: colors.teal800, fontFamily: typography.headingFamily, fontSize: 9, fontWeight: typography.weights.extraBold, letterSpacing: 1.3, marginBottom: 3 },
  sectionTitle: { color: colors.textPrimary, fontFamily: typography.headingFamily, fontSize: typography.sizes.h3, fontWeight: typography.weights.extraBold, letterSpacing: -0.2 },
  sectionSubtitle: { color: colors.textSecondary, fontFamily: typography.fontFamily, fontSize: typography.sizes.small, marginTop: 3 },
  statGrid: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.lg, flexWrap: "wrap" },
  metricTile: { flex: 1, minWidth: 110, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: "rgba(7,80,90,0.07)" },
  metricIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  metricValue: { color: colors.textPrimary, fontFamily: typography.headingFamily, fontSize: typography.sizes.h2, fontWeight: typography.weights.extraBold },
  metricLabel: { color: colors.textSecondary, fontFamily: typography.fontFamily, fontSize: typography.sizes.xs, marginTop: 1 },
  latestCard: { marginTop: 2 },
  latestHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  latestMain: { flex: 1 },
  latestEyebrow: { color: colors.teal800, fontFamily: typography.headingFamily, fontSize: 9, fontWeight: typography.weights.extraBold, letterSpacing: 1.1 },
  latestTitle: { color: colors.textPrimary, fontFamily: typography.headingFamily, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.extraBold, marginTop: 2 },
  latestMeta: { color: colors.textSecondary, fontFamily: typography.fontFamily, fontSize: typography.sizes.xs, marginTop: 3 },
  emptyScreeningCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  emptyScreeningMain: { flex: 1 },
  emptyScreeningTitle: { color: colors.textPrimary, fontFamily: typography.headingFamily, fontSize: typography.sizes.body, fontWeight: typography.weights.bold },
  emptyScreeningText: { color: colors.textSecondary, fontFamily: typography.fontFamily, fontSize: typography.sizes.xs, lineHeight: 17, marginTop: 3 },
  privacyCard: { marginTop: spacing.xl, marginBottom: spacing.xl },
  privacyHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap", marginBottom: spacing.sm },
  privacyTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1, minWidth: 240 },
  privacyEyebrow: { color: colors.teal800, fontSize: 9, fontWeight: typography.weights.extraBold, letterSpacing: 1.1 },
  privacyTitle: { color: colors.textPrimary, fontSize: typography.sizes.small, fontWeight: typography.weights.bold, marginTop: 2 },
  privacyEvent: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingVertical: spacing.sm },
  privacyEventDivider: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  privacyEventMain: { flex: 1 },
  privacyActor: { color: colors.textPrimary, fontSize: typography.sizes.small, fontWeight: typography.weights.bold },
  privacyAction: { color: colors.textSecondary, fontSize: typography.sizes.xs, marginTop: 2 },
  privacyMeta: { color: colors.textMuted, fontSize: 10, marginTop: 2, textTransform: "capitalize" },
  privacyEmpty: { color: colors.textSecondary, fontSize: typography.sizes.small, paddingVertical: spacing.sm },
  cardsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  actionCard: { width: "100%", backgroundColor: colors.surface, minHeight: 160 },
  actionCardTwoColumn: { width: "48.8%" },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  openIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: colors.teal50, alignItems: "center", justifyContent: "center" },
  cardTitle: { color: colors.textPrimary, fontFamily: typography.headingFamily, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.extraBold, marginBottom: 5 },
  cardDesc: { color: colors.textSecondary, fontFamily: typography.fontFamily, fontSize: typography.sizes.small, lineHeight: 19 },
  iconSlot: { position: "relative" },
  unreadBadge: { position: "absolute", top: -7, right: -7, minWidth: 21, height: 21, paddingHorizontal: 5, borderRadius: 11, backgroundColor: colors.error, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.white },
  unreadBadgeText: { color: colors.white, fontFamily: typography.headingFamily, fontSize: 9, fontWeight: typography.weights.extraBold },
  urduText: { textAlign: "right", writingDirection: "rtl" },
  rtlRow: { flexDirection: "row-reverse" },
});
