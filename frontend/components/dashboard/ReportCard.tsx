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

interface ReportCardProps {
  title: string;
  date: string;
  status: "Completed" | "Pending" | "Processing";
  onPress?: () => void;
}

export default function ReportCard({
  title,
  date,
  status,
  onPress,
}: ReportCardProps) {
  const statusConfig = {
    Completed: {
      color: Colors.success,
      background: Colors.successSoft,
    },
    Pending: {
      color: Colors.warning,
      background: Colors.warningSoft,
    },
    Processing: {
      color: Colors.info,
      background: Colors.infoSoft,
    },
  };

  const config = statusConfig[status];

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.iconContainer}>
        <Ionicons
          name="document-text-outline"
          size={22}
          color={Colors.primary}
        />
      </View>

      <View style={styles.info}>
        <AppText
          variant="body"
          color={Colors.textPrimary}
          weight="semibold"
          numberOfLines={1}
        >
          {title}
        </AppText>

        <AppText
          variant="tiny"
          color={Colors.textSecondary}
          style={styles.date}
        >
          {date}
        </AppText>
      </View>

      <View
        style={[
          styles.statusBadge,
          { backgroundColor: config.background },
        ]}
      >
        <AppText
          variant="tiny"
          color={config.color}
          weight="bold"
        >
          {status}
        </AppText>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Sizes.radius.lg,
    padding: Sizes.padding.md,
    marginBottom: Sizes.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,

    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 2,
  },

  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: Sizes.radius.md,
    backgroundColor: Colors.primaryGlow,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Sizes.spacing.md,
  },

  info: {
    flex: 1,
    minWidth: 0,
  },

  date: {
    marginTop: 3,
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Sizes.radius.pill,
    marginLeft: Sizes.spacing.sm,
  },
});