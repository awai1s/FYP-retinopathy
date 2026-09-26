import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  createHealthMetric,
  getPatientAnalytics,
  PatientAnalytics,
} from "../services/analytics";
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
const todayKey = () => new Date().toISOString().slice(0, 10);

const isValidDateKey = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return !Number.isNaN(parsed.getTime());
};

const formatNumber = (value: number | null | undefined, suffix = "") =>
  value === null || value === undefined ? "—" : `${Number(value).toFixed(1)}${suffix}`;

const TrendSnapshotCard = ({
  label,
  previous,
  current,
  suffix = "",
  lowerIsBetter = false,
  icon,
  iconColor,
  iconBackground,
}: {
  label: string;
  previous: number | null | undefined;
  current: number | null | undefined;
  suffix?: string;
  lowerIsBetter?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBackground: string;
}) => {
  const delta =
    current !== null &&
    current !== undefined &&
    previous !== null &&
    previous !== undefined
      ? Number((current - previous).toFixed(1))
      : null;

  const improvement =
    delta === null ? null : lowerIsBetter ? delta < 0 : delta > 0;
  const unchanged = delta === 0;
  const indicatorColor =
    delta === null || unchanged
      ? colors.textMuted
      : improvement
        ? colors.success
        : colors.warning;
  const indicatorIcon =
    delta === null || unchanged
      ? "remove-outline"
      : delta < 0
        ? "arrow-down-outline"
        : "arrow-up-outline";

  const statusText = useMemo(() => {
    if (current === null || current === undefined) return "No data yet";
    if (previous === null || previous === undefined) return "Baseline recorded";
    if (unchanged) return "No change";
    if (improvement) return `Improving by ${Math.abs(delta || 0).toFixed(1)}${suffix}`;
    return `Changed by ${Math.abs(delta || 0).toFixed(1)}${suffix}`;
  }, [current, previous, unchanged, improvement, delta, suffix]);

  return (
    <Card variant="elevated" style={styles.progressCard}>
      <View style={styles.progressCardTop}>
        <IconContainer
          name={icon}
          size={22}
          color={iconColor}
          backgroundColor={iconBackground}
        />
        <Text style={styles.progressLabel}>{label}</Text>
      </View>

      <View style={styles.valueFlowRow}>
        <Text style={styles.previousValue}>{formatNumber(previous, suffix)}</Text>
        <Ionicons name="arrow-forward-outline" size={18} color={colors.textMuted} />
        <Text style={styles.currentValue}>{formatNumber(current, suffix)}</Text>
      </View>

      <View style={styles.progressStatusRow}>
        <Ionicons name={indicatorIcon} size={16} color={indicatorColor} />
        <Text style={[styles.progressStatusText, { color: indicatorColor }]}>
          {statusText}
        </Text>
      </View>
    </Card>
  );
};

const StatCard = ({
  label,
  value,
  icon,
  bgColor,
  iconColor,
}: {
  label: string;
  value: number | string;
  icon: keyof typeof Ionicons.glyphMap;
  bgColor: string;
  iconColor: string;
}) => (
  <Card style={styles.statCard}>
    <IconContainer name={icon} size={24} color={iconColor} backgroundColor={bgColor} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </Card>
);

export default function AnalyticsScreen() {
  useThemeRefresh();
  const { t } = useLanguage();
  const [data, setData] = useState<PatientAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [metricModalVisible, setMetricModalVisible] = useState(false);
  const [hba1c, setHba1c] = useState("");
  const [bloodGlucose, setBloodGlucose] = useState("");
  const [recordedDate, setRecordedDate] = useState(todayKey());
  const [savingMetric, setSavingMetric] = useState(false);
  const [metricError, setMetricError] = useState("");

  const loadAnalytics = async (showInitialLoader = false) => {
    if (showInitialLoader) setLoading(true);
    setError("");
    try {
      const result = await getPatientAnalytics(30);
      setData(result);
    } catch (err: any) {
      setError(err?.message || "Unable to load analytics.");
    } finally {
      if (showInitialLoader) setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics(true);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAnalytics(false);
    setRefreshing(false);
  };

  const resetMetricForm = () => {
    setHba1c("");
    setBloodGlucose("");
    setRecordedDate(todayKey());
    setMetricError("");
  };

  const closeMetricModal = () => {
    if (savingMetric) return;
    setMetricModalVisible(false);
    resetMetricForm();
  };

  const handleSaveMetric = async () => {
    setMetricError("");

    const parsedHbA1c = hba1c.trim() ? Number(hba1c.trim()) : undefined;
    const parsedGlucose = bloodGlucose.trim()
      ? Number(bloodGlucose.trim())
      : undefined;

    if (parsedHbA1c === undefined && parsedGlucose === undefined) {
      setMetricError("Enter at least HbA1c or blood glucose.");
      return;
    }
    if (
      parsedHbA1c !== undefined &&
      (!Number.isFinite(parsedHbA1c) || parsedHbA1c < 0 || parsedHbA1c > 30)
    ) {
      setMetricError("HbA1c must be between 0 and 30.");
      return;
    }
    if (
      parsedGlucose !== undefined &&
      (!Number.isFinite(parsedGlucose) || parsedGlucose < 0 || parsedGlucose > 2000)
    ) {
      setMetricError("Blood glucose must be between 0 and 2000 mg/dL.");
      return;
    }
    if (!isValidDateKey(recordedDate)) {
      setMetricError("Date must use YYYY-MM-DD format.");
      return;
    }

    try {
      setSavingMetric(true);
      await createHealthMetric({
        ...(parsedHbA1c !== undefined ? { hba1c: parsedHbA1c } : {}),
        ...(parsedGlucose !== undefined ? { bloodGlucose: parsedGlucose } : {}),
        recordedAt: new Date(`${recordedDate}T12:00:00`).toISOString(),
      });
      setMetricModalVisible(false);
      resetMetricForm();
      await loadAnalytics(false);
    } catch (err: any) {
      setMetricError(err?.message || "Unable to save health metric.");
    } finally {
      setSavingMetric(false);
    }
  };

  if (loading) {
    return (
      <AppShell role="Patient" title={t("patientAnalytics") || "My Analytics"}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.teal800} />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      </AppShell>
    );
  }

  const summary = data?.summary;

  return (
    <AppShell
      role="Patient"
      title={t("patientAnalytics") || "My Analytics"}
      showBack
      onBackPress={() => router.back()}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.headerGroup}>
          <Text style={styles.eyebrow}>PROGRESS MONITORING</Text>
          <Text style={styles.title}>{t("patientAnalytics") || "Patient Analytics"}</Text>
          <Text style={styles.subtitle}>
            Track changes in HbA1c, DR risk, retinal screening, and medication adherence over time.
          </Text>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={20} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.sectionHeadingRow}>
          <View style={styles.sectionHeadingText}>
            <Text style={styles.sectionEyebrow}>CURRENT HEALTH SNAPSHOT</Text>
            <Text style={styles.sectionTitle}>Progress Overview</Text>
          </View>
          <TouchableOpacity
            style={styles.addMetricButton}
            onPress={() => setMetricModalVisible(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <Ionicons name="add-circle-outline" size={18} color={colors.teal800} />
            <Text style={styles.addMetricButtonText}>Record Metric</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.progressGrid}>
          <TrendSnapshotCard
            label="HbA1c"
            previous={summary?.baselineHbA1c ?? summary?.previousHbA1c}
            current={summary?.latestHbA1c}
            suffix="%"
            lowerIsBetter
            icon="water-outline"
            iconColor={colors.warning}
            iconBackground={colors.warningBg}
          />
          <TrendSnapshotCard
            label="Risk Score"
            previous={summary?.baselineRisk ?? summary?.previousRisk}
            current={summary?.latestRisk}
            suffix=""
            lowerIsBetter
            icon="pulse-outline"
            iconColor={colors.error}
            iconBackground={colors.errorBg}
          />
          <TrendSnapshotCard
            label="Medication Adherence"
            previous={summary?.previousMedicationAdherence}
            current={summary?.medicationAdherence}
            suffix="%"
            icon="medkit-outline"
            iconColor={colors.success}
            iconBackground={colors.successBg}
          />
        </View>

        <Text style={styles.sectionEyebrow}>ACTIVITY TOTALS</Text>
        <View style={styles.grid}>
          <StatCard
            label={t("screenings") || "Screenings"}
            value={data?.screenings || 0}
            icon="analytics-outline"
            bgColor={colors.teal100}
            iconColor={colors.teal900}
          />
          <StatCard
            label={t("reports") || "Reports"}
            value={data?.reports || 0}
            icon="document-text-outline"
            bgColor={colors.warningBg}
            iconColor={colors.warning}
          />
          <StatCard
            label={t("appointments") || "Appointments"}
            value={data?.appointments || 0}
            icon="calendar-outline"
            bgColor={colors.infoBg}
            iconColor={colors.info}
          />
          <StatCard
            label={t("visionTests") || "Vision Tests"}
            value={data?.visionTests || 0}
            icon="eye-outline"
            bgColor={colors.teal50}
            iconColor={colors.teal800}
          />
        </View>

        <Card variant="elevated" style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <IconContainer
              name="sparkles-outline"
              size={24}
              color={colors.teal900}
              backgroundColor={colors.teal100}
            />
            <View style={styles.summaryMain}>
              <Text style={styles.summaryTitle}>
                {t("latestScreening") || "Latest Screening Outcome"}
              </Text>
              <Text style={styles.summaryText}>
                {data?.latestPrediction?.stage ||
                  t("noScreeningResult") ||
                  "No screening result recorded"}
              </Text>
              {data?.latestPrediction?.riskScore !== null &&
              data?.latestPrediction?.riskScore !== undefined ? (
                <Text style={styles.summaryMeta}>
                  Latest risk score: {Number(data.latestPrediction.riskScore).toFixed(1)}
                </Text>
              ) : null}
            </View>
            {data?.latestPrediction?.status ? (
              <StatusBadge status={data.latestPrediction.status} size="sm" />
            ) : null}
          </View>

          <Button
            title="View Detailed Trends"
            variant="outline"
            icon="stats-chart-outline"
            iconPosition="right"
            onPress={() => router.push("/tabs/history" as any)}
            style={styles.historyBtn}
          />
        </Card>
      </ScrollView>

      <Modal
        visible={metricModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeMetricModal}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closeMetricModal}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>HEALTH METRICS</Text>
                <Text style={styles.modalTitle}>Record a Measurement</Text>
              </View>
              <TouchableOpacity
                onPress={closeMetricModal}
                style={styles.modalClose}
                disabled={savingMetric}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>HbA1c (%)</Text>
            <TextInput
              value={hba1c}
              onChangeText={setHba1c}
              placeholder="e.g. 7.2"
              keyboardType="decimal-pad"
              style={styles.input}
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.inputLabel}>Blood Glucose (mg/dL)</Text>
            <TextInput
              value={bloodGlucose}
              onChangeText={setBloodGlucose}
              placeholder="e.g. 145"
              keyboardType="decimal-pad"
              style={styles.input}
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.inputLabel}>Recorded Date</Text>
            <TextInput
              value={recordedDate}
              onChangeText={setRecordedDate}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              style={styles.input}
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.helperText}>
              Enter at least one measurement. Saving creates a historical health-metric record; it does not overwrite your profile.
            </Text>

            {metricError ? (
              <View style={styles.metricErrorBox}>
                <Ionicons name="alert-circle-outline" size={17} color={colors.error} />
                <Text style={styles.metricErrorText}>{metricError}</Text>
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="ghost"
                onPress={closeMetricModal}
                disabled={savingMetric}
                style={styles.modalActionButton}
              />
              <Button
                title="Save Metric"
                icon="save-outline"
                onPress={handleSaveMetric}
                loading={savingMetric}
                style={styles.modalActionButton}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    lineHeight: 22,
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
    flex: 1,
    color: colors.error,
    fontSize: typography.sizes.small,
  },
  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sectionHeadingText: {
    flex: 1,
  },
  sectionEyebrow: {
    color: colors.teal800,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
    letterSpacing: 1.1,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.h3,
    fontWeight: typography.weights.bold,
  },
  addMetricButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.teal50,
    borderWidth: 1,
    borderColor: colors.teal100,
  },
  addMetricButtonText: {
    color: colors.teal800,
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
  },
  progressGrid: {
    marginBottom: spacing.xl,
  },
  progressCard: {
    marginBottom: spacing.md,
  },
  progressCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  progressLabel: {
    color: colors.textPrimary,
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.bold,
  },
  valueFlowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  previousValue: {
    color: colors.textMuted,
    fontSize: typography.sizes.h3,
    fontWeight: typography.weights.semibold,
  },
  currentValue: {
    color: colors.teal800,
    fontSize: typography.sizes.h2,
    fontWeight: typography.weights.bold,
  },
  progressStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  progressStatusText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  statCard: {
    width: "48%",
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: typography.sizes.display,
    fontWeight: typography.weights.bold,
    marginTop: spacing.sm,
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: typography.sizes.small,
    marginTop: 2,
  },
  summaryCard: {
    backgroundColor: colors.surface,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  summaryMain: {
    flex: 1,
    marginLeft: spacing.md,
    paddingRight: spacing.xs,
  },
  summaryTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
  },
  summaryText: {
    color: colors.teal800,
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.bold,
    marginTop: 2,
  },
  summaryMeta: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    fontSize: typography.sizes.small,
  },
  historyBtn: {
    marginTop: spacing.xs,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(3, 24, 23, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  modalEyebrow: {
    color: colors.teal800,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
    letterSpacing: 1,
  },
  modalTitle: {
    marginTop: 2,
    color: colors.textPrimary,
    fontSize: typography.sizes.h3,
    fontWeight: typography.weights.bold,
  },
  modalClose: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: colors.surfaceSecondary,
  },
  inputLabel: {
    color: colors.textPrimary,
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    fontSize: typography.sizes.body,
  },
  helperText: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    lineHeight: 18,
    marginTop: spacing.md,
  },
  metricErrorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.errorBg,
  },
  metricErrorText: {
    flex: 1,
    color: colors.error,
    fontSize: typography.sizes.small,
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  modalActionButton: {
    flex: 1,
  },
});