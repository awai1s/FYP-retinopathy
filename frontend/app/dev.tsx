import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ImageBackground,
  Animated,
} from "react-native";
import { router, Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useThemeRefresh } from "../providers/AppThemeProvider";
import colors from "../design/tokens/colors";
interface MenuItem {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}

const DRAWER_WIDTH = 320;

// Corrected route strings matching Expo Router structure
const menuItems: MenuItem[] = [
  { title: "Patient Dashboard", icon: "grid-outline", route: "/tabs/dashboard" },
  { title: "Patient Profile", icon: "person-outline", route: "/tabs/profile" },
  { title: "History", icon: "document-text-outline", route: "/tabs/history" },
  { title: "Upload", icon: "cloud-upload-outline", route: "/upload" },
  { title: "Result", icon: "analytics-outline", route: "/result" },
  { title: "Doctor Summary", icon: "clipboard-outline", route: "/doctor-summary" },
  { title: "Doctor Dashboard", icon: "medkit-outline", route: "/doctor/dashboard" },
  { title: "Doctor Patient Search", icon: "search-outline", route: "/doctor/search-patient" },
  { title: "Doctor Patient Profile", icon: "person-circle-outline", route: "/doctor/patient-profile" },
  { title: "Prescription", icon: "receipt-outline", route: "/doctor/prescription" },
  { title: "Hospital Dashboard", icon: "business-outline", route: "/hospital/dashboard" },
  { title: "Hospital Search Patient", icon: "search-outline", route: "/hospital/search-patient" },
  { title: "Hospital Patient Profile", icon: "people-outline", route: "/hospital/patient-profile" },
  { title: "Hospital Reports", icon: "folder-open-outline", route: "/hospital/reports" },
  { title: "Upload Report", icon: "cloud-upload-outline", route: "/hospital/upload-report" },
];

export default function DevMenu() {
  useThemeRefresh();
  const [isOpen, setIsOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const toggleDrawer = () => {
    const nextState = !isOpen;
    const toValue = nextState ? 0 : -DRAWER_WIDTH;
    const fadeValue = nextState ? 1 : 0;

    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: fadeValue,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();

    setIsOpen(nextState);
  };

  const handleNavigation = (route: string) => {
    toggleDrawer();
    router.push(route as Href);
  };

  return (
    <View style={styles.container}>
      {/* BACKGROUND IMAGE - Dynamic Blur */}
      <ImageBackground
        source={require("@/assets/images/retina_bg.jpg")}
        style={styles.backgroundImage}
        resizeMode="cover"
        blurRadius={isOpen ? 0 : 10}
      >
        <View style={styles.mainOverlay}>
          {/* GLASS CARD */}
          {!isOpen && (
            <View style={styles.glassCard}>
              <View style={styles.iconCircle}>
                <Ionicons name="eye-outline" size={44} color="#2563EB" />
              </View>

              <Text style={styles.contentTitle}>AI Retinal Health</Text>
              <Text style={styles.contentText}>
                Select a screen from the menu to jump directly to any module.
              </Text>

              <Pressable
                style={({ pressed }) => [
                  styles.openMenuBtn,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={toggleDrawer}
              >
                <Ionicons name="menu-outline" size={20} color="#FFFFFF" />
                <Text style={styles.openMenuBtnText}>Development Menu</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ImageBackground>

      {/* BACKDROP OVERLAY WHEN DRAWER IS OPEN */}
      {isOpen && (
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={styles.backdropPress} onPress={toggleDrawer} />
        </Animated.View>
      )}

      {/* ANIMATED DRAWER */}
      <Animated.View
        style={[
          styles.drawer,
          {
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        {/* DRAWER HEADER */}
        <View style={styles.header}>
          <Ionicons name="construct-outline" size={26} color="#2563EB" />

          <View style={styles.headerText}>
            <Text style={styles.title}>Development Menu</Text>
            <Text style={styles.subtitle}>Navigate to any screen</Text>
          </View>

          {/* CLOSE BUTTON */}
          <Pressable
            onPress={toggleDrawer}
            hitSlop={15}
            style={({ pressed }) => [
              styles.closeBtn,
              pressed && { opacity: 0.5 },
            ]}
          >
            <Ionicons name="close-outline" size={28} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* MENU ITEMS LIST */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.menu}
        >
          {menuItems.map((item) => (
            <Pressable
              key={item.route}
              style={({ pressed }) => [
                styles.menuItem,
                pressed && styles.menuItemPressed,
              ]}
              onPress={() => handleNavigation(item.route)}
            >
              <Ionicons name={item.icon} size={20} color={colors.textSecondary} />
              <Text style={styles.menuText}>{item.title}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.pageBackground,
  },
  backgroundImage: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  mainOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "flex-start",
    paddingLeft: 60,
    paddingRight: 24,
  },
  glassCard: {
    width: "100%",
    maxWidth: 380,
    alignItems: "flex-start",
    padding: 32,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.8)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(37, 99, 235, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  contentTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  contentText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  openMenuBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 22,
    backgroundColor: "#2563EB",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  openMenuBtnText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.3)",
    zIndex: 10,
  },
  backdropPress: {
    flex: 1,
  },
  drawer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: colors.surface,
    zIndex: 20,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 55,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerText: {
    marginLeft: 10,
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
  },
  menu: {
    padding: 12,
    paddingBottom: 30,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 10,
    marginBottom: 4,
  },
  menuItemPressed: {
    backgroundColor: colors.teal50,
  },
  menuText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
  },
});