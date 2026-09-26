import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import AuthScaffold from "../../../components/ui/AuthScaffold";
import CustomButton from "../../../components/ui/CustomButton";
import CustomInput from "../../../components/ui/CustomInput";
import FormNotice from "../../../components/ui/FormNotice";
import AppText from "../../../components/ui/AppText";
import Colors from "../../../constants/Colors";
import Sizes from "../../../constants/Sizes";
import { resendOtpApi, verifyOtp } from "../../../services/auth";

import { useThemeRefresh } from "../../../providers/AppThemeProvider";
export default function VerifyEmail() {
  useThemeRefresh();
  const params = useLocalSearchParams();
  const userEmail = typeof params.email === "string" ? params.email : "";

  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(60);
  const [touched, setTouched] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => setTimer((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const otpError = useMemo(() => {
    if (!touched) return "";
    if (!otp) return "Verification code is required.";
    if (!/^\d{6}$/.test(otp)) return "Enter the complete 6-digit code.";
    return "";
  }, [otp, touched]);

  const handleVerify = async () => {
    if (verifying) return;
    setTouched(true);
    setError("");
    setNotice("");

    if (!userEmail) {
      setError("Your email is missing from this signup session. Go back and enter it again.");
      return;
    }
    if (!/^\d{6}$/.test(otp)) return;

    try {
      setVerifying(true);
      await verifyOtp(userEmail, otp);
      router.push({ pathname: "/auth/signup/step4", params: { ...params } });
    } catch (err: any) {
      setError(err?.message || "The code is invalid or has expired. Check it and try again.");
    } finally {
      setVerifying(false);
    }
  };

  const resendOTP = async () => {
    if (resending || timer > 0) return;
    setError("");
    setNotice("");
    if (!userEmail) {
      setError("Your email is missing from this signup session.");
      return;
    }

    try {
      setResending(true);
      await resendOtpApi(userEmail);
      setTimer(60);
      setOtp("");
      setTouched(false);
      setNotice("A new verification code has been sent. Use the latest code only.");
    } catch (err: any) {
      setError(err?.message || "We could not resend the code. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthScaffold
      eyebrow="EMAIL VERIFICATION"
      title="Check your inbox"
      subtitle="Enter the 6-digit code we sent to verify your email address."
      currentStep={3}
    >
      <View style={styles.emailChip}>
        <View style={styles.emailIcon}><Ionicons name="mail-outline" size={18} color={Colors.primaryDark} /></View>
        <View style={styles.emailTextWrap}>
          <AppText variant="tiny" color={Colors.textLight}>Verification email sent to</AppText>
          <AppText variant="small" weight="bold" numberOfLines={1}>{userEmail || "Email unavailable"}</AppText>
        </View>
      </View>

      <CustomInput
        label="Verification code"
        required
        placeholder="000000"
        icon="keypad-outline"
        value={otp}
        error={otpError}
        helperText="The code expires after a short time for your security."
        keyboardType="number-pad"
        maxLength={6}
        onBlur={() => setTouched(true)}
        onChangeText={(text) => {
          setOtp(text.replace(/[^0-9]/g, ""));
          setError("");
          setNotice("");
        }}
        onSubmitEditing={handleVerify}
      />

      {timer > 0 ? (
        <View style={styles.timerRow}>
          <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
          <AppText variant="small" color={Colors.textSecondary}>You can request another code in {timer}s</AppText>
        </View>
      ) : (
        <TouchableOpacity onPress={resendOTP} disabled={resending} style={styles.resendButton} accessibilityRole="button">
          <Ionicons name="refresh-outline" size={17} color={Colors.primaryDark} />
          <AppText variant="small" color={Colors.primaryDark} weight="bold">
            {resending ? "Sending another code…" : "Resend verification code"}
          </AppText>
        </TouchableOpacity>
      )}

      <FormNotice message={notice} type="success" />
      <FormNotice message={error} type="error" />

      <CustomButton
        title={verifying ? "Verifying…" : "Verify and continue"}
        icon="shield-checkmark-outline"
        iconPosition="right"
        onPress={handleVerify}
        loading={verifying}
        disabled={verifying}
      />
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  emailChip: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surfaceMuted, borderRadius: Sizes.radius.md, borderWidth: 1, borderColor: Colors.border, padding: 11, marginBottom: Sizes.spacing.lg },
  emailIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: Colors.primaryGlow, marginRight: 10 },
  emailTextWrap: { flex: 1, gap: 2 },
  timerRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: -3, marginBottom: Sizes.spacing.lg },
  resendButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 10, marginTop: -3, marginBottom: Sizes.spacing.md },
});