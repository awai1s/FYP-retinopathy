/**
 * Patient Tab Layout
 * Uses BottomNavigation — a reusable floating pill nav component.
 * Only patients reach these tabs; other roles are redirected by the role check.
 */

import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";
import { Tabs, router, usePathname } from "expo-router";

import Colors from "../../constants/Colors";
import { getUserRole } from "../../services/storage";
import BottomNavigation, {
  BottomNavItem,
} from "../../design/components/BottomNavigation";

import { useThemeRefresh } from "../../providers/AppThemeProvider";
// ─── Patient Tab Definitions ──────────────────────────────────────────────────
// Add/remove/reorder tabs here without touching BottomNavigation component.

const PATIENT_TABS: BottomNavItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: "grid-outline",
    iconFocused: "grid",
    route: "/tabs/dashboard",
  },
  {
    key: "history",
    label: "History",
    icon: "time-outline",
    iconFocused: "time",
    route: "/tabs/history",
  },
  {
    key: "profile",
    label: "Profile",
    icon: "person-outline",
    iconFocused: "person",
    route: "/tabs/profile",
  },
];

// ─── Layout Component ─────────────────────────────────────────────────────────

export default function TabLayout() {
  useThemeRefresh();
  const [checkingRole, setCheckingRole] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    const checkRole = async () => {
      try {
        const role = await getUserRole();

        // =====================================================
        // ONLY PATIENTS CAN ACCESS THESE TABS
        // =====================================================
        if (role !== "Patient") {
          if (role === "Doctor") {
            router.replace("/doctor/dashboard");
          } else if (role === "Hospital") {
            router.replace("/hospital/dashboard");
          } else {
            router.replace("/auth/login");
          }
          return;
        }

        setCheckingRole(false);
      } catch (error) {
        console.error("Failed to verify user role:", error);
        router.replace("/auth/login");
      }
    };

    checkRole();
  }, []);

  // =====================================================
  // SHOW LOADING WHILE ROLE IS BEING VERIFIED
  // =====================================================
  if (checkingRole) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.secondary} />
      </View>
    );
  }

  // =====================================================
  // PATIENT TABS — Custom floating bottom navigation
  // =====================================================
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Hide the default tab bar — we render our own via tabBar prop
        tabBarStyle: { display: "none" },
      }}
      tabBar={() => (
        <BottomNavigation
          items={PATIENT_TABS}
          activeRoute={pathname}
          onTabPress={(route) => router.push(route as any)}
        />
      )}
    >
      {/* ===================================================
          DASHBOARD
      =================================================== */}
      <Tabs.Screen
        name="dashboard"
        options={{ title: "Dashboard" }}
      />

      {/* ===================================================
          HISTORY
      =================================================== */}
      <Tabs.Screen
        name="history"
        options={{ title: "History" }}
      />

      {/* ===================================================
          PROFILE
      =================================================== */}
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile" }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: Colors.navy,
    justifyContent: "center",
    alignItems: "center",
  },
});