import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { getUserRole } from "../../services/storage";
import { getProfile } from "../../services/auth";
import { getHospitalStatistics } from "../../services/analytics";
import { getEquipmentSummary, type EquipmentSummary } from "../../services/equipment";
import { getHospitalPrivilegeSummary, type HospitalPrivilegeSummary } from "../../services/credentialsPrivileges";
import { useLanguage } from "../../services/i18n";
import AppShell from "../../design/components/AppShell";
import Card from "../../design/components/card";
import IconContainer from "../../design/components/IconContainer";
import Button from "../../design/components/Button";
import ProviderVerificationBanner from "../../components/ProviderVerificationBanner";
import { getProviderVerification, type ProviderVerification } from "../../services/providerVerification";
import colors from "../../design/tokens/colors";
import spacing from "../../design/tokens/spacing";
import typography from "../../design/tokens/typography";

import { useThemeRefresh } from "../../providers/AppThemeProvider";
export default function HospitalDashboard() {
  useThemeRefresh();
  const { t } = useLanguage();
  const [hospitalName, setHospitalName] = useState("");
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [verification, setVerification] = useState<ProviderVerification | null>(null);
  const [equipmentSummary, setEquipmentSummary] = useState<EquipmentSummary | null>(null);
  const [privilegeSummary, setPrivilegeSummary] = useState<HospitalPrivilegeSummary | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const role = await getUserRole();
        if (role !== "Hospital") {
          if (role === "Patient") router.replace("/tabs/dashboard" as any);
          else if (role === "Doctor") router.replace("/doctor/dashboard" as any);
          else if (role === "SuperAdmin") router.replace("/superadmin/dashboard" as any);
          else router.replace("/auth/login" as any);
          return;
        }

        const profile = await getProfile();
        setHospitalName(profile.name || "Hospital Staff");
        const verificationData = await getProviderVerification();
        setVerification(verificationData);

        const restricted = verificationData.status !== "verified" || verificationData.accountStatus !== "active";
        if (restricted) return;

        try {
          const [statsResult, equipmentResult, privilegeResult] = await Promise.allSettled([
            getHospitalStatistics(),
            getEquipmentSummary(),
            getHospitalPrivilegeSummary(),
          ]);
          if (statsResult.status === "fulfilled") setStats(statsResult.value);
          else console.warn("Failed to fetch hospital statistics:", statsResult.reason);
          if (equipmentResult.status === "fulfilled") setEquipmentSummary(equipmentResult.value);
          else console.warn("Failed to fetch equipment statistics:", equipmentResult.reason);
          if (privilegeResult.status === "fulfilled") setPrivilegeSummary(privilegeResult.value);
          else console.warn("Failed to fetch credential/privilege summary:", privilegeResult.reason);
        } catch (err) {
          console.warn("Failed to fetch hospital dashboard data:", err);
        }
      } catch {
        router.replace("/auth/login" as any);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const actionCards = [
    {
      icon: "search-outline" as const,
      color: colors.teal800,
      bgColor: colors.teal100,
      title: t("searchPatient") || "Search Patient Directory",
      description: t("searchPatientDescription") || "Locate patient profiles and clinical records",
      route: "/hospital/search-patient",
    },
    {
      icon: "cloud-upload-outline" as const,
      color: colors.teal700,
      bgColor: colors.teal50,
      title: t("uploadClinicalReport") || "Upload Clinical Report",
      description: t("uploadClinicalReportDescription") || "Submit diagnostic scans and lab reports",
      route: "/hospital/upload-report",
    },
    {
      icon: "document-text-outline" as const,
      color: colors.warning,
      bgColor: colors.warningBg,
      title: t("viewReports") || "Screening Reports",
      description: t("viewReportsDescription") || "Access uploaded reports & doctor verifications",
      route: "/hospital/reports",
    },
    {
      icon: "hardware-chip-outline" as const,
      color: colors.teal800,
      bgColor: colors.teal100,
      title: "Eye Equipment",
      description: "Manage ophthalmic devices, service, calibration and downtime",
      route: "/hospital/equipment",
    },
    {
      icon: "people-circle-outline" as const,
      color: colors.teal800,
      bgColor: colors.teal50,
      title: "Doctors & Privileges",
      description: "Review verified credentials, affiliations and hospital privileges",
      route: "/hospital/doctors",
    },
    {
      icon: "stats-chart-outline" as const,
      color: colors.info,
      bgColor: colors.infoBg,
      title: t("hospitalOverview") || "Hospital Analytics Overview",
      description: t("hospitalOverviewDescription") || "Facility screening statistics & patient throughput",
      route: "/hospital/overview",
    },
    {
      icon: "shield-checkmark-outline" as const,
      color: colors.teal900,
      bgColor: colors.teal100,
      title: t("auditLogs") || "Audit Logs & Security",
      description: t("auditLogsDescription") || "Review system access logs & compliance events",
      route: "/hospital/audit-logs",
    },
    {
      icon: "notifications-outline" as const,
      color: colors.info,
      bgColor: colors.infoBg,
      title: t("notifications") || "Notifications",
      description: t("notificationsDescription") || "Facility-wide alerts and updates",
      route: "/notifications",
    },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.teal800} />
      </View>
    );
  }

  if (verification && (verification.status !== "verified" || verification.accountStatus !== "active")) {
    return (
      <AppShell role="Hospital" title="Hospital Portal" userName={hospitalName} showAssistant={false}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.welcomeContainer}>
            <Text style={styles.greetingEyebrow}>HOSPITAL ACCOUNT</Text>
            <Text style={styles.welcomeTitle}>Welcome, {hospitalName}</Text>
            <Text style={styles.welcomeSubtitle}>Facility clinical tools remain locked until provider verification is approved.</Text>
          </View>
          <ProviderVerificationBanner status={verification.status} accountStatus={verification.accountStatus} decisionReason={verification.decisionReason} />
          <Text style={styles.sectionTitle}>Available while verification is pending</Text>
          <View style={styles.cardsGrid}>
            <Card onPress={() => router.push("/provider-verification" as any)} style={styles.actionCard}>
              <Text style={styles.cardTitle}>Provider Verification</Text>
              <Text style={styles.cardDesc}>Submit facility registration details and supporting credentials.</Text>
            </Card>
            <Card onPress={() => router.push("/hospital/profile" as any)} style={styles.actionCard}>
              <Text style={styles.cardTitle}>Hospital Profile</Text>
              <Text style={styles.cardDesc}>Review the facility account information used by EyeCare AI.</Text>
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

  return (
    <AppShell role="Hospital" title="Hospital Portal" userName={hospitalName}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Welcome Header */}
        <View style={styles.welcomeContainer}>
          <Text style={styles.greetingEyebrow}>{t("hospitalPortal") || "HOSPITAL ADMINISTRATION"}</Text>
          <Text style={styles.welcomeTitle}>
            {t("welcome") || "Welcome"}, {hospitalName}
          </Text>
          <Text style={styles.welcomeSubtitle}>
            Manage clinical reports, patient admissions, staff access, and facility analytics.
          </Text>
        </View>

        {/* Hospital Stats Summary */}
        {stats && (
          <Card variant="elevated" style={styles.statsBanner}>
            <Text style={styles.sectionHeader}>FACILITY METRICS</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Patients</Text>
                <Text style={styles.statValue}>{stats.totalPatients ?? stats.patients ?? "0"}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Doctors</Text>
                <Text style={styles.statValue}>{stats.totalDoctors ?? stats.doctors ?? "0"}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Reports</Text>
                <Text style={styles.statValue}>{stats.totalReports ?? stats.reports ?? "0"}</Text>
              </View>
            </View>
          </Card>
        )}

        {equipmentSummary ? (
          <Card style={styles.equipmentBanner}>
            <View style={styles.equipmentHeader}>
              <View style={styles.equipmentHeaderText}>
                <Text style={styles.sectionHeader}>EYE EQUIPMENT</Text>
                <Text style={styles.equipmentSubtitle}>Service, calibration and operational readiness</Text>
              </View>
              <Button title="View Equipment" variant="outline" size="sm" icon="hardware-chip-outline" onPress={() => router.push("/hospital/equipment" as any)} />
            </View>
            <View style={styles.equipmentStatsRow}>
              <View style={styles.equipmentStat}><Text style={styles.equipmentStatValue}>{equipmentSummary.activeDevices}</Text><Text style={styles.equipmentStatLabel}>Active</Text></View>
              <View style={styles.equipmentStat}><Text style={[styles.equipmentStatValue, { color: colors.warning }]}>{equipmentSummary.serviceDue}</Text><Text style={styles.equipmentStatLabel}>Service Due</Text></View>
              <View style={styles.equipmentStat}><Text style={[styles.equipmentStatValue, { color: colors.info }]}>{equipmentSummary.calibrationDue}</Text><Text style={styles.equipmentStatLabel}>Calibration Due</Text></View>
              <View style={styles.equipmentStat}><Text style={[styles.equipmentStatValue, { color: colors.error }]}>{equipmentSummary.outOfService}</Text><Text style={styles.equipmentStatLabel}>Out of Service</Text></View>
            </View>
          </Card>
        ) : null}

        {privilegeSummary ? (
          <Card style={styles.credentialBanner}>
            <View style={styles.equipmentHeader}>
              <View style={styles.equipmentHeaderText}>
                <Text style={styles.sectionHeader}>CREDENTIAL ALERTS</Text>
                <Text style={styles.equipmentSubtitle}>Professional licenses and hospital privilege expiry</Text>
              </View>
              <Button title="Doctors & Privileges" variant="outline" size="sm" icon="people-circle-outline" onPress={() => router.push("/hospital/doctors" as any)} />
            </View>
            <View style={styles.equipmentStatsRow}>
              <View style={styles.equipmentStat}><Text style={styles.equipmentStatValue}>{privilegeSummary.activeDoctors}</Text><Text style={styles.equipmentStatLabel}>Active Doctors</Text></View>
              <View style={styles.equipmentStat}><Text style={[styles.equipmentStatValue, { color: colors.warning }]}>{privilegeSummary.licenseExpiring60}</Text><Text style={styles.equipmentStatLabel}>Licenses ≤60d</Text></View>
              <View style={styles.equipmentStat}><Text style={[styles.equipmentStatValue, { color: colors.error }]}>{privilegeSummary.licenseExpired}</Text><Text style={styles.equipmentStatLabel}>Expired Licenses</Text></View>
              <View style={styles.equipmentStat}><Text style={[styles.equipmentStatValue, { color: colors.warning }]}>{privilegeSummary.privilegeExpiring30}</Text><Text style={styles.equipmentStatLabel}>Privileges ≤30d</Text></View>
            </View>
            {privilegeSummary.privilegeExpired ? <Text style={styles.credentialAlertText}>! {privilegeSummary.privilegeExpired} hospital privilege(s) have expired and no longer authorize procedures.</Text> : null}
          </Card>
        ) : null}

        {/* Primary Upload Action Hero */}
        <Card variant="accent" style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={styles.heroTextContent}>
              <Text style={styles.heroTitle}>Upload Medical Record</Text>
              <Text style={styles.heroDesc}>
                Upload clinical reports, DICOM scans, or laboratory results directly to patient charts.
              </Text>
              <Button
                title={t("uploadClinicalReport") || "Upload Report"}
                icon="cloud-upload-outline"
                onPress={() => router.push("/hospital/upload-report" as any)}
                style={styles.heroBtn}
              />
            </View>
            <IconContainer
              name="cloud-upload-outline"
              size={30}
              color={colors.teal900}
              backgroundColor={colors.surface}
            />
          </View>
        </Card>

        {/* Hospital Features Grid */}
        <Text style={styles.sectionTitle}>Hospital Portal Services</Text>
        <View style={styles.cardsGrid}>
          {actionCards.map((card) => (
            <Card
              key={card.route}
              onPress={() => router.push(card.route as any)}
              style={styles.actionCard}
              accessibilityLabel={`${card.title}. ${card.description}`}
            >
              <View style={styles.cardHeaderRow}>
                <IconContainer
                  name={card.icon}
                  size={24}
                  color={card.color}
                  backgroundColor={card.bgColor}
                />
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>

              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardDesc}>{card.description}</Text>
            </Card>
          ))}
        </View>
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
  equipmentBanner: {
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
  },
  equipmentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    flexWrap: "wrap",
    marginBottom: spacing.md,
  },
  equipmentHeaderText: {
    flex: 1,
    minWidth: 180,
  },
  equipmentSubtitle: {
    color: colors.textSecondary,
    fontSize: typography.sizes.small,
  },
  equipmentStatsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  equipmentStat: {
    flexGrow: 1,
    flexBasis: 110,
    minWidth: 100,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    padding: spacing.sm,
  },
  equipmentStatValue: {
    color: colors.success,
    fontSize: typography.sizes.h2,
    fontWeight: typography.weights.bold,
  },
  equipmentStatLabel: {
    color: colors.textSecondary,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.medium,
    marginTop: 2,
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
  cardDesc: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  credentialBanner: { marginBottom: spacing.lg, backgroundColor: colors.surface },
  credentialAlertText: { color: colors.error, fontSize: typography.sizes.xs, fontWeight: "800", marginTop: spacing.sm },
});
