import React, { useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { getPatientProfileInfo, PatientProfile } from "../../services/common";
import { useLanguage } from "../../services/i18n";

import AppShell from "../../design/components/AppShell";
import Card from "../../design/components/card";
import IconContainer from "../../design/components/IconContainer";
import StatusBadge from "../../design/components/StatusBadge";
import Button from "../../design/components/Button";
import colors from "../../design/tokens/colors";
import spacing from "../../design/tokens/spacing";
import typography from "../../design/tokens/typography";

import { useThemeRefresh } from "../../providers/AppThemeProvider";
export default function HospitalPatientProfileScreen() {
  useThemeRefresh();
  const { t } = useLanguage();
  const { patientId } = useLocalSearchParams<{ patientId?: string }>();

  const [patient, setPatient] = useState<PatientProfile>({
    firstName: "",
    lastName: "",
    username: "",
    mobile: "",
    email: "",
    dob: "",
    gender: "",
  });

  useEffect(() => {
    if (!patientId) return;

    getPatientProfileInfo(String(patientId))
      .then(setPatient)
      .catch((error) => {
        console.error("Failed to load hospital patient profile:", error);
      });
  }, [patientId]);

  return (
    <AppShell role="Hospital" title="Patient Chart" showBack onBackPress={() => router.back()}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <Card variant="elevated" style={styles.headerCard}>
          <View style={styles.headerRow}>
            <IconContainer name="person-outline" size={30} color={colors.teal900} backgroundColor={colors.teal100} />
            <View style={styles.headerMain}>
              <Text style={styles.patientName}>
                {patient.firstName || t("patient") || "Patient"} {patient.lastName}
              </Text>
              <Text style={styles.usernameText}>
                {patient.username ? `@${patient.username}` : (t("username") || "Username")}
              </Text>
            </View>
            <StatusBadge status="Active" size="sm" />
          </View>
        </Card>

        {/* Patient Details */}
        <Card style={styles.infoCard}>
          <Text style={styles.sectionHeaderTitle}>Demographic Record</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t("mobileNumber") || "Mobile Phone"}</Text>
            <Text style={styles.infoVal}>{patient.mobile || "--"}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t("email") || "Email"}</Text>
            <Text style={styles.infoVal}>{patient.email || "--"}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t("dateOfBirth") || "Date of Birth"}</Text>
            <Text style={styles.infoVal}>{patient.dob || "--"}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t("gender") || "Gender"}</Text>
            <Text style={styles.infoVal}>{patient.gender || "--"}</Text>
          </View>
        </Card>

        {/* Hospital Actions */}
        <Text style={styles.sectionHeaderTitle}>Hospital Operations</Text>

        <Button
          title={t("uploadClinicalReport") || "Upload Clinical / Fundus Report"}
          icon="cloud-upload-outline"
          onPress={() => router.push({ pathname: "/hospital/upload-report", params: { patientId: String(patientId || "") } })}
          style={styles.actionBtn}
        />

        <Button
          title={t("viewRetinalImages") || "View Retinal Image Archive"}
          variant="outline"
          icon="images-outline"
          onPress={() => router.push({ pathname: "/doctor/retinal-images", params: { patientId: String(patientId || "") } } as any)}
          style={styles.actionBtn}
        />

        <Button
          title={t("viewReports") || "View Patient Hospital Reports"}
          variant="outline"
          icon="document-text-outline"
          onPress={() => router.push("/hospital/reports")}
          style={styles.actionBtn}
        />
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.xxxl + 40,
  },
  headerCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerMain: {
    flex: 1,
    marginLeft: spacing.md,
    paddingRight: spacing.xs,
  },
  patientName: {
    fontSize: typography.sizes.h2,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  usernameText: {
    fontSize: typography.sizes.small,
    color: colors.textMuted,
    marginTop: 2,
  },
  infoCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.lg,
  },
  sectionHeaderTitle: {
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  infoLabel: {
    fontSize: typography.sizes.small,
    color: colors.textMuted,
  },
  infoVal: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.xs,
  },
  actionBtn: {
    marginBottom: spacing.sm,
  },
});
