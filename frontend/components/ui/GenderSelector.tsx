import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "../../constants/Colors";
import Fonts from "../../constants/Fonts";
import Sizes from "../../constants/Sizes";

interface Props {
  value: string;
  onSelect: (gender: string) => void;
  error?: string;
}

const genders = [
  { value: "Male", icon: "male-outline" as const },
  { value: "Female", icon: "female-outline" as const },
  { value: "Other", icon: "person-outline" as const },
];

export default function GenderSelector({ value, onSelect, error }: Props) {
  const select = (gender: string) => {
    if (Platform.OS !== "web") void Haptics.selectionAsync();
    onSelect(gender);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Gender <Text style={styles.required}>*</Text></Text>
      <View style={styles.row}>
        {genders.map((gender) => {
          const selected = value === gender.value;
          return (
            <TouchableOpacity
              key={gender.value}
              style={[styles.button, selected && styles.selected, error && !value && styles.errorBorder]}
              onPress={() => select(gender.value)}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Ionicons name={gender.icon} size={17} color={selected ? Colors.white : Colors.textSecondary} />
              <Text style={[styles.text, selected && styles.selectedText]}>{gender.value}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle-outline" size={14} color={Colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Sizes.spacing.md },
  label: { color: Colors.textPrimary, fontFamily: Fonts.headingFamily, fontSize: Fonts.small, lineHeight: Fonts.lineHeight.small, fontWeight: Fonts.weight.semibold, marginBottom: 8 },
  required: { color: Colors.danger },
  row: { flexDirection: "row", justifyContent: "space-between", marginHorizontal: -4 },
  button: { flex: 1, marginHorizontal: 4, minHeight: 48, borderRadius: Sizes.radius.md, backgroundColor: Colors.inputBackground, borderWidth: 1, borderColor: Colors.border, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center" },
  selected: { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark, shadowColor: Colors.neonAqua, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 9, elevation: 3 },
  errorBorder: { borderColor: Colors.danger },
  text: { fontFamily: Fonts.headingFamily, color: Colors.textSecondary, fontSize: Fonts.small, fontWeight: Fonts.weight.semibold },
  selectedText: { color: Colors.white },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6, paddingHorizontal: 2 },
  errorText: { color: Colors.danger, fontFamily: Fonts.bodyFamily, fontSize: Fonts.tiny, fontWeight: Fonts.weight.semibold },
});
