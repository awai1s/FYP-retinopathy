import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Button from "../design/components/Button";
import colors from "../design/tokens/colors";
import spacing from "../design/tokens/spacing";
import typography from "../design/tokens/typography";
import radius from "../design/tokens/radius";

export default function LogoutConfirmation({ visible, loading, onCancel, onConfirm }: { visible: boolean; loading?: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.icon}><Text style={styles.iconText}>↪</Text></View>
          <Text style={styles.title}>Log out of DR-Healthcare?</Text>
          <Text style={styles.message}>Are you sure you want to end your current session?</Text>
          <View style={styles.actions}>
            <Pressable onPress={onCancel} disabled={loading} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]} accessibilityRole="button"><Text style={styles.cancelText}>Cancel</Text></Pressable>
            <Button title={loading ? "Logging out…" : "Log out"} icon="log-out-outline" variant="danger" size="sm" onPress={onConfirm} loading={loading} disabled={loading} style={styles.confirm} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(6, 40, 38, 0.58)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  card: { width: "100%", maxWidth: 420, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, alignItems: "center", ...({ elevation: 12 } as any) },
  icon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.errorBg, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  iconText: { color: colors.error, fontSize: 28, fontWeight: typography.weights.bold },
  title: { color: colors.textPrimary, fontSize: typography.sizes.h3, fontWeight: typography.weights.bold, textAlign: "center" },
  message: { color: colors.textSecondary, fontSize: typography.sizes.body, textAlign: "center", lineHeight: 21, marginTop: spacing.xs },
  actions: { width: "100%", flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: spacing.sm, marginTop: spacing.xl },
  cancel: { minHeight: 42, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  cancelText: { color: colors.textSecondary, fontSize: typography.sizes.small, fontWeight: typography.weights.bold },
  confirm: { minWidth: 118 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});