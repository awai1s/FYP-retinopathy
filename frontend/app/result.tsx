import { Alert } from "../services/alert";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { getPredictionResult, PredictionResult } from "../services/patient";
import {
  downloadMedicalReport,
  generateMedicalReport,
  GeneratedMedicalReport,
  getGeneratedReportsForPrediction,
  ReportLanguage,
  shareMedicalReport,
} from "../services/reports";
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
export default function ResultScreen() {
  useThemeRefresh();
  const params = useLocalSearchParams();
  const { t } = useLanguage();
  const predictionId = params.predictionId as string;

  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reports, setReports] = useState<GeneratedMedicalReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [generatingLanguage, setGeneratingLanguage] = useState<ReportLanguage | null>(null);
  const [reportActionId, setReportActionId] = useState<string>("");

  useEffect(() => {
    if (!predictionId) {
      setLoading(false);
      setLoadError("Missing screening prediction ID.");
      return;
    }

    let active = true;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;

    const loadPrediction = async (initial = false) => {
      if (initial) setLoading(true);

      try {
        const data = await getPredictionResult(predictionId);
        if (!active) return;

        setResult(data);
        setLoadError("");

        if (data.status === "Pending" || data.status === "Processing") {
          pollTimer = setTimeout(() => loadPrediction(false), 4000);
        }
      } catch (err: any) {
        if (!active) return;
        console.error("Failed to load prediction result:", err);
        setLoadError(
          err?.message ||
            t("couldNotLoadResult") ||
            "Could not load prediction result."
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    loadPrediction(true);

    return () => {
      active = false;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [predictionId, t]);

  useEffect(() => {
    if (!predictionId || result?.status !== "Completed") {
      setReports([]);
      setReportsLoading(false);
      return;
    }

    setReportsLoading(true);
    getGeneratedReportsForPrediction(predictionId)
      .then(setReports)
      .catch((error) => {
        console.warn("Unable to load generated reports:", error);
      })
      .finally(() => setReportsLoading(false));
  }, [predictionId, result?.status]);

  const handleGenerateReport = async (language: ReportLanguage) => {
    if (!predictionId || generatingLanguage) return;
    setGeneratingLanguage(language);
    try {
      const report = await generateMedicalReport(predictionId, language);
      setReports((current) => {
        const filtered = current.filter((item) => item.reportId !== report.reportId);
        return [report, ...filtered];
      });
      Alert.alert(
        "Medical report ready",
        `${language === "ur" ? "Urdu" : "English"} PDF ${report.reused ? "is already available" : "was generated successfully"}.`
      );
    } catch (error: any) {
      Alert.alert("Report generation failed", error?.message || "Unable to generate the PDF report.");
    } finally {
      setGeneratingLanguage(null);
    }
  };

  const handleDownloadReport = async (report: GeneratedMedicalReport) => {
    if (reportActionId) return;
    setReportActionId(report.reportId);
    try {
      const uri = await downloadMedicalReport(report);
      if (uri && Platform.OS !== "web") {
        Alert.alert("Report saved", "The PDF has been saved in the app's document storage and can be shared or opened again later.");
      }
    } catch (error: any) {
      Alert.alert("Download failed", error?.message || "Unable to download the medical report.");
    } finally {
      setReportActionId("");
    }
  };

  const handleShareReport = async (report: GeneratedMedicalReport) => {
    if (reportActionId) return;
    setReportActionId(report.reportId);
    try {
      await shareMedicalReport(report);
    } catch (error: any) {
      Alert.alert("Share failed", error?.message || "Unable to open the share sheet for this PDF.");
    } finally {
      setReportActionId("");
    }
  };

  const reportLanguageLabel = (language: ReportLanguage) => language === "ur" ? "Urdu / اردو" : "English";

  const getConfidenceValue = () => {
    if (!result?.confidence) return 0;
    const numericValue = parseFloat(String(result.confidence).replace("%", ""));
    if (isNaN(numericValue)) return 0;
    return Math.min(Math.max(numericValue, 0), 100);
  };

  const confidenceValue = getConfidenceValue();
  const isProcessing = result?.status === "Pending" || result?.status === "Processing";
  const waitingStatus = result?.status === "Processing" ? "Processing" : "Pending";
  const riskDisplay =
    result?.riskScore !== null && result?.riskScore !== undefined
      ? `${Number(result.riskScore).toFixed(1)}/100`
      : result?.riskLevel || "N/A";

  if (loading) {
    return (
      <AppShell role="Patient" title={t("aiAnalysisResult") || "Screening Result"}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.teal800} />
          <Text style={styles.loadingTitle}>{t("analyzingResults") || "Analyzing Scan..."}</Text>
          <Text style={styles.loadingText}>{t("pleaseWaitAiAnalysisLoaded") || "Please wait while AI analysis is processed."}</Text>
        </View>
      </AppShell>
    );
  }

  if (loadError && !result) {
    return (
      <AppShell
        role="Patient"
        title={t("aiAnalysisResult") || "Screening Result"}
        showBack
        onBackPress={() => router.back()}
      >
        <View style={styles.stateCenter}>
          <IconContainer
            name="alert-circle-outline"
            size={34}
            color={colors.error}
            backgroundColor={colors.errorBg}
          />
          <Text style={styles.stateTitle}>Unable to load screening</Text>
          <Text style={styles.stateText}>{loadError}</Text>
          <Button
            title={t("backToDashboard") || "Back to Dashboard"}
            icon="home-outline"
            onPress={() => router.replace("/tabs/dashboard" as any)}
            style={styles.stateButton}
          />
        </View>
      </AppShell>
    );
  }

  if (result && isProcessing) {
    return (
      <AppShell
        role="Patient"
        title={t("aiAnalysisResult") || "Screening Result"}
        showBack
        onBackPress={() => router.back()}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.processingContent}
        >
          <View style={styles.processingHero}>
            <View style={styles.processingIcon}>
              <ActivityIndicator size="large" color={colors.teal800} />
            </View>
            <Text style={styles.processingEyebrow}>AI RETINAL SCREENING</Text>
            <Text style={styles.processingTitle}>Screening submitted</Text>
            <Text style={styles.processingSubtitle}>
              Your retinal image has been saved. The result will appear here when
              screening analysis is complete.
            </Text>
          </View>

          <Card variant="elevated" style={styles.processingCard}>
            <View style={styles.processingStatusRow}>
              <View>
                <Text style={styles.processingStatusLabel}>Status</Text>
                <Text style={styles.processingStatusValue}>{waitingStatus}</Text>
              </View>
              <StatusBadge status={waitingStatus} />
            </View>

            <View style={styles.processingDivider} />

            <View style={styles.processingStep}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.processingStepText}>Retinal image uploaded successfully</Text>
            </View>
            <View style={styles.processingStep}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.processingStepText}>Prediction record created</Text>
            </View>
            <View style={styles.processingStep}>
              <ActivityIndicator size="small" color={colors.teal800} />
              <Text style={styles.processingStepText}>Waiting for screening analysis</Text>
            </View>

            <Text style={styles.processingHint}>
              This page refreshes automatically. When analysis is complete, the
              screening result and available report actions will appear here.
            </Text>
          </Card>

          <Card style={styles.screeningIdCard}>
            <Text style={styles.screeningIdLabel}>SCREENING ID</Text>
            <Text style={styles.screeningIdValue} selectable>
              {predictionId}
            </Text>
          </Card>

          {loadError ? <Text style={styles.pollWarning}>{loadError}</Text> : null}

          <Button
            title={t("backToDashboard") || "Back to Dashboard"}
            icon="home-outline"
            variant="outline"
            onPress={() => router.replace("/tabs/dashboard" as any)}
          />
        </ScrollView>
      </AppShell>
    );
  }

  if (result?.status === "Failed") {
    return (
      <AppShell
        role="Patient"
        title={t("aiAnalysisResult") || "Screening Result"}
        showBack
        onBackPress={() => router.back()}
      >
        <View style={styles.stateCenter}>
          <IconContainer
            name="close-circle-outline"
            size={34}
            color={colors.error}
            backgroundColor={colors.errorBg}
          />
          <Text style={styles.stateTitle}>Screening could not be completed</Text>
          <Text style={styles.stateText}>
            The screening record is safe, but processing failed. Please submit a
            new retinal image or try again later.
          </Text>
          <Button
            title={t("uploadAScan") || "Upload Eye Scan"}
            icon="cloud-upload-outline"
            onPress={() => router.replace("/upload" as any)}
            style={styles.stateButton}
          />
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell role="Patient" title={t("aiAnalysisResult") || "Screening Result"} showBack onBackPress={() => router.back()}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerGroup}>
          <Text style={styles.eyebrow}>AI RETINAL GRADING</Text>
          <Text style={styles.title}>{t("aiAnalysisResult") || "Screening Analysis Result"}</Text>
          <Text style={styles.subtitle}>{t("yourRetinalAnalysisProcessed") || "AI-assisted automated Diabetic Retinopathy classification."}</Text>
        </View>

        {!result ? (
          <Card style={styles.emptyCard}>
            <IconContainer name="analytics-outline" size={32} color={colors.teal800} backgroundColor={colors.teal100} />
            <Text style={styles.emptyTitle}>{t("noAnalysisAvailable") || "No Analysis Found"}</Text>
            <Text style={styles.emptySub}>{t("uploadRetinalImageToGenerate") || "Upload a retinal scan image to generate analysis results."}</Text>
            <Button
              title={t("uploadAScan") || "Upload Eye Scan"}
              icon="cloud-upload-outline"
              onPress={() => router.push("/upload" as any)}
              style={styles.uploadBtn}
            />
          </Card>
        ) : (
          <>
            {/* Diagnosis Main Card */}
            <Card variant="elevated" style={styles.diagnosisCard}>
              <View style={styles.diagnosisRow}>
                <IconContainer name="eye" size={30} color={colors.teal900} backgroundColor={colors.teal100} />
                <View style={styles.diagnosisMain}>
                  <Text style={styles.sectionLabel}>{t("aiDiagnosis") || "AI CLASSIFICATION"}</Text>
                  <Text style={styles.diagnosisTitleText}>{result.diagnosis}</Text>
                </View>
                <StatusBadge status={result.riskLevel || "Completed"} />
              </View>
            </Card>

            {/* Metrics Row */}
            <View style={styles.metricsRow}>
              <Card style={styles.metricCard}>
                <Text style={styles.metricLabel}>{t("confidence") || "AI Confidence"}</Text>
                <Text style={styles.metricVal}>{result.confidence || "N/A"}</Text>
              </Card>

              <Card style={styles.metricCard}>
                <Text style={styles.metricLabel}>Risk Score</Text>
                <Text style={styles.metricVal}>{riskDisplay}</Text>
              </Card>
            </View>

            {/* Confidence Gauge */}
            <Card style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.boxTitle}>{t("predictionConfidence") || "Model Confidence Score"}</Text>
                <Text style={styles.confidenceNum}>{confidenceValue}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${confidenceValue}%` }]} />
              </View>
            </Card>

            {result.gradCam ? (
              <Card style={styles.gradCamCard}>
                <View style={styles.cardHeaderTitleRow}>
                  <IconContainer
                    name="flame-outline"
                    size={20}
                    color={colors.warning}
                    backgroundColor={colors.warningBg}
                  />
                  <Text style={styles.cardHeaderTitle}>Grad-CAM Explainability</Text>
                </View>
                <Text style={styles.noDataText}>
                  Explainability data is attached to this completed prediction and
                  is available for the medical-report pipeline.
                </Text>
              </Card>
            ) : null}

            {/* Clinical Findings */}
            <Card style={styles.listCard}>
              <View style={styles.cardHeaderTitleRow}>
                <IconContainer name="search-outline" size={20} color={colors.teal800} backgroundColor={colors.teal50} />
                <Text style={styles.cardHeaderTitle}>{t("clinicalFindings") || "Clinical Findings"}</Text>
              </View>

              {result.findings && result.findings.length > 0 ? (
                result.findings.map((item, idx) => (
                  <View key={idx} style={styles.bulletRow}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.teal800} />
                    <Text style={styles.bulletText}>{item}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noDataText}>{t("noClinicalFindings") || "No specific lesions detected."}</Text>
              )}
            </Card>

            {/* Recommendations */}
            <Card style={styles.listCard}>
              <View style={styles.cardHeaderTitleRow}>
                <IconContainer name="medical-outline" size={20} color={colors.info} backgroundColor={colors.infoBg} />
                <Text style={styles.cardHeaderTitle}>{t("recommendations") || "Clinical Recommendations"}</Text>
              </View>

              {result.recommendations && result.recommendations.length > 0 ? (
                result.recommendations.map((item, idx) => (
                  <View key={idx} style={styles.bulletRow}>
                    <Ionicons name="shield-checkmark" size={18} color={colors.info} />
                    <Text style={styles.bulletText}>{item}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noDataText}>{t("noRecommendations") || "Follow standard annual diabetic eye exam guidelines."}</Text>
              )}
            </Card>

            {/* Automated Medical Reports */}
            <Card variant="elevated" style={styles.reportCard}>
              <View style={styles.reportHeaderRow}>
                <IconContainer name="document-text-outline" size={22} color={colors.teal900} backgroundColor={colors.teal100} />
                <View style={styles.reportHeaderText}>
                  <Text style={styles.cardHeaderTitle}>Automated Medical PDF</Text>
                  <Text style={styles.reportDescription}>
                    Generate a professional screening report with DR classification, risk score, HbA1c, medication adherence, recommendations, Grad-CAM when available, and QR verification.
                  </Text>
                </View>
              </View>

              <View style={styles.generateRow}>
                <Button
                  title={generatingLanguage === "en" ? "Generating..." : "Generate English PDF"}
                  icon="document-outline"
                  size="sm"
                  onPress={() => handleGenerateReport("en")}
                  loading={generatingLanguage === "en"}
                  disabled={Boolean(generatingLanguage)}
                  style={styles.generateButton}
                />
                <Button
                  title={generatingLanguage === "ur" ? "Generating..." : "Generate Urdu / اردو PDF"}
                  icon="language-outline"
                  variant="secondary"
                  size="sm"
                  onPress={() => handleGenerateReport("ur")}
                  loading={generatingLanguage === "ur"}
                  disabled={Boolean(generatingLanguage)}
                  style={styles.generateButton}
                />
              </View>

              {reportsLoading ? (
                <View style={styles.reportLoadingRow}>
                  <ActivityIndicator size="small" color={colors.teal800} />
                  <Text style={styles.reportMuted}>Checking existing reports...</Text>
                </View>
              ) : reports.length > 0 ? (
                <View style={styles.reportList}>
                  {reports.map((report) => (
                    <View key={report.reportId} style={styles.generatedReportRow}>
                      <View style={styles.generatedReportMeta}>
                        <Text style={styles.generatedReportTitle}>{reportLanguageLabel(report.language)} PDF</Text>
                        <Text style={styles.generatedReportSub}>
                          {report.reportNumber || report.reportId}
                          {report.generatedAt ? ` • ${new Date(report.generatedAt).toLocaleDateString()}` : ""}
                        </Text>
                      </View>
                      <View style={styles.reportActions}>
                        <Button
                          title="Download"
                          icon="download-outline"
                          variant="outline"
                          size="sm"
                          loading={reportActionId === report.reportId}
                          disabled={Boolean(reportActionId)}
                          onPress={() => handleDownloadReport(report)}
                        />
                        <Button
                          title="Share / WhatsApp"
                          icon="share-social-outline"
                          size="sm"
                          disabled={Boolean(reportActionId)}
                          onPress={() => handleShareReport(report)}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.reportMuted}>No PDF has been generated for this screening yet.</Text>
              )}
            </Card>

            {/* Actions */}
            <Button
              title={t("viewAiDoctorSummary") || "View AI Doctor Summary"}
              icon="document-text-outline"
              onPress={() => router.push({ pathname: "/doctor-summary", params: { predictionId: String(predictionId) } } as any)}
              style={styles.actionBtn}
            />

            <Button
              title="Explore Educational Vision Simulation"
              variant="secondary"
              icon="git-compare-outline"
              onPress={() => router.push({ pathname: "/vision-simulator", params: { mode: "dr", stage: String(result.stage || result.diagnosis || "") } } as any)}
              style={styles.actionBtn}
            />
            <View style={styles.simulationNote}>
              <Ionicons name="information-circle-outline" size={17} color={colors.info} />
              <Text style={styles.simulationNoteText}>Illustrative only. A DR stage does not predict exactly what you personally see.</Text>
            </View>

            {/* Phase 8: continue the screening journey into longitudinal care. */}
            <Card variant="accent" style={styles.integrationCard}>
              <View style={styles.integrationHeader}>
                <IconContainer
                  name="git-branch-outline"
                  size={20}
                  color={colors.teal900}
                  backgroundColor={colors.surface}
                />
                <View style={styles.integrationMain}>
                  <Text style={styles.integrationTitle}>Continue your care journey</Text>
                  <Text style={styles.integrationText}>
                    This screening now contributes to your DR and risk trends. Generated PDFs, health metrics, and medication adherence remain connected to the same longitudinal history.
                  </Text>
                </View>
              </View>
              <View style={styles.integrationActions}>
                <Button
                  title="View Progress Dashboard"
                  icon="stats-chart-outline"
                  size="sm"
                  onPress={() => router.push("/analytics" as any)}
                />
                <Button
                  title="View Full History"
                  icon="time-outline"
                  variant="outline"
                  size="sm"
                  onPress={() => router.push("/tabs/history" as any)}
                />
              </View>
            </Card>
          </>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  integrationCard: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  integrationHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  integrationMain: {
    flex: 1,
  },
  integrationTitle: {
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.bold,
    color: colors.teal900,
  },
  integrationText: {
    marginTop: 4,
    fontSize: typography.sizes.small,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  integrationActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  stateCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  stateTitle: {
    fontSize: typography.sizes.h2,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: spacing.md,
    textAlign: "center",
  },
  stateText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    lineHeight: 21,
    textAlign: "center",
    marginTop: spacing.sm,
    maxWidth: 520,
  },
  stateButton: {
    marginTop: spacing.lg,
  },
  processingContent: {
    paddingBottom: spacing.xxxl + 40,
  },
  processingHero: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  processingIcon: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.teal50,
    marginBottom: spacing.md,
  },
  processingEyebrow: {
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
    color: colors.teal800,
    letterSpacing: 1.1,
  },
  processingTitle: {
    fontSize: typography.sizes.h1,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: 4,
    textAlign: "center",
  },
  processingSubtitle: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
    marginTop: spacing.sm,
    maxWidth: 560,
  },
  processingCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  processingStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  processingStatusLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  processingStatusValue: {
    fontSize: typography.sizes.h3,
    fontWeight: typography.weights.bold,
    color: colors.teal900,
    marginTop: 2,
  },
  processingDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.md,
  },
  processingStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  processingStepText: {
    flex: 1,
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
  processingHint: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    lineHeight: 17,
    marginTop: spacing.sm,
  },
  screeningIdCard: {
    backgroundColor: colors.teal50,
    marginBottom: spacing.md,
  },
  screeningIdLabel: {
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
    color: colors.teal800,
    letterSpacing: 0.6,
  },
  screeningIdValue: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 4,
  },
  pollWarning: {
    fontSize: typography.sizes.xs,
    color: colors.warning,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  gradCamCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  loadingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  loadingTitle: {
    fontSize: typography.sizes.h3,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  loadingText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginTop: 4,
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
  diagnosisCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  diagnosisRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  diagnosisMain: {
    flex: 1,
    marginLeft: spacing.md,
    paddingRight: spacing.xs,
  },
  sectionLabel: {
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
    color: colors.teal800,
    letterSpacing: 0.5,
  },
  diagnosisTitleText: {
    fontSize: typography.sizes.h2,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  metricLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  metricVal: {
    fontSize: typography.sizes.h3,
    fontWeight: typography.weights.bold,
    color: colors.teal900,
    marginTop: 4,
  },
  progressCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  boxTitle: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  confidenceNum: {
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.bold,
    color: colors.teal800,
  },
  progressTrack: {
    height: 10,
    backgroundColor: colors.borderLight,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.teal800,
    borderRadius: radius.pill,
  },
  listCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  cardHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  cardHeaderTitle: {
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  bulletText: {
    flex: 1,
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  noDataText: {
    fontSize: typography.sizes.small,
    color: colors.textMuted,
  },
  reportCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.teal200,
  },
  reportHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  reportHeaderText: {
    flex: 1,
  },
  reportDescription: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    lineHeight: 19,
    marginTop: 4,
  },
  generateRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  generateButton: {
    marginBottom: 2,
  },
  reportLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  reportMuted: {
    fontSize: typography.sizes.small,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  reportList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  generatedReportRow: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.teal50,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  generatedReportMeta: {
    flex: 1,
  },
  generatedReportTitle: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  generatedReportSub: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 3,
  },
  reportActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  actionBtn: {
    marginBottom: spacing.sm,
  },
  simulationNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    marginTop: -2,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  simulationNoteText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: typography.sizes.tiny,
    lineHeight: 17,
  },
  emptyCard: {
    padding: spacing.xxl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
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
  uploadBtn: {
    marginTop: spacing.md,
  },
});
