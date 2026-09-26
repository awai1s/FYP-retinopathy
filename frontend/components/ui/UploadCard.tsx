import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Colors from "../../constants/Colors";
import Sizes from "../../constants/Sizes";
import Fonts from "../../constants/Fonts";

interface Props {
  onPress: () => void;
}

export default function UploadCard({
  onPress,
}: Props) {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={onPress}
    >
      <Ionicons
        name="cloud-upload-outline"
        size={55}
        color={Colors.primary}
      />

      <Text style={styles.title}>
        Upload Retina Image
      </Text>

      <Text style={styles.subtitle}>
        Tap here to upload a retinal fundus image for AI analysis.
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,

    borderRadius: Sizes.radius.xl,

    padding: 25,

    alignItems: "center",

    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,

    elevation: 6,
  },

  title: {
    marginTop: 15,
    fontSize: Fonts.h3,
    fontWeight: "700",
    color: Colors.primary,
  },

  subtitle: {
    marginTop: 8,
    textAlign: "center",
    color: Colors.textSecondary,
    fontSize: Fonts.body,
    lineHeight: 22,
  },
});