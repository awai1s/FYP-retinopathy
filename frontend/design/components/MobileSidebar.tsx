import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, usePathname } from "expo-router";
import colors from "../tokens/colors";
import radius from "../tokens/radius";
import spacing from "../tokens/spacing";
import typography from "../tokens/typography";
import shadows from "../tokens/shadows";
import LogoutConfirmation from "../../components/LogoutConfirmation";
import SidebarNavItem, { NavItemConfig } from "./SidebarNavItem";
import { removeToken } from "../../services/storage";
import { clearAllPrivateOfflineData } from "../../services/offlineCache";
import { useLanguage } from "../../services/i18n";
import { useAppTheme } from "../../providers/AppThemeProvider";

const SCREEN_WIDTH = Dimensions.get("window").width;
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.86, 340);

export type UserRoleType = "Patient" | "Doctor" | "Hospital" | "SuperAdmin";

export interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  role: UserRoleType;
  navItems: NavItemConfig[];
  userName?: string;
  userEmail?: string;
}

export const MobileSidebar: React.FC<MobileSidebarProps> = ({
  isOpen,
  onClose,
  role,
  navItems,
  userName = "User",
  userEmail,
}) => {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { reduceMotion, eyeFriendly } = useAppTheme();
  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      animValue.setValue(isOpen ? 1 : 0);
      return;
    }
    Animated.spring(animValue, {
      toValue: isOpen ? 1 : 0,
      useNativeDriver: true,
      friction: 9,
      tension: 85,
    }).start();
  }, [isOpen, animValue, reduceMotion]);

  const drawerTranslateX = animValue.interpolate({ inputRange: [0, 1], outputRange: [-DRAWER_WIDTH - 20, 0] });
  const backdropOpacity = animValue.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  const handleNavigate = (route: string) => {
    onClose();
    setTimeout(() => router.push(route as any), 120);
  };

  const confirmAndLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await clearAllPrivateOfflineData();
      await removeToken();
      setLogoutConfirmVisible(false);
      onClose();
      router.replace("/auth/login" as any);
    } catch (err: any) {
      Alert.alert(t("error") || "Error", err?.message || t("logoutUnavailable") || "Logout unavailable. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <View style={[StyleSheet.absoluteFillObject, styles.overlayRoot]} pointerEvents={isOpen ? "auto" : "none"}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.drawer, { width: DRAWER_WIDTH, transform: [{ translateX: drawerTranslateX }] }]}>
        <LinearGradient
          colors={[colors.drawerBackgroundDark, colors.drawerBackground, "#0A373B"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="none" style={styles.drawerGlow} />

        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.brandRow}>
              <View style={styles.brandLogo}>
                <Ionicons name="eye-outline" size={19} color={colors.navyInk} />
              </View>
              <View>
                <Text style={styles.brandEyebrow}>RETINAL HEALTH</Text>
                <Text style={styles.brandTitle}>EyeCare AI</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close navigation menu">
              <Ionicons name="close" size={21} color={colors.textWhite} />
            </TouchableOpacity>
          </View>

          <View style={styles.profileCard}>
            <View style={styles.avatarRing}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text></View>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName} numberOfLines={1}>{userName}</Text>
              {userEmail ? <Text style={styles.profileEmail} numberOfLines={1}>{userEmail}</Text> : null}
              <View style={styles.roleBadge}>
                <View style={styles.roleDot} />
                <Text style={styles.roleText}>{role} workspace</Text>
              </View>
            </View>
          </View>
        </View>

        <ScrollView style={styles.navList} contentContainerStyle={styles.navListContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.menuHeader}>NAVIGATION</Text>
          {navItems.map((item) => {
            const active = pathname === item.route || (item.route !== "/" && pathname?.startsWith(item.route));
            return <SidebarNavItem key={item.route} item={item} isActive={active} onPress={() => handleNavigate(item.route)} />;
          })}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.secureRow}>
            <Ionicons name="shield-checkmark-outline" size={15} color={colors.teal300} />
            <Text style={styles.secureText}>Secure authenticated session</Text>
          </View>
          <TouchableOpacity onPress={() => setLogoutConfirmVisible(true)} style={[styles.logoutBtn, eyeFriendly && styles.eyeFriendlyLogout]} activeOpacity={0.82} accessibilityRole="button" accessibilityLabel="Log out">
            <Ionicons name="log-out-outline" size={19} color={colors.errorBorder} />
            <Text style={styles.logoutText}>{t("logout") || "Log out"}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <LogoutConfirmation
        visible={logoutConfirmVisible}
        loading={loggingOut}
        onCancel={() => setLogoutConfirmVisible(false)}
        onConfirm={() => void confirmAndLogout()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  overlayRoot: { zIndex: 10000, elevation: 10000 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.backdropOverlay, zIndex: 998 },
  drawer: { position: "absolute", top: 0, bottom: 0, left: 0, zIndex: 999, ...shadows.drawer3D, flexDirection: "column", overflow: "hidden" },
  drawerGlow: { position: "absolute", width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(39,229,198,0.10)", right: -120, top: -70 },
  header: { paddingTop: Platform.OS === "ios" ? 52 : 36, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xl },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  brandLogo: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.neonAqua, alignItems: "center", justifyContent: "center", shadowColor: colors.neonAqua, shadowOpacity: 0.25, shadowRadius: 10 },
  brandEyebrow: { color: colors.teal300, fontFamily: typography.headingFamily, fontSize: 8, fontWeight: typography.weights.extraBold, letterSpacing: 1.1 },
  brandTitle: { color: colors.white, fontFamily: typography.headingFamily, fontSize: typography.sizes.h3, fontWeight: typography.weights.extraBold, letterSpacing: -0.35 },
  closeBtn: { width: 38, height: 38, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", alignItems: "center", justifyContent: "center" },
  profileCard: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.07)", borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
  avatarRing: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, borderColor: "rgba(39,229,198,0.45)", alignItems: "center", justifyContent: "center", marginRight: spacing.md },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.teal600, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.white, fontFamily: typography.headingFamily, fontSize: typography.sizes.h3, fontWeight: typography.weights.extraBold },
  profileInfo: { flex: 1 },
  profileName: { color: colors.white, fontFamily: typography.headingFamily, fontSize: typography.sizes.body, fontWeight: typography.weights.bold },
  profileEmail: { color: colors.textLight, fontFamily: typography.fontFamily, fontSize: typography.sizes.xs, marginTop: 1, opacity: 0.82 },
  roleBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(39,229,198,0.10)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, alignSelf: "flex-start", marginTop: 6 },
  roleDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.neonAqua },
  roleText: { color: colors.textLight, fontFamily: typography.headingFamily, fontSize: typography.sizes.tiny, fontWeight: typography.weights.semibold },
  navList: { flex: 1 },
  navListContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.lg },
  menuHeader: { color: colors.teal300, fontFamily: typography.headingFamily, fontSize: 9, fontWeight: typography.weights.extraBold, letterSpacing: 1.4, marginBottom: spacing.sm, marginLeft: spacing.xs },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" },
  secureRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginBottom: spacing.sm },
  secureText: { color: colors.textLight, fontFamily: typography.fontFamily, fontSize: typography.sizes.tiny, opacity: 0.75 },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", minHeight: 48, paddingHorizontal: spacing.lg, borderRadius: radius.lg, backgroundColor: "rgba(216,75,87,0.12)", borderWidth: 1, borderColor: "rgba(245,190,196,0.20)" },
  logoutText: { color: colors.errorBorder, fontFamily: typography.headingFamily, fontSize: typography.sizes.body, fontWeight: typography.weights.bold, marginLeft: spacing.sm },
  eyeFriendlyLogout: { minHeight: 54 },
});

export default MobileSidebar;
