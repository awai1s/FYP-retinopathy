import { Alert } from "../../services/alert";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

import AppShell from "../../design/components/AppShell";
import Card from "../../design/components/card";
import Button from "../../design/components/Button";
import IconContainer from "../../design/components/IconContainer";
import colors from "../../design/tokens/colors";
import radius from "../../design/tokens/radius";
import spacing from "../../design/tokens/spacing";
import typography from "../../design/tokens/typography";
import { useThemeRefresh } from "../../providers/AppThemeProvider";
import {
  createWatchlistEntry,
  getDoctorWatchlist,
  getWatchlistPatientState,
  removeWatchlistEntry,
  updateWatchlistEntry,
  type DoctorWatchlistEntry,
  type WatchlistPatientState,
  type WatchlistPriority,
} from "../../services/watchlist";

const dateAfterDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const prettyDate = (value?: string | null) => {
  if (!value) return "No review date";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const reviewLabel = (value?: string | null) => {
  if (!value) return "Review not scheduled";
  const target = new Date(`${value}T00:00:00`);
  if (Number.isNaN(target.getTime())) return prettyDate(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diff = Math.round((targetDay.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return `Overdue • ${prettyDate(value)}`;
  if (diff === 0) return "Review Today";
  if (diff === 1) return "Review Tomorrow";
  return prettyDate(value);
};

export default function DoctorWatchlistScreen() {
  useThemeRefresh();
  const params = useLocalSearchParams<{ patientId?: string }>();
  const patientId = typeof params.patientId === "string" ? params.patientId : "";
  const editorMode = Boolean(patientId);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<DoctorWatchlistEntry[]>([]);
  const [patientState, setPatientState] = useState<WatchlistPatientState | null>(null);
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState<WatchlistPriority>("normal");
  const [reviewDate, setReviewDate] = useState(dateAfterDays(7));
  const [error, setError] = useState("");

  const existing = patientState?.entry || null;

  const load = useCallback(async () => {
    try {
      setError("");
      if (editorMode) {
        const data = await getWatchlistPatientState(patientId);
        setPatientState(data);
        if (data.entry) {
          setReason(data.entry.reason || "");
          setPriority(data.entry.priority || "normal");
          setReviewDate(data.entry.reviewDate || dateAfterDays(7));
        }
      } else {
        const data = await getDoctorWatchlist();
        setItems(data.watchlist || []);
      }
    } catch (err: any) {
      setError(err?.message || "Unable to load the watchlist.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [editorMode, patientId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const validDate = useMemo(() => /^\d{4}-\d{2}-\d{2}$/.test(reviewDate.trim()), [reviewDate]);

  const save = async () => {
    const cleanedReason = reason.trim();
    if (cleanedReason.length < 3) {
      Alert.alert("Reason required", "Add a short clinical reason for keeping this case on your watchlist.");
      return;
    }
    if (!validDate) {
      Alert.alert("Review date required", "Use the review date format YYYY-MM-DD, for example 2026-09-28.");
      return;
    }
    if (!existing && !patientState?.accessAvailable) {
      Alert.alert("Connection required", "A new watchlist bookmark can only be created while the patient has an accepted care connection.");
      return;
    }

    try {
      setSaving(true);
      if (existing) {
        await updateWatchlistEntry(existing.id, { reason: cleanedReason, priority, reviewDate: reviewDate.trim() });
      } else {
        await createWatchlistEntry({ patientId, reason: cleanedReason, priority, reviewDate: reviewDate.trim() });
      }
      Alert.alert(existing ? "Watchlist updated" : "Added to watchlist", "This private case reminder is visible only to your doctor account.", [
        { text: "OK", onPress: () => router.replace("/doctor/watchlist" as any) },
      ]);
    } catch (err: any) {
      Alert.alert("Unable to save", err?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = (entry: DoctorWatchlistEntry, afterRemove?: () => void) => {
    Alert.alert(
      "Remove from watchlist?",
      `Remove ${entry.patientName || "this patient"} from your private watchlist? This does not change the care connection or medical history.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await removeWatchlistEntry(entry.id);
              afterRemove?.();
              if (!editorMode) await load();
            } catch (err: any) {
              Alert.alert("Unable to remove", err?.message || "Please try again.");
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <AppShell role="Doctor" title="Case Watchlist" showBack onBackPress={() => router.back()}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.teal800} />
          <Text style={styles.loadingText}>Loading private watchlist...</Text>
        </View>
      </AppShell>
    );
  }

  if (editorMode) {
    return (
      <AppShell role="Doctor" title={existing ? "Edit Watchlist Case" : "Add to Watchlist"} showBack onBackPress={() => router.back()}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {error ? <View style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text></View> : null}

          <Card variant="elevated" style={styles.patientCard}>
            <View style={styles.patientRow}>
              <IconContainer name="person-outline" size={26} color={colors.teal900} backgroundColor={colors.teal100} />
              <View style={styles.patientBody}>
                <Text style={styles.patientName}>{patientState?.patient.name || "Patient"}</Text>
                <Text style={styles.patientMeta}>{patientState?.patient.username ? `@${patientState.patient.username}` : "Connected patient"}</Text>
                {!patientState?.accessAvailable ? (
                  <View style={styles.accessWarning}>
                    <Ionicons name="lock-closed-outline" size={14} color={colors.warning} />
                    <Text style={styles.accessWarningText}>Current clinical access is revoked. The private bookmark remains, but it does not unlock the patient chart.</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Card>

          <Text style={styles.label}>Reason</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="High-risk progression..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
            style={[styles.input, styles.reasonInput]}
          />
          <Text style={styles.helper}>{reason.trim().length}/500 • This note is private to you.</Text>

          <Text style={styles.label}>Priority</Text>
          <View style={styles.priorityRow}>
            {(["normal", "important"] as WatchlistPriority[]).map((value) => {
              const selected = priority === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setPriority(value)}
                  style={[styles.priorityChoice, selected && styles.priorityChoiceSelected]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <Ionicons
                    name={selected ? "radio-button-on" : "radio-button-off"}
                    size={20}
                    color={selected ? colors.teal800 : colors.textMuted}
                  />
                  <Text style={[styles.priorityText, selected && styles.priorityTextSelected]}>
                    {value === "important" ? "Important" : "Normal"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Review Date</Text>
          <TextInput
            value={reviewDate}
            onChangeText={setReviewDate}
            placeholder="2026-09-28"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            style={styles.input}
          />
          <Text style={styles.helper}>Use YYYY-MM-DD. Current reminder: {validDate ? reviewLabel(reviewDate) : "Invalid date format"}.</Text>

          <View style={styles.formActions}>
            <Button
              title={existing ? "Save Changes" : "Save to Watchlist"}
              icon="bookmark-outline"
              loading={saving}
              onPress={() => void save()}
              disabled={saving || (!existing && !patientState?.accessAvailable)}
            />
            {existing ? (
              <Button
                title="Remove from Watchlist"
                variant="outline"
                icon="trash-outline"
                onPress={() => remove(existing, () => router.replace("/doctor/watchlist" as any))}
                disabled={saving}
              />
            ) : null}
          </View>
        </ScrollView>
      </AppShell>
    );
  }

  return (
    <AppShell role="Doctor" title="Case Watchlist" subtitle="Private reminders for cases you want to review again">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.teal800} />}
      >
        <View style={styles.headerGroup}>
          <Text style={styles.eyebrow}>PRIVATE CLINICAL WORKSPACE</Text>
          <Text style={styles.title}>My Watchlist</Text>
          <Text style={styles.subtitle}>Bookmarks help you return to important cases. They never replace patient consent or an accepted care connection.</Text>
        </View>

        {error ? <View style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text></View> : null}

        {items.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="bookmark-outline" size={30} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No bookmarked cases</Text>
            <Text style={styles.emptyText}>Open a connected patient and choose “Add to Watchlist” to create a private review reminder.</Text>
          </Card>
        ) : (
          items.map((item) => (
            <Card key={item.id} style={[styles.watchCard, item.priority === "important" && styles.importantCard]}>
              <View style={styles.watchHeader}>
                <View style={styles.patientBody}>
                  <Text style={styles.patientName}>{item.patientName}</Text>
                  {item.username ? <Text style={styles.patientMeta}>@{item.username}</Text> : null}
                </View>
                <View style={[styles.priorityPill, item.priority === "important" ? styles.importantPill : styles.normalPill]}>
                  <Ionicons name={item.priority === "important" ? "alert-circle" : "bookmark"} size={13} color={item.priority === "important" ? colors.warning : colors.teal800} />
                  <Text style={[styles.priorityPillText, item.priority === "important" && styles.importantPillText]}>{item.priority === "important" ? "IMPORTANT" : "NORMAL"}</Text>
                </View>
              </View>

              <Text style={styles.reasonText}>{item.reason}</Text>
              <View style={styles.reviewRow}>
                <Ionicons name="calendar-outline" size={16} color={colors.teal800} />
                <Text style={styles.reviewText}>{reviewLabel(item.reviewDate)}</Text>
              </View>

              {!item.accessAvailable ? (
                <View style={styles.accessWarning}>
                  <Ionicons name="lock-closed-outline" size={14} color={colors.warning} />
                  <Text style={styles.accessWarningText}>Patient access is currently unavailable. This bookmark does not override the revoked/non-active connection.</Text>
                </View>
              ) : null}

              <View style={styles.cardActions}>
                <Button
                  title={item.accessAvailable ? "Open Patient" : "Access Revoked"}
                  size="sm"
                  icon={item.accessAvailable ? "folder-open-outline" : "lock-closed-outline"}
                  onPress={() => router.push({ pathname: "/doctor/patient-profile", params: { patientId: item.patientId } } as any)}
                  disabled={!item.accessAvailable}
                />
                <Button
                  title="Edit"
                  size="sm"
                  variant="outline"
                  icon="create-outline"
                  onPress={() => router.push({ pathname: "/doctor/watchlist", params: { patientId: item.patientId } } as any)}
                />
                <Button title="Remove" size="sm" variant="ghost" icon="trash-outline" onPress={() => remove(item)} />
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl + 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  loadingText: { marginTop: spacing.md, color: colors.textSecondary, fontSize: typography.sizes.body },
  headerGroup: { marginBottom: spacing.lg },
  eyebrow: { color: colors.teal800, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, letterSpacing: 1.1, marginBottom: 3 },
  title: { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.bold },
  subtitle: { color: colors.textSecondary, fontSize: typography.sizes.body, marginTop: 4, lineHeight: 22 },
  patientCard: { backgroundColor: colors.surface, marginBottom: spacing.lg },
  patientRow: { flexDirection: "row", alignItems: "flex-start" },
  patientBody: { flex: 1, marginLeft: spacing.md, minWidth: 0 },
  patientName: { color: colors.textPrimary, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold },
  patientMeta: { color: colors.textMuted, fontSize: typography.sizes.xs, marginTop: 2 },
  label: { color: colors.textPrimary, fontSize: typography.sizes.small, fontWeight: typography.weights.bold, marginBottom: spacing.xs, marginTop: spacing.md },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, color: colors.textPrimary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: typography.sizes.body },
  reasonInput: { minHeight: 112, textAlignVertical: "top" },
  helper: { color: colors.textMuted, fontSize: typography.sizes.xs, marginTop: 5 },
  priorityRow: { flexDirection: "row", gap: spacing.sm },
  priorityChoice: { flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.xs, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: colors.surface },
  priorityChoiceSelected: { borderColor: colors.teal800, backgroundColor: colors.teal50 },
  priorityText: { color: colors.textSecondary, fontSize: typography.sizes.small, fontWeight: typography.weights.medium },
  priorityTextSelected: { color: colors.teal900, fontWeight: typography.weights.bold },
  formActions: { gap: spacing.sm, marginTop: spacing.xl },
  errorBanner: { backgroundColor: colors.errorBg, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  errorText: { color: colors.error, fontSize: typography.sizes.small },
  emptyCard: { alignItems: "center", backgroundColor: colors.surface, paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  emptyTitle: { color: colors.textPrimary, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold, marginTop: spacing.sm },
  emptyText: { color: colors.textSecondary, fontSize: typography.sizes.small, textAlign: "center", marginTop: 4, lineHeight: 19 },
  watchCard: { backgroundColor: colors.surface, marginBottom: spacing.sm },
  importantCard: { borderWidth: 1, borderColor: colors.warning },
  watchHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  priorityPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  normalPill: { backgroundColor: colors.teal50 },
  importantPill: { backgroundColor: colors.warningBg },
  priorityPillText: { color: colors.teal800, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold },
  importantPillText: { color: colors.warning },
  reasonText: { color: colors.textPrimary, fontSize: typography.sizes.body, marginTop: spacing.md, lineHeight: 21 },
  reviewRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm },
  reviewText: { color: colors.teal800, fontSize: typography.sizes.small, fontWeight: typography.weights.bold },
  accessWarning: { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: colors.warningBg, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.sm },
  accessWarningText: { flex: 1, color: colors.textSecondary, fontSize: typography.sizes.xs, lineHeight: 17 },
  cardActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.md, justifyContent: "flex-end" },
});
