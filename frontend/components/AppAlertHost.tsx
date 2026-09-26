import React, { useSyncExternalStore } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { closeAlert, getAlertSnapshot, subscribeAlerts } from "../services/alert";
import { useAppTheme } from "../providers/AppThemeProvider";

export default function AppAlertHost() {
  const alerts = useSyncExternalStore(subscribeAlerts, getAlertSnapshot, getAlertSnapshot);
  const { colors } = useAppTheme();
  const alert = alerts[0];
  if (Platform.OS !== "web" || !alert) return null;

  const dismiss = () => {
    if (!alert.options?.cancelable) return;
    closeAlert(alert.id);
    alert.options.onDismiss?.();
  };
  return (
    <Modal transparent visible animationType="fade" onRequestClose={dismiss}>
      <View style={[styles.scrim, { backgroundColor: colors.scrim }]}>
        <View accessibilityViewIsModal accessibilityLabel={alert.title} style={[styles.dialog, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>{alert.title}</Text>
          <ScrollView style={styles.messageArea}>
            {alert.message ? <Text style={[styles.message, { color: colors.textSecondary }]}>{alert.message}</Text> : null}
          </ScrollView>
          <View style={styles.actions}>
            {alert.buttons.map((button, index) => (
              <Pressable key={index} accessibilityRole="button" accessibilityLabel={button.text || "OK"}
                style={[styles.button, { borderColor: colors.border, backgroundColor: button.style === "destructive" ? colors.errorSurface : colors.surfaceSecondary }]}
                onPress={() => { closeAlert(alert.id); button.onPress?.(); }}>
                <Text style={[styles.buttonText, { color: button.style === "destructive" ? colors.error : colors.primaryStrong }]}>{button.text || "OK"}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  dialog: { width: "100%", maxWidth: 480, maxHeight: "85%", borderWidth: 1, borderRadius: 20, padding: 24 },
  title: { fontSize: 21, fontWeight: "700", marginBottom: 12 },
  messageArea: { flexGrow: 0 },
  message: { fontSize: 16, lineHeight: 24 },
  actions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 10, marginTop: 24 },
  button: { minHeight: 46, justifyContent: "center", paddingHorizontal: 18, paddingVertical: 10, borderWidth: 1, borderRadius: 12 },
  buttonText: { fontSize: 16, fontWeight: "700" },
});
