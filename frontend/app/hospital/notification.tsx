import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { useLanguage } from "../../services/i18n";
import AppShell from "../../design/components/AppShell";
import Card from "../../design/components/card";
import IconContainer from "../../design/components/IconContainer";
import colors from "../../design/tokens/colors";
import spacing from "../../design/tokens/spacing";
import typography from "../../design/tokens/typography";

import { useThemeRefresh } from "../../providers/AppThemeProvider";
export default function HospitalNotificationsScreen() {
  useThemeRefresh();
  const { t } = useLanguage();

  return (
    <AppShell role="Hospital" title={t("notifications") || "Hospital Alerts"} showBack onBackPress={() => router.back()}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerGroup}>
          <Text style={styles.eyebrow}>HOSPITAL ALERTS</Text>
          <Text style={styles.title}>{t("notifications") || "System Notifications"}</Text>
          <Text style={styles.subtitle}>Hospital center notifications, report status updates, and system messages.</Text>
        </View>

        <Card style={styles.emptyCard}>
          <IconContainer name="notifications-outline" size={32} color={colors.textMuted} backgroundColor={colors.teal50} />
          <Text style={styles.emptyTitle}>{t("noNewNotifications") || "No New Notifications"}</Text>
          <Text style={styles.emptySub}>All administrative and patient report updates are caught up.</Text>
        </Card>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
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
});
