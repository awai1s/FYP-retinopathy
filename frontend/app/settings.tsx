import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";

import AppShell from "../design/components/AppShell";
import Card from "../design/components/card";
import Button from "../design/components/Button";
import spacing from "../design/tokens/spacing";
import radius from "../design/tokens/radius";
import typography from "../design/tokens/typography";
import { getUserRole, type UserRole } from "../services/storage";
import { useAppTheme } from "../providers/AppThemeProvider";
import type { TextScale, ThemeMode } from "../design/theme/runtimeTheme";

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap; detail: string }> = [
  { value: "system", label: "System", icon: "phone-portrait-outline", detail: "Follow your device appearance" },
  { value: "light", label: "Light", icon: "sunny-outline", detail: "Bright clinical workspace" },
  { value: "dark", label: "Dark", icon: "moon-outline", detail: "Low-glare dark workspace" },
];

const TEXT_OPTIONS: Array<{ value: TextScale; label: string; sample: string }> = [
  { value: "normal", label: "Normal", sample: "Aa" },
  { value: "large", label: "Large", sample: "Aa" },
  { value: "extraLarge", label: "Extra Large", sample: "Aa" },
];

export default function AppearanceSettingsScreen() {
  const {
    themeMode,
    effectiveMode,
    colors,
    eyeFriendly,
    textScale,
    reduceMotion,
    setThemeMode,
    setEyeFriendly,
    setTextScale,
    setReduceMotion,
    resetAppearance,
  } = useAppTheme();

  const [role, setRole] = useState<UserRole | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);

  useEffect(() => {
    let active = true;
    void getUserRole().then((value) => {
      if (!active) return;
      setRole(value);
      setLoadingRole(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const styles = useMemo(() => createStyles(colors, eyeFriendly), [colors, eyeFriendly]);

  if (loadingRole) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading appearance settings...</Text>
      </View>
    );
  }

  if (!role) {
    return <Redirect href="/auth/login" />;
  }

  return (
    <AppShell
      role={role}
      title="Appearance & Accessibility"
      subtitle="Theme, readability and motion preferences"
      showBack
      onBackPress={() => router.back()}
      showAssistant={false}
    >
      <View style={styles.pageIntro}>
        <Text style={styles.eyebrow}>PHASE 10B</Text>
        <Text style={styles.pageTitle}>Make EyeCare comfortable for your eyes</Text>
        <Text style={styles.pageSubtitle}>
          Your choices are saved on this device and applied across Patient, Doctor and Hospital screens.
        </Text>
      </View>

      <Card variant="elevated" style={styles.sectionCard}>
        <View style={styles.sectionHeadingRow}>
          <View style={[styles.sectionIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="contrast-outline" size={21} color={colors.primaryStrong} />
          </View>
          <View style={styles.sectionHeadingText}>
            <Text style={styles.sectionTitle}>Theme</Text>
            <Text style={styles.sectionSubtitle}>Currently using {effectiveMode} appearance</Text>
          </View>
        </View>

        <View style={styles.optionGrid}>
          {THEME_OPTIONS.map((option) => {
            const selected = themeMode === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => void setThemeMode(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${option.label} theme. ${option.detail}`}
                style={({ pressed }) => [
                  styles.themeOption,
                  selected && styles.themeOptionSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.themeIconWrap, selected && styles.themeIconWrapSelected]}>
                  <Ionicons
                    name={selected ? "checkmark-circle" : option.icon}
                    size={22}
                    color={selected ? colors.primaryStrong : colors.textSecondary}
                  />
                </View>
                <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{option.label}</Text>
                <Text style={styles.optionDetail}>{option.detail}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card variant="elevated" style={styles.sectionCard}>
        <View style={styles.sectionHeadingRow}>
          <View style={[styles.sectionIcon, { backgroundColor: colors.infoSurface }]}>
            <Ionicons name="eye-outline" size={21} color={colors.info} />
          </View>
          <View style={styles.sectionHeadingText}>
            <Text style={styles.sectionTitle}>Eye-Friendly Mode</Text>
            <Text style={styles.sectionSubtitle}>Increase readability and reduce visual strain</Text>
          </View>
          <Switch
            value={eyeFriendly}
            onValueChange={(value) => void setEyeFriendly(value)}
            trackColor={{ false: colors.borderStrong, true: colors.primary }}
            thumbColor={eyeFriendly ? colors.inverseText : colors.surfaceRaised}
            accessibilityLabel="Eye-Friendly Mode"
          />
        </View>

        <View style={styles.featureList}>
          {[
            "Larger text, controls and touch targets",
            "Higher contrast with stronger card borders",
            "More spacing and clearer status presentation",
            "Reduced decorative depth for a calmer interface",
          ].map((item) => (
            <View key={item} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={styles.featureText}>{item}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card variant="elevated" style={styles.sectionCard}>
        <View style={styles.sectionHeadingRow}>
          <View style={[styles.sectionIcon, { backgroundColor: colors.warningSurface }]}>
            <Ionicons name="text-outline" size={21} color={colors.warning} />
          </View>
          <View style={styles.sectionHeadingText}>
            <Text style={styles.sectionTitle}>Text Size</Text>
            <Text style={styles.sectionSubtitle}>Applied to existing and future EyeCare screens</Text>
          </View>
        </View>

        <View style={styles.textScaleRow}>
          {TEXT_OPTIONS.map((option, index) => {
            const selected = textScale === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => void setTextScale(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  styles.textScaleOption,
                  selected && styles.textScaleOptionSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.sampleText, { fontSize: 15 + index * 3 }, selected && styles.sampleTextSelected]}>{option.sample}</Text>
                <Text style={[styles.textScaleLabel, selected && styles.optionLabelSelected]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card variant="elevated" style={styles.sectionCard}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <View style={styles.settingTitleRow}>
              <Ionicons name="sparkles-outline" size={20} color={colors.primaryStrong} />
              <Text style={styles.settingTitle}>Reduce Motion</Text>
            </View>
            <Text style={styles.settingDescription}>
              Minimizes decorative button, drawer and navigation animations while keeping clinical interactions usable.
            </Text>
          </View>
          <Switch
            value={reduceMotion}
            onValueChange={(value) => void setReduceMotion(value)}
            trackColor={{ false: colors.borderStrong, true: colors.primary }}
            thumbColor={reduceMotion ? colors.inverseText : colors.surfaceRaised}
            accessibilityLabel="Reduce Motion"
          />
        </View>
      </Card>

      <Card variant="accent" style={styles.previewCard}>
        <Text style={styles.previewEyebrow}>LIVE PREVIEW</Text>
        <Text style={styles.previewTitle}>Readable clinical status</Text>
        <Text style={styles.previewBody}>
          Important states use text and icons rather than relying on color alone.
        </Text>
        <View style={styles.previewStatuses}>
          <View style={[styles.previewPill, { backgroundColor: colors.successSurface, borderColor: colors.success }]}>
            <Ionicons name="checkmark-circle" size={17} color={colors.success} />
            <Text style={[styles.previewPillText, { color: colors.success }]}>TAKEN</Text>
          </View>
          <View style={[styles.previewPill, { backgroundColor: colors.errorSurface, borderColor: colors.error }]}>
            <Ionicons name="alert-circle" size={17} color={colors.error} />
            <Text style={[styles.previewPillText, { color: colors.error }]}>MISSED</Text>
          </View>
        </View>
      </Card>

      <Button
        title="Reset Appearance to Defaults"
        icon="refresh-outline"
        variant="outline"
        onPress={() => void resetAppearance()}
        style={styles.resetButton}
      />
    </AppShell>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"], eyeFriendly: boolean) {
  const borderWidth = eyeFriendly ? 1.5 : 1;
  return StyleSheet.create({
    loadingScreen: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
      padding: spacing.xl,
    },
    loadingText: { marginTop: spacing.md, color: colors.textSecondary, fontSize: typography.sizes.body },
    pageIntro: { marginBottom: spacing.xl },
    eyebrow: { color: colors.primaryStrong, fontSize: typography.sizes.tiny, fontWeight: "800", letterSpacing: 1.25 },
    pageTitle: { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: "800", marginTop: 4 },
    pageSubtitle: { color: colors.textSecondary, fontSize: typography.sizes.body, lineHeight: 23, marginTop: 8, maxWidth: 720 },
    sectionCard: { marginBottom: spacing.lg, borderWidth },
    sectionHeadingRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    sectionIcon: { width: eyeFriendly ? 52 : 46, height: eyeFriendly ? 52 : 46, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
    sectionHeadingText: { flex: 1 },
    sectionTitle: { color: colors.textPrimary, fontSize: typography.sizes.subtitle, fontWeight: "800" },
    sectionSubtitle: { color: colors.textSecondary, fontSize: typography.sizes.small, lineHeight: 19, marginTop: 2 },
    optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.lg },
    themeOption: {
      flexGrow: 1,
      flexBasis: 180,
      minHeight: eyeFriendly ? 132 : 116,
      borderWidth,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: eyeFriendly ? spacing.lg + 2 : spacing.lg,
      backgroundColor: colors.surfaceSecondary,
    },
    themeOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    themeIconWrap: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceRaised },
    themeIconWrapSelected: { backgroundColor: colors.surface },
    optionLabel: { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: "800", marginTop: spacing.sm },
    optionLabelSelected: { color: colors.primaryStrong },
    optionDetail: { color: colors.textSecondary, fontSize: typography.sizes.xs, lineHeight: 17, marginTop: 3 },
    pressed: { opacity: 0.86 },
    featureList: { gap: spacing.sm, marginTop: spacing.lg },
    featureRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    featureText: { color: colors.textSecondary, flex: 1, fontSize: typography.sizes.small, lineHeight: 20 },
    textScaleRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.lg },
    textScaleOption: {
      minWidth: 130,
      flexGrow: 1,
      alignItems: "center",
      justifyContent: "center",
      minHeight: eyeFriendly ? 98 : 86,
      borderRadius: radius.lg,
      borderWidth,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSecondary,
      padding: spacing.md,
    },
    textScaleOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    sampleText: { color: colors.textPrimary, fontWeight: "800" },
    sampleTextSelected: { color: colors.primaryStrong },
    textScaleLabel: { color: colors.textSecondary, fontSize: typography.sizes.xs, fontWeight: "700", marginTop: 4 },
    settingRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
    settingInfo: { flex: 1 },
    settingTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    settingTitle: { color: colors.textPrimary, fontSize: typography.sizes.subtitle, fontWeight: "800" },
    settingDescription: { color: colors.textSecondary, fontSize: typography.sizes.small, lineHeight: 20, marginTop: 5 },
    previewCard: { marginBottom: spacing.lg, borderWidth },
    previewEyebrow: { color: colors.primaryStrong, fontSize: typography.sizes.tiny, fontWeight: "800", letterSpacing: 1.2 },
    previewTitle: { color: colors.textPrimary, fontSize: typography.sizes.h3, fontWeight: "800", marginTop: 4 },
    previewBody: { color: colors.textSecondary, fontSize: typography.sizes.body, lineHeight: 22, marginTop: 5 },
    previewStatuses: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg },
    previewPill: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: eyeFriendly ? 9 : 7 },
    previewPillText: { fontSize: typography.sizes.xs, fontWeight: "800", letterSpacing: 0.35 },
    resetButton: { alignSelf: "stretch", marginBottom: spacing.xxl },
  });
}
