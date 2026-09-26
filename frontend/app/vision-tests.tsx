import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../services/i18n";

import AppShell from "../design/components/AppShell";
import Card from "../design/components/card";
import IconContainer from "../design/components/IconContainer";
import StatusBadge from "../design/components/StatusBadge";
import Button from "../design/components/Button";
import colors from "../design/tokens/colors";
import spacing from "../design/tokens/spacing";
import typography from "../design/tokens/typography";

import { useThemeRefresh } from "../providers/AppThemeProvider";
export default function VisionTestsHubScreen() {
  useThemeRefresh();
  const { t } = useLanguage();

  const testCards = [
    {
      title: t("visualAcuity") || "Visual Acuity Test",
      description: t("visualAcuityDescription") || "Measure distance visual clarity using Tumbling E optotypes.",
      icon: "eye-outline" as const,
      color: colors.teal800,
      bgColor: colors.teal100,
      duration: t("visualAcuityDuration") || "2 - 3 min",
      route: "/visual-acuity",
    },
    {
      title: t("amslerGrid") || "Amsler Grid Test",
      description: t("amslerGridDescription") || "Detect macular distortion, scotoma, or metamorphopsia.",
      icon: "grid-outline" as const,
      color: colors.teal900,
      bgColor: colors.teal50,
      duration: t("amslerGridDuration") || "1 - 2 min",
      route: "/amsler-grid",
    },
    {
      title: t("colorVision") || "Ishihara Color Vision",
      description: t("colorVisionDescription") || "Screen for red-green & blue-yellow color perception deficiency.",
      icon: "color-palette-outline" as const,
      color: colors.warning,
      bgColor: colors.warningBg,
      duration: t("colorVisionDuration") || "3 - 5 min",
      route: "/color-vision",
    },
  ];

  return (
    <AppShell role="Patient" title={t("visionTests") || "Vision Tests"} showBack onBackPress={() => router.back()}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerGroup}>
          <Text style={styles.eyebrow}>DIGITAL OPHTHALMOLOGY</Text>
          <Text style={styles.title}>{t("visionTests") || "Vision Tests & Screening"}</Text>
          <Text style={styles.subtitle}>
            {t("visionTestsSubtitle") || "Perform interactive digital eye screening tests to monitor visual function."}
          </Text>
        </View>

        {/* Instructions Notice Card */}
        <Card variant="accent" style={styles.noticeCard}>
          <View style={styles.noticeRow}>
            <IconContainer name="information-circle-outline" size={24} color={colors.teal900} backgroundColor={colors.surface} />
            <View style={styles.noticeTextGroup}>
              <Text style={styles.noticeTitle}>{t("beforeYouBegin") || "Instructions Before You Begin"}</Text>
              <Text style={styles.noticeText}>
                {t("visionTestsNotice") || "Ensure comfortable lighting, hold device at arm's length (approx 40cm), and wear corrective glasses if prescribed."}
              </Text>
            </View>
          </View>
        </Card>

        {/* Tests List */}
        <Text style={styles.sectionTitle}>{t("availableTests") || "Available Interactive Tests"}</Text>
        <View style={styles.testsList}>
          {testCards.map((test) => (
            <Card
              key={test.route}
              onPress={() => router.push(test.route as any)}
              style={styles.testCard}
              accessibilityLabel={`${test.title}. ${test.description}`}
            >
              <View style={styles.testCardRow}>
                <IconContainer name={test.icon} size={28} color={test.color} backgroundColor={test.bgColor} />
                <View style={styles.testMain}>
                  <View style={styles.testTitleRow}>
                    <Text style={styles.testTitle}>{test.title}</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </View>
                  <Text style={styles.testDesc}>{test.description}</Text>
                  <View style={styles.durationTag}>
                    <Ionicons name="time-outline" size={14} color={colors.teal800} />
                    <Text style={styles.durationText}>{test.duration}</Text>
                  </View>
                </View>
              </View>
            </Card>
          ))}
        </View>

        {/* Disclaimer Footer */}
        <Card style={styles.footerCard}>
          <View style={styles.footerRow}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.teal800} />
            <Text style={styles.footerText}>
              {t("visionTestsFooter") || "These screening games are designed for monitoring and do not replace formal clinical examinations."}
            </Text>
          </View>
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
  noticeCard: {
    backgroundColor: colors.teal50,
    marginBottom: spacing.lg,
  },
  noticeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  noticeTextGroup: {
    flex: 1,
    marginLeft: spacing.md,
  },
  noticeTitle: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    color: colors.teal900,
  },
  noticeText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  testsList: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  testCard: {
    backgroundColor: colors.surface,
  },
  testCardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  testMain: {
    flex: 1,
    marginLeft: spacing.md,
  },
  testTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  testTitle: {
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  testDesc: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  durationTag: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
    gap: 4,
  },
  durationText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.teal800,
  },
  footerCard: {
    backgroundColor: colors.surface,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  footerText: {
    flex: 1,
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    lineHeight: 16,
  },
});
