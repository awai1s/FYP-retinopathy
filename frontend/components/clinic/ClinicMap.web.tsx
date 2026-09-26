import React, { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { ClinicMapProps } from "./ClinicMapBase";
import { buildClinicMapHtml } from "./ClinicMapHtml";
import colors from "../../design/tokens/colors";
import radius from "../../design/tokens/radius";

export default function ClinicMap({
  latitude,
  longitude,
  clinics,
  selectedClinicId,
  onSelectClinic,
}: ClinicMapProps) {
  const html = useMemo(
    () => buildClinicMapHtml({ latitude, longitude, clinics, selectedClinicId }),
    [latitude, longitude, clinics, selectedClinicId]
  );

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message?.source !== "dr-clinic-map" || !message?.clinicId) return;
      const clinic = clinics.find((item) => item.id === message.clinicId);
      if (clinic) onSelectClinic?.(clinic);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [clinics, onSelectClinic]);

  return (
    <View style={styles.wrapper}>
      {React.createElement("iframe", {
        title: "Nearby eye clinics map",
        srcDoc: html,
        style: {
          width: "100%",
          height: "100%",
          border: 0,
          display: "block",
        },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    height: 300,
    overflow: "hidden",
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.teal50,
  },
});
