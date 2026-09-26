import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import AuthScaffold from "../../../components/ui/AuthScaffold";
import CustomButton from "../../../components/ui/CustomButton";
import CustomInput from "../../../components/ui/CustomInput";
import FormNotice from "../../../components/ui/FormNotice";
import AppText from "../../../components/ui/AppText";
import Colors from "../../../constants/Colors";
import Sizes from "../../../constants/Sizes";

import { sendOtp } from "../../../services/auth";
import { useLanguage } from "../../../services/i18n";

import { useThemeRefresh } from "../../../providers/AppThemeProvider";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{4,20}$/;

export default function Step2() {
  useThemeRefresh();
  const params = useLocalSearchParams();
  const { t } = useLanguage();
  const selectedRole = String(params.role || "");

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [hospital, setHospital] = useState("");
  const [pmdcNumber, setPmdcNumber] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [serverError, setServerError] = useState("");
  const [touched, setTouched] = useState({ username: false, email: false, specialization: false, hospital: false, pmdc: false });

  const usernameError = useMemo(() => {
    if (!touched.username && !submitted) return "";
    if (!username.trim()) return "Username is required.";
    if (!USERNAME_PATTERN.test(username.trim())) return "Use 4–20 letters, numbers or underscores; no spaces.";
    return "";
  }, [username, touched.username, submitted]);

  const emailError = useMemo(() => {
    if (!touched.email && !submitted) return "";
    if (!email.trim()) return "Email address is required.";
    if (!EMAIL_PATTERN.test(email.trim())) return "Enter a valid email address, for example name@example.com.";
    return "";
  }, [email, touched.email, submitted]);

  const specializationError = selectedRole === "Doctor" && (submitted || touched.specialization) && !specialization.trim() ? "Specialization is required for doctor accounts." : "";
  const hospitalError = selectedRole === "Doctor" && (submitted || touched.hospital) && !hospital.trim() ? "Hospital or clinic is required for doctor accounts." : "";
  const pmdcError = selectedRole === "Doctor" && (submitted || touched.pmdc) && !pmdcNumber.trim() ? "PMDC number is required for doctor accounts." : "";

  const handleNext = async () => {
    if (sending) return;
    setSubmitted(true);
    setTouched({ username: true, email: true, specialization: true, hospital: true, pmdc: true });
    setServerError("");

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanSpecialization = specialization.trim();
    const cleanHospital = hospital.trim();
    const cleanPmdcNumber = pmdcNumber.trim();

    if (!USERNAME_PATTERN.test(cleanUsername) || !EMAIL_PATTERN.test(cleanEmail)) return;
    if (selectedRole === "Doctor" && (!cleanSpecialization || !cleanHospital || !cleanPmdcNumber)) return;

    try {
      setSending(true);
      await sendOtp(cleanEmail);

      router.push({
        pathname: "/auth/signup/verifyEmail",
        params: {
          ...params,
          username: cleanUsername,
          email: cleanEmail,
          ...(selectedRole === "Doctor"
            ? { specialization: cleanSpecialization, hospital: cleanHospital, pmdcNumber: cleanPmdcNumber }
            : {}),
        },
      } as never);
    } catch (error: any) {
      setServerError(error?.message || "We could not send the verification code. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthScaffold
      eyebrow="ACCOUNT & CONTACT DETAILS"
      title={t("createAccount") || "Create your account"}
      subtitle={selectedRole === "Doctor" ? "Add your sign-in details and professional information." : "Choose your username and a verified email address."}
      currentStep={2}
    >
      <View style={styles.sectionHeader}>
        <AppText variant="title" weight="bold">Account information</AppText>
        <AppText variant="small" color={Colors.textSecondary} style={styles.sectionCaption}>
          We will send a 6-digit verification code to this email.
        </AppText>
      </View>

      <CustomInput
        label="Username"
        required
        placeholder="e.g. awais_raza"
        icon="at-outline"
        value={username}
        error={usernameError}
        helperText="4–20 characters. Letters, numbers and underscore only."
        autoCapitalize="none"
        autoComplete="username"
        onBlur={() => setTouched((v) => ({ ...v, username: true }))}
        onChangeText={(text) => { setUsername(text.replace(/\s/g, "")); setServerError(""); }}
      />

      <CustomInput
        label="Email address"
        required
        placeholder="name@example.com"
        icon="mail-outline"
        value={email}
        error={emailError}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        onBlur={() => setTouched((v) => ({ ...v, email: true }))}
        onChangeText={(text) => { setEmail(text); setServerError(""); }}
      />

      {selectedRole === "Doctor" ? (
        <>
          <View style={styles.divider} />
          <View style={styles.sectionHeader}>
            <AppText variant="title" weight="bold">Professional information</AppText>
            <AppText variant="small" color={Colors.textSecondary} style={styles.sectionCaption}>
              Used to identify your clinical account in the doctor portal.
            </AppText>
          </View>
          <CustomInput
            label={t("specialization") || "Specialization"}
            required
            placeholder="e.g. Ophthalmology"
            icon="medical-outline"
            value={specialization}
            error={specializationError}
            autoCapitalize="words"
            onBlur={() => setTouched((v) => ({ ...v, specialization: true }))}
            onChangeText={(text) => { setSpecialization(text); setServerError(""); }}
          />
          <CustomInput
            label={t("hospitalClinic") || "Hospital / clinic"}
            required
            placeholder="Hospital or clinic name"
            icon="business-outline"
            value={hospital}
            error={hospitalError}
            autoCapitalize="words"
            onBlur={() => setTouched((v) => ({ ...v, hospital: true }))}
            onChangeText={(text) => { setHospital(text); setServerError(""); }}
          />
          <CustomInput
            label={t("pmdcNumber") || "PMDC number"}
            required
            placeholder="Enter registration number"
            icon="card-outline"
            value={pmdcNumber}
            error={pmdcError}
            autoCapitalize="characters"
            onBlur={() => setTouched((v) => ({ ...v, pmdc: true }))}
            onChangeText={(text) => { setPmdcNumber(text); setServerError(""); }}
          />
        </>
      ) : null}

      <FormNotice message={serverError} type="error" />
      <CustomButton
        title={sending ? "Sending code…" : "Send verification code"}
        icon="paper-plane-outline"
        iconPosition="right"
        onPress={handleNext}
        loading={sending}
        disabled={sending}
      />
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { marginBottom: Sizes.spacing.lg },
  sectionCaption: { marginTop: 4 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Sizes.spacing.lg },
});