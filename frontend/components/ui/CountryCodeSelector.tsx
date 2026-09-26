import React, { useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import Colors from "../../constants/Colors";
import Fonts from "../../constants/Fonts";
import Sizes from "../../constants/Sizes";

export type CountryCode = {
  name: string;
  code: string;
  flag: string;
};

export const COUNTRY_CODES: CountryCode[] = [
  { name: "Pakistan", code: "+92", flag: "PK" },
  { name: "India", code: "+91", flag: "IN" },
  { name: "United States", code: "+1", flag: "US" },
  { name: "United Kingdom", code: "+44", flag: "GB" },
  { name: "United Arab Emirates", code: "+971", flag: "AE" },
  { name: "Saudi Arabia", code: "+966", flag: "SA" },
  { name: "Qatar", code: "+974", flag: "QA" },
  { name: "Bangladesh", code: "+880", flag: "BD" },
  { name: "Turkey", code: "+90", flag: "TR" },
  { name: "Australia", code: "+61", flag: "AU" },
  { name: "Canada", code: "+1", flag: "CA" },
  { name: "Malaysia", code: "+60", flag: "MY" },
];

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function CountryCodeSelector({ value, onChange }: Props) {
  const [visible, setVisible] = useState(false);
  const selected = COUNTRY_CODES.find((country) => country.code === value) || COUNTRY_CODES[0];

  const choose = (country: CountryCode) => {
    if (Platform.OS !== "web") void Haptics.selectionAsync();
    onChange(country.code);
    setVisible(false);
  };

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
        onPress={() => setVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={`Country code ${selected.name} ${selected.code}`}
      >
        <View style={styles.countryBadge}><Text style={styles.countryBadgeText}>{selected.flag}</Text></View>
        <Text style={styles.code}>{selected.code}</Text>
        <Ionicons name="chevron-down" size={16} color={Colors.textSecondary} />
      </Pressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHandle} />
            <View style={styles.header}>
              <View>
                <Text style={styles.eyebrow}>PHONE REGION</Text>
                <Text style={styles.title}>Choose country code</Text>
              </View>
              <Pressable onPress={() => setVisible(false)} hitSlop={10} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close country code list">
                <Ionicons name="close" size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
              {COUNTRY_CODES.map((country) => {
                const isSelected = country.name === selected.name;
                return (
                  <Pressable
                    key={`${country.name}-${country.code}`}
                    style={({ pressed }) => [styles.option, isSelected && styles.optionSelected, pressed && styles.pressed]}
                    onPress={() => choose(country)}
                  >
                    <View style={[styles.optionBadge, isSelected && styles.optionBadgeSelected]}>
                      <Text style={[styles.optionBadgeText, isSelected && styles.optionBadgeTextSelected]}>{country.flag}</Text>
                    </View>
                    <Text style={styles.optionName}>{country.name}</Text>
                    <Text style={styles.optionCode}>{country.code}</Text>
                    {isSelected ? <Ionicons name="checkmark-circle" size={20} color={Colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { width: 116, minHeight: Sizes.control.height, marginRight: 9, paddingHorizontal: 10, borderRadius: Sizes.radius.md, backgroundColor: Colors.inputBackground, borderWidth: 1, borderColor: Colors.border, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  countryBadge: { width: 31, height: 31, borderRadius: 10, backgroundColor: Colors.primaryGlow, alignItems: "center", justifyContent: "center", marginRight: 7 },
  countryBadgeText: { color: Colors.primaryDark, fontFamily: Fonts.headingFamily, fontSize: 10, fontWeight: Fonts.weight.extraBold, letterSpacing: 0.5 },
  code: { color: Colors.textPrimary, fontFamily: Fonts.headingFamily, fontSize: Fonts.small, fontWeight: Fonts.weight.bold, flex: 1 },
  backdrop: { flex: 1, backgroundColor: "rgba(2,12,18,0.72)", alignItems: "center", justifyContent: "center", padding: 20 },
  modalCard: { width: "100%", maxWidth: 410, maxHeight: "80%", backgroundColor: Colors.surface, borderRadius: 26, padding: 20, borderWidth: 1, borderColor: Colors.border, shadowColor: Colors.black, shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.28, shadowRadius: 28, elevation: 16 },
  modalHandle: { width: 44, height: 4, borderRadius: 4, backgroundColor: Colors.primary, alignSelf: "center", marginBottom: 16 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 },
  eyebrow: { color: Colors.primaryDark, fontFamily: Fonts.headingFamily, fontSize: 10, fontWeight: Fonts.weight.extraBold, letterSpacing: 1.2 },
  title: { color: Colors.textPrimary, fontFamily: Fonts.headingFamily, fontSize: 20, fontWeight: Fonts.weight.extraBold, marginTop: 3 },
  closeBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: Colors.surfaceMuted, alignItems: "center", justifyContent: "center" },
  list: { marginTop: 4 },
  option: { minHeight: 56, borderRadius: 16, paddingHorizontal: 11, marginBottom: 7, flexDirection: "row", alignItems: "center", backgroundColor: Colors.inputBackground, borderWidth: 1, borderColor: Colors.border },
  optionSelected: { borderColor: Colors.primary, backgroundColor: Colors.surfaceMuted },
  optionBadge: { width: 34, height: 34, borderRadius: 11, backgroundColor: Colors.surfaceMuted, alignItems: "center", justifyContent: "center", marginRight: 10 },
  optionBadgeSelected: { backgroundColor: Colors.primary },
  optionBadgeText: { color: Colors.textSecondary, fontFamily: Fonts.headingFamily, fontSize: 10, fontWeight: Fonts.weight.extraBold },
  optionBadgeTextSelected: { color: Colors.white },
  optionName: { flex: 1, color: Colors.textPrimary, fontFamily: Fonts.bodyFamily, fontSize: Fonts.body, fontWeight: Fonts.weight.semibold },
  optionCode: { color: Colors.textSecondary, fontFamily: Fonts.headingFamily, fontSize: Fonts.small, fontWeight: Fonts.weight.bold, marginRight: 8 },
});