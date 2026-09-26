import { Alert } from "../services/alert";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import SummarySection from "../components/patient/SummarySection";
import {
  downloadClinicalSummary,
  getClinicalSummary,
  getLatestPatientClinicalSummary,
} from "../services/clinical";
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
interface DoctorSummaryData {
  predictionId?: string;
  overview: string;
  findings: string;
  assessment: string;
  recommendations: string;
  source?: string;
  isAiGenerated?: boolean;
}

export default function DoctorSummaryScreen() {
  useThemeRefresh();
  const { t } = useLanguage();
  const params = useLocalSearchParams();
  const predictionId = params.predictionId as string | undefined;
  const patientId = params.patientId as string | undefined;

  const [summary, setSummary] = useState<DoctorSummaryData | null>(null);
  const [loading, setLoading] = useState(Boolean(predictionId || patientId));
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!predictionId && !patientId) return;

    const request = predictionId
      ? getClinicalSummary(predictionId)
      : getLatestPatientClinicalSummary(patientId as string);

    request
      .then(setSummary)
      .catch((error) =>
        Alert.alert(
          t("summaryUnavailable") || "Summary Unavailable",
          error?.message || t("unableToLoadStoredSummary") || "Unable to load summary."
        )
      )
      .finally(() => setLoading(false));
  }, [predictionId, patientId, t]);

  const handleDownload = async () => {
    const downloadablePredictionId = summary?.predictionId || predictionId;
    if (!downloadablePredictionId) return;

    setDownloading(true);

    try {
      await downloadClinicalSummary(downloadablePredictionId);
    } catch (error: any) {
      Alert.alert(
        t("downloadUnavailable") || "Download Unavailable",
        error?.message || t("unableToDownloadSummary") || "Could not download report."
      );
    } finally {
      setDownloading(false);
    }
  };

  const analysisId = summary?.predictionId || predictionId;

  return (
    <AppShell role="Doctor" title={t("aiDoctorSummary") || "AI Doctor Summary"} showBack onBackPress={() => router.back()}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerGroup}>
          <Text style={styles.eyebrow}>AI CLINICAL REPORT</Text>
          <Text style={styles.title}>{t("aiDoctorSummary") || "AI Doctor Summary"}</Text>
          <Text style={styles.subtitle}>
            {t("clinicalSummaryDescription") || "Automated clinical summary synthesized from fundus image analysis and medical history."}
          </Text>
          {analysisId ? (
            <Text style={styles.analysisTag}>{t("analysisId") || "ANALYSIS ID"}: {analysisId}</Text>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.loadingCenter}>
            <ActivityIndicator color={colors.teal800} size="large" />
            <Text style={styles.loadingText}>Synthesizing clinical summary...</Text>
          </View>
        ) : summary ? (
          <View style={styles.summaryList}>
            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <IconContainer name="person-outline" size={20} color={colors.teal800} backgroundColor={colors.teal100} />
                <Text style={styles.sectionTitle}>{t("patientOverview") || "Patient Overview"}</Text>
              </View>
              <Text style={styles.sectionText}>{summary.overview}</Text>
            </Card>

            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <IconContainer name="search-outline" size={20} color={colors.teal800} backgroundColor={colors.teal100} />
                <Text style={styles.sectionTitle}>{t("clinicalFindings") || "Clinical Findings"}</Text>
              </View>
              <Text style={styles.sectionText}>{summary.findings}</Text>
            </Card>

            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <IconContainer name="analytics-outline" size={20} color={colors.teal800} backgroundColor={colors.teal100} />
                <Text style={styles.sectionTitle}>{t("assessment") || "Diagnostic Assessment"}</Text>
              </View>
              <Text style={styles.sectionText}>{summary.assessment}</Text>
            </Card>

            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <IconContainer name="medical-outline" size={20} color={colors.info} backgroundColor={colors.infoBg} />
                <Text style={styles.sectionTitle}>{t("recommendedActions") || "Recommended Care Actions"}</Text>
              </View>
              <Text style={styles.sectionText}>{summary.recommendations}</Text>
            </Card>

            {!summary.isAiGenerated && (
              <View style={styles.noticeCard}>
                <Ionicons name="information-circle-outline" size={18} color={colors.warning} />
                <Text style={styles.noticeText}>
                  {t("summaryNotDiagnosis") || "Notice: AI summaries provide clinical decision support and do not constitute a final medical diagnosis."}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <Card style={styles.emptyCard}>
            <IconContainer name="document-text-outline" size={32} color={colors.textMuted} backgroundColor={colors.teal50} />
            <Text style={styles.emptyTitle}>{t("noSummaryAvailable") || "No Summary Found"}</Text>
            <Text style={styles.emptySub}>
              {predictionId ? t("noStoredSummary") || "No clinical summary found." : t("completeRetinalAnalysis") || "Complete a screening to generate a summary."}
            </Text>
          </Card>
        )}

        <Button
          title={downloading ? (t("preparingDownload") || "Preparing Report...") : (t("downloadDoctorSummary") || "Download PDF Summary")}
          icon="download-outline"
          onPress={handleDownload}
          disabled={!analysisId || downloading}
          loading={downloading}
          style={styles.downloadBtn}
        />
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  loadingCenter: {
    padding: spacing.xxl,
    alignItems: "center",
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
  analysisTag: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  summaryList: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionCard: {
    backgroundColor: colors.surface,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  sectionText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  noticeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warningBg,
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  noticeText: {
    flex: 1,
    fontSize: typography.sizes.xs,
    color: colors.warning,
    lineHeight: 16,
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
  downloadBtn: {
    marginTop: spacing.xs,
  },
});
