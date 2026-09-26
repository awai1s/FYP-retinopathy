import React from "react";
import { View, Text, StyleSheet } from "react-native";
import colors from "../../design/tokens/colors";

interface Props {
  title: string;
  value: string;
}

export default function ResultInfoCard({
  title,
  value,
}: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,

    shadowColor: colors.shadowColor,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },

    elevation: 3,
  },

  title: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 6,
  },

  value: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
  },
});