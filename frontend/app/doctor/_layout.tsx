import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect, Tabs, router, usePathname } from "expo-router";

import Colors from "../../constants/Colors";
import { getUserRole, UserRole } from "../../services/storage";
import BottomNavigation, { BottomNavItem } from "../../design/components/BottomNavigation";
import { getProviderVerification } from "../../services/providerVerification";

import { useThemeRefresh } from "../../providers/AppThemeProvider";
const DOCTOR_TABS: BottomNavItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: "grid-outline",
    iconFocused: "grid",
    route: "/doctor/dashboard",
  },
  {
    key: "profile",
    label: "Profile",
    icon: "person-outline",
    iconFocused: "person",
    route: "/doctor/profile",
  },
];

export default function DoctorLayout() {
  useThemeRefresh();
  const [role, setRole] = useState<UserRole | null>(null);
  const [providerRestricted, setProviderRestricted] = useState(true);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    const loadRole = async () => {
      try {
        const currentRole = await getUserRole();
        setRole(currentRole);
        if (currentRole === "Doctor") {
          try {
            const verification = await getProviderVerification();
            setProviderRestricted(verification.status !== "verified" || verification.accountStatus !== "active");
          } catch {
            setProviderRestricted(true);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    loadRole();
  }, []);

  if (loading) {
    return (
      <View style={styles.loading}>
        <View style={styles.loadingRing}>
          <ActivityIndicator size="small" color={Colors.neonAqua} />
        </View>
      </View>
    );
  }

  if (role !== "Doctor") {
    return <Redirect href="/auth/login" />;
  }

  const allowedWhileRestricted = pathname === "/doctor/dashboard" || pathname.startsWith("/doctor/profile");
  if (providerRestricted && !allowedWhileRestricted) {
    return <Redirect href="/doctor/dashboard" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: "none" },
      }}
      tabBar={() => (
        <BottomNavigation
          items={DOCTOR_TABS}
          activeRoute={pathname}
          onTabPress={(route) => router.push(route as any)}
        />
      )}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      <Tabs.Screen name="appointments" options={{ href: null }} />
      <Tabs.Screen name="consultations" options={{ href: null }} />
      <Tabs.Screen name="consultation/[id]" options={{ href: null }} />
      <Tabs.Screen name="connections" options={{ href: null }} />
      <Tabs.Screen name="watchlist" options={{ href: null }} />
      <Tabs.Screen name="patient-profile" options={{ href: null }} />
      <Tabs.Screen name="prescription" options={{ href: null }} />
      <Tabs.Screen name="retinal-images" options={{ href: null }} />
      <Tabs.Screen name="search-patient" options={{ href: null }} />
      <Tabs.Screen name="tools" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: Colors.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingRing: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: Colors.navySurface,
    borderWidth: 1,
    borderColor: "rgba(39,229,198,0.2)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.neonAqua,
    shadowOpacity: 0.2,
    shadowRadius: 14,
  },
});
