import React, { useCallback, useState } from "react";
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { getPatientRetinalImages, getRetinalImageSource, RetinalImage } from "../../services/retinalImages";
import AppShell from "../../design/components/AppShell";
import Card from "../../design/components/card";
import IconContainer from "../../design/components/IconContainer";
import colors from "../../design/tokens/colors";
import spacing from "../../design/tokens/spacing";
import typography from "../../design/tokens/typography";
import radius from "../../design/tokens/radius";

import { useThemeRefresh } from "../../providers/AppThemeProvider";
export default function DoctorRetinalImagesScreen() {
  useThemeRefresh();
  const { patientId } = useLocalSearchParams<{ patientId?: string }>();
  const [images, setImages] = useState<RetinalImage[]>([]);
  const [sources, setSources] = useState<Record<string, { uri: string; headers?: Record<string, string> }>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!patientId) {
      setError("No patient was selected.");
      setLoading(false);
      return;
    }
    try {
      setError("");
      const next = await getPatientRetinalImages(patientId);
      setImages(next);
      const nextSources: Record<string, { uri: string; headers?: Record<string, string> }> = {};
      await Promise.all(
        next.map(async (item) => {
          nextSources[item.id] = await getRetinalImageSource(item.url);
        })
      );
      setSources(nextSources);
    } catch (err: any) {
      setError(err?.message || "Unable to load retinal images.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [patientId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <AppShell role="Doctor" title="Retinal Scans">
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={colors.teal800} size="large" />
          <Text style={styles.loadingText}>Loading authorized retinal scans...</Text>
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell role="Doctor" title="Patient Retinal Scans" showBack onBackPress={() => router.back()}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.teal800} />}
      >
        <View style={styles.headerGroup}>
          <Text style={styles.eyebrow}>IMAGING ARCHIVE</Text>
          <Text style={styles.title}>Retinal Scans & Funduscopy</Text>
          <Text style={styles.subtitle}>High-resolution clinical fundus images associated with patient record.</Text>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={20} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {!error && images.length === 0 ? (
          <Card style={styles.emptyCard}>
            <IconContainer name="eye-outline" size={32} color={colors.textMuted} backgroundColor={colors.teal50} />
            <Text style={styles.emptyTitle}>No Retinal Scans Available</Text>
            <Text style={styles.emptySub}>Uploaded fundus photographs will appear in this clinical viewer when uploaded by the patient or hospital.</Text>
          </Card>
        ) : null}

        {images.map((item) => (
          <Card key={item.id} style={styles.imageCard}>
            <View style={styles.cardHeaderRow}>
              <IconContainer name="image-outline" size={22} color={colors.teal800} backgroundColor={colors.teal100} />
              <View style={styles.headerTextGroup}>
                <Text style={styles.fileName}>{item.fileName}</Text>
                <Text style={styles.dateText}>{item.createdAt ? new Date(item.createdAt).toLocaleString() : "Date unavailable"}</Text>
              </View>
            </View>

            {sources[item.id] ? (
              <Image source={sources[item.id]} style={styles.image} resizeMode="contain" accessibilityLabel={`Retinal image ${item.fileName}`} />
            ) : (
              <View style={styles.unavailableBox}>
                <Text style={styles.unavailableText}>Image scan data unavailable.</Text>
              </View>
            )}
          </Card>
        ))}
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
  imageCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  headerTextGroup: {
    flex: 1,
    marginLeft: spacing.md,
  },
  fileName: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  dateText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  image: {
    width: "100%",
    height: 280,
    backgroundColor: colors.teal50,
    borderRadius: radius.md,
  },
  unavailableBox: {
    height: 120,
    backgroundColor: colors.teal50,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  unavailableText: {
    fontSize: typography.sizes.small,
    color: colors.textMuted,
  },
});
