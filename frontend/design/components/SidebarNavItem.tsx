import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import colors from "../tokens/colors";
import radius from "../tokens/radius";
import spacing from "../tokens/spacing";
import typography from "../tokens/typography";

export interface NavItemConfig {
  label: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: string | number;
}

export interface SidebarNavItemProps {
  item: NavItemConfig;
  isActive: boolean;
  onPress: () => void;
}

export const SidebarNavItem: React.FC<SidebarNavItemProps> = ({ item, isActive, onPress }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.navItem, isActive && styles.activeNavItem, pressed && styles.pressed]}
    accessibilityRole="button"
    accessibilityLabel={`${item.label}${isActive ? ", selected" : ""}`}
    accessibilityState={{ selected: isActive }}
  >
    {isActive ? <View style={styles.activeIndicator} /> : null}
    <View style={[styles.iconContainer, isActive && styles.activeIconContainer]}>
      <Ionicons name={item.icon} size={19} color={isActive ? colors.neonAqua : colors.textLight} />
    </View>
    <Text style={[styles.label, isActive && styles.activeLabel]} numberOfLines={1}>{item.label}</Text>
    {item.badge !== undefined ? (
      <View style={[styles.badge, isActive && styles.activeBadge]}>
        <Text style={[styles.badgeText, isActive && styles.activeBadgeText]}>{item.badge}</Text>
      </View>
    ) : null}
    <Ionicons name="chevron-forward" size={15} color={isActive ? colors.neonAqua : "rgba(255,255,255,0.56)"} />
  </Pressable>
);

const styles = StyleSheet.create({
  navItem: { minHeight: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, borderRadius: radius.lg, marginVertical: 3, position: "relative", borderWidth: 1, borderColor: "transparent" },
  activeNavItem: { backgroundColor: colors.navActiveBg, borderColor: "rgba(39,229,198,0.16)" },
  pressed: { opacity: 0.82, transform: [{ scale: 0.992 }] },
  activeIndicator: { position: "absolute", left: 0, top: 12, bottom: 12, width: 3, borderRadius: 2, backgroundColor: colors.neonAqua, shadowColor: colors.neonAqua, shadowOpacity: 0.7, shadowRadius: 6 },
  iconContainer: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: spacing.md, backgroundColor: "rgba(255,255,255,0.06)" },
  activeIconContainer: { backgroundColor: "rgba(39,229,198,0.12)" },
  label: { flex: 1, color: colors.textWhite, fontFamily: typography.fontFamily, fontSize: typography.sizes.body, fontWeight: typography.weights.medium },
  activeLabel: { color: colors.navActiveText, fontWeight: typography.weights.bold },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill, minWidth: 21, alignItems: "center", backgroundColor: "rgba(255,255,255,0.12)", marginRight: 7 },
  activeBadge: { backgroundColor: colors.neonAqua },
  badgeText: { color: colors.white, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold },
  activeBadgeText: { color: colors.navyInk },
});

export default SidebarNavItem;