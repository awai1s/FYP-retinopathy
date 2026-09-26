import React, { useRef, useSyncExternalStore } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import colors from "../tokens/colors";
import radius from "../tokens/radius";
import spacing from "../tokens/spacing";
import typography from "../tokens/typography";
import { useAppTheme } from "../../providers/AppThemeProvider";
import { getSidebarVisible, subscribeSidebarVisibility } from "../../services/sidebarVisibility";

export interface BottomNavItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
  route: string;
}

export interface BottomNavigationProps {
  items: BottomNavItem[];
  activeRoute: string;
  onTabPress: (route: string) => void;
}

function NavItem({ item, active, onPress }: { item: BottomNavItem; active: boolean; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const { reduceMotion, eyeFriendly } = useAppTheme();
  const animate = (value: number) => {
    if (reduceMotion) { scale.setValue(1); return; }
    Animated.spring(scale, { toValue: value, useNativeDriver: true, friction: 7, tension: 160 }).start();
  };

  const handlePress = () => {
    if (Platform.OS !== "web") void Haptics.selectionAsync();
    onPress();
  };

  return (
    <Animated.View style={[styles.tabTouchable, { transform: [{ scale }] }]}>
      <Pressable
        onPress={handlePress}
        onPressIn={() => animate(0.96)}
        onPressOut={() => animate(1)}
        style={styles.pressable}
        accessibilityRole="tab"
        accessibilityLabel={item.label}
        accessibilityState={{ selected: active }}
      >
        <View style={[styles.tabInner, active && styles.activeTabInner]}>
          {active ? (
            <LinearGradient
              colors={[colors.neonAqua, "#39DCCB", colors.neonBlue]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <Ionicons
            name={active ? item.iconFocused : item.icon}
            size={eyeFriendly ? 22 : 20}
            color={active ? colors.bottomNavActiveIcon : colors.bottomNavInactiveIcon}
          />
          <Text style={[styles.label, eyeFriendly && styles.eyeFriendlyLabel, active && styles.activeLabel]} numberOfLines={1}>{item.label}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ items, activeRoute, onTabPress }) => {
  const sidebarOpen = useSyncExternalStore(subscribeSidebarVisibility, getSidebarVisible, getSidebarVisible);
  const insets = useSafeAreaInsets();
  const { eyeFriendly } = useAppTheme();
  const { width } = useWindowDimensions();
  const safeBottom = Math.max(insets.bottom, spacing.sm);
  const horizontalPadding = Math.max(spacing.lg, Math.min(34, width * 0.04));

  if (sidebarOpen) return null;

  return (
    <View pointerEvents="box-none" style={[styles.safeWrapper, { paddingBottom: safeBottom, paddingHorizontal: horizontalPadding }]}>
      <LinearGradient
        colors={["rgba(6,27,36,0.98)", "rgba(8,42,49,0.98)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.navContainer, eyeFriendly && styles.eyeFriendlyNav]}
      >
        <View pointerEvents="none" style={styles.glowLine} />
        {items.map((item) => {
          const active = activeRoute === item.route || (item.route !== "/" && activeRoute?.startsWith(item.route));
          return <NavItem key={item.key} item={item} active={active} onPress={() => onTabPress(item.route)} />;
        })}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  safeWrapper: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "transparent", alignItems: "center" },
  navContainer: {
    width: "100%",
    maxWidth: 560,
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.bottomNavBorder,
    paddingVertical: 7,
    paddingHorizontal: 7,
    shadowColor: colors.navyInk,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.34,
    shadowRadius: 24,
    elevation: 16,
    overflow: "hidden",
  },
  glowLine: { position: "absolute", top: 0, left: "24%", right: "24%", height: 1, backgroundColor: colors.neonAqua, opacity: 0.6 },
  tabTouchable: { flex: 1, minHeight: 50 },
  pressable: { flex: 1, alignItems: "center", justifyContent: "center" },
  tabInner: { width: "100%", minHeight: 48, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", gap: 2, overflow: "hidden", paddingHorizontal: 6 },
  activeTabInner: { shadowColor: colors.neonAqua, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.22, shadowRadius: 10 },
  label: { color: colors.bottomNavInactiveLabel, fontFamily: typography.headingFamily, fontSize: 10, fontWeight: typography.weights.semibold, marginTop: 1 },
  activeLabel: { color: colors.bottomNavActiveLabel, fontWeight: typography.weights.extraBold },
  eyeFriendlyLabel: { fontSize: 12 },
  eyeFriendlyNav: { minHeight: 74, paddingVertical: 9 },
});

export default BottomNavigation;
