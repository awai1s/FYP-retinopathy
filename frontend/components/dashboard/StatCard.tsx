import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import AppCard from "../ui/AppCard";
import AppText from "../ui/AppText";
import Colors from "../../constants/Colors";
import Sizes from "../../constants/Sizes";

interface Props {
  title: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

export default function StatCard({
  title,
  value,
  icon,
  color,
}: Props) {
  return (
    <AppCard style={styles.card}>
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: color + "20" },
        ]}
      >
        <Ionicons name={icon} size={22} color={color} />
      </View>

      <AppText
        variant="h2"
        color={Colors.textPrimary}
        weight="extraBold"
        style={styles.value}
      >
        {value}
      </AppText>

      <AppText
        variant="small"
        color={Colors.textSecondary}
        weight="medium"
      >
        {title}
      </AppText>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "48%",
    marginBottom: Sizes.spacing.md,
    padding: Sizes.padding.md,
  },

  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: Sizes.radius.md,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Sizes.spacing.md,
  },

  value: {
    marginBottom: 3,
  },
});