import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { LanguageProvider } from "../services/i18n";
import { configureMedicationNotificationHandler } from "../services/medicationNotifications";
import { AppThemeProvider, useAppTheme } from "../providers/AppThemeProvider";
import { NetworkProvider } from "../providers/NetworkProvider";
import AppAlertHost from "../components/AppAlertHost";

function ThemeStatusBar() {
  const { isDark } = useAppTheme();
  return <StatusBar style={isDark ? "light" : "dark"} />;
}

export default function RootLayout() {
  useEffect(() => {
    void configureMedicationNotificationHandler();
  }, []);

  return (
    <AppThemeProvider>
      <NetworkProvider>
        <LanguageProvider>
          <ThemeStatusBar />
          <Stack screenOptions={{ headerShown: false }} />
          <AppAlertHost />
        </LanguageProvider>
      </NetworkProvider>
    </AppThemeProvider>
  );
}
