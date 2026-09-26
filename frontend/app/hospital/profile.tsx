import { Alert } from "../../services/alert";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import AppShell from "../../design/components/AppShell";
import Button from "../../design/components/Button";
import ProviderVerificationBanner from "../../components/ProviderVerificationBanner";
import { useAppTheme, useThemeRefresh } from "../../providers/AppThemeProvider";
import { getHospitalProfile, updateHospitalProfile } from "../../services/hospital";
import { getProviderVerification, type ProviderVerification } from "../../services/providerVerification";

export default function HospitalProfileScreen() {
  useThemeRefresh();
  const { colors } = useAppTheme();
  const [name, setName] = useState("Hospital");
  const [hospitalName, setHospitalName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [verification, setVerification] = useState<ProviderVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [profile, verificationData] = await Promise.all([getHospitalProfile(), getProviderVerification()]);
        setName(profile.name || profile.hospitalName || "Hospital");
        setHospitalName(profile.hospitalName || profile.name || "");
        setLicenseNumber(profile.licenseNumber || "");
        setPhone(profile.phone || "");
        setAddress(profile.address || "");
        setVerification(verificationData);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await updateHospitalProfile({ hospitalName, licenseNumber, phone, address });
      Alert.alert("Saved", "Hospital profile updated successfully.");
    } catch (err: any) {
      Alert.alert("Unable to save", err?.message || "Hospital profile update failed.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={[styles.loading, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <AppShell role="Hospital" title="Hospital Profile" userName={name} showAssistant={false}>
      <ScrollView contentContainerStyle={styles.content}>
        {verification ? <ProviderVerificationBanner status={verification.status} accountStatus={verification.accountStatus} decisionReason={verification.decisionReason} compact /> : null}
        {[
          ["Hospital name", hospitalName, setHospitalName],
          ["Registration / license number", licenseNumber, setLicenseNumber],
          ["Phone", phone, setPhone],
          ["Address", address, setAddress],
        ].map(([label, value, setter]: any) => (
          <View key={label} style={styles.field}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
            <TextInput
              value={value}
              onChangeText={setter}
              multiline={label === "Address"}
              style={[styles.input, label === "Address" && styles.multiline, { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border }]}
              placeholderTextColor={colors.textMuted}
            />
          </View>
        ))}
        <Button title="Save Profile" icon="save-outline" onPress={() => void save()} loading={saving} />
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingBottom: 44 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: "700", marginBottom: 6 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 14 },
  multiline: { minHeight: 92, paddingTop: 12, textAlignVertical: "top" },
});
