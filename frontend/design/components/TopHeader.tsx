import React from "react";
import {
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import colors from "../tokens/colors";
import spacing from "../tokens/spacing";
import radius from "../tokens/radius";
import typography from "../tokens/typography";
import shadows from "../tokens/shadows";
import LanguageToggle from "../../components/LanguageToggle";
import { useLanguage } from "../../services/i18n";

export interface TopHeaderProps {
  title: string;
  subtitle?: string;
  onOpenDrawer: () => void;
  showBack?: boolean;
  onBackPress?: () => void;
  rightElement?: React.ReactNode;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  title,
  subtitle,
  onOpenDrawer,
  showBack = false,
  onBackPress,
  rightElement,
}) => {
  const { language } = useLanguage();
  const handleBack = () => (onBackPress ? onBackPress() : router.back());

  return (
    <View style={styles.shadowWrap}>
      <StatusBar barStyle="light-content" backgroundColor={colors.navyInk} />
      <LinearGradient
        colors={[colors.navyInk, "#08333A", "#0A3A3D"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerContainer}
      >
        <View pointerEvents="none" style={styles.glow} />
        <View style={[styles.topRow, language === "ur" && styles.rtlRow]}>
          <View style={[styles.leadingActions, language === "ur" && styles.rtlRow]}>
            <TouchableOpacity
              onPress={onOpenDrawer}
              activeOpacity={0.78}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel="Open navigation menu"
            >
              <Ionicons name="menu" size={22} color={colors.white} />
            </TouchableOpacity>
            {showBack ? (
              <TouchableOpacity
                onPress={handleBack}
                activeOpacity={0.78}
                style={styles.iconBtn}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Ionicons name="arrow-back" size={22} color={colors.white} />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.titleWrapper}>
            <View style={styles.brandLine}>
              <View style={styles.brandDot} />
              <Text style={styles.brandLabel}>EYECARE AI</Text>
            </View>
            <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
            {subtitle ? <Text style={styles.headerSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
          </View>

          <View style={styles.rightActions}>
            {rightElement || <LanguageToggle />}
          </View>
        </View>
        <LinearGradient
          colors={["rgba(39,229,198,0)", colors.neonAqua, "rgba(76,201,240,0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.bottomAccent}
        />
      </LinearGradient>
    </View>
  );
};

const topPadding = Platform.select({
  ios: 50,
  android: (StatusBar.currentHeight || 24) + 10,
  web: 16,
  default: 16,
});

const styles = StyleSheet.create({
  shadowWrap: { backgroundColor: colors.navyInk, ...shadows.floating, zIndex: 10 },
  headerContainer: {
    paddingTop: topPadding,
    paddingBottom: 14,
    paddingHorizontal: spacing.lg,
    position: "relative",
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    right: -80,
    top: -95,
    backgroundColor: "rgba(39,229,198,0.12)",
  },
  topRow: { flexDirection: "row", alignItems: "center", minHeight: 52 },
  rtlRow: { flexDirection: "row-reverse" },
  leadingActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  titleWrapper: { flex: 1, marginHorizontal: spacing.md, justifyContent: "center" },
  brandLine: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 1 },
  brandDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.neonAqua, shadowColor: colors.neonAqua, shadowOpacity: 0.8, shadowRadius: 5 },
  brandLabel: { color: colors.teal300, fontFamily: typography.headingFamily, fontSize: 8, fontWeight: typography.weights.extraBold, letterSpacing: 1.2 },
  headerTitle: { color: colors.white, fontFamily: typography.headingFamily, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.extraBold, letterSpacing: -0.25 },
  headerSubtitle: { color: colors.textLight, fontFamily: typography.fontFamily, fontSize: typography.sizes.xs, fontWeight: typography.weights.medium, marginTop: 2 },
  rightActions: { minWidth: 86, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6 },
  bottomAccent: { position: "absolute", left: 0, right: 0, bottom: 0, height: 1 },
});

export default TopHeader;
