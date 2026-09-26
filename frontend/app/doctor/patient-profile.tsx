import { Alert } from "../../services/alert";
import React, { useState, useEffect } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import { getPatientProfileInfo } from "../../services/common";
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
interface Patient {
  firstName: string;
  lastName: string;
  username: string;
  mobile: string;
  email: string;
  dob: string;
  gender: string;
}

export default function DoctorPatientProfileScreen() {
  useThemeRefresh();
  const { t } = useLanguage();
  const params = useLocalSearchParams();
  const patientId = params.patientId as string;

  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<Patient>({
    firstName: "",
    lastName: "",
    username: "",
    mobile: "",
    email: "",
    dob: "",
    gender: "",
  });

  useEffect(() => {
    if (patientId) {
      getPatientProfileInfo(patientId)
        .then((data: Patient) => {
          setPatient(data);
        })
        .catch((err: any) => {
          console.error("Failed to load patient profile:", err);
          const requiresConnection = String(err?.message || "").toLowerCase().includes("connection");

          Alert.alert(
            requiresConnection ? (t("connectionRequired") || "Connection Required") : (t("error") || "Error"),
            requiresConnection
              ? (t("acceptConnectionBeforeClinicalDetails") || "You must have an accepted care connection to view clinical details.")
              : (t("couldNotLoadPatientDetails") || "Could not load patient details."),
            requiresConnection
              ? [
                  {
                    text: t("manageConnections") || "Manage Connections",
                    onPress: () => router.push("/doctor/connections" as any),
                  },
                  { text: t("close") || "Close", style: "cancel" },
                ]
              : [{ text: t("close") || "Close", style: "cancel" }]
          );
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [patientId, t]);

  if (loading) {
    return (
      <AppShell role="Doctor" title="Patient Chart">
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.teal800} />
          <Text style={styles.loadingText}>{t("loadingPatientDetails") || "Loading Patient Record..."}</Text>
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell role="Doctor" title="Patient Clinical Profile" showBack onBackPress={() => router.back()}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header Profile Card */}
        <Card variant="elevated" style={styles.headerCard}>
          <View style={styles.headerRow}>
            <IconContainer name="person-outline" size={32} color={colors.teal900} backgroundColor={colors.teal100} />
            <View style={styles.headerMain}>
              <Text style={styles.patientName}>
                {patient.firstName || "Patient"} {patient.lastName}
              </Text>
              <Text style={styles.usernameText}>
                {patient.username ? `@${patient.username}` : "Username unavailable"}
              </Text>
              <View style={styles.badgeRow}>
                <StatusBadge status="Confirmed" label="Active Chart" size="sm" />
              </View>
            </View>
          </View>
        </Card>

        {/* Info Rows */}
        <Card style={styles.infoCard}>
          <Text style={styles.sectionHeaderTitle}>Demographics & Contact</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t("mobileNumber") || "Mobile Phone"}</Text>
            <Text style={styles.infoVal}>{patient.mobile || "Not provided"}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t("email") || "Email Address"}</Text>
            <Text style={styles.infoVal}>{patient.email || "Not provided"}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t("dateOfBirth") || "Date of Birth"}</Text>
            <Text style={styles.infoVal}>{patient.dob || "Not provided"}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t("gender") || "Gender"}</Text>
            <Text style={styles.infoVal}>{patient.gender || "Not provided"}</Text>
          </View>
        </Card>

        {/* Clinical Actions */}
        <Text style={styles.sectionHeaderTitle}>Clinician Actions</Text>

        <Button
          title="☆ Add to Watchlist"
          variant="outline"
          icon="bookmark-outline"
          onPress={() => router.push({ pathname: "/doctor/watchlist", params: { patientId } } as any)}
          style={styles.actionBtn}
        />

        <Button
          title={t("viewAiDoctorSummary") || "View AI Screening Summary"}
          icon="pulse"
          onPress={() => router.push({ pathname: "/doctor-summary", params: { patientId } } as any)}
          style={styles.actionBtn}
        />

        <Button
          title={t("viewRetinalImages") || "View Retinal Image Scans"}
          variant="outline"
          icon="images-outline"
          onPress={() => router.push({ pathname: "/doctor/retinal-images", params: { patientId } } as any)}
          style={styles.actionBtn}
        />

        <Button
          title={t("createPrescription") || "Issue New Prescription"}
          variant="outline"
          icon="document-text-outline"
          onPress={() => router.push({ pathname: "/doctor/prescription", params: { patientId } } as any)}
          style={styles.actionBtn}
        />
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  loadingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
    fontSize: typography.sizes.body,
  },
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
  badgeRow: {
    marginTop: 6,
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
