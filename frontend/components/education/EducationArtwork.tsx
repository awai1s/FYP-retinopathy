import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { EducationImageKey } from "../../content/educationContent";
import colors from "../../design/tokens/colors";
import radius from "../../design/tokens/radius";
import typography from "../../design/tokens/typography";

const artwork: Record<EducationImageKey, { icon: keyof typeof Ionicons.glyphMap; label: string; colors: [string, string, ...string[]] }> = {
  retina: { icon: "eye-outline", label: "RETINA", colors: ["#062F35", "#0D9488", "#2DD4BF"] },
  screening: { icon: "scan-outline", label: "SCREENING", colors: ["#0B3557", "#0F6C8D", "#2AA7C8"] },
  glucose: { icon: "water-outline", label: "DIABETES", colors: ["#3B2D0B", "#B7791F", "#F6AD55"] },
  safety: { icon: "shield-checkmark-outline", label: "EYE SAFETY", colors: ["#163A32", "#1F7A63", "#4DD4AC"] },
  medicine: { icon: "medkit-outline", label: "MEDICATION", colors: ["#3D284D", "#7C3E8B", "#C084D2"] },
  lifestyle: { icon: "walk-outline", label: "LIFESTYLE", colors: ["#1D3B22", "#478447", "#8ACB75"] },
  warning: { icon: "warning-outline", label: "WARNING SIGNS", colors: ["#4A2512", "#B45309", "#F59E0B"] },
  treatment: { icon: "medical-outline", label: "TREATMENT", colors: ["#2E2B5E", "#4F46A5", "#818CF8"] },
};

export default function EducationArtwork({ image, compact = false }: { image: EducationImageKey; compact?: boolean }) {
  const item = artwork[image];
  return (
    <LinearGradient colors={item.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.base, compact ? styles.compact : styles.large]}>
      <View style={styles.glowOne} />
      <View style={styles.glowTwo} />
      <View style={[styles.iconShell, compact && styles.iconShellCompact]}>
        <Ionicons name={item.icon} size={compact ? 23 : 38} color={colors.white} />
      </View>
      <Text style={[styles.label, compact && styles.labelCompact]}>{item.label}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  base: { overflow: "hidden", borderRadius: radius.lg, justifyContent: "space-between", position: "relative" },
  large: { minHeight: 190, padding: 22 },
  compact: { width: 94, minHeight: 94, padding: 12 },
  glowOne: { position: "absolute", width: 150, height: 150, borderRadius: 90, backgroundColor: "rgba(255,255,255,0.10)", right: -45, top: -65 },
  glowTwo: { position: "absolute", width: 90, height: 90, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.08)", left: -25, bottom: -35 },
  iconShell: { width: 66, height: 66, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  iconShellCompact: { width: 42, height: 42, borderRadius: 15 },
  label: { color: colors.white, fontSize: typography.sizes.small, fontWeight: typography.weights.bold, letterSpacing: 1.2 },
  labelCompact: { fontSize: 9, letterSpacing: 0.7 },
});
