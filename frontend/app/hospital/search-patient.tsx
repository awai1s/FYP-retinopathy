import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { PatientSearchResult, searchPatients } from "../../services/common";
import { useLanguage } from "../../services/i18n";

import AppShell from "../../design/components/AppShell";
import Card from "../../design/components/card";
import IconContainer from "../../design/components/IconContainer";
import Button from "../../design/components/Button";
import colors from "../../design/tokens/colors";
import spacing from "../../design/tokens/spacing";
import typography from "../../design/tokens/typography";
import radius from "../../design/tokens/radius";

import { useThemeRefresh } from "../../providers/AppThemeProvider";
export default function HospitalSearchPatientScreen() {
  useThemeRefresh();
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<PatientSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    const query = search.trim();
    if (!query) {
      setResults([]);
      setError(t("enterUsernameOrMobile") || "Please enter username or mobile number.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setResults(await searchPatients(query));
    } catch (searchError: any) {
      console.error("Hospital patient search failed:", searchError);
      setResults([]);
      setError(searchError?.message || t("failedToSearchPatients") || "Failed to search patient directory.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell role="Hospital" title={t("searchPatient") || "Search Patient"} showBack onBackPress={() => router.back()}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.headerGroup}>
          <Text style={styles.eyebrow}>HOSPITAL REGISTRY</Text>
          <Text style={styles.title}>{t("searchPatient") || "Patient Record Lookup"}</Text>
          <Text style={styles.subtitle}>
            {t("searchPatientSubtitle") || "Locate patient profiles to upload laboratory, fundus, or clinical reports."}
          </Text>
        </View>

        {/* Search Input Box */}
        <Card style={styles.searchCard}>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder={t("searchPatientPlaceholder") || "Enter patient username, phone, or email..."}
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              onSubmitEditing={handleSearch}
            />
            <Button
              title={loading ? "" : (t("searchPatient") || "Search")}
              icon="search"
              onPress={handleSearch}
              loading={loading}
              style={styles.searchBtn}
            />
          </View>
        </Card>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={20} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Results */}
        {results.length > 0 ? (
          <View style={styles.resultsList}>
            <Text style={styles.resultsHeaderTitle}>Matching Records ({results.length})</Text>
            {results.map((patient) => (
              <Card
                key={patient.id}
                style={styles.patientCard}
                onPress={() =>
                  router.push({
                    pathname: "/hospital/patient-profile",
                    params: { patientId: patient.id },
                  })
                }
              >
                <View style={styles.patientRow}>
                  <IconContainer name="person-outline" size={24} color={colors.teal800} backgroundColor={colors.teal100} />
                  <View style={styles.patientMain}>
                    <Text style={styles.patientName}>
                      {[patient.firstName, patient.lastName].filter(Boolean).join(" ") || patient.username}
                    </Text>
                    <Text style={styles.patientMeta}>{patient.username} · {patient.mobile || patient.email}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </View>
              </Card>
            ))}
          </View>
        ) : (
          <Card style={styles.emptyCard}>
            <IconContainer name="people-outline" size={32} color={colors.textMuted} backgroundColor={colors.teal50} />
            <Text style={styles.emptyTitle}>{t("noPatientSelected") || "Hospital Patient Registry"}</Text>
            <Text style={styles.emptySub}>{t("searchPatientToViewProfileAndReports") || "Search by username or mobile to locate patient record."}</Text>
          </Card>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.xxxl + 40,
  },
  headerGroup: {
    marginBottom: spacing.lg,
  },
  eyebrow: {
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
    color: colors.teal800,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  title: {
    fontSize: typography.sizes.h1,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    marginTop: 4,
  },
  searchCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.lg,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.sizes.body,
    paddingVertical: spacing.xs,
  },
  searchBtn: {
    minHeight: 44,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.errorBg,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.sizes.small,
  },
  resultsHeaderTitle: {
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  resultsList: {
    gap: spacing.sm,
  },
  patientCard: {
    backgroundColor: colors.surface,
  },
  patientRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  patientMain: {
    flex: 1,
    marginLeft: spacing.md,
  },
  patientName: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  patientMeta: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  emptyCard: {
    padding: spacing.xxl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  emptyTitle: {
    fontSize: typography.sizes.h3,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  emptySub: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
  },
});