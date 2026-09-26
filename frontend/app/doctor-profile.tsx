import { Alert } from "../services/alert";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  getConnectionPerson,
  requestConnection,
  type ConnectionPerson,
} from "../services/connections";
import AppShell from "../design/components/AppShell";
import Card from "../design/components/card";
import IconContainer from "../design/components/IconContainer";
import Button from "../design/components/Button";
import colors from "../design/tokens/colors";
import spacing from "../design/tokens/spacing";
import typography from "../design/tokens/typography";
import radius from "../design/tokens/radius";
import { useThemeRefresh } from "../providers/AppThemeProvider";

export default function DoctorProfileScreen() {
  useThemeRefresh();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const doctorId = Array.isArray(id) ? id[0] : id;

  const [profile, setProfile] = useState<ConnectionPerson | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    if (!doctorId) {
      setError("Doctor ID is missing.");
      setLoading(false);
      return;
    }
    try {
      setError("");
      const data = await getConnectionPerson(String(doctorId));
      setProfile(data);
    } catch (err: any) {
      setError(err?.message || "Could not load doctor profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [doctorId]);

  const connect = async () => {
    if (!profile) return;
    try {
      setRequesting(true);
      await requestConnection(profile.id);
      await load();
      Alert.alert("Care request sent", "The doctor has been notified. Clinical access starts only after the request is accepted.");
    } catch (err: any) {
      Alert.alert("Unable to connect", err?.message || "Please try again.");
    } finally {
      setRequesting(false);
    }
  };

  if (loading) {
    return (
      <AppShell role="Patient" title="Doctor Profile">
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.teal800} />
          <Text style={styles.loadingText}>Loading verified profile...</Text>
        </View>
      </AppShell>
    );
  }

  const status = profile?.connectionStatus;
  const isConnected = status === "accepted";
  const isPending = status === "pending";

  return (
    <AppShell role="Patient" title="Doctor Profile" showBack onBackPress={() => router.back()}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={20} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {profile ? (
          <>
            <Card style={styles.profileHeaderCard}>
              <IconContainer name="person" size={42} color={colors.teal900} backgroundColor={colors.teal100} />
              <View style={styles.nameRow}>
                <Text style={styles.doctorName}>{profile.name || "Doctor"}</Text>
                {profile.verified ? (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.specialization}>{profile.specialization || "Ophthalmologist"}</Text>
              {profile.hospital ? <Text style={styles.hospitalText}>{profile.hospital}</Text> : null}

              <View style={styles.actionsRow}>
                {isConnected ? (
                  <>
                    <Button title="Connected" size="sm" icon="checkmark-circle-outline" disabled onPress={() => {}} />
                    <Button title="Book Appointment" size="sm" icon="calendar-outline" onPress={() => router.push({ pathname: "/book-appointment", params: { doctorId: profile.id } } as any)} />
                  </>
                ) : (
                  <Button
                    title={isPending ? "Request Pending" : requesting ? "Sending..." : "Connect with Doctor"}
                    size="sm"
                    icon={isPending ? "time-outline" : "person-add-outline"}
                    onPress={() => void connect()}
                    disabled={isPending || requesting || status === "blocked"}
                    loading={requesting}
                  />
                )}
              </View>
              {status === "blocked" ? <Text style={styles.blockedText}>This care relationship is currently blocked.</Text> : null}
            </Card>

            <Text style={styles.sectionTitle}>Professional Information</Text>
            <Card style={styles.infoCard}>
              <InfoRow icon="medical-outline" label="Specialization" value={profile.specialization || "General Ophthalmology"} />
              <View style={styles.divider} />
              <InfoRow icon="business-outline" label="Hospital / Clinic" value={profile.hospital || "Not specified"} />
              <View style={styles.divider} />
              <InfoRow icon="star-outline" label="Experience" value={profile.experience || "Not specified"} />
              <View style={styles.divider} />
              <InfoRow icon="school-outline" label="Qualification" value={profile.qualification || "Not specified"} />
              <View style={styles.divider} />
              <InfoRow icon="shield-checkmark-outline" label="Provider Status" value={profile.verified ? "Verified EyeCare AI provider" : "Not verified"} />
            </Card>

            <Card style={styles.noticeCard}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.teal800} />
              <Text style={styles.noticeText}>
                Connecting does not expose your data immediately. Ongoing clinical access becomes active only after the care request is accepted.
              </Text>
            </Card>
          </>
        ) : null}
      </ScrollView>
    </AppShell>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.iconBox}><Ionicons name={icon} size={20} color={colors.teal800} /></View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl + 40 },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  loadingText: { marginTop: spacing.md, color: colors.textSecondary, fontSize: typography.sizes.body },
  errorCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.errorBg, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md, gap: spacing.xs },
  errorText: { color: colors.error, fontSize: typography.sizes.small, flex: 1 },
  profileHeaderCard: { backgroundColor: colors.surface, alignItems: "center", paddingVertical: spacing.xl, marginBottom: spacing.lg },
  nameRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.md },
  doctorName: { fontSize: typography.sizes.h2, fontWeight: typography.weights.bold, color: colors.textPrimary },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.successBg },
  verifiedText: { color: colors.success, fontSize: typography.sizes.xs, fontWeight: typography.weights.bold },
  specialization: { fontSize: typography.sizes.body, color: colors.teal800, fontWeight: typography.weights.medium, marginTop: 4 },
  hospitalText: { fontSize: typography.sizes.small, color: colors.textSecondary, marginTop: 3 },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg, justifyContent: "center" },
  blockedText: { color: colors.error, fontSize: typography.sizes.small, marginTop: spacing.sm },
  sectionTitle: { fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold, color: colors.textPrimary, marginBottom: spacing.sm },
  infoCard: { backgroundColor: colors.surface },
  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm },
  iconBox: { width: 40, alignItems: "center" },
  infoContent: { flex: 1, paddingLeft: spacing.sm },
  infoLabel: { fontSize: typography.sizes.xs, color: colors.textMuted, fontWeight: typography.weights.bold, letterSpacing: 0.5, marginBottom: 2 },
  infoValue: { fontSize: typography.sizes.body, color: colors.textPrimary, fontWeight: typography.weights.medium },
  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: spacing.sm },
  noticeCard: { marginTop: spacing.lg, backgroundColor: colors.teal50, flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  noticeText: { flex: 1, color: colors.textSecondary, fontSize: typography.sizes.small, lineHeight: 20 },
});
