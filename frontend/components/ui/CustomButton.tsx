import React, { useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Colors from "../../constants/Colors";
import Sizes from "../../constants/Sizes";
import Fonts from "../../constants/Fonts";

interface Props {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  style?: StyleProp<ViewStyle>;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: "left" | "right";
}

const CustomButton = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = "primary",
  style,
  icon,
  iconPosition = "left",
}: Props) => {
  const scale = useRef(new Animated.Value(1)).current;
  const isButtonDisabled = disabled || loading;

  const animateTo = (toValue: number) => {
    Animated.spring(scale, { toValue, useNativeDriver: true, friction: 7, tension: 150 }).start();
  };

  const handlePress = () => {
    if (isButtonDisabled) return;
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const foreground = variant === "primary" || variant === "danger" ? Colors.white : Colors.primaryDark;

  return (
    <Animated.View
      style={[
        styles.shadowWrap,
        variant === "primary" && styles.primaryGlow,
        isButtonDisabled && styles.noGlow,
        { transform: [{ scale }] },
        style,
      ]}
    >
      <Pressable
        style={({ pressed }) => [
          styles.button,
          variantStyles[variant],
          pressed && !isButtonDisabled && styles.pressed,
          isButtonDisabled && styles.disabledButton,
        ]}
        onPressIn={() => animateTo(0.975)}
        onPressOut={() => animateTo(1)}
        onPress={handlePress}
        disabled={isButtonDisabled}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled: isButtonDisabled, busy: loading }}
      >
        {variant === "primary" ? (
          <LinearGradient
            colors={["#0AAE9E", "#17C9B3", "#2AA7D8"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        ) : null}

        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator color={foreground} />
          ) : (
            <>
              {icon && iconPosition === "left" ? <Ionicons name={icon} size={19} color={foreground} /> : null}
              <Text style={[styles.text, { color: foreground }]}>{title}</Text>
              {icon && iconPosition === "right" ? <Ionicons name={icon} size={19} color={foreground} /> : null}
            </>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
};

export default CustomButton;

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: Colors.primary, borderColor: "rgba(255,255,255,0.18)" },
  secondary: { backgroundColor: Colors.surface, borderColor: Colors.borderStrong },
  ghost: { backgroundColor: "transparent", borderColor: "transparent" },
  danger: { backgroundColor: Colors.danger, borderColor: Colors.danger },
});

const styles = StyleSheet.create({
  shadowWrap: { width: "100%", borderRadius: Sizes.radius.md },
  primaryGlow: { shadowColor: Colors.neonAqua, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 18, elevation: 8 },
  noGlow: { shadowOpacity: 0, elevation: 0 },
  button: { minHeight: Sizes.control.buttonHeight, paddingHorizontal: Sizes.padding.lg, borderRadius: Sizes.radius.md, alignItems: "center", justifyContent: "center", borderWidth: 1, overflow: "hidden" },
  pressed: { opacity: 0.94 },
  disabledButton: { opacity: 0.5 },
  content: { minHeight: Sizes.control.buttonHeight - 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  text: { fontFamily: Fonts.headingFamily, fontSize: Fonts.body, fontWeight: Fonts.weight.bold, letterSpacing: 0.15 },
});
