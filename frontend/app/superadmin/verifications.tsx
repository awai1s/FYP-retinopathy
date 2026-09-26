import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import AppShell from "../../design/components/AppShell";
import { useAppTheme, useThemeRefresh } from "../../providers/AppThemeProvider";
import { listProviderVerifications } from "../../services/superadmin";
import type { ProviderVerification } from "../../services/providerVerification";

const STATUS_FILTERS = [
  ["All", ""],
  ["Pending", "pending"],
  ["Under Review", "under_review"],
  ["Needs Changes", "needs_changes"],
  ["Verified", "verified"],
  ["Rejected", "rejected"],
] as const;

function pretty(value: string) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ProviderVerificationsScreen() {
  useThemeRefresh();
  const params = useLocalSearchParams();
  const { colors } = useAppTheme();
  const [status, setStatus] = useState(String(params.status || ""));
  const [role, setRole] = useState(String(params.role || ""));
  const [accountStatus, setAccountStatus] = useState(String(params.accountStatus || ""));
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ProviderVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await listProviderVerifications({ status, role, accountStatus, query }));
    } catch (err: any) {
      setError(err?.message || "Unable to load provider verifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [status, role, accountStatus]);

  const title = useMemo(() => {
    if (accountStatus === "suspended") return "Suspended Accounts";
    if (role === "Doctor") return "Doctor Verifications";
    if (role === "Hospital") return "Hospital Verifications";
    if (status === "verified") return "Verified Providers";
    return "Verification Queue";
  }, [status, role, accountStatus]);

  return (
    <AppShell role="SuperAdmin" title={title} subtitle="Credential review queue" showAssistant={false}>
      <View style={styles.content}>
        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Ionicons name="search-outline" size={19} color={colors.textMuted} />
          <TextInput value={query} onChangeText={setQuery} onSubmitEditing={() => void load()} placeholder="Search name, email, license or registration" placeholderTextColor={colors.textMuted} style={[styles.searchInput, { color: colors.textPrimary }]} />
          <TouchableOpacity onPress={() => void load()}><Ionicons name="arrow-forward-circle" size={24} color={colors.primary} /></TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {STATUS_FILTERS.map(([label, value]) => (
            <TouchableOpacity key={label} onPress={() => { setStatus(value); setAccountStatus(""); }} style={[styles.chip, { borderColor: status === value && !accountStatus ? colors.primary : colors.border, backgroundColor: status === value && !accountStatus ? colors.surfaceRaised : colors.surface }]}>
              <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "700" }}>{label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => { setAccountStatus("suspended"); setStatus(""); }} style={[styles.chip, { borderColor: accountStatus === "suspended" ? colors.error : colors.border, backgroundColor: colors.surface }]}><Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "700" }}>Suspended</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setRole(role === "Doctor" ? "" : "Doctor")} style={[styles.chip, { borderColor: role === "Doctor" ? colors.primary : colors.border, backgroundColor: colors.surface }]}><Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "700" }}>Doctors</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setRole(role === "Hospital" ? "" : "Hospital")} style={[styles.chip, { borderColor: role === "Hospital" ? colors.primary : colors.border, backgroundColor: colors.surface }]}><Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "700" }}>Hospitals</Text></TouchableOpacity>
        </ScrollView>

        {loading ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 36 }} /> : null}
        {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

        {!loading && !items.length ? <Text style={[styles.empty, { color: colors.textSecondary }]}>No provider verification records match this filter.</Text> : null}
        <View style={styles.list}>
          {items.map((item) => (
            <TouchableOpacity key={item.id} onPress={() => router.push(`/superadmin/verification/${item.id}` as any)} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]} activeOpacity={0.82}>
              <View style={[styles.avatar, { backgroundColor: colors.surfaceRaised }]}><Ionicons name={item.role === "Doctor" ? "medical-outline" : "business-outline"} size={21} color={colors.primary} /></View>
              <View style={styles.rowMain}>
                <Text style={[styles.name, { color: colors.textPrimary }]}>{item.provider?.name || item.details?.fullName || item.details?.hospitalName || "Provider"}</Text>
                <Text style={[styles.meta, { color: colors.textSecondary }]}>{item.role} • {item.provider?.email || "No email"}</Text>
                <View style={styles.statusLine}>
                  <Text style={[styles.status, { color: item.status === "verified" ? colors.success : item.status === "rejected" ? colors.error : colors.warning }]}>{pretty(item.status)}</Text>
                  {item.accountStatus !== "active" ? <Text style={[styles.status, { color: colors.error }]}> • {pretty(item.accountStatus)}</Text> : null}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={19} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 44 },
  searchBox: { minHeight: 50, flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, minHeight: 48 },
  filters: { paddingVertical: 12, gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  list: { gap: 9 },
  row: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 16, padding: 13, gap: 11 },
  avatar: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  rowMain: { flex: 1 },
  name: { fontSize: 15, fontWeight: "800" },
  meta: { fontSize: 12, marginTop: 2 },
  statusLine: { flexDirection: "row", marginTop: 5 },
  status: { fontSize: 11, fontWeight: "800" },
  error: { marginTop: 18, fontSize: 13 },
  empty: { marginTop: 30, textAlign: "center", fontSize: 14 },
});
