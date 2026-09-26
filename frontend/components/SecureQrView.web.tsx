import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";

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
      {React.createElement("iframe", {
        title: accessibilityLabel,
        srcDoc: html,
        sandbox: "",
        referrerPolicy: "no-referrer",
        style: {
          width: "100%",
          height: "100%",
          border: 0,
          display: "block",
          background: "#fff",
        },
      })}
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
});
