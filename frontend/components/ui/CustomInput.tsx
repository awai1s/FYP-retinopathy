import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "../../constants/Colors";
import Sizes from "../../constants/Sizes";
import Fonts from "../../constants/Fonts";

interface Props {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  icon: keyof typeof Ionicons.glyphMap;
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  keyboardType?: TextInputProps["keyboardType"];
  autoCapitalize?: TextInputProps["autoCapitalize"];
  autoComplete?: TextInputProps["autoComplete"];
  textContentType?: TextInputProps["textContentType"];
  returnKeyType?: TextInputProps["returnKeyType"];
  maxLength?: number;
  onBlur?: () => void;
  onFocus?: () => void;
  onSubmitEditing?: () => void;
}

const CustomInput = ({
  placeholder,
  value,
  onChangeText,
  icon,
  label,
  error,
  helperText,
  required = false,
  keyboardType,
  autoCapitalize = "none",
  autoComplete,
  textContentType,
  returnKeyType,
  maxLength,
  onBlur,
  onFocus,
  onSubmitEditing,
}: Props) => {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      {label ? (
        <Text style={styles.label}>
          {label}{required ? <Text style={styles.required}> *</Text> : null}
        </Text>
      ) : null}

      <View
        style={[
          styles.container,
          focused && styles.containerFocused,
          error ? styles.containerError : null,
        ]}
      >
        <View style={[styles.iconShell, focused && styles.iconShellFocused, error && styles.iconShellError]}>
          <Ionicons
            name={icon}
            size={20}
            color={error ? Colors.danger : focused ? Colors.primary : Colors.textSecondary}
          />
        </View>
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={Colors.textPlaceholder}
          value={value}
          keyboardType={keyboardType}
          onChangeText={(text) => {
            if (keyboardType === "phone-pad") onChangeText(text.replace(/[^0-9]/g, ""));
            else onChangeText(text);
          }}
          onFocus={() => {
            setFocused(true);
            onFocus?.();
          }}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          onSubmitEditing={onSubmitEditing}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          textContentType={textContentType}
          returnKeyType={returnKeyType}
          maxLength={maxLength}
          editable
          selectionColor={Colors.primary}
          style={styles.input}
          accessibilityLabel={label || placeholder}
          accessibilityState={{ invalid: Boolean(error) } as any}
        />
        {value.length > 0 && !error ? (
          <Ionicons name="checkmark-circle" size={18} color={Colors.success} style={styles.trailingIcon} />
        ) : null}
      </View>

      {error ? (
        <View style={styles.messageRow}>
          <Ionicons name="alert-circle-outline" size={14} color={Colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
};

export default CustomInput;

const styles = StyleSheet.create({
  wrapper: { width: "100%", marginBottom: Sizes.spacing.md },
  label: {
    color: Colors.textPrimary,
    fontFamily: Fonts.headingFamily,
    fontSize: Fonts.small,
    fontWeight: Fonts.weight.semibold,
    marginBottom: 7,
  },
  required: { color: Colors.danger },
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.inputBackground,
    borderRadius: Sizes.radius.md,
    paddingHorizontal: 10,
    minHeight: Sizes.control.height,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  containerFocused: {
    backgroundColor: Colors.inputFocused,
    borderColor: Colors.primary,
    shadowColor: Colors.neonAqua,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 2,
  },
  containerError: { borderColor: Colors.danger, backgroundColor: Colors.dangerSoft },
  iconShell: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceMuted,
  },
  iconShellFocused: { backgroundColor: Colors.primaryGlow },
  iconShellError: { backgroundColor: Colors.dangerSoft },
  input: {
    flex: 1,
    marginLeft: Sizes.spacing.sm,
    fontFamily: Fonts.bodyFamily,
    fontSize: Fonts.body,
    lineHeight: 21,
    color: Colors.textPrimary,
    paddingVertical: 0,
    minHeight: 52,
  },
  trailingIcon: { marginHorizontal: 6 },
  messageRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6, paddingHorizontal: 2 },
  errorText: { flex: 1, color: Colors.danger, fontFamily: Fonts.bodyFamily, fontSize: Fonts.tiny, lineHeight: 16, fontWeight: Fonts.weight.semibold },
  helperText: { color: Colors.textLight, fontFamily: Fonts.bodyFamily, fontSize: Fonts.tiny, lineHeight: 16, marginTop: 6, paddingHorizontal: 2 },
});