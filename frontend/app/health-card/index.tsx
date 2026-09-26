import { Alert } from "../../services/alert";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";

import AppShell from "../../design/components/AppShell";
import Card from "../../design/components/card";
import Button from "../../design/components/Button";
import IconContainer from "../../design/components/IconContainer";
import StatusBadge from "../../design/components/StatusBadge";
import SecureQrView from "../../components/SecureQrView";
import colors from "../../design/tokens/colors";
import spacing from "../../design/tokens/spacing";
import typography from "../../design/tokens/typography";
import radius from "../../design/tokens/radius";
import { useThemeRefresh } from "../../providers/AppThemeProvider";
import { useNetwork } from "../../providers/NetworkProvider";
import {
  createTemporaryQr,
  getEmergencyQr,
  getHealthCard,
  HealthCardData,
  HealthCardFields,
  listQrShares,
  QrShare,
  revokeQrShare,
  updateHealthCardSettings,
} from "../../services/privacy";

const FIELD_OPTIONS: { key: keyof HealthCardFields; label: string; description: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "basicIdentity", label: "Basic identity", description: "Name and EyeCare ID", icon: "person-outline" },
  { key: "emergencyContact", label: "Emergency contact", description: "Your dedicated emergency contact", icon: "call-outline" },
  { key: "bloodGroup", label: "Blood group", description: "Blood group saved in your profile", icon: "water-outline" },
  { key: "allergies", label: "Allergies", description: "Allergy information saved in your profile", icon: "alert-circle-outline" },
  { key: "activeMedication", label: "Active medication", description: "Current active medication only", icon: "medkit-outline" },
  { key: "latestDrResult", label: "Latest DR result", description: "Latest stage, date and confidence", icon: "eye-outline" },
  { key: "latestHba1c", label: "Latest HbA1c", description: "Most recent saved HbA1c value", icon: "pulse-outline" },
];

const TEMP_SCOPE_OPTIONS = [
  {
    key: "profile",
    scopes: ["profile.basic", "profile.emergency_contact", "profile.blood_group", "profile.allergies"],
    label: "Profile",
    icon: "person-outline" as const,
  },
  { key: "screening", scopes: ["screening.latest"], label: "Latest Screening", icon: "eye-outline" as const },
  { key: "medication", scopes: ["medications.active"], label: "Current Medication", icon: "medkit-outline" as const },
  { key: "reports", scopes: ["reports.recent"], label: "Recent Reports", icon: "document-text-outline" as const },
  { key: "hba1c", scopes: ["health_metrics.latest"], label: "Latest HbA1c", icon: "pulse-outline" as const },
];

const DURATION_OPTIONS: { value: 15 | 60 | 1440; label: string }[] = [
  { value: 15, label: "15 min" },
  { value: 60, label: "1 hour" },
  { value: 1440, label: "24 hours" },
];

export default function HealthCardScreen() {
  useThemeRefresh();
  const { isOnline } = useNetwork();
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [card, setCard] = useState<HealthCardData | null>(null);
  const [settings, setSettings] = useState<HealthCardFields | null>(null);
  const [shares, setShares] = useState<QrShare[]>([]);
  const [emergencyQr, setEmergencyQr] = useState<{ share: QrShare; qrSvg: string } | null>(null);
  const [temporaryQr, setTemporaryQr] = useState<{ share: QrShare; qrSvg: string } | null>(null);
  const [tempScopes, setTempScopes] = useState<string[]>([
    "profile.basic",
    "profile.emergency_contact",
    "profile.blood_group",
    "profile.allergies",
    "screening.latest",
  ]);
  const [duration, setDuration] = useState<15 | 60 | 1440>(60);
  const [creatingTemp, setCreatingTemp] = useState(false);
  const [creatingEmergency, setCreatingEmergency] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const cardResult = await getHealthCard();
      setCard(cardResult.card);
      setSettings(cardResult.settings);
      if (isOnline) {
        try {
          const shareResult = await listQrShares();
          setShares(shareResult.shares || []);
        } catch {
          setShares([]);
        }
      } else {
        setShares([]);
      }
    } catch (error: any) {
      Alert.alert("Health Card unavailable", error?.message || "Unable to load your Digital Health Card.");
    } finally {
      setLoading(false);
    }
  }, [isOnline]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const activeShares = useMemo(() => shares.filter((item) => item.status === "active"), [shares]);

  const requireOnline = (message: string) => {
    if (isOnline) return true;
    Alert.alert("Internet required", message);
    return false;
  };

  const toggleField = async (key: keyof HealthCardFields) => {
    if (!requireOnline("Health Card sharing settings are server-controlled and cannot be changed offline.")) return;
    if (!settings || savingSettings) return;
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    setSavingSettings(true);
    try {
      const result = await updateHealthCardSettings({ [key]: next[key] });
      setSettings(result.settings);
      // Changing emergency disclosure settings rotates the emergency token.
      setEmergencyQr(null);
      const shareResult = await listQrShares();
      setShares(shareResult.shares || []);
    } catch (error: any) {
      setSettings(settings);
      Alert.alert("Unable to update", error?.message || "Could not update Health Card privacy settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  const showEmergency = async (rotate = false) => {
    if (!requireOnline("Your cached emergency information is available on this phone, but creating or opening a secure QR share requires the EyeCare AI backend.")) return;
    try {
      setCreatingEmergency(true);
      const result = await getEmergencyQr(rotate);
      setEmergencyQr(result);
      const shareResult = await listQrShares();
      setShares(shareResult.shares || []);
    } catch (error: any) {
      Alert.alert("QR unavailable", error?.message || "Unable to create the Emergency QR.");
    } finally {
      setCreatingEmergency(false);
    }
  };

  const rotateEmergency = () => {
    Alert.alert(
      "Replace Emergency QR?",
      "The current Emergency QR will stop working immediately and a new one will be created.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Replace QR", style: "destructive", onPress: () => void showEmergency(true) },
      ]
    );
  };

  const toggleTempScopeGroup = (scopes: string[]) => {
    setTempScopes((current) => {
      const selected = scopes.every((scope) => current.includes(scope));
      if (selected) return current.filter((scope) => !scopes.includes(scope));
      return Array.from(new Set([...current, ...scopes]));
    });
  };

  const createTemporary = async () => {
    if (!requireOnline("Temporary medical QR shares require the EyeCare AI backend so expiry, scopes and revocation can be enforced.")) return;
    if (!tempScopes.length) {
      Alert.alert("Choose information", "Select at least one category to share.");
      return;
    }
    try {
      setCreatingTemp(true);
      const result = await createTemporaryQr({ scopes: tempScopes, durationMinutes: duration });
      setTemporaryQr(result);
      const shareResult = await listQrShares();
      setShares(shareResult.shares || []);
    } catch (error: any) {
      Alert.alert("Temporary QR unavailable", error?.message || "Unable to create this temporary share.");
    } finally {
      setCreatingTemp(false);
    }
  };

  const revoke = (share: QrShare) => {
    if (!requireOnline("QR revocation must reach the EyeCare AI backend.")) return;
    Alert.alert(
      "Revoke QR share?",
      "Anyone using this QR/link will immediately lose access. The historical share record will remain in Privacy & Access.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke",
          style: "destructive",
          onPress: async () => {
            try {
              await revokeQrShare(share.id);
              if (emergencyQr?.share.id === share.id) setEmergencyQr(null);
              if (temporaryQr?.share.id === share.id) setTemporaryQr(null);
              const result = await listQrShares();
              setShares(result.shares || []);
            } catch (error: any) {
              Alert.alert("Unable to revoke", error?.message || "Could not revoke this QR share.");
            }
          },
        },
      ]
    );
  };

  if (loading || !card || !settings) {
    return (
      <AppShell role="Patient" title="Digital Health Card" showBack onBackPress={() => router.back()} showAssistant={false}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.teal800} />
          <Text style={styles.loadingText}>Preparing your secure Health Card...</Text>
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell role="Patient" title="Digital Health Card" subtitle="Patient-controlled emergency and temporary sharing" showBack onBackPress={() => router.back()} showAssistant={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <LinearGradient colors={["#06343A", "#07505A", "#087A73"]} style={styles.healthCard}>
          <View style={styles.brandRow}>
            <View>
              <Text style={styles.brand}>EYECARE AI</Text>
              <Text style={styles.cardType}>DIGITAL HEALTH CARD</Text>
            </View>
            <Ionicons name="shield-checkmark" size={28} color={colors.teal200} />
          </View>
          <View style={styles.identityRow}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{card.avatarInitial || "P"}</Text></View>
            <View style={styles.identityMain}>
              <Text style={styles.cardName}>{card.name || "Patient"}</Text>
              <Text style={styles.cardMeta}>EyeCare ID: {card.eyeCareId}</Text>
              <Text style={styles.cardMeta}>Blood Group: {card.bloodGroup || "Not provided"}</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={creatingEmergency}
              onPress={() => void showEmergency(false)}
              style={styles.cardQrButton}
              accessibilityRole="button"
              accessibilityLabel="Show secure Emergency Health Card QR"
            >
              {creatingEmergency ? <ActivityIndicator size="small" color={colors.navyInk} /> : <Ionicons name="qr-code" size={24} color={colors.navyInk} />}
              <Text style={styles.cardQrText}>QR</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.emergencyLine}>
            <Ionicons name="call-outline" size={17} color={colors.teal200} />
            <View>
              <Text style={styles.emergencyLabel}>EMERGENCY CONTACT</Text>
              <Text style={styles.emergencyValue}>{card.emergencyContact || "Not provided"}</Text>
            </View>
          </View>
        </LinearGradient>

        {!isOnline ? (
          <Card variant="accent" style={styles.offlineNotice}>
            <Ionicons name="cloud-offline-outline" size={21} color={colors.warning} />
            <View style={styles.noticeMain}>
              <Text style={styles.noticeTitle}>Emergency information available offline</Text>
              <Text style={styles.noticeText}>This card is the last synchronized copy stored on your device. Secure QR creation, settings changes and revocation require the backend.</Text>
            </View>
          </Card>
        ) : null}

        <Card style={styles.securityNotice}>
          <IconContainer name="lock-closed-outline" size={22} color={colors.teal800} backgroundColor={colors.teal100} />
          <View style={styles.noticeMain}>
            <Text style={styles.noticeTitle}>Your medical details are not stored inside the QR</Text>
            <Text style={styles.noticeText}>The QR contains only an opaque secure share link. EyeCare AI validates the token, expiry, revocation state and allowed fields before returning any information.</Text>
          </View>
        </Card>

        <Text style={styles.sectionTitle}>Emergency QR privacy</Text>
        <Text style={styles.sectionSub}>Choose exactly what your longer-lived Emergency QR is allowed to reveal.</Text>
        <Card style={styles.settingsCard}>
          {FIELD_OPTIONS.map((item, index) => (
            <TouchableOpacity key={item.key} activeOpacity={0.8} disabled={savingSettings} onPress={() => void toggleField(item.key)} style={[styles.settingRow, index < FIELD_OPTIONS.length - 1 && styles.rowDivider]}>
              <IconContainer name={item.icon} size={19} color={settings[item.key] ? colors.teal800 : colors.textMuted} backgroundColor={settings[item.key] ? colors.teal100 : colors.surfaceSecondary} />
              <View style={styles.settingMain}>
                <Text style={styles.settingLabel}>{item.label}</Text>
                <Text style={styles.settingDescription}>{item.description}</Text>
              </View>
              <View style={[styles.switch, settings[item.key] && styles.switchOn]}>
                <View style={[styles.switchKnob, settings[item.key] && styles.switchKnobOn]} />
              </View>
            </TouchableOpacity>
          ))}
        </Card>

        <Card variant="elevated" style={styles.qrCard}>
          <View style={styles.qrHeader}>
            <View style={styles.qrHeaderMain}>
              <Text style={styles.qrTitle}>Emergency Health Card QR</Text>
              <Text style={styles.qrSub}>Longer-lived and limited to the fields selected above.</Text>
            </View>
            <StatusBadge status="Confirmed" label="Patient controlled" size="sm" />
          </View>
          {emergencyQr ? (
            <>
              <SecureQrView svg={emergencyQr.qrSvg} />
              <Text style={styles.expiryText}>Expires: {formatDateTime(emergencyQr.share.expiresAt)}</Text>
              <View style={styles.buttonRow}>
                <Button title="Open Shared View" icon="open-outline" variant="outline" onPress={() => emergencyQr.share.shareUrl && Linking.openURL(emergencyQr.share.shareUrl)} style={styles.flexButton} />
                <Button title="Replace QR" icon="refresh-outline" variant="secondary" onPress={rotateEmergency} style={styles.flexButton} />
              </View>
            </>
          ) : (
            <Button title="Show My Emergency QR" icon="qr-code-outline" onPress={() => void showEmergency(false)} loading={creatingEmergency} />
          )}
        </Card>

        <Text style={styles.sectionTitle}>Temporary medical share</Text>
        <Text style={styles.sectionSub}>Select specific information and create a QR that automatically expires.</Text>
        <Card style={styles.tempCard}>
          <Text style={styles.smallHeading}>INFORMATION TO SHARE</Text>
          <View style={styles.scopeGrid}>
            {TEMP_SCOPE_OPTIONS.map((item) => {
              const selected = item.scopes.every((scope) => tempScopes.includes(scope));
              return (
                <TouchableOpacity key={item.key} onPress={() => toggleTempScopeGroup(item.scopes)} activeOpacity={0.8} style={[styles.scopeChip, selected && styles.scopeChipSelected]}>
                  <Ionicons name={selected ? "checkmark-circle" : item.icon} size={18} color={selected ? colors.teal800 : colors.textMuted} />
                  <Text style={[styles.scopeText, selected && styles.scopeTextSelected]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[styles.smallHeading, { marginTop: spacing.lg }]}>EXPIRES AFTER</Text>
          <View style={styles.durationRow}>
            {DURATION_OPTIONS.map((item) => (
              <TouchableOpacity key={item.value} onPress={() => setDuration(item.value)} style={[styles.durationChip, duration === item.value && styles.durationChipSelected]}>
                <Text style={[styles.durationText, duration === item.value && styles.durationTextSelected]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Button title="Generate Temporary Medical QR" icon="qr-code-outline" onPress={() => void createTemporary()} loading={creatingTemp} style={{ marginTop: spacing.lg }} />

          {temporaryQr ? (
            <View style={styles.generatedTemp}>
              <SecureQrView svg={temporaryQr.qrSvg} />
              <Text style={styles.expiryText}>Expires: {formatDateTime(temporaryQr.share.expiresAt)}</Text>
              <View style={styles.buttonRow}>
                <Button title="Open Shared View" variant="outline" icon="open-outline" onPress={() => temporaryQr.share.shareUrl && Linking.openURL(temporaryQr.share.shareUrl)} style={styles.flexButton} />
                <Button title="Revoke" variant="danger" icon="close-circle-outline" onPress={() => revoke(temporaryQr.share)} style={styles.flexButton} />
              </View>
            </View>
          ) : null}
        </Card>

        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Active QR shares</Text>
            <Text style={styles.sectionSub}>{activeShares.length} active share{activeShares.length === 1 ? "" : "s"}</Text>
          </View>
          <Button title="Privacy Center" variant="ghost" size="sm" icon="shield-outline" onPress={() => router.push("/privacy" as any)} />
        </View>
        {activeShares.length ? activeShares.map((share) => (
          <Card key={share.id} style={styles.shareRowCard}>
            <View style={styles.shareRow}>
              <IconContainer name={share.type === "emergency" ? "medical-outline" : "time-outline"} size={21} color={share.type === "emergency" ? colors.error : colors.info} backgroundColor={share.type === "emergency" ? colors.errorBg : colors.infoBg} />
              <View style={styles.shareMain}>
                <Text style={styles.shareTitle}>{share.type === "emergency" ? "Emergency QR" : "Temporary Medical QR"}</Text>
                <Text style={styles.shareMeta}>Expires {formatDateTime(share.expiresAt)} • Used {share.usedCount} time{share.usedCount === 1 ? "" : "s"}</Text>
              </View>
              <Button title="Revoke" variant="outline" size="sm" onPress={() => revoke(share)} />
            </View>
          </Card>
        )) : <Card style={styles.emptyCard}><Text style={styles.emptyText}>No active QR shares.</Text></Card>}
      </ScrollView>
    </AppShell>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl + 50 },
  loadingCenter: { minHeight: 420, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: spacing.md, color: colors.textSecondary, fontSize: typography.sizes.body },
  healthCard: { borderRadius: radius.xxl, padding: spacing.xl, marginBottom: spacing.lg, overflow: "hidden" },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { color: colors.white, fontSize: 18, fontWeight: typography.weights.extraBold, letterSpacing: 1.5 },
  cardType: { color: colors.teal200, fontSize: 10, fontWeight: typography.weights.bold, letterSpacing: 1.2, marginTop: 2 },
  identityRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.xl },
  avatar: { width: 62, height: 62, borderRadius: 22, backgroundColor: colors.neonAqua, alignItems: "center", justifyContent: "center", marginRight: spacing.md },
  avatarText: { color: colors.navyInk, fontSize: 26, fontWeight: typography.weights.extraBold },
  identityMain: { flex: 1 },
  cardQrButton: { width: 58, minHeight: 58, borderRadius: 18, backgroundColor: colors.neonAqua, alignItems: "center", justifyContent: "center", marginLeft: spacing.sm },
  cardQrText: { color: colors.navyInk, fontSize: 9, fontWeight: typography.weights.extraBold, marginTop: 2, letterSpacing: 0.8 },
  cardName: { color: colors.white, fontSize: typography.sizes.h2, fontWeight: typography.weights.extraBold },
  cardMeta: { color: colors.teal100, fontSize: typography.sizes.small, marginTop: 4 },
  emergencyLine: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xl, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.18)" },
  emergencyLabel: { color: colors.teal200, fontSize: 9, fontWeight: typography.weights.bold, letterSpacing: 1 },
  emergencyValue: { color: colors.white, fontSize: typography.sizes.body, fontWeight: typography.weights.bold, marginTop: 2 },
  offlineNotice: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, marginBottom: spacing.md },
  securityNotice: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start", marginBottom: spacing.xl },
  noticeMain: { flex: 1 },
  noticeTitle: { color: colors.textPrimary, fontWeight: typography.weights.bold, fontSize: typography.sizes.body },
  noticeText: { color: colors.textSecondary, fontSize: typography.sizes.small, lineHeight: 20, marginTop: 4 },
  sectionTitle: { color: colors.textPrimary, fontSize: typography.sizes.h2, fontWeight: typography.weights.extraBold, marginTop: spacing.lg },
  sectionSub: { color: colors.textSecondary, fontSize: typography.sizes.small, lineHeight: 19, marginTop: 4, marginBottom: spacing.md },
  settingsCard: { paddingVertical: 4 },
  settingRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  settingMain: { flex: 1 },
  settingLabel: { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.bold },
  settingDescription: { color: colors.textSecondary, fontSize: typography.sizes.xs, marginTop: 3 },
  switch: { width: 46, height: 26, borderRadius: 13, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, padding: 2 },
  switchOn: { backgroundColor: colors.teal800, borderColor: colors.teal800 },
  switchKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.white },
  switchKnobOn: { alignSelf: "flex-end" },
  qrCard: { marginTop: spacing.lg },
  qrHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md, marginBottom: spacing.lg },
  qrHeaderMain: { flex: 1 },
  qrTitle: { color: colors.textPrimary, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.extraBold },
  qrSub: { color: colors.textSecondary, fontSize: typography.sizes.xs, lineHeight: 17, marginTop: 3 },
  expiryText: { color: colors.textSecondary, fontSize: typography.sizes.xs, textAlign: "center", marginTop: spacing.sm },
  buttonRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" },
  flexButton: { flex: 1, minWidth: 150 },
  tempCard: { marginTop: spacing.sm },
  smallHeading: { color: colors.teal800, fontSize: 10, fontWeight: typography.weights.extraBold, letterSpacing: 1 },
  scopeGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  scopeChip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 9 },
  scopeChipSelected: { borderColor: colors.teal700, backgroundColor: colors.teal100 },
  scopeText: { color: colors.textSecondary, fontSize: typography.sizes.xs, fontWeight: typography.weights.bold },
  scopeTextSelected: { color: colors.teal900 },
  durationRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" },
  durationChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 15, paddingVertical: 9, backgroundColor: colors.surfaceSecondary },
  durationChipSelected: { borderColor: colors.teal800, backgroundColor: colors.teal800 },
  durationText: { color: colors.textSecondary, fontSize: typography.sizes.small, fontWeight: typography.weights.bold },
  durationTextSelected: { color: colors.white },
  generatedTemp: { marginTop: spacing.xl, paddingTop: spacing.xl, borderTopWidth: 1, borderTopColor: colors.borderLight },
  sectionHeaderRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: spacing.md, marginTop: spacing.lg },
  shareRowCard: { marginTop: spacing.sm },
  shareRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  shareMain: { flex: 1 },
  shareTitle: { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.bold },
  shareMeta: { color: colors.textSecondary, fontSize: typography.sizes.xs, marginTop: 3 },
  emptyCard: { alignItems: "center", marginTop: spacing.sm },
  emptyText: { color: colors.textSecondary, fontSize: typography.sizes.small },
});
