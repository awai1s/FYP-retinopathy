import React, { useMemo, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";

import AuthScaffold from "../../../components/ui/AuthScaffold";
import CustomButton from "../../../components/ui/CustomButton";
import CustomInput from "../../../components/ui/CustomInput";
import DOBSelector from "../../../components/ui/DOBSelector";
import GenderSelector from "../../../components/ui/GenderSelector";
import CountryCodeSelector from "../../../components/ui/CountryCodeSelector";
import FormNotice from "../../../components/ui/FormNotice";
import AppText from "../../../components/ui/AppText";

import Colors from "../../../constants/Colors";
import Fonts from "../../../constants/Fonts";
import Sizes from "../../../constants/Sizes";
import { useLanguage } from "../../../services/i18n";

import { useThemeRefresh } from "../../../providers/AppThemeProvider";
const roleOptions = [
  { value: "Patient", icon: "person-outline" as const, caption: "Track and manage your eye health" },
  { value: "Doctor", icon: "medical-outline" as const, caption: "Clinical patient care workspace" },
  { value: "Hospital", icon: "business-outline" as const, caption: "Hospital reporting workspace" },
];

export default function Step1() {
  useThemeRefresh();
  const { t } = useLanguage();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [role, setRole] = useState("");
  const [day, setDay] = useState(1);
  const [month, setMonth] = useState(1);
  const [year, setYear] = useState(2000);
  const [mobile, setMobile] = useState("");
  const [countryCode, setCountryCode] = useState("+92");
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState({ firstName: false, lastName: false, mobile: false });
  const [formError, setFormError] = useState("");

  const calculateAge = () => {
    const today = new Date();
    let age = today.getFullYear() - year;
    if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age--;
    return age;
  };

  const validateName = (text: string) => /^[A-Za-z][A-Za-z '-]{0,49}$/.test(text.trim());
  const validateMobile = (text: string) => {
    const digits = text.replace(/[^0-9]/g, "");
    if (countryCode === "+92") return /^(03\d{9}|3\d{9})$/.test(digits);
    return /^\d{6,14}$/.test(digits);
  };

  const firstNameError = useMemo(() => {
    if (!touched.firstName && !submitted) return "";
    if (!firstName.trim()) return "First name is required.";
    if (!validateName(firstName)) return "Use letters only; apostrophes, spaces and hyphens are allowed.";
    return "";
  }, [firstName, touched.firstName, submitted]);

  const lastNameError = useMemo(() => {
    if (!touched.lastName && !submitted) return "";
    if (!lastName.trim()) return "Last name is required.";
    if (!validateName(lastName)) return "Use letters only; apostrophes, spaces and hyphens are allowed.";
    return "";
  }, [lastName, touched.lastName, submitted]);

  const mobileError = useMemo(() => {
    if (!touched.mobile && !submitted) return "";
    if (!mobile.trim()) return "Mobile number is required.";
    if (!validateMobile(mobile)) {
      return countryCode === "+92"
        ? "Enter a valid Pakistani mobile number, e.g. 03001234567."
        : "Enter a valid phone number using 6–14 digits.";
    }
    return "";
  }, [mobile, countryCode, touched.mobile, submitted]);

  const roleError = submitted && !role ? "Choose the portal that matches how you will use EyeCare AI." : "";
  const genderError = submitted && !gender ? "Select a gender to continue." : "";
  const age = calculateAge();
  const dobError = submitted && (age < 1 || age > 120) ? "Select a valid date of birth." : "";

  const selectRole = (nextRole: string) => {
    if (Platform.OS !== "web") void Haptics.selectionAsync();
    setRole(nextRole);
    setFormError("");
  };

  const handleNext = () => {
    setSubmitted(true);
    setTouched({ firstName: true, lastName: true, mobile: true });
    setFormError("");

    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanMobile = mobile.replace(/[^0-9]/g, "").trim();

    if (!cleanFirstName || !cleanLastName || !gender || !role || !cleanMobile || !validateName(cleanFirstName) || !validateName(cleanLastName) || !validateMobile(cleanMobile) || age < 1 || age > 120) {
      setFormError("Please correct the highlighted fields before continuing.");
      return;
    }

    const normalizedMobile = `${countryCode}${cleanMobile.replace(/^0+/, "")}`;

    router.push({
      pathname: "/auth/signup/step2",
      params: {
        firstName: cleanFirstName,
        lastName: cleanLastName,
        gender,
        role,
        mobile: normalizedMobile,
        countryCode,
        day: String(day),
        month: String(month),
        year: String(year),
      },
    });
  };

  return (
    <AuthScaffold
      eyebrow="CREATE YOUR SECURE PROFILE"
      title={t("createAccount") || "Create your account"}
      subtitle="Start with your personal details. You can review and update your profile later."
      currentStep={1}
    >
      <View style={styles.sectionHeader}>
        <AppText variant="title" weight="bold">Personal details</AppText>
        <AppText variant="small" color={Colors.textSecondary} style={styles.sectionCaption}>
          Fields marked with * are required.
        </AppText>
      </View>

      <CustomInput
        label={t("firstName") || "First name"}
        required
        placeholder="e.g. Awais"
        icon="person-outline"
        value={firstName}
        error={firstNameError}
        autoCapitalize="words"
        autoComplete="given-name"
        onBlur={() => setTouched((v) => ({ ...v, firstName: true }))}
        onChangeText={(text) => { setFirstName(text); setFormError(""); }}
      />

      <CustomInput
        label={t("lastName") || "Last name"}
        required
        placeholder="e.g. Raza"
        icon="person-outline"
        value={lastName}
        error={lastNameError}
        autoCapitalize="words"
        autoComplete="family-name"
        onBlur={() => setTouched((v) => ({ ...v, lastName: true }))}
        onChangeText={(text) => { setLastName(text); setFormError(""); }}
      />

      <Text style={styles.fieldLabel}>Account type <Text style={styles.required}>*</Text></Text>
      <View style={styles.roleList}>
        {roleOptions.map((option) => {
          const selected = role === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.roleButton, selected && styles.roleButtonSelected, roleError && !role && styles.roleButtonError]}
              onPress={() => selectRole(option.value)}
              activeOpacity={0.84}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <View style={[styles.roleIcon, selected && styles.roleIconSelected]}>
                <Ionicons name={option.icon} size={19} color={selected ? Colors.white : Colors.primaryDark} />
              </View>
              <View style={styles.roleTextWrap}>
                <Text style={[styles.roleTitle, selected && styles.roleTitleSelected]}>{option.value}</Text>
                <Text style={[styles.roleCaption, selected && styles.roleCaptionSelected]}>{option.caption}</Text>
              </View>
              <Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={20} color={selected ? Colors.neonAqua : Colors.textLight} />
            </TouchableOpacity>
          );
        })}
      </View>
      {roleError ? <Text style={styles.inlineError}>{roleError}</Text> : null}

      <GenderSelector value={gender} onSelect={(value) => { setGender(value); setFormError(""); }} error={genderError} />

      <DOBSelector day={day} month={month} year={year} setDay={setDay} setMonth={setMonth} setYear={setYear} />
      <View style={styles.ageCard}>
        <View style={styles.ageIcon}><Ionicons name="calendar-number-outline" size={18} color={Colors.primaryDark} /></View>
        <View style={styles.ageMain}>
          <Text style={styles.ageLabel}>{t("age") || "Age"}</Text>
          <Text style={styles.ageHint}>Calculated from your date of birth</Text>
        </View>
        <Text style={styles.ageValue}>{age} {t("years") || "years"}</Text>
      </View>
      {dobError ? <Text style={styles.inlineError}>{dobError}</Text> : null}

      <Text style={styles.fieldLabel}>Mobile number <Text style={styles.required}>*</Text></Text>
      <View style={styles.phoneRow}>
        <CountryCodeSelector value={countryCode} onChange={(code) => { setCountryCode(code); setFormError(""); }} />
        <View style={styles.phoneInput}>
          <CustomInput
            placeholder={countryCode === "+92" ? "03001234567" : "Phone number"}
            icon="call-outline"
            value={mobile}
            error={mobileError}
            helperText={countryCode === "+92" ? "Pakistan format: 03XXXXXXXXX" : "Digits only"}
            onBlur={() => setTouched((v) => ({ ...v, mobile: true }))}
            onChangeText={(text) => { setMobile(text); setFormError(""); }}
            keyboardType="phone-pad"
            autoComplete="tel"
            maxLength={14}
          />
        </View>
      </View>

      <FormNotice message={formError} type="error" />
      <CustomButton title="Continue to account details" icon="arrow-forward" iconPosition="right" onPress={handleNext} />
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { marginBottom: Sizes.spacing.lg },
  sectionCaption: { marginTop: 4 },
  fieldLabel: { color: Colors.textPrimary, fontFamily: Fonts.headingFamily, fontSize: Fonts.small, fontWeight: Fonts.weight.semibold, marginBottom: 8 },
  required: { color: Colors.danger },
  roleList: { gap: 8, marginBottom: 6 },
  roleButton: { minHeight: 66, flexDirection: "row", alignItems: "center", borderRadius: Sizes.radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.inputBackground, paddingHorizontal: 12, paddingVertical: 9 },
  roleButtonSelected: { borderColor: Colors.primaryDark, backgroundColor: Colors.surfaceMuted, shadowColor: Colors.neonAqua, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 9, elevation: 2 },
  roleButtonError: { borderColor: Colors.danger },
  roleIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: Colors.primaryGlow, marginRight: 10 },
  roleIconSelected: { backgroundColor: Colors.primaryDark },
  roleTextWrap: { flex: 1, paddingRight: 8 },
  roleTitle: { color: Colors.textPrimary, fontFamily: Fonts.headingFamily, fontSize: Fonts.body, fontWeight: Fonts.weight.bold },
  roleTitleSelected: { color: Colors.primaryDark },
  roleCaption: { color: Colors.textSecondary, fontFamily: Fonts.bodyFamily, fontSize: Fonts.tiny, lineHeight: 15, marginTop: 2 },
  roleCaptionSelected: { color: Colors.textSecondary },
  inlineError: { color: Colors.danger, fontFamily: Fonts.bodyFamily, fontSize: Fonts.tiny, fontWeight: Fonts.weight.semibold, marginTop: 1, marginBottom: Sizes.spacing.md, paddingHorizontal: 2 },
  ageCard: { minHeight: 58, marginBottom: 4, paddingHorizontal: 12, borderRadius: Sizes.radius.md, backgroundColor: Colors.surfaceMuted, borderWidth: 1, borderColor: Colors.border, flexDirection: "row", alignItems: "center" },
  ageIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: Colors.primaryGlow, alignItems: "center", justifyContent: "center", marginRight: 10 },
  ageMain: { flex: 1 },
  ageLabel: { color: Colors.textPrimary, fontFamily: Fonts.headingFamily, fontSize: Fonts.small, fontWeight: Fonts.weight.bold },
  ageHint: { color: Colors.textLight, fontFamily: Fonts.bodyFamily, fontSize: Fonts.tiny, marginTop: 2 },
  ageValue: { color: Colors.primaryDark, fontFamily: Fonts.headingFamily, fontSize: Fonts.body, fontWeight: Fonts.weight.extraBold },
  phoneRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 2 },
  phoneInput: { flex: 1 },
});