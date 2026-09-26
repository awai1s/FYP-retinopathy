import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import Colors from "../../constants/Colors";
import Fonts from "../../constants/Fonts";
import AppText from "./AppText";

export default function Loading({ text = "Please wait…" }: { text?: string }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <AppText variant="small" color={Colors.textSecondary} style={styles.text}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: "center", alignItems: "center", padding: 20 },
  text: { marginTop: 12, fontFamily: Fonts.family },
});