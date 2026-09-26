import { Alert } from "../../services/alert";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  downloadHospitalReport,
  getHospitalReports,
  HospitalReport,
} from "../../services/hospital";
import { useLanguage } from "../../services/i18n";

import AppShell from "../../design/components/AppShell";
import Card from "../../design/components/card";
import IconContainer from "../../design/components/IconContainer";
import StatusBadge from "../../design/components/StatusBadge";
import Button from "../../design/components/Button";
import colors from "../../design/tokens/colors";
import spacing from "../../design/tokens/spacing";
import typography from "../../design/tokens/typography";
import radius from "../../design/tokens/radius";

import { useThemeRefresh } from "../../providers/AppThemeProvider";
export default function HospitalReportsScreen() {
  useThemeRefresh();
  const { t } = useLanguage();

  const [reports, setReports] = useState<HospitalReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    try {
      setError("");
      setReports(await getHospitalReports());
    } catch (err: any) {
      setError(err?.message || t("unableToLoadClinicalReports") || "Unable to load clinical reports.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      loadReports();
    }, [loadReports])
  );

  const handleDownload = async (report: HospitalReport) => {
    if (!report.id || downloadingId) return;

    setDownloadingId(report.id);

    try {
      await downloadHospitalReport(report.id);
    } catch (err: any) {
      Alert.alert(
        t("downloadUnavailable") || "Download Unavailable",
        err?.message || t("unableToDownloadReport") || "Unable to download report file."
      );
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <AppShell role="Hospital" title={t("clinicalReports") || "Hospital Reports"}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={colors.teal800} size="large" />
          <Text style={styles.loadingText}>{t("loadingClinicalReports") || "Loading Reports Archive..."}</Text>
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell role="Hospital" title={t("clinicalReports") || "Hospital Reports"} showBack onBackPress={() => router.back()}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadReports(); }} tintColor={colors.teal800} />}
      >
        <View style={styles.headerGroup}>
          <Text style={styles.eyebrow}>CLINICAL ARCHIVE</Text>
          <Text style={styles.title}>{t("clinicalReports") || "Clinical Reports Archive"}</Text>
          <Text style={styles.subtitle}>{t("viewAllUploadedClinicalReports") || "View all uploaded lab reports, fundus summaries, and hospital records."}</Text>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={20} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {!error && reports.length === 0 ? (
          <Card style={styles.emptyCard}>
            <IconContainer name="document-text-outline" size={32} color={colors.textMuted} backgroundColor={colors.teal50} />
            <Text style={styles.emptyTitle}>{t("noReportsAvailable") || "No Reports Found"}</Text>
            <Text style={styles.emptySub}>{t("hospitalReportsWillAppearHere") || "Uploaded hospital clinical reports will appear here."}</Text>
          </Card>
        ) : null}

        <View style={styles.list}>
          {reports.map((report) => (
            <Card key={report.id} style={styles.reportCard}>
              <View style={styles.cardHeaderRow}>
                <IconContainer name="document-text-outline" size={24} color={colors.teal800} backgroundColor={colors.teal100} />
                <View style={styles.cardMain}>
                  <Text style={styles.reportType}>{report.reportType}</Text>
                  <Text style={styles.hospitalName}>{report.hospitalName || t("hospitalReport") || "Hospital Record"}</Text>
                </View>
                <StatusBadge status={report.status || "Completed"} size="sm" />
              </View>

              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t("uploadDate") || "Upload Date"}:</Text>
                <Text style={styles.infoVal}>{report.uploadDate || t("notProvided") || "N/A"}</Text>
              </View>

              <Button
                title={downloadingId === report.id ? (t("preparing") || "Downloading...") : (t("downloadReport") || "Download Report PDF")}
                variant="outline"
                icon="download-outline"
                onPress={() => handleDownload(report)}
                disabled={Boolean(downloadingId)}
                loading={downloadingId === report.id}
                style={styles.downloadBtn}
              />
            </Card>
          ))}
        </View>
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
  list: {
    gap: spacing.md,
  },
  reportCard: {
    backgroundColor: colors.surface,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardMain: {
    flex: 1,
    marginLeft: spacing.md,
    paddingRight: spacing.xs,
  },
  reportType: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  hospitalName: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  infoLabel: {
    fontSize: typography.sizes.small,
    color: colors.textMuted,
  },
  infoVal: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  downloadBtn: {
    marginTop: spacing.xs,
  },
});
