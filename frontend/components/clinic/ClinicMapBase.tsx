import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ClinicPlace } from "../../services/clinic";
import colors from "../../design/tokens/colors";
import radius from "../../design/tokens/radius";
import spacing from "../../design/tokens/spacing";
import typography from "../../design/tokens/typography";

export interface ClinicMapProps {
  latitude: number;
  longitude: number;
  clinics: ClinicPlace[];
  selectedClinicId?: string | null;
  onSelectClinic?: (clinic: ClinicPlace) => void;
}

/** Generic fallback for an unsupported platform. */
export default function ClinicMap({ clinics, onSelectClinic }: ClinicMapProps) {
  return (
    <View style={styles.container}>
      <Ionicons name="map-outline" size={32} color={colors.teal800} />
      <Text style={styles.title}>OpenStreetMap preview unavailable here</Text>
      <Text style={styles.subtitle}>
        The clinic list still uses your current location and free OpenStreetMap data.
      </Text>
      {clinics[0] ? (
        <TouchableOpacity
          style={styles.nearestButton}
          onPress={() => onSelectClinic?.(clinics[0])}
        >
          <Text style={styles.nearestText}>Select nearest clinic</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.teal50,
    padding: spacing.lg,
  },
  title: {
    marginTop: spacing.sm,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 4,
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textAlign: "center",
  },
  nearestButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.teal800,
  },
  nearestText: {
    color: colors.white,
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.bold,
  },
});
