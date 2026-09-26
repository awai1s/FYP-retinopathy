import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Colors from "../../constants/Colors";
import Sizes from "../../constants/Sizes";

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const GlassCard = ({ children, style }: Props) => {
  return <View style={[styles.card, style]}>{children}</View>;
};

export default GlassCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.glassLight,
    borderRadius: Sizes.radius.xl,
    padding: Sizes.padding.xl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
});
