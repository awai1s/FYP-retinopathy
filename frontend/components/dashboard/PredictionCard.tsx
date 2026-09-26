import React from "react";
import {
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import AppCard from "../ui/AppCard";
import AppText from "../ui/AppText";
import Colors from "../../constants/Colors";
import Sizes from "../../constants/Sizes";

interface PredictionCardProps {
  stage: string;
  confidence: string;
  date: string;
  status: string;
  onPress?: () => void;
}

export default function PredictionCard({
  stage,
  confidence,
  date,
  status,
  onPress,
}: PredictionCardProps) {
  return (
    <AppCard variant="dark" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="eye-outline" size={25} color={Colors.secondary} />
        </View>

        <View style={styles.headerText}>
          <AppText
            variant="title"
            color={Colors.textOnDark}
            weight="semibold"
          >
            Latest AI Prediction
          </AppText>

          <AppText
            variant="small"
            color={Colors.textOnDarkMuted}
            style={styles.date}
          >
            {date}
          </AppText>
        </View>

        <View style={styles.aiBadge}>
          <Ionicons name="sparkles" size={13} color={Colors.secondary} />
          <AppText
            variant="tiny"
            color={Colors.secondary}
            weight="bold"
          >
            AI
          </AppText>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.infoRow}>
        <AppText variant="small" color={Colors.textOnDarkMuted}>
          Disease stage
        </AppText>

        <AppText
          variant="small"
          color={Colors.textOnDark}
          weight="semibold"
        >
          {stage}
        </AppText>
      </View>

      <View style={styles.infoRow}>
        <AppText variant="small" color={Colors.textOnDarkMuted}>
          Confidence
        </AppText>

        <AppText
          variant="small"
          color={Colors.secondary}
          weight="bold"
        >
          {confidence}
        </AppText>
      </View>

      <View style={styles.infoRow}>
        <AppText variant="small" color={Colors.textOnDarkMuted}>
          Status
        </AppText>

        <View style={styles.badge}>
          <View style={styles.statusDot} />

          <AppText
            variant="tiny"
            color={Colors.success}
            weight="semibold"
          >
            {status}
          </AppText>
        </View>
      </View>

      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.button}
        onPress={onPress}
      >
        <AppText
          variant="button"
          color={Colors.white}
          weight="semibold"
        >
          View full report
        </AppText>

        <Ionicons
          name="arrow-forward"
          size={17}
          color={Colors.white}
        />
      </TouchableOpacity>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Sizes.spacing.md,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
  },

  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: Sizes.radius.md,
    backgroundColor: Colors.aiGlow,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Sizes.spacing.sm,
  },

  headerText: {
    flex: 1,
  },

  date: {
    marginTop: 3,
  },

  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: Sizes.radius.pill,
    backgroundColor: Colors.primaryGlow,
  },

  divider: {
    height: 1,
    backgroundColor: Colors.borderOnDark,
    marginVertical: Sizes.spacing.md,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Sizes.spacing.sm,
  },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.successSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Sizes.radius.pill,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },

  button: {
    minHeight: Sizes.control.buttonHeight,
    marginTop: Sizes.spacing.sm,
    borderRadius: Sizes.radius.md,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
});