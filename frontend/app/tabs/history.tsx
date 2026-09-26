import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  LayoutChangeEvent,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { getPatientHistory, HistoryItem } from "../../services/patient";
import { getPatientPrescriptions, Prescription } from "../../services/prescriptions";
import {
  AnalyticsRangeDays,
  getPatientAnalytics,
  PatientAnalytics,
} from "../../services/analytics";
import { useLanguage } from "../../services/i18n";

import AppShell from "../../design/components/AppShell";
import Card from "../../design/components/card";
import StatusBadge from "../../design/components/StatusBadge";
import Button from "../../design/components/Button";
import colors from "../../design/tokens/colors";
import spacing from "../../design/tokens/spacing";
import typography from "../../design/tokens/typography";
import radius from "../../design/tokens/radius";

import { useThemeRefresh } from "../../providers/AppThemeProvider";
const RANGE_OPTIONS: { label: string; days: AnalyticsRangeDays }[] = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
];

const DR_LEVELS: Record<number, string> = {
  0: "No DR",
  1: "Mild",
  2: "Moderate",
  3: "Severe",
  4: "Proliferative",
};

const shortDate = (value: string) => {
  const key = String(value || "").slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return key || "—";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Math.max(0, Number(match[2]) - 1)]} ${Number(match[3])}`;
};

const formatValue = (value: number | null | undefined, suffix = "") =>
  value === null || value === undefined ? "—" : `${Number(value).toFixed(1)}${suffix}`;

interface TrendPoint {
  date: string;
  value: number;
}

function samplePoints(points: TrendPoint[], maximum = 12) {
  if (points.length <= maximum) return points;
  return Array.from({ length: maximum }, (_, index) => {
    const sourceIndex = Math.round((index * (points.length - 1)) / (maximum - 1));
    return points[sourceIndex];
  });
}

function MiniTrendChart({
  points,
  fixedMin,
  fixedMax,
  valueFormatter = (value) => value.toFixed(1),
}: {
  points: TrendPoint[];
  fixedMin?: number;
  fixedMax?: number;
  valueFormatter?: (value: number) => string;
}) {
  const [width, setWidth] = useState(0);
  const chartHeight = 150;
  const horizontalPadding = 14;
  const verticalPadding = 14;
  const sampled = useMemo(() => samplePoints(points), [points]);

  const onLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  if (!points.length) {
    return (
      <View style={styles.chartEmptyBox}>
        <Ionicons name="analytics-outline" size={28} color={colors.textMuted} />
        <Text style={styles.chartEmptyText}>No data in this period.</Text>
      </View>
    );
  }

  const values = sampled.map((item) => item.value);
  const rawMin = fixedMin ?? Math.min(...values);
  const rawMax = fixedMax ?? Math.max(...values);
  const minValue = rawMin === rawMax ? rawMin - 1 : rawMin;
  const maxValue = rawMin === rawMax ? rawMax + 1 : rawMax;
  const range = Math.max(1, maxValue - minValue);
  const plotWidth = Math.max(0, width - horizontalPadding * 2);
  const plotHeight = chartHeight - verticalPadding * 2;

  const coordinates = sampled.map((item, index) => ({
    ...item,
    x:
      sampled.length === 1
        ? horizontalPadding + plotWidth / 2
        : horizontalPadding + (index * plotWidth) / (sampled.length - 1),
    y: verticalPadding + ((maxValue - item.value) / range) * plotHeight,
  }));

  return (
    <View>
      <View style={styles.chartScaleRow}>
        <Text style={styles.chartScaleText}>{valueFormatter(maxValue)}</Text>
        <Text style={styles.chartScaleText}>{valueFormatter(minValue)}</Text>
      </View>
      <View style={styles.chartPlot} onLayout={onLayout}>
        <View style={[styles.gridLine, { top: verticalPadding }]} />
        <View style={[styles.gridLine, { top: chartHeight / 2 }]} />
        <View style={[styles.gridLine, { bottom: verticalPadding }]} />

        {width > 0
          ? coordinates.slice(0, -1).map((point, index) => {
              const next = coordinates[index + 1];
              const dx = next.x - point.x;
              const dy = next.y - point.y;
              const length = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx);
              const midpointX = (point.x + next.x) / 2;
              const midpointY = (point.y + next.y) / 2;
              return (
                <View
                  key={`line-${index}`}
                  style={[
                    styles.chartLine,
                    {
                      width: length,
                      left: midpointX - length / 2,
                      top: midpointY - 1,
                      transform: [{ rotate: `${angle}rad` }],
                    },
                  ]}
                />
              );
            })
          : null}

        {width > 0
          ? coordinates.map((point, index) => (
              <View
                key={`${point.date}-${index}`}
                style={[
                  styles.chartDot,
                  { left: point.x - 4, top: point.y - 4 },
                ]}
              />
            ))
          : null}
      </View>
      <View style={styles.chartDateRow}>
        <Text style={styles.chartDateText}>{shortDate(points[0]?.date || "")}</Text>
        <Text style={styles.chartDateText}>
          {shortDate(points[points.length - 1]?.date || "")}
        </Text>
      </View>
    </View>
  );
}

function TrendHeader({
  icon,
  title,
  subtitle,
  iconColor = colors.teal900,
  iconBackground = colors.teal100,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  iconColor?: string;
  iconBackground?: string;
}) {
  return (
    <View style={styles.sectionCardHeader}>
      <View style={[styles.headerIconWrapper, { backgroundColor: iconBackground }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.headerTextGroup}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSub}>{subtitle}</Text>
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  useThemeRefresh();
  const { t } = useLanguage();

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [analytics, setAnalytics] = useState<PatientAnalytics | null>(null);
  const [selectedRange, setSelectedRange] = useState<AnalyticsRangeDays>(30);
  const [staticLoading, setStaticLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadStaticData = async () => {
    try {
      setStaticLoading(true);
      const [historyData, prescriptionData] = await Promise.allSettled([
        getPatientHistory(),
        getPatientPrescriptions(),
      ]);

      if (historyData.status === "fulfilled") {
        setHistory(historyData.value || []);
      }
      if (prescriptionData.status === "fulfilled") {
        setPrescriptions(prescriptionData.value || []);
      }
    } finally {
      setStaticLoading(false);
    }
  };

  const loadTrendData = async (range: AnalyticsRangeDays) => {
    setAnalyticsLoading(true);
    setError("");
    try {
      const result = await getPatientAnalytics(range);
      setAnalytics(result);
    } catch (err: any) {
      setError(err?.message || "Unable to load progress trends.");
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    loadStaticData();
  }, []);

  useEffect(() => {
    loadTrendData(selectedRange);
  }, [selectedRange]);

  const refreshAll = async () => {
    setRefreshing(true);
    await Promise.all([loadStaticData(), loadTrendData(selectedRange)]);
    setRefreshing(false);
  };

  const hba1cPoints = useMemo<TrendPoint[]>(
    () =>
      (analytics?.hba1cTrend || []).map((item) => ({
        date: item.date,
        value: Number(item.value),
      })),
    [analytics]
  );

  const riskPoints = useMemo<TrendPoint[]>(
    () =>
      (analytics?.riskTrend || []).map((item) => ({
        date: item.date,
        value: Number(item.value),
      })),
    [analytics]
  );

  const drPoints = useMemo<TrendPoint[]>(
    () =>
      (analytics?.drTrend || [])
        .filter((item) => item.severity !== null && item.severity !== undefined)
        .map((item) => ({
          date: item.date,
          value: Number(item.severity),
        })),
    [analytics]
  );

  const medicationPoints = useMemo<TrendPoint[]>(
    () =>
      (analytics?.medicationTrend || [])
        .filter((item) => Number(item.expected || 0) > 0)
        .map((item) => ({
          date: item.date,
          value: Number(item.percent || 0),
        })),
    [analytics]
  );

  const initialLoading = staticLoading && analyticsLoading && !analytics;
  if (initialLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.teal800} />
        <Text style={styles.loadingText}>
          {t("loadingHistory") || "Loading Health Records..."}
        </Text>
      </View>
    );
  }

  return (
    <AppShell
      role="Patient"
      title="Health History"
      subtitle="Longitudinal Eye & Medical Analytics"
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} />}
      >
        <View style={styles.headerBanner}>
          <Text style={styles.eyebrow}>LONGITUDINAL PROGRESS</Text>
          <Text style={styles.title}>{t("medicalHistory") || "Patient Health History"}</Text>
          <Text style={styles.subtitle}>
            Your retinal risk, HbA1c, and medication adherence trends are aggregated from their original clinical records without duplicating data.
          </Text>
        </View>

        <View style={styles.filterHeaderRow}>
          <Text style={styles.filterTitle}>Trend Period</Text>
          {analyticsLoading ? <ActivityIndicator size="small" color={colors.teal800} /> : null}
        </View>
        <View style={styles.rangeRow}>
          {RANGE_OPTIONS.map((option) => {
            const selected = selectedRange === option.days;
            return (
              <TouchableOpacity
                key={option.days}
                onPress={() => setSelectedRange(option.days)}
                style={[styles.rangeButton, selected && styles.rangeButtonSelected]}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.rangeButtonText, selected && styles.rangeButtonTextSelected]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => loadTrendData(selectedRange)}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.summaryStrip}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>HbA1c</Text>
            <Text style={styles.summaryValue}>
              {formatValue(analytics?.summary?.latestHbA1c, "%")}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Risk</Text>
            <Text style={styles.summaryValue}>
              {formatValue(analytics?.summary?.latestRisk)}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>7-day adherence</Text>
            <Text style={styles.summaryValue}>
              {formatValue(analytics?.summary?.medicationAdherence, "%")}
            </Text>
          </View>
        </View>

        <Card variant="elevated" style={styles.sectionCard}>
          <TrendHeader
            icon="water-outline"
            title="HbA1c Trend"
            subtitle="Historical HbA1c values from health_metrics"
            iconColor={colors.warning}
            iconBackground={colors.warningBg}
          />
          <MiniTrendChart
            points={hba1cPoints}
            valueFormatter={(value) => `${value.toFixed(1)}%`}
          />
          {analytics?.hba1cTrend?.length ? (
            <View style={styles.latestDetailRow}>
              <Text style={styles.latestDetailLabel}>Latest HbA1c</Text>
              <Text style={styles.latestDetailValue}>
                {formatValue(analytics.summary.latestHbA1c, "%")}
              </Text>
            </View>
          ) : (
            <View style={styles.actionEmptyState}>
              <Text style={styles.actionEmptyText}>
                Record HbA1c from My Analytics to start this trend.
              </Text>
              <Button
                title="Open My Analytics"
                size="sm"
                variant="outline"
                onPress={() => router.push("/analytics" as any)}
              />
            </View>
          )}
        </Card>

        <Card variant="elevated" style={styles.sectionCard}>
          <TrendHeader
            icon="eye-outline"
            title="DR Progression"
            subtitle="Retinal severity derived from prediction history"
          />
          <MiniTrendChart
            points={drPoints}
            fixedMin={0}
            fixedMax={4}
            valueFormatter={(value) => DR_LEVELS[Math.round(value)] || String(Math.round(value))}
          />
          {analytics?.drTrend?.length ? (
            <View style={styles.timelineList}>
              {analytics.drTrend
                .slice()
                .reverse()
                .slice(0, 4)
                .map((item, index) => (
                  <TouchableOpacity
                    key={item.id || `${item.date}-${index}`}
                    style={styles.timelineRow}
                    onPress={() => {
                      if (item.id) {
                        router.push({ pathname: "/result", params: { predictionId: item.id } });
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.timelineDot} />
                    <View style={styles.timelineMain}>
                      <Text style={styles.timelineTitle}>{item.stage}</Text>
                      <Text style={styles.timelineDate}>{shortDate(item.date)}</Text>
                    </View>
                    {item.confidence !== null && item.confidence !== undefined ? (
                      <Text style={styles.timelineMeta}>{String(item.confidence)}</Text>
                    ) : null}
                    <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
                  </TouchableOpacity>
                ))}
            </View>
          ) : null}
        </Card>

        <Card variant="elevated" style={styles.sectionCard}>
          <TrendHeader
            icon="pulse-outline"
            title="Risk-score Trend"
            subtitle="Clinical risk score from prediction history"
            iconColor={colors.error}
            iconBackground={colors.errorBg}
          />
          <MiniTrendChart
            points={riskPoints}
            fixedMin={0}
            fixedMax={100}
            valueFormatter={(value) => `${Math.round(value)}`}
          />
          <View style={styles.latestDetailRow}>
            <Text style={styles.latestDetailLabel}>Latest risk</Text>
            <Text style={styles.latestDetailValue}>
              {formatValue(analytics?.summary?.latestRisk)}
            </Text>
          </View>
        </Card>

        <Card variant="elevated" style={styles.sectionCard}>
          <TrendHeader
            icon="medkit-outline"
            title="Medication Adherence"
            subtitle="Daily completion calculated from medication_adherence"
            iconColor={colors.success}
            iconBackground={colors.successBg}
          />
          <MiniTrendChart
            points={medicationPoints}
            fixedMin={0}
            fixedMax={100}
            valueFormatter={(value) => `${Math.round(value)}%`}
          />
          <View style={styles.latestDetailRow}>
            <Text style={styles.latestDetailLabel}>Recent 7-day adherence</Text>
            <Text style={styles.latestDetailValue}>
              {formatValue(analytics?.summary?.medicationAdherence, "%")}
            </Text>
          </View>
        </Card>

        <Card variant="elevated" style={styles.sectionCard}>
          <TrendHeader
            icon="document-text-outline"
            title="Medication & Prescription Records"
            subtitle="Active and completed medication instructions"
            iconColor={colors.info}
            iconBackground={colors.infoBg}
          />
          {prescriptions.length > 0 ? (
            <View style={styles.prescriptionList}>
              {prescriptions.map((rx, idx) => (
                <View key={rx.id || idx} style={styles.rxCard}>
                  <View style={styles.rxHeader}>
                    <Ionicons name="medkit-outline" size={18} color={colors.teal800} />
                    <Text style={styles.rxDoctor}>
                      {rx.source === "Patient" ? "Added by Patient" : rx.doctorName || "Prescribing Clinician"}
                    </Text>
                    {rx.date ? <Text style={styles.rxDate}>{shortDate(rx.date)}</Text> : null}
                  </View>
                  <Text style={styles.rxMedication}>{rx.medicationDetails}</Text>
                  {rx.dosage ? <Text style={styles.rxInstructions}>Dosage: {rx.dosage}</Text> : null}
                  {rx.instructions ? (
                    <Text style={styles.rxInstructions}>Instructions: {rx.instructions}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.chartEmptyBox}>
              <Ionicons name="medkit-outline" size={28} color={colors.textMuted} />
              <Text style={styles.chartEmptyText}>No medication records yet.</Text>
            </View>
          )}
        </Card>

        <Text style={styles.listHeaderTitle}>All Medical Records ({history.length})</Text>
        {history.length > 0 ? (
          <View style={styles.recordsList}>
            {history.map((record, index) => (
              <Card
                key={record.id || index}
                style={styles.recordItemCard}
                onPress={() => {
                  const isPrediction =
                    record.type?.toLowerCase().includes("prediction") ||
                    record.type?.toLowerCase().includes("ai");
                  if (record.id && isPrediction) {
                    router.push({ pathname: "/result", params: { predictionId: record.id } });
                  }
                }}
              >
                <View style={styles.recordRow}>
                  <View style={styles.recordIconBox}>
                    <Ionicons
                      name={
                        record.type?.toLowerCase().includes("prediction") ||
                        record.type?.toLowerCase().includes("ai")
                          ? "analytics-outline"
                          : "document-text-outline"
                      }
                      size={22}
                      color={colors.teal800}
                    />
                  </View>
                  <View style={styles.recordMainContent}>
                    <Text style={styles.recordTitleText}>{record.title || "Medical Record"}</Text>
                    <Text style={styles.recordDateText}>{record.date || "Recent"}</Text>
                  </View>
                  <StatusBadge status={record.status || "Completed"} size="sm" />
                </View>
              </Card>
            ))}
          </View>
        ) : staticLoading ? (
          <View style={styles.recordsLoading}>
            <ActivityIndicator size="small" color={colors.teal800} />
          </View>
        ) : (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyCardText}>No medical records currently found in database.</Text>
          </Card>
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
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl + 40,
  },
  headerBanner: {
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
  filterHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  filterTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.bold,
  },
  rangeRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  rangeButton: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rangeButtonSelected: {
    backgroundColor: colors.teal800,
    borderColor: colors.teal800,
  },
  rangeButtonText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
  },
  rangeButtonTextSelected: {
    color: colors.white,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.errorBg,
    borderRadius: radius.md,
  },
  errorText: {
    flex: 1,
    color: colors.error,
    fontSize: typography.sizes.small,
  },
  retryText: {
    color: colors.error,
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.bold,
  },
  summaryStrip: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: colors.teal50,
    borderWidth: 1,
    borderColor: colors.teal100,
    borderRadius: radius.lg,
    marginBottom: spacing.xl,
    paddingVertical: spacing.md,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: spacing.xs,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.teal100,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: typography.sizes.tiny,
    textAlign: "center",
  },
  summaryValue: {
    marginTop: spacing.xs,
    color: colors.teal900,
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.bold,
  },
  sectionCard: {
    marginBottom: spacing.xl,
    backgroundColor: colors.surface,
  },
  sectionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  headerIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.teal100,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  headerTextGroup: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  sectionSub: {
    marginTop: 2,
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  chartEmptyBox: {
    minHeight: 130,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.sm,
  },
  chartEmptyText: {
    color: colors.textMuted,
    fontSize: typography.sizes.small,
    textAlign: "center",
  },
  chartScaleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  chartScaleText: {
    color: colors.textMuted,
    fontSize: typography.sizes.tiny,
  },
  chartPlot: {
    height: 150,
    position: "relative",
    overflow: "hidden",
    borderRadius: radius.md,
    backgroundColor: colors.teal50,
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.borderLight,
  },
  chartLine: {
    position: "absolute",
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.teal700,
  },
  chartDot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.teal800,
    borderWidth: 2,
    borderColor: colors.white,
  },
  chartDateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  chartDateText: {
    color: colors.textMuted,
    fontSize: typography.sizes.tiny,
  },
  latestDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  latestDetailLabel: {
    color: colors.textSecondary,
    fontSize: typography.sizes.small,
  },
  latestDetailValue: {
    color: colors.teal800,
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.bold,
  },
  actionEmptyState: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  actionEmptyText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.small,
  },
  timelineList: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.teal700,
    marginRight: spacing.sm,
  },
  timelineMain: {
    flex: 1,
  },
  timelineTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
  },
  timelineDate: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  timelineMeta: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    marginRight: spacing.xs,
  },
  prescriptionList: {
    gap: spacing.sm,
  },
  rxCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  rxHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  rxDoctor: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  rxDate: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
  },
  rxMedication: {
    color: colors.textPrimary,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    marginTop: spacing.sm,
  },
  rxInstructions: {
    color: colors.textSecondary,
    fontSize: typography.sizes.small,
    marginTop: spacing.xs,
  },
  listHeaderTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.h3,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.md,
  },
  recordsList: {
    gap: spacing.sm,
  },
  recordItemCard: {
    padding: spacing.md,
  },
  recordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  recordIconBox: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.teal50,
  },
  recordMainContent: {
    flex: 1,
  },
  recordTitleText: {
    color: colors.textPrimary,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
  },
  recordDateText: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  recordsLoading: {
    padding: spacing.lg,
    alignItems: "center",
  },
  emptyCard: {
    alignItems: "center",
  },
  emptyCardText: {
    color: colors.textMuted,
    fontSize: typography.sizes.small,
    textAlign: "center",
  },
});