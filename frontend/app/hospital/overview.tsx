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
import { Ionicons } from "@expo/vector-icons";

import {
  getHospitalActivity,
  getHospitalDoctors,
  getHospitalPatients,
  getHospitalStatistics,
} from "../../services/analytics";
import { useLanguage } from "../../services/i18n";

import AppShell from "../../design/components/AppShell";
import Card from "../../design/components/card";
import IconContainer from "../../design/components/IconContainer";
import colors from "../../design/tokens/colors";
import spacing from "../../design/tokens/spacing";
import typography from "../../design/tokens/typography";

import { useThemeRefresh } from "../../providers/AppThemeProvider";
export default function HospitalOverviewScreen() {
  useThemeRefresh();
  const { t } = useLanguage();

  const [stats, setStats] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [nextStats, nextActivity, nextPatients, nextDoctors] = await Promise.all([
        getHospitalStatistics(),
        getHospitalActivity(),
        getHospitalPatients(),
        getHospitalDoctors(),
      ]);

      setStats(nextStats);
      setActivity(nextActivity.activity || []);
      setPatients(nextPatients.patients || []);
      setDoctors(nextDoctors.doctors || []);
    } catch (error) {
      console.error("Failed to load hospital overview:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <AppShell role="Hospital" title={t("hospitalOverview") || "Hospital Analytics"}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={colors.teal800} size="large" />
          <Text style={styles.loadingText}>Loading operational analytics...</Text>
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell role="Hospital" title={t("hospitalOverview") || "Operational Overview"} showBack onBackPress={() => router.back()}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.teal800} />}
      >
        <View style={styles.headerGroup}>
          <Text style={styles.eyebrow}>ANALYTICS & METRICS</Text>
          <Text style={styles.title}>{t("hospitalOverview") || "Hospital Operations"}</Text>
          <Text style={styles.subtitle}>{t("hospitalOverviewDescription") || "Real-time clinical throughput, active staff, and screening activity metrics."}</Text>
        </View>

        {/* Key Performance Cards Grid */}
        {stats ? (
          <View style={styles.statsGrid}>
            {Object.entries(stats).map(([label, value]) => (
              <Card key={label} style={styles.statCard}>
                <Text style={styles.statVal}>{String(value)}</Text>
                <Text style={styles.statLabel}>{label.replace(/([A-Z])/g, " $1").trim()}</Text>
              </Card>
            ))}
          </View>
        ) : null}

        {/* Doctors Roster */}
        <Text style={styles.sectionHeaderTitle}>{t("doctors") || "Medical Staff"} ({doctors.length})</Text>
        <View style={styles.list}>
          {doctors.map((doctor) => (
            <Card key={doctor.id || doctor._id} style={styles.rowCard}>
              <View style={styles.rowItem}>
                <IconContainer name="medical-outline" size={20} color={colors.teal800} backgroundColor={colors.teal100} />
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitleText}>{doctor.name || doctor.username || doctor.email}</Text>
                  <Text style={styles.rowMetaText}>{doctor.email || (t("doctor") || "Clinician")}</Text>
                </View>
              </View>
            </Card>
          ))}
        </View>

        {/* Patients Registry */}
        <Text style={styles.sectionHeaderTitle}>{t("patients") || "Active Patients"} ({patients.length})</Text>
        <View style={styles.list}>
          {patients.map((patient) => (
            <Card key={patient.id || patient._id} style={styles.rowCard}>
              <View style={styles.rowItem}>
                <IconContainer name="person-outline" size={20} color={colors.teal900} backgroundColor={colors.teal50} />
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitleText}>{patient.name || patient.username || patient.email}</Text>
                  <Text style={styles.rowMetaText}>{patient.email || patient.mobile || (t("patient") || "Patient Record")}</Text>
                </View>
              </View>
            </Card>
          ))}
        </View>

        {/* Recent Audit Log Activity */}
        <Text style={styles.sectionHeaderTitle}>{t("recentActivity") || "Recent Clinical Activity"}</Text>
        {activity.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptySub}>{t("noRecentActivity") || "No recent activity recorded."}</Text>
          </Card>
        ) : (
          <View style={styles.list}>
            {activity.slice(0, 10).map((item, index) => (
              <Card key={item.id || item._id || index} style={styles.rowCard}>
                <View style={styles.rowItem}>
                  <IconContainer name="pulse" size={20} color={colors.teal800} backgroundColor={colors.teal100} />
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitleText}>{item.fileName || item.status || (t("clinicalActivity") || "System Action")}</Text>
                    <Text style={styles.rowMetaText}>{item.createdAt || ""}</Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
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
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    width: "47%",
    backgroundColor: colors.surface,
  },
  statVal: {
    fontSize: typography.sizes.h1,
    fontWeight: typography.weights.bold,
    color: colors.teal900,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 4,
    textTransform: "capitalize",
  },
  sectionHeaderTitle: {
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  list: {
    gap: spacing.sm,
  },
  rowCard: {
    backgroundColor: colors.surface,
  },
  rowItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowMain: {
    flex: 1,
    marginLeft: spacing.md,
  },
  rowTitleText: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  rowMetaText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  emptyCard: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  emptySub: {
    fontSize: typography.sizes.small,
    color: colors.textMuted,
  },
});
