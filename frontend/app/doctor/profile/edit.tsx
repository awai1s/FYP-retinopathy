import { Alert } from "../../../services/alert";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import AppShell from "../../../design/components/AppShell";
import Card from "../../../design/components/card";
import Button from "../../../design/components/Button";
import colors from "../../../design/tokens/colors";
import spacing from "../../../design/tokens/spacing";
import typography from "../../../design/tokens/typography";
import { getProfile, updateProfile } from "../../../services/auth";
import { useLanguage } from "../../../services/i18n";

import { useThemeRefresh } from "../../../providers/AppThemeProvider";
export default function EditDoctorProfileScreen() {
  useThemeRefresh();
  const { t } = useLanguage();
  const [profile, setProfile] = useState({ name: "", specialization: "", hospital: "", pmdc_number: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getProfile().then((data) => setProfile({ name: data.name || "", specialization: data.specialization || "", hospital: data.hospital || "", pmdc_number: data.pmdc_number || data.pmdcNumber || "" })).catch((err: any) => setError(err?.message || "Unable to load profile.")).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!profile.name.trim() || !profile.specialization.trim() || !profile.hospital.trim() || !profile.pmdc_number.trim()) {
      setError("Please complete all professional profile fields.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      await updateProfile({ name: profile.name.trim(), specialization: profile.specialization.trim(), hospital: profile.hospital.trim(), pmdc_number: profile.pmdc_number.trim() });
      Alert.alert(t("success") || "Success", "Profile updated successfully.", [{ text: "OK", onPress: () => router.back() }]);
    } catch (err: any) {
      setError(err?.message || "Unable to update profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AppShell role="Doctor" title="Edit Profile"><View style={styles.center}><ActivityIndicator color={colors.teal800} size="large" /></View></AppShell>;

  return (
    <AppShell role="Doctor" title="Edit Profile" showBack onBackPress={() => router.back()}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}><Text style={styles.eyebrow}>ACCOUNT SETTINGS</Text><Text style={styles.title}>Edit Profile</Text><Text style={styles.subtitle}>Keep your professional information current for connected patients.</Text></View>
        {error ? <Card style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></Card> : null}
        <Card style={styles.card}>
          <Field label="Full name" value={profile.name} onChangeText={(value) => setProfile((current) => ({ ...current, name: value }))} />
          <Field label={t("specialization") || "Specialization"} value={profile.specialization} onChangeText={(value) => setProfile((current) => ({ ...current, specialization: value }))} />
          <Field label={t("hospitalClinic") || "Hospital / Clinic"} value={profile.hospital} onChangeText={(value) => setProfile((current) => ({ ...current, hospital: value }))} />
          <Field label={t("pmdcNumber") || "PMDC Number"} value={profile.pmdc_number} onChangeText={(value) => setProfile((current) => ({ ...current, pmdc_number: value }))} />
          <Button title={saving ? "Saving…" : "Save Changes"} icon="checkmark-circle-outline" onPress={save} loading={saving} disabled={saving} style={styles.save} />
        </Card>
      </ScrollView>
    </AppShell>
  );
}

function Field({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={label} placeholderTextColor={colors.textMuted} style={styles.input} /></View>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl + 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { marginBottom: spacing.lg },
  eyebrow: { color: colors.teal800, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, letterSpacing: 1.2 },
  title: { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.bold, marginTop: 2 },
  subtitle: { color: colors.textSecondary, fontSize: typography.sizes.body, marginTop: 4 },
  card: { backgroundColor: colors.surface },
  errorCard: { backgroundColor: colors.errorBg, marginBottom: spacing.md },
  errorText: { color: colors.error, fontSize: typography.sizes.small },
  field: { marginBottom: spacing.md },
  label: { color: colors.textMuted, fontSize: typography.sizes.xs, fontWeight: typography.weights.bold, marginBottom: spacing.xs },
  input: { minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surfaceElevated, color: colors.textPrimary, paddingHorizontal: spacing.md, fontSize: typography.sizes.body },
  save: { marginTop: spacing.sm },
});