import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

import colors from "../design/tokens/colors";
import radius from "../design/tokens/radius";

type Props = {
  svg: string;
  size?: number;
  accessibilityLabel?: string;
};

function htmlForSvg(svg: string) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1" /></head><body style="margin:0;display:flex;align-items:center;justify-content:center;background:#fff;overflow:hidden;">${svg}</body></html>`;
}

export default function SecureQrView({ svg, size = 230, accessibilityLabel = "Secure Health Card QR code" }: Props) {
  const html = useMemo(() => htmlForSvg(svg || ""), [svg]);
  if (!svg) return null;

  return (
    <View style={[styles.shell, { width: size, height: size }]} accessibilityLabel={accessibilityLabel}>
      <WebView
        source={{ html }}
        originWhitelist={["*"]}
        scrollEnabled={false}
        javaScriptEnabled={false}
        domStorageEnabled={false}
        sharedCookiesEnabled={false}
        thirdPartyCookiesEnabled={false}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignSelf: "center",
    overflow: "hidden",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
  },
  webview: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
});
