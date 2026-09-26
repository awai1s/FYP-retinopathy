import { Alert } from "../../services/alert";
import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { getProfile } from "../../services/auth";
import { updateMyProfile } from "../../services/common";
import { useLanguage } from "../../services/i18n";
import { getScreeningConsent, setScreeningConsent } from "../../services/consent";
import DOBSelector from "../../components/ui/DOBSelector";
import LogoutButton from "../../components/LogoutButton";

import AppShell from "../../design/components/AppShell";
import Card from "../../design/components/card";
import IconContainer from "../../design/components/IconContainer";
import StatusBadge from "../../design/components/StatusBadge";
import Button from "../../design/components/Button";
import colors from "../../design/tokens/colors";
import spacing from "../../design/tokens/spacing";
import typography from "../../design/tokens/typography";
import radius from "../../design/tokens/radius";

import { useThemeRefresh } from "../../providers/AppThemeProvider";
export default function PatientProfileScreen() {
  useThemeRefresh();
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [gender, setGender] = useState("");
  const [role, setRole] = useState("");
  const [screeningConsent, setScreeningConsentState] = useState(false);
  const [consentSaving, setConsentSaving] = useState(false);
  const [bloodGroup, setBloodGroup] = useState("");
  const [address, setAddress] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [allergies, setAllergies] = useState("");

  const [day, setDay] = useState(1);
  const [month, setMonth] = useState(1);
  const [year, setYear] = useState(2000);

  const [dob, setDob] = useState("");
  const [age, setAge] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await getProfile();
      try {
        setScreeningConsentState(await getScreeningConsent());
      } catch {
        // Fallback for missing consent API
      }

      setFirstName(data.first_name || "");
      setLastName(data.last_name || "");
      setUsername(data.username || "");
      setEmail(data.email || "");
      setMobile(data.mobile || "");
      setGender(data.gender || "");
      setRole(data.role || "");
      setBloodGroup(data.bloodGroup || "");
      setAddress(data.address || "");
      setEmergencyContact(data.emergencyContact || "");
      setAllergies(Array.isArray(data.allergies) ? data.allergies.join(", ") : data.allergies || "");

      if (data.dob) {
        const dobDate = new Date(data.dob);

        if (!isNaN(dobDate.getTime())) {
          const selectedDay = dobDate.getDate();
          const selectedMonth = dobDate.getMonth() + 1;
          const selectedYear = dobDate.getFullYear();

          setDay(selectedDay);
          setMonth(selectedMonth);
          setYear(selectedYear);

          setDob(
            `${String(selectedDay).padStart(2, "0")}/` +
              `${String(selectedMonth).padStart(2, "0")}/` +
              `${selectedYear}`
          );

          calculateAgeFromDate(selectedDay, selectedMonth, selectedYear);
        }
      }

      if (data.age !== undefined && data.age !== null) {
        setAge(String(data.age));
      }
    } catch (error: any) {
      console.error("Profile request failed.");
      Alert.alert("Error", error?.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const calculateAgeFromDate = (
    selectedDay: number,
    selectedMonth: number,
    selectedYear: number
  ) => {
    const today = new Date();
    let calculatedAge = today.getFullYear() - selectedYear;
    if (
      today.getMonth() + 1 < selectedMonth ||
      (today.getMonth() + 1 === selectedMonth && today.getDate() < selectedDay)
    ) {
      calculatedAge--;
    }
    setAge(String(calculatedAge));
  };

  useEffect(() => {
    if (!editing) return;
    calculateAgeFromDate(day, month, year);
    setDob(
      `${String(day).padStart(2, "0")}/` +
        `${String(month).padStart(2, "0")}/` +
        `${year}`
    );
  }, [day, month, year]);

  const handleConsentToggle = async () => {
    if (consentSaving) return;
    setConsentSaving(true);
    const next = !screeningConsent;
    try {
      await setScreeningConsent(next);
      setScreeningConsentState(next);
    } catch (error: any) {
      Alert.alert("Consent unavailable", error?.message || "Unable to update screening consent.");
    } finally {
      setConsentSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      await updateMyProfile({ firstName, lastName, username, mobile, email, dob, gender, age, bloodGroup, address, emergencyContact, allergies });
      setEditing(false);
      Alert.alert("Success", "Profile updated successfully.");
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to update profile.");
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.teal800} />
        <Text style={styles.loadingText}>Loading Profile...</Text>
      </View>
    );
  }

  return (
    <AppShell role="Patient" title={t("profile") || "My Profile"} subtitle="Manage Your DR-Healthcare Account">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* User Card Header */}
        <Card variant="elevated" style={styles.userHeaderCard}>
          <View style={styles.userHeaderRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarLetter}>
                {(firstName || username || "P").charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={styles.userInfoCol}>
              <Text style={styles.userNameText}>
                {firstName || "Patient"} {lastName}
              </Text>
              <Text style={styles.userHandleText}>@{username || "username"}</Text>

              <View style={styles.badgeRow}>
                <StatusBadge status="Confirmed" label={role || "Patient Account"} size="sm" />
              </View>
            </View>
          </View>

          <Button
            title={editing ? "Cancel Editing" : "Edit Profile"}
            variant={editing ? "secondary" : "outline"}
            icon={editing ? "close-outline" : "create-outline"}
            onPress={() => setEditing(!editing)}
            style={styles.editBtn}
          />
        </Card>

        {!editing && (
          <Card variant="bordered" style={styles.healthCardEntry} onPress={() => router.push("/health-card" as any)}>
            <View style={styles.healthCardEntryRow}>
              <IconContainer name="card-outline" size={24} color={colors.teal800} backgroundColor={colors.teal100} />
              <View style={styles.healthCardEntryMain}>
                <Text style={styles.healthCardEntryTitle}>Digital Health Card</Text>
                <Text style={styles.healthCardEntryText}>Manage your secure Emergency QR and temporary medical sharing.</Text>
              </View>
              <Ionicons name="chevron-forward" size={19} color={colors.teal800} />
            </View>
          </Card>
        )}

        {!editing && (
          <Card variant="bordered" style={styles.healthCardEntry} onPress={() => router.push("/vision-vault" as any)}>
            <View style={styles.healthCardEntryRow}>
              <IconContainer name="glasses-outline" size={24} color={colors.teal800} backgroundColor={colors.teal100} />
              <View style={styles.healthCardEntryMain}>
                <Text style={styles.healthCardEntryTitle}>Vision & Lens Vault</Text>
                <Text style={styles.healthCardEntryText}>Keep glasses, contact-lens prescriptions, attachments and expiry reminders together.</Text>
              </View>
              <Ionicons name="chevron-forward" size={19} color={colors.teal800} />
            </View>
          </Card>
        )}

        {/* Profile Information Form */}
        <Card style={styles.formCard}>
          <Text style={styles.sectionHeaderTitle}>Account Information</Text>

          <ProfileInputField
            label="First Name"
            icon="person-outline"
            value={firstName}
            editable={editing}
            onChangeText={setFirstName}
            placeholder="Enter first name"
          />

          <ProfileInputField
            label="Last Name"
            icon="person-outline"
            value={lastName}
            editable={editing}
            onChangeText={setLastName}
            placeholder="Enter last name"
          />

          <ProfileInputField
            label="Username"
            icon="at-outline"
            value={username}
            editable={editing}
            onChangeText={setUsername}
            placeholder="Enter username"
          />

          <ProfileInputField
            label="Email Address"
            icon="mail-outline"
            value={email}
            editable={editing}
            onChangeText={setEmail}
            placeholder="Enter email address"
            keyboardType="email-address"
          />

          <ProfileInputField
            label="Mobile Phone"
            icon="call-outline"
            value={mobile}
            editable={editing}
            onChangeText={setMobile}
            placeholder="Enter mobile number"
            keyboardType="phone-pad"
          />

          <ProfileInputField
            label="Blood Group"
            icon="water-outline"
            value={bloodGroup}
            editable={editing}
            onChangeText={setBloodGroup}
            placeholder="Example: B+"
          />

          <ProfileInputField
            label="Address"
            icon="location-outline"
            value={address}
            editable={editing}
            onChangeText={setAddress}
            placeholder="Enter home address"
          />

          <ProfileInputField
            label="Emergency Contact"
            icon="call-outline"
            value={emergencyContact}
            editable={editing}
            onChangeText={setEmergencyContact}
            placeholder="Emergency contact phone number"
            keyboardType="phone-pad"
          />

          <ProfileInputField
            label="Allergies"
            icon="alert-circle-outline"
            value={allergies}
            editable={editing}
            onChangeText={setAllergies}
            placeholder="Example: Penicillin, latex"
          />

          {/* Gender Selector */}
          <Text style={styles.fieldLabel}>Gender</Text>
          <View style={styles.genderGrid}>
            {["Male", "Female", "Prefer not to say", "Transgender"].map((option) => (
              <TouchableOpacity
                key={option}
                activeOpacity={0.8}
                disabled={!editing}
                style={[
                  styles.genderChip,
                  gender === option && styles.selectedGenderChip,
                  !editing && styles.disabledChip,
                ]}
                onPress={() => setGender(option)}
              >
                <Text
                  style={[
                    styles.genderText,
                    gender === option && styles.selectedGenderText,
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* DOB Selector */}
          <Text style={styles.fieldLabel}>Date of Birth</Text>
          {editing ? (
            <View style={styles.dobWrapper}>
              <DOBSelector day={day} month={month} year={year} setDay={setDay} setMonth={setMonth} setYear={setYear} />
            </View>
          ) : (
            <View style={styles.readOnlyBox}>
              <Ionicons name="calendar-outline" size={18} color={colors.teal800} />
              <Text style={styles.readOnlyText}>{dob || "Not provided"}</Text>
            </View>
          )}

          {/* Age */}
          <Text style={styles.fieldLabel}>Age</Text>
          <View style={styles.readOnlyBox}>
            <Ionicons name="hourglass-outline" size={18} color={colors.teal800} />
            <Text style={styles.readOnlyText}>
              {age ? `${age} Years` : "Calculated from DOB"}
            </Text>
          </View>

          {/* Save Button */}
          {editing && (
            <Button
              title="Save Profile Changes"
              icon="checkmark-circle-outline"
              onPress={handleSaveProfile}
              style={styles.saveBtn}
            />
          )}
        </Card>

        {/* Screening Consent Toggle */}
        {!editing && (
          <Card style={styles.consentCard}>
            <View style={styles.consentRow}>
              <View style={styles.consentTextGroup}>
                <Text style={styles.consentTitle}>Retinal Screening Consent</Text>
                <Text style={styles.consentSub}>
                  Allow this account to save retinal screening results for longitudinal care & analytics.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.switchToggle, screeningConsent && styles.switchToggleOn]}
                onPress={handleConsentToggle}
                disabled={consentSaving}
                accessibilityRole="switch"
                accessibilityState={{ checked: screeningConsent, disabled: consentSaving }}
              >
                <Text style={styles.switchText}>{consentSaving ? "..." : screeningConsent ? "ON" : "OFF"}</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Logout */}
        {!editing && (
          <LogoutButton />
        )}
      </ScrollView>
    </AppShell>
  );
}

function ProfileInputField({
  label,
  icon,
  value,
  editable,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  editable: boolean;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: any;
}) {
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputBox, !editable && styles.inputDisabled]}>
        <Ionicons name={icon} size={18} color={colors.teal800} style={styles.inputIcon} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          editable={editable}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType={keyboardType}
          style={styles.textInput}
        />
        {!editable && <Ionicons name="lock-closed-outline" size={15} color={colors.textMuted} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.pageBackground,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
    fontSize: typography.sizes.body,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl + 40,
  },
  userHeaderCard: {
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
  },
  userHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.teal800,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarLetter: {
    color: colors.white,
    fontSize: typography.sizes.h2,
    fontWeight: typography.weights.bold,
  },
  userInfoCol: {
    flex: 1,
  },
  userNameText: {
    fontSize: typography.sizes.h3,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  userHandleText: {
    fontSize: typography.sizes.small,
    color: colors.textMuted,
    marginTop: 2,
  },
  badgeRow: {
    marginTop: 6,
  },
  editBtn: {
    marginTop: spacing.xs,
  },
  healthCardEntry: {
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
  },
  healthCardEntryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  healthCardEntryMain: { flex: 1 },
  healthCardEntryTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
  },
  healthCardEntryText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    lineHeight: 17,
    marginTop: 3,
  },
  formCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.lg,
  },
  sectionHeaderTitle: {
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  fieldWrapper: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.teal800,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.pageBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  inputDisabled: {
    backgroundColor: colors.teal50,
    borderColor: colors.borderLight,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  textInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.sizes.body,
  },
  genderGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  genderChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.pageBackground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedGenderChip: {
    backgroundColor: colors.teal100,
    borderColor: colors.teal800,
  },
  disabledChip: {
    opacity: 0.7,
  },
  genderText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
  selectedGenderText: {
    color: colors.teal900,
    fontWeight: typography.weights.bold,
  },
  dobWrapper: {
    marginBottom: spacing.md,
  },
  readOnlyBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.teal50,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 48,
    marginBottom: spacing.md,
  },
  readOnlyText: {
    marginLeft: spacing.sm,
    fontSize: typography.sizes.body,
    color: colors.textPrimary,

  },
  saveBtn: {
    marginTop: spacing.md,
  },
  consentCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.lg,
  },
  consentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  consentTextGroup: {
    flex: 1,
    paddingRight: spacing.md,
  },
  consentTitle: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  consentSub: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  switchToggle: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.teal100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  switchToggleOn: {
    backgroundColor: colors.teal800,
  },
  switchText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  logoutBtn: {
    marginTop: spacing.sm,
  },
});
