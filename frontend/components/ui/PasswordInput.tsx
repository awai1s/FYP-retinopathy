import React, { useState } from "react";
import { StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "../../constants/Colors";
import Sizes from "../../constants/Sizes";
import Fonts from "../../constants/Fonts";

interface Props {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  autoComplete?: TextInputProps["autoComplete"];
  onBlur?: () => void;
  onSubmitEditing?: () => void;
}

const PasswordInput = ({
  placeholder,
  value,
  onChangeText,
  label,
  error,
  helperText,
  required = false,
  autoComplete,
  onBlur,
  onSubmitEditing,
}: Props) => {
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      {label ? (
        <Text style={styles.label}>
          {label}{required ? <Text style={styles.required}> *</Text> : null}
        </Text>
      ) : null}
      <View style={[styles.container, focused && styles.containerFocused, error && styles.containerError]}>
        <View style={[styles.iconShell, focused && styles.iconShellFocused, error && styles.iconShellError]}>
          <Ionicons name="lock-closed-outline" size={20} color={error ? Colors.danger : focused ? Colors.primary : Colors.textSecondary} />
        </View>
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={Colors.textPlaceholder}
          secureTextEntry={!showPassword}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          onSubmitEditing={onSubmitEditing}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={autoComplete}
          selectionColor={Colors.primary}
          style={styles.input}
          accessibilityLabel={label || placeholder}
          accessibilityState={{ invalid: Boolean(error) } as any}
        />
        <TouchableOpacity
          onPress={() => setShowPassword((current) => !current)}
          hitSlop={10}
          style={styles.eyeButton}
          accessibilityRole="button"
          accessibilityLabel={showPassword ? "Hide password" : "Show password"}
        >
          <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color={focused ? Colors.primaryDark : Colors.textSecondary} />
        </TouchableOpacity>
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

export default PasswordInput;

const styles = StyleSheet.create({
  wrapper: { width: "100%", marginBottom: Sizes.spacing.md },
  label: { color: Colors.textPrimary, fontFamily: Fonts.headingFamily, fontSize: Fonts.small, fontWeight: Fonts.weight.semibold, marginBottom: 7 },
  required: { color: Colors.danger },
  container: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.inputBackground, borderRadius: Sizes.radius.md, paddingHorizontal: 10, minHeight: Sizes.control.height, borderWidth: 1, borderColor: Colors.border },
  containerFocused: { backgroundColor: Colors.inputFocused, borderColor: Colors.primary, shadowColor: Colors.neonAqua, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.14, shadowRadius: 10, elevation: 2 },
  containerError: { borderColor: Colors.danger, backgroundColor: Colors.dangerSoft },
  iconShell: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: Colors.surfaceMuted },
  iconShellFocused: { backgroundColor: Colors.primaryGlow },
  iconShellError: { backgroundColor: Colors.dangerSoft },
  input: { flex: 1, marginLeft: Sizes.spacing.sm, fontFamily: Fonts.bodyFamily, fontSize: Fonts.body, lineHeight: 21, color: Colors.textPrimary, paddingVertical: 0, minHeight: 52 },
  eyeButton: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  messageRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6, paddingHorizontal: 2 },
  errorText: { flex: 1, color: Colors.danger, fontFamily: Fonts.bodyFamily, fontSize: Fonts.tiny, lineHeight: 16, fontWeight: Fonts.weight.semibold },
  helperText: { color: Colors.textLight, fontFamily: Fonts.bodyFamily, fontSize: Fonts.tiny, lineHeight: 16, marginTop: 6, paddingHorizontal: 2 },
});