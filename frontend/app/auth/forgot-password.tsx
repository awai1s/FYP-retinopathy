import React, { useMemo, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import AuthScaffold from "../../components/ui/AuthScaffold";
import CustomInput from "../../components/ui/CustomInput";
import PasswordInput from "../../components/ui/PasswordInput";
import CustomButton from "../../components/ui/CustomButton";
import FormNotice from "../../components/ui/FormNotice";
import AppText from "../../components/ui/AppText";
import Colors from "../../constants/Colors";
import Sizes from "../../constants/Sizes";
import { requestPasswordReset, verifyPasswordResetOtp, resetPassword } from "../../services/auth";

import { useThemeRefresh } from "../../providers/AppThemeProvider";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  useThemeRefresh();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const emailError = useMemo(() => {
    if (!touched || step !== 0) return "";
    if (!email.trim()) return "Email address is required.";
    if (!EMAIL_PATTERN.test(email.trim())) return "Enter a valid email address.";
    return "";
  }, [email, touched, step]);

  const otpError = touched && step === 1 && !/^\d{6}$/.test(otp) ? "Enter the complete 6-digit verification code." : "";
  const passwordError = touched && step === 2 && newPassword.length < 8 ? "Use at least 8 characters for your new password." : "";
  const confirmError = touched && step === 2 && confirmPassword !== newPassword ? "Passwords do not match." : "";

  const handleRequestOtp = async () => {
    setTouched(true);
    setError("");
    setNotice("");
    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(cleanEmail)) return;

    try {
      setLoading(true);
      await requestPasswordReset(cleanEmail);
      setEmail(cleanEmail);
      setTouched(false);
      setStep(1);
      setNotice("A 6-digit password reset code has been sent to your email.");
    } catch (err: any) {
      setError(err?.message || "We could not send a reset code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setTouched(true);
    setError("");
    setNotice("");
    if (!/^\d{6}$/.test(otp)) return;

    try {
      setLoading(true);
      await verifyPasswordResetOtp(email, otp);
      setTouched(false);
      setStep(2);
      setNotice("Email verified. You can now create a new password.");
    } catch (err: any) {
      setError(err?.message || "The verification code is invalid or expired.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setTouched(true);
    setError("");
    setNotice("");
    if (newPassword.length < 8 || newPassword !== confirmPassword) return;

    try {
      setLoading(true);
      await resetPassword(email, otp, newPassword);
      router.replace("/auth/login");
    } catch (err: any) {
      setError(err?.message || "We could not update your password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const titles = ["Reset your password", "Verify your email", "Choose a new password"];
  const subtitles = [
    "Enter your account email and we will send a secure reset code.",
    `Enter the 6-digit code sent to ${email || "your email"}.`,
    "Create a fresh password for your EyeCare AI account.",
  ];

  return (
    <AuthScaffold
      eyebrow="ACCOUNT RECOVERY"
      title={titles[step]}
      subtitle={subtitles[step]}
      footer={
        <TouchableOpacity onPress={() => router.replace("/auth/login")} style={styles.backButton} accessibilityRole="button">
          <Ionicons name="arrow-back" size={16} color={Colors.neonAqua} />
          <AppText variant="small" color={Colors.neonAqua} weight="bold">Back to sign in</AppText>
        </TouchableOpacity>
      }
    >
      <View style={styles.stepRow}>
        {[0, 1, 2].map((item) => (
          <View key={item} style={styles.stepItem}>
            <View style={[styles.stepDot, item <= step && styles.stepDotActive]}>
              {item < step ? <Ionicons name="checkmark" size={12} color={Colors.navy} /> : <AppText variant="tiny" color={item <= step ? Colors.navy : Colors.textLight} weight="bold">{item + 1}</AppText>}
            </View>
            {item < 2 ? <View style={[styles.stepLine, item < step && styles.stepLineActive]} /> : null}
          </View>
        ))}
      </View>

      {step === 0 ? (
        <>
          <CustomInput
            label="Email address"
            required
            placeholder="name@example.com"
            icon="mail-outline"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            error={emailError}
            onBlur={() => setTouched(true)}
            onChangeText={(text) => { setEmail(text); setTouched(false); setError(""); }}
          />
          <FormNotice message={error} type="error" />
          <CustomButton title={loading ? "Sending code…" : "Send reset code"} icon="paper-plane-outline" iconPosition="right" onPress={handleRequestOtp} loading={loading} disabled={loading} />
        </>
      ) : null}

      {step === 1 ? (
        <>
          <FormNotice message={notice} type="success" />
          <CustomInput
            label="Verification code"
            required
            placeholder="000000"
            icon="keypad-outline"
            keyboardType="number-pad"
            value={otp}
            error={otpError}
            maxLength={6}
            onBlur={() => setTouched(true)}
            onChangeText={(text) => { setOtp(text.replace(/[^0-9]/g, "")); setTouched(false); setError(""); }}
            onSubmitEditing={handleVerifyOtp}
          />
          <FormNotice message={error} type="error" />
          <CustomButton title={loading ? "Verifying…" : "Verify code"} icon="shield-checkmark-outline" iconPosition="right" onPress={handleVerifyOtp} loading={loading} disabled={loading} />
        </>
      ) : null}

      {step === 2 ? (
        <>
          <FormNotice message={notice} type="success" />
          <PasswordInput
            label="New password"
            required
            placeholder="At least 8 characters"
            value={newPassword}
            error={passwordError}
            helperText="Use a password you do not use on other websites."
            autoComplete="new-password"
            onBlur={() => setTouched(true)}
            onChangeText={(text) => { setNewPassword(text); setTouched(false); setError(""); }}
          />
          <PasswordInput
            label="Confirm new password"
            required
            placeholder="Re-enter the new password"
            value={confirmPassword}
            error={confirmError}
            autoComplete="new-password"
            onBlur={() => setTouched(true)}
            onChangeText={(text) => { setConfirmPassword(text); setTouched(false); setError(""); }}
            onSubmitEditing={handleResetPassword}
          />
          <FormNotice message={error} type="error" />
          <CustomButton title={loading ? "Updating password…" : "Update password"} icon="lock-closed-outline" iconPosition="right" onPress={handleResetPassword} loading={loading} disabled={loading} />
        </>
      ) : null}
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  stepRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: Sizes.spacing.xl },
  stepItem: { flexDirection: "row", alignItems: "center" },
  stepDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.surfaceMuted, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  stepDotActive: { backgroundColor: Colors.neonAqua, borderColor: Colors.neonAqua },
  stepLine: { width: 52, height: 2, backgroundColor: Colors.border, marginHorizontal: 5 },
  stepLineActive: { backgroundColor: Colors.neonAqua },
  backButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8 },
});