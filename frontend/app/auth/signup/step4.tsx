import React, { useMemo, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";

import AuthScaffold from "../../../components/ui/AuthScaffold";
import PasswordInput from "../../../components/ui/PasswordInput";
import CustomButton from "../../../components/ui/CustomButton";
import FormNotice from "../../../components/ui/FormNotice";
import AppText from "../../../components/ui/AppText";

import { signup } from "../../../services/auth";
import Colors from "../../../constants/Colors";
import Fonts from "../../../constants/Fonts";
import Sizes from "../../../constants/Sizes";

import { useThemeRefresh } from "../../../providers/AppThemeProvider";
export default function Step4() {
  useThemeRefresh();
  const params = useLocalSearchParams();
  const role = String(params.role || "");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [touchedConfirm, setTouchedConfirm] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const rules = useMemo(() => [
    { label: "At least 8 characters", ok: password.length >= 8 },
    { label: "One uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "One lowercase letter", ok: /[a-z]/.test(password) },
    { label: "One number", ok: /\d/.test(password) },
    { label: "One special character", ok: /[@$!%*?&#^()_+\-=[\]{};':"\\|,.<>/?]/.test(password) },
  ], [password]);

  const validPassword = rules.every((rule) => rule.ok);
  const strengthCount = rules.filter((rule) => rule.ok).length;
  const strengthLabel = password.length === 0 ? "" : strengthCount <= 2 ? "Weak" : strengthCount <= 4 ? "Good" : "Strong";
  const strengthColor = strengthLabel === "Strong" ? Colors.success : strengthLabel === "Good" ? Colors.warning : Colors.danger;

  const passwordError = submitted && !validPassword ? "Your password does not yet meet all security requirements." : "";
  const confirmError = (submitted || touchedConfirm) && confirmPassword !== password ? "Passwords do not match." : "";
  const termsError = submitted && !accepted ? "Accept the Terms & Conditions to create your account." : "";

  const toggleTerms = () => {
    if (Platform.OS !== "web") void Haptics.selectionAsync();
    setAccepted((previous) => !previous);
    setError("");
  };

  const handleSignup = async () => {
    if (isLoading) return;
    setSubmitted(true);
    setError("");

    if (!validPassword || confirmPassword !== password || !accepted) return;
    if (!role) {
      setError("Your account type is missing. Go back to Step 1 and select Patient, Doctor or Hospital.");
      return;
    }
    if (!params.firstName || !params.lastName || !params.username || !params.email) {
      setError("Your signup session is incomplete. Please restart signup so no profile information is missed.");
      return;
    }

    setIsLoading(true);
    try {
      const fullName = `${String(params.firstName)} ${String(params.lastName)}`.trim();
      const dobDay = String(params.day || "1");
      const dobMonth = String(params.month || "1");
      const dobYear = String(params.year || "2000");
      const dobString = `${dobYear}-${dobMonth.padStart(2, "0")}-${dobDay.padStart(2, "0")}`;

      const today = new Date();
      let computedAge = today.getFullYear() - Number(dobYear);
      if (today.getMonth() + 1 < Number(dobMonth) || (today.getMonth() + 1 === Number(dobMonth) && today.getDate() < Number(dobDay))) computedAge--;

      await signup(
        fullName,
        String(params.username),
        String(params.email),
        password,
        role,
        String(params.firstName),
        String(params.lastName),
        String(params.mobile || ""),
        String(params.gender || ""),
        dobString,
        computedAge,
        String(params.specialization || ""),
        String(params.hospital || ""),
        String(params.pmdcNumber || ""),
        String(params.countryCode || ""),
      );

      router.replace("/auth/login" as any);
    } catch (err: any) {
      setError(err?.message || "We could not create your account. Review your details and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthScaffold
      eyebrow="FINAL SECURITY STEP"
      title="Protect your account"
      subtitle="Create a strong password to secure your health information and complete signup."
      currentStep={4}
    >
      <View style={styles.roleCard}>
        <View style={styles.roleIcon}><Ionicons name={role === "Doctor" ? "medical-outline" : role === "Hospital" ? "business-outline" : "person-outline"} size={18} color={Colors.primaryDark} /></View>
        <View style={styles.roleMain}>
          <AppText variant="tiny" color={Colors.textLight}>Creating</AppText>
          <AppText variant="small" weight="bold">{role || "Unselected"} account</AppText>
        </View>
        <Ionicons name="shield-checkmark-outline" size={22} color={Colors.success} />
      </View>

      <PasswordInput
        label="Password"
        required
        placeholder="Create a strong password"
        value={password}
        error={passwordError}
        autoComplete="new-password"
        onChangeText={(text) => { setPassword(text); setError(""); }}
      />

      {password.length > 0 ? (
        <View style={styles.strengthCard}>
          <View style={styles.strengthHeader}>
            <Text style={styles.strengthTitle}>Password strength</Text>
            <Text style={[styles.strengthLabel, { color: strengthColor }]}>{strengthLabel}</Text>
          </View>
          <View style={styles.strengthTrack}>
            <View style={[styles.strengthFill, { width: `${Math.max(12, (strengthCount / 5) * 100)}%`, backgroundColor: strengthColor }]} />
          </View>
          <View style={styles.ruleGrid}>
            {rules.map((rule) => (
              <View key={rule.label} style={styles.ruleRow}>
                <Ionicons name={rule.ok ? "checkmark-circle" : "ellipse-outline"} size={15} color={rule.ok ? Colors.success : Colors.textLight} />
                <Text style={[styles.ruleText, rule.ok && styles.ruleTextDone]}>{rule.label}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <PasswordInput
        label="Confirm password"
        required
        placeholder="Re-enter your password"
        value={confirmPassword}
        error={confirmError}
        autoComplete="new-password"
        onBlur={() => setTouchedConfirm(true)}
        onChangeText={(text) => { setConfirmPassword(text); setError(""); }}
      />

      <TouchableOpacity
        style={[styles.termsCard, accepted && styles.termsCardAccepted, termsError && styles.termsCardError]}
        onPress={toggleTerms}
        activeOpacity={0.84}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: accepted }}
      >
        <View style={[styles.checkbox, accepted && styles.checked]}>
          {accepted ? <Ionicons name="checkmark" size={15} color={Colors.white} /> : null}
        </View>
        <View style={styles.termsMain}>
          <Text style={styles.termsTitle}>I accept the Terms & Conditions</Text>
          <Text style={styles.termsCaption}>I understand this application supports screening and care management and does not replace a clinician.</Text>
        </View>
      </TouchableOpacity>
      {termsError ? <Text style={styles.inlineError}>{termsError}</Text> : null}

      <FormNotice message={error} type="error" />
      <CustomButton
        title={isLoading ? "Creating your account…" : "Create secure account"}
        icon="sparkles-outline"
        iconPosition="right"
        onPress={handleSignup}
        loading={isLoading}
        disabled={isLoading}
      />
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  roleCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surfaceMuted, borderRadius: Sizes.radius.md, padding: 11, borderWidth: 1, borderColor: Colors.border, marginBottom: Sizes.spacing.lg },
  roleIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.primaryGlow, alignItems: "center", justifyContent: "center", marginRight: 10 },
  roleMain: { flex: 1, gap: 1 },
  strengthCard: { marginTop: -4, marginBottom: Sizes.spacing.lg, backgroundColor: Colors.surfaceMuted, borderRadius: Sizes.radius.md, borderWidth: 1, borderColor: Colors.border, padding: 12 },
  strengthHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  strengthTitle: { color: Colors.textSecondary, fontFamily: Fonts.headingFamily, fontSize: Fonts.small, fontWeight: Fonts.weight.semibold },
  strengthLabel: { fontFamily: Fonts.headingFamily, fontSize: Fonts.small, fontWeight: Fonts.weight.extraBold },
  strengthTrack: { height: 5, backgroundColor: Colors.border, borderRadius: 3, overflow: "hidden", marginBottom: 10 },
  strengthFill: { height: "100%", borderRadius: 3 },
  ruleGrid: { gap: 6 },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  ruleText: { color: Colors.textLight, fontFamily: Fonts.bodyFamily, fontSize: Fonts.tiny },
  ruleTextDone: { color: Colors.textSecondary },
  termsCard: { flexDirection: "row", alignItems: "flex-start", borderRadius: Sizes.radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.inputBackground, padding: 12, marginBottom: 6 },
  termsCardAccepted: { borderColor: Colors.primary, backgroundColor: Colors.surfaceMuted },
  termsCardError: { borderColor: Colors.danger },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: Colors.borderStrong, backgroundColor: Colors.surface, alignItems: "center", justifyContent: "center", marginRight: 10, marginTop: 1 },
  checked: { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
  termsMain: { flex: 1 },
  termsTitle: { color: Colors.textPrimary, fontFamily: Fonts.headingFamily, fontSize: Fonts.small, fontWeight: Fonts.weight.bold },
  termsCaption: { color: Colors.textSecondary, fontFamily: Fonts.bodyFamily, fontSize: Fonts.tiny, lineHeight: 16, marginTop: 3 },
  inlineError: { color: Colors.danger, fontFamily: Fonts.bodyFamily, fontSize: Fonts.tiny, fontWeight: Fonts.weight.semibold, marginBottom: Sizes.spacing.md, paddingHorizontal: 2 },
});