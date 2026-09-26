import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import AppShell from "../../design/components/AppShell";
import Card from "../../design/components/card";
import Button from "../../design/components/Button";
import { getProfile } from "../../services/auth";
import { useLanguage } from "../../services/i18n";
import colors from "../../design/tokens/colors";
import spacing from "../../design/tokens/spacing";
import typography from "../../design/tokens/typography";

import { useThemeRefresh } from "../../providers/AppThemeProvider";
export default function DoctorProfile() {
  useThemeRefresh();
  const { t } = useLanguage();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getProfile()
      .then(setProfile)
      .catch((err: any) => setError(err?.message || t("unableToLoad")))
      .finally(() => setLoading(false));
  }, [t]);

  return (
    <AppShell role="Doctor" title={t("doctorProfile") || "Doctor Profile"}>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.teal800} /></View>
      ) : error ? (
        <Card style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></Card>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <Card style={styles.headerCard}>
            <View style={styles.avatar}><Ionicons name="person" size={38} color={colors.teal900} /></View>
            <Text style={styles.name}>{profile?.name || "Doctor"}</Text>
            <Text style={styles.role}>{profile?.specialization || t("specialization")}</Text>
          </Card>

          <Text style={styles.sectionTitle}>{t("professionalInformation") || "Professional Information"}</Text>
          <Card style={styles.infoCard}>
            <InfoRow icon="medical-outline" label={t("specialization")} value={profile?.specialization} />
            <InfoRow icon="business-outline" label={t("hospitalClinic")} value={profile?.hospital} />
            <InfoRow icon="card-outline" label={t("pmdcNumber")} value={profile?.pmdc_number || profile?.pmdcNumber} />
          </Card>

          <Button title="Edit Profile" icon="create-outline" variant="outline" onPress={() => router.push("/doctor/profile/edit" as any)} style={styles.editButton} />
          <Button title={t("dashboard")} icon="grid-outline" onPress={() => router.replace("/doctor/dashboard" as any)} style={styles.dashboardButton} />
        </ScrollView>
      )}
    </AppShell>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={22} color={colors.teal800} />
      <View style={styles.infoText}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value || "—"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl + 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  errorCard: { backgroundColor: colors.errorBg },
  errorText: { color: colors.error, fontSize: typography.sizes.body },
  headerCard: { alignItems: "center", paddingVertical: spacing.xl, marginBottom: spacing.xl, backgroundColor: colors.surface },
  avatar: { width: 78, height: 78, borderRadius: 39, alignItems: "center", justifyContent: "center", backgroundColor: colors.teal100, marginBottom: spacing.md },
  name: { color: colors.textPrimary, fontSize: typography.sizes.h2, fontWeight: typography.weights.bold },
  role: { color: colors.teal800, fontSize: typography.sizes.body, marginTop: 4 },
  sectionTitle: { color: colors.textPrimary, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold, marginBottom: spacing.sm },
  infoCard: { backgroundColor: colors.surface, marginBottom: spacing.xl },
  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  infoText: { marginLeft: spacing.md, flex: 1 },
  label: { color: colors.textMuted, fontSize: typography.sizes.xs, fontWeight: typography.weights.bold },
  value: { color: colors.textPrimary, fontSize: typography.sizes.body, marginTop: 3 },
  editButton: { alignSelf: "stretch", marginBottom: spacing.sm },
  dashboardButton: { alignSelf: "stretch" },
});