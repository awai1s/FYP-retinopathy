import React, { useMemo, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";

import AuthScaffold from "../../components/ui/AuthScaffold";
import CustomInput from "../../components/ui/CustomInput";
import PasswordInput from "../../components/ui/PasswordInput";
import CustomButton from "../../components/ui/CustomButton";
import FormNotice from "../../components/ui/FormNotice";
import AppText from "../../components/ui/AppText";
import Colors from "../../constants/Colors";
import Sizes from "../../constants/Sizes";

import { login, getProfile } from "../../services/auth";
import { saveToken } from "../../services/storage";
import { useLanguage } from "../../services/i18n";

import { useThemeRefresh } from "../../providers/AppThemeProvider";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  useThemeRefresh();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({ email: false, password: false });
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const emailError = useMemo(() => {
    if (!touched.email) return "";
    if (!email.trim()) return "Email address is required.";
    if (!EMAIL_PATTERN.test(email.trim())) return "Enter a valid email address, for example name@example.com.";
    return "";
  }, [email, touched.email]);

  const passwordError = useMemo(() => {
    if (!touched.password) return "";
    if (!password) return "Password is required.";
    return "";
  }, [password, touched.password]);

  const handleLogin = async () => {
    setTouched({ email: true, password: true });
    setServerError("");

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !EMAIL_PATTERN.test(cleanEmail) || !password) return;

    try {
      setLoading(true);
      const response = await login(cleanEmail, password);
      const token = response?.access_token || response?.token || response?.accessToken;
      if (!token) throw new Error("Login succeeded, but the server did not return a session token.");
      await saveToken(token);

      let profile: any = null;
      try {
        profile = await getProfile();
      } catch {
        // Role in the login response remains a valid fallback.
      }

      const role = String(profile?.role || response?.role || response?.user?.role || response?.userRole || "")
        .trim()
        .toLowerCase();

      if (role === "superadmin" || role === "super admin") router.replace("/superadmin/dashboard" as any);
      else if (role === "doctor") router.replace("/doctor/dashboard");
      else if (role === "hospital" || role === "hospital staff") router.replace("/hospital/dashboard");
      else router.replace("/tabs/dashboard");
    } catch (err: any) {
      setServerError(err?.message || "We could not sign you in. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScaffold
      eyebrow="EYECARE AI • SECURE ACCESS"
      title={t("welcomeBack") || "Welcome back"}
      subtitle="Sign in to continue to your retinal health workspace."
      footer={
        <View style={styles.signupRow}>
          <AppText variant="small" color={Colors.textOnDarkMuted}>
            {t("dontHaveAccount") || "Don't have an account?"}{" "}
          </AppText>
          <TouchableOpacity
            onPress={() => router.push("/auth/signup" as any)}
            accessibilityRole="button"
            accessibilityLabel="Create an account"
          >
            <AppText variant="small" color={Colors.neonAqua} weight="bold">
              {t("createOne") || "Create one"}
            </AppText>
          </TouchableOpacity>
        </View>
      }
    >
      <View style={styles.formIntro}>
        <AppText variant="title" weight="bold">Sign in</AppText>
        <AppText variant="small" color={Colors.textSecondary} style={styles.formSubtitle}>
          Use the email address linked to your account.
        </AppText>
      </View>

      <CustomInput
        label="Email address"
        required
        placeholder="name@example.com"
        icon="mail-outline"
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        value={email}
        error={emailError}
        returnKeyType="next"
        onBlur={() => setTouched((v) => ({ ...v, email: true }))}
        onChangeText={(text) => {
          setEmail(text);
          setServerError("");
        }}
      />

      <PasswordInput
        label="Password"
        required
        placeholder="Enter your password"
        value={password}
        error={passwordError}
        autoComplete="current-password"
        onBlur={() => setTouched((v) => ({ ...v, password: true }))}
        onChangeText={(text) => {
          setPassword(text);
          setServerError("");
        }}
        onSubmitEditing={handleLogin}
      />

      <View style={styles.utilityRow}>
        <View />
        <TouchableOpacity
          onPress={() => router.push("/auth/forgot-password" as any)}
          accessibilityRole="button"
          accessibilityLabel="Forgot password"
          style={styles.forgotButton}
        >
          <AppText variant="small" color={Colors.primaryDark} weight="bold">
            {t("forgotPassword") || "Forgot password?"}
          </AppText>
        </TouchableOpacity>
      </View>

      <FormNotice message={serverError} type="error" />

      <CustomButton
        title={loading ? "Signing in…" : "Sign in securely"}
        icon="log-in-outline"
        iconPosition="right"
        onPress={handleLogin}
        disabled={loading}
        loading={loading}
      />

      <View style={styles.securityHint}>
        <AppText variant="tiny" color={Colors.textLight} style={styles.securityText}>
          Protected with encrypted authentication and role-based access.
        </AppText>
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  formIntro: { marginBottom: Sizes.spacing.lg },
  formSubtitle: { marginTop: 4 },
  utilityRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: -5, marginBottom: Sizes.spacing.md },
  forgotButton: { paddingVertical: 6, paddingHorizontal: 2 },
  signupRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", flexWrap: "wrap" },
  securityHint: { marginTop: Sizes.spacing.md, paddingTop: Sizes.spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  securityText: { textAlign: "center" },
});