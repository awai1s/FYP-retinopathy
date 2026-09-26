import React from "react";
import { StyleSheet, Text, View } from "react-native";

import colors from "../design/tokens/colors";
import radius from "../design/tokens/radius";

type Props = {
  svg: string;
  size?: number;
  accessibilityLabel?: string;
};

/** Fallback for platforms without a dedicated .web/.native renderer. */
export default function SecureQrView({ svg, size = 230, accessibilityLabel = "Secure Health Card QR code" }: Props) {
  if (!svg) return null;
  return (
    <View style={[styles.shell, { width: size, height: size }]} accessibilityLabel={accessibilityLabel}>
      <Text style={styles.text}>Secure QR</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
  },
  text: { color: "#111827", fontWeight: "700" },
});
