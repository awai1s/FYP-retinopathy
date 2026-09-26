import React from "react";
import { View, Text, StyleSheet } from "react-native";
import colors from "../../design/tokens/colors";

interface Props {
  title: string;
  content: string;
}

export default function SummarySection({ title, content }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.content}>{content}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,

    shadowColor: colors.shadowColor,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },

    elevation: 3,
  },

  title: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 10,
  },

  content: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
  },
});