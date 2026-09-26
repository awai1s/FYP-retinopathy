import React from "react";
import { View, Text, StyleSheet } from "react-native";
import colors from "../../design/tokens/colors";

interface Props {
  label: string;
  value: string;
}

export default function ProfileInfoCard({
  label,
  value,
}: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    padding: 18,
    borderRadius: 16,
    marginBottom: 14,

    shadowColor: colors.shadowColor,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },

    elevation: 3,
  },

  label: {
    color: colors.textMuted,
    fontSize: 13,
  },

  value: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
});