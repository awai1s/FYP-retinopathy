import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect, Stack } from "expo-router";

import { getUserRole, type UserRole } from "../../services/storage";
import { useAppTheme, useThemeRefresh } from "../../providers/AppThemeProvider";

export default function SuperAdminLayout() {
  useThemeRefresh();
  const { colors } = useAppTheme();
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getUserRole().then(setRole).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }
  if (role !== "SuperAdmin") return <Redirect href="/auth/login" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
