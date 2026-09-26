import { Alert } from "../services/alert";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { router } from "expo-router";

import { removeToken } from "../services/storage";
import { clearAllPrivateOfflineData } from "../services/offlineCache";
import { useLanguage } from "../services/i18n";
import LogoutConfirmation from "./LogoutConfirmation";

export default function LogoutButton() {
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const { t } = useLanguage();

  const completeLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await clearAllPrivateOfflineData();
      await removeToken();
      setConfirmVisible(false);
      router.replace("/auth/login" as any);
    } catch (error: any) {
      setLoggingOut(false);
      Alert.alert(t("error") || "Error", error?.message || t("logoutUnavailable") || "Logout unavailable. Please try again.");
    }
  };

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.pressed, loggingOut && styles.disabled]}
        onPress={() => setConfirmVisible(true)}
        disabled={loggingOut}
        accessibilityRole="button"
        accessibilityLabel={t("logout") || "Log out"}
        accessibilityState={{ disabled: loggingOut, busy: loggingOut }}
      >
        <Text style={styles.text}>{loggingOut ? t("loggingOut") || "Logging out…" : t("logout") || "Log out"}</Text>
      </Pressable>
      <LogoutConfirmation visible={confirmVisible} loading={loggingOut} onCancel={() => setConfirmVisible(false)} onConfirm={() => void completeLogout()} />
    </>
  );
}

const styles = StyleSheet.create({
  button: { alignSelf: "flex-end", minHeight: 44, paddingHorizontal: 18, borderRadius: 22, borderWidth: 1, borderColor: "rgba(248,113,113,0.65)", backgroundColor: "rgba(239,68,68,0.14)", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.55 },
  text: { color: "#FCA5A5", fontWeight: "800", fontSize: 14 },
});