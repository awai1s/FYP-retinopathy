import React from "react";
import {
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import AppText from "../ui/AppText";
import Colors from "../../constants/Colors";
import Sizes from "../../constants/Sizes";

interface Props {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress?: () => void;
}

export default function QuickActionCard({
  title,
  subtitle,
  icon,
  color,
  onPress,
}: Props) {
  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onPress}
      style={styles.card}
    >
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: color + "20" },
        ]}
      >
        <Ionicons name={icon} size={23} color={color} />
      </View>

      <AppText
        variant="title"
        color={Colors.textPrimary}
        weight="bold"
        style={styles.title}
      >
        {title}
      </AppText>

      <AppText
        variant="tiny"
        color={Colors.textSecondary}
        style={styles.subtitle}
      >
        {subtitle}
      </AppText>

      <View style={styles.arrow}>
        <Ionicons
          name="arrow-forward"
          size={16}
          color={color}
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "48%",
    backgroundColor: Colors.surface,
    borderRadius: Sizes.radius.lg,
    padding: Sizes.padding.md,
    marginBottom: Sizes.spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,

    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 3,
  },

  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: Sizes.radius.md,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Sizes.spacing.md,
  },

  title: {
    fontSize: 16,
    lineHeight: 21,
  },

  subtitle: {
    marginTop: 4,
    lineHeight: 16,
    paddingRight: 8,
  },

  arrow: {
    position: "absolute",
    right: 14,
    bottom: 14,
  },
});