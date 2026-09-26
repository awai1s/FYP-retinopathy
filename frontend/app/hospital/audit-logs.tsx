import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { getHospitalAuditLogs, AuditLog } from "../../services/audit";
import { useLanguage } from "../../services/i18n";

import AppShell from "../../design/components/AppShell";
import Card from "../../design/components/card";
import IconContainer from "../../design/components/IconContainer";
import colors from "../../design/tokens/colors";
import spacing from "../../design/tokens/spacing";
import typography from "../../design/tokens/typography";
import radius from "../../design/tokens/radius";

import { useThemeRefresh } from "../../providers/AppThemeProvider";
export default function HospitalAuditLogsScreen() {
  useThemeRefresh();
  const { t } = useLanguage();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      setLogs(await getHospitalAuditLogs());
    } catch (err: any) {
      setError(err?.message || t("unableToLoadAuditLogs") || "Unable to load audit logs.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <AppShell role="Hospital" title={t("auditLogs") || "Security Audit Logs"}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={colors.teal800} size="large" />
          <Text style={styles.loadingText}>{t("loadingAuditLogs") || "Loading Audit Logs..."}</Text>
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell role="Hospital" title={t("auditLogs") || "System Audit Trail"} showBack onBackPress={() => router.back()}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.teal800} />}
      >
        <View style={styles.headerGroup}>
          <Text style={styles.eyebrow}>SECURITY & COMPLIANCE</Text>
          <Text style={styles.title}>{t("auditLogs") || "System Audit Trail"}</Text>
          <Text style={styles.subtitle}>{t("auditLogsDescription") || "Immutable log of patient data access, report uploads, and clinical actions."}</Text>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={20} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {logs.length === 0 && !error ? (
          <Card style={styles.emptyCard}>
            <IconContainer name="shield-checkmark-outline" size={32} color={colors.textMuted} backgroundColor={colors.teal50} />
            <Text style={styles.emptyTitle}>{t("noAuditActivity") || "No Audit Log Activity"}</Text>
            <Text style={styles.emptySub}>System security events and access logs will be recorded here.</Text>
          </Card>
        ) : null}

        <View style={styles.list}>
          {logs.map((log) => (
            <Card key={log.id} style={styles.logCard}>
              <View style={styles.logRow}>
                <IconContainer name="key-outline" size={20} color={colors.teal800} backgroundColor={colors.teal100} />
                <View style={styles.logMain}>
                  <Text style={styles.logActionText}>{log.action}</Text>
                  <Text style={styles.logResourceText}>
                    {log.resource} {log.resourceId ? `· ${log.resourceId}` : ""}
                  </Text>
                  <Text style={styles.logDateText}>
                    {log.createdAt ? new Date(log.createdAt).toLocaleString() : (t("dateUnavailable") || "N/A")}
                  </Text>
                </View>
              </View>
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
    gap: spacing.sm,
  },
  logCard: {
    backgroundColor: colors.surface,
  },
  logRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  logMain: {
    flex: 1,
    marginLeft: spacing.md,
  },
  logActionText: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  logResourceText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  logDateText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 4,
  },
});