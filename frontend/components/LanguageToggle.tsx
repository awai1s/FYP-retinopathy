import React, { useEffect, useRef } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useLanguage } from "../services/i18n";
import colors from "../design/tokens/colors";
import { useAppTheme } from "../providers/AppThemeProvider";

export default function LanguageToggle() {
  const { language, toggleLanguage, t } = useLanguage();
  const { reduceMotion, eyeFriendly } = useAppTheme();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) { pulse.setValue(1); return; }
    Animated.sequence([
      Animated.timing(pulse, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.spring(pulse, { toValue: 1, friction: 7, tension: 100, useNativeDriver: true }),
    ]).start();
  }, [language, pulse, reduceMotion]);

  const isEnglish = language === "en";
  const changeLanguage = async () => {
    if (Platform.OS !== "web") void Haptics.selectionAsync();
    await toggleLanguage();
  };

  return (
    <Animated.View style={{ transform: [{ scale: pulse }] }}>
      <Pressable
        onPress={changeLanguage}
        style={({ pressed }) => [styles.control, eyeFriendly && styles.eyeFriendlyControl, pressed && !reduceMotion && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t("switchLanguage")}
        accessibilityHint={`${t("language")}: ${isEnglish ? t("english") : t("urdu")}`}
      >
        <View style={[styles.option, isEnglish && styles.activeOption]}>
          <Text style={[styles.optionText, isEnglish && styles.activeText]}>EN</Text>
        </View>
        <View style={[styles.option, !isEnglish && styles.activeOption]}>
          <Text style={[styles.optionText, !isEnglish && styles.activeText]}>اردو</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  control: { minHeight: 38, padding: 3, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.13)", backgroundColor: "rgba(255,255,255,0.08)", flexDirection: "row", alignItems: "center" },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  option: { minHeight: 30, minWidth: 40, paddingHorizontal: 8, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  activeOption: { backgroundColor: colors.neonAqua, shadowColor: colors.neonAqua, shadowOpacity: 0.28, shadowRadius: 7, elevation: 2 },
  optionText: { color: colors.textLight, fontWeight: "800", fontSize: 11 },
  activeText: { color: colors.navyInk },
  eyeFriendlyControl: { minHeight: 46, padding: 4 },
});