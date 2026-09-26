import React from "react";
import { StyleSheet, View } from "react-native";
import Colors from "../../constants/Colors";
import Fonts from "../../constants/Fonts";
import AppText from "./AppText";

interface Props {
  title: string;
  subtitle?: string;
}

export default function ScreenHeader({ title, subtitle }: Props) {
  return (
    <View style={styles.container}>
      <AppText variant="h1" weight="bold">{title}</AppText>
      {subtitle ? (
        <AppText variant="body" color={Colors.textSecondary} style={styles.subtitle}>
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 24 },
  subtitle: {
    marginTop: 6,
    fontFamily: Fonts.family,
  },
});
