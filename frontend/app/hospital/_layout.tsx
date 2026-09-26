import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect, Stack, usePathname } from "expo-router";

import { getUserRole, UserRole } from "../../services/storage";
import Colors from "../../constants/Colors";
import { getProviderVerification } from "../../services/providerVerification";

import { useThemeRefresh } from "../../providers/AppThemeProvider";
export default function HospitalLayout() {
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
        if (currentRole === "Hospital") {
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
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.navy,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={Colors.secondary} />
      </View>
    );
  }

  if (role !== "Hospital") {
    return <Redirect href="/auth/login" />;
  }

  const allowedWhileRestricted = pathname === "/hospital/dashboard" || pathname.startsWith("/hospital/profile");
  if (providerRestricted && !allowedWhileRestricted) {
    return <Redirect href="/hospital/dashboard" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
