import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import AppShell from "../../../design/components/AppShell";
import Card from "../../../design/components/card";
import Button from "../../../design/components/Button";
import IconContainer from "../../../design/components/IconContainer";
import StatusBadge from "../../../design/components/StatusBadge";
import colors from "../../../design/tokens/colors";
import spacing from "../../../design/tokens/spacing";
import typography from "../../../design/tokens/typography";
import radius from "../../../design/tokens/radius";
import { useThemeRefresh } from "../../../providers/AppThemeProvider";
import {
  EQUIPMENT_DISPLAY_STATUSES,
  EQUIPMENT_TYPES,
  getEquipmentSummary,
  listEquipment,
  type EquipmentStatus,
  type EquipmentSummary,
  type EquipmentType,
  type EyeEquipment,
} from "../../../services/equipment";

const dateLabel = (value?: string) => {
  if (!value) return "Not scheduled";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

const statusKind = (status: EquipmentStatus) => {
  if (status === "Operational") return "Confirmed";
  if (status === "Service Due" || status === "Calibration Due") return "ActionNeeded";
  if (status === "Under Maintenance") return "Processing";
  if (status === "Out of Service" || status === "Retired") return "Rejected";
  return "Pending";
};

const equipmentIcon = (type: EquipmentType): keyof typeof Ionicons.glyphMap => {
  switch (type) {
    case "Fundus Camera": return "camera-outline";
    case "OCT Scanner": return "scan-outline";
    case "Slit Lamp": return "flashlight-outline";
    case "Retinal Laser": return "flash-outline";
    case "Visual Field Analyzer": return "eye-outline";
    case "Tonometer": return "speedometer-outline";
    default: return "hardware-chip-outline";
  }
};

function MetricCard({ label, value, icon, tone }: { label: string; value: number; icon: keyof typeof Ionicons.glyphMap; tone: "good" | "warn" | "info" | "bad" }) {
  const palette = tone === "good"
    ? { fg: colors.success, bg: colors.successBg }
    : tone === "warn"
      ? { fg: colors.warning, bg: colors.warningBg }
      : tone === "bad"
        ? { fg: colors.error, bg: colors.errorBg }
        : { fg: colors.info, bg: colors.infoBg };
  return (
    <Card style={styles.metricCard}>
      <IconContainer name={icon} size={21} color={palette.fg} backgroundColor={palette.bg} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </Card>
  );
}

export default function EquipmentDashboardScreen() {
  useThemeRefresh();
  const router = useRouter();
  const [equipment, setEquipment] = useState<EyeEquipment[]>([]);
  const [summary, setSummary] = useState<EquipmentSummary | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<EquipmentType | "">("");
  const [statusFilter, setStatusFilter] = useState<EquipmentStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const [summaryData, equipmentData] = await Promise.all([
        getEquipmentSummary(),
        listEquipment({ search, type: typeFilter, status: statusFilter }),
      ]);
      setSummary(summaryData);
      setEquipment(equipmentData);
    } catch (err: any) {
      setError(err?.message || "Unable to load hospital equipment.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, statusFilter, typeFilter]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const urgent = useMemo(
    () => equipment.filter((item) => item.status === "Service Due" || item.status === "Calibration Due" || item.status === "Out of Service"),
    [equipment]
  );

  if (loading) {
    return (
      <AppShell role="Hospital" title="Eye Equipment" showBack onBackPress={() => router.back()} showAssistant={false}>
        <View style={styles.center}><ActivityIndicator size="large" color={colors.teal800} /><Text style={styles.secondary}>Loading equipment lifecycle data...</Text></View>
      </AppShell>
    );
  }

  return (
    <AppShell role="Hospital" title="Eye Equipment" showBack onBackPress={() => router.back()} showAssistant={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.teal800} />}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerMain}>
            <Text style={styles.eyebrow}>HOSPITAL OPERATIONS</Text>
            <Text style={styles.title}>Eye Equipment</Text>
            <Text style={styles.subtitle}>Track service, calibration, downtime, repairs and retirement without losing lifecycle history.</Text>
          </View>
          <Button title="Add Device" icon="add-circle-outline" size="sm" onPress={() => router.push("/hospital/equipment/new" as any)} />
        </View>

        {error ? <View style={styles.errorBanner}><Ionicons name="alert-circle-outline" size={20} color={colors.error} /><Text style={styles.errorText}>{error}</Text></View> : null}

        <View style={styles.metricsGrid}>
          <MetricCard label="Active Devices" value={summary?.activeDevices || 0} icon="checkmark-circle-outline" tone="good" />
          <MetricCard label="Service Due" value={summary?.serviceDue || 0} icon="construct-outline" tone="warn" />
          <MetricCard label="Calibration Due" value={summary?.calibrationDue || 0} icon="options-outline" tone="info" />
          <MetricCard label="Out of Service" value={summary?.outOfService || 0} icon="warning-outline" tone="bad" />
        </View>

        {summary && summary.dueWithin7Days > 0 ? (
          <Card style={styles.attentionCard}>
            <View style={styles.attentionRow}>
              <IconContainer name="alarm-outline" size={22} color={colors.warning} backgroundColor={colors.warningBg} />
              <View style={styles.flex}>
                <Text style={styles.attentionTitle}>Upcoming lifecycle work</Text>
                <Text style={styles.attentionText}>{summary.dueWithin7Days} service/calibration item{summary.dueWithin7Days === 1 ? "" : "s"} due within the next 7 days.</Text>
              </View>
            </View>
          </Card>
        ) : null}

        <Card style={styles.filterCard}>
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={20} color={colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={() => void load()}
              placeholder="Search asset ID, device, model, department..."
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              returnKeyType="search"
            />
            {search ? <TouchableOpacity onPress={() => setSearch("")} accessibilityLabel="Clear search"><Ionicons name="close-circle" size={20} color={colors.textMuted} /></TouchableOpacity> : null}
          </View>

          <Text style={styles.filterLabel}>Equipment Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            <TouchableOpacity onPress={() => setTypeFilter("")} style={[styles.chip, !typeFilter && styles.chipActive]}><Text style={[styles.chipText, !typeFilter && styles.chipTextActive]}>All</Text></TouchableOpacity>
            {EQUIPMENT_TYPES.map((item) => <TouchableOpacity key={item} onPress={() => setTypeFilter(item)} style={[styles.chip, typeFilter === item && styles.chipActive]}><Text style={[styles.chipText, typeFilter === item && styles.chipTextActive]}>{item}</Text></TouchableOpacity>)}
          </ScrollView>

          <Text style={styles.filterLabel}>Status</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            <TouchableOpacity onPress={() => setStatusFilter("")} style={[styles.chip, !statusFilter && styles.chipActive]}><Text style={[styles.chipText, !statusFilter && styles.chipTextActive]}>All</Text></TouchableOpacity>
            {EQUIPMENT_DISPLAY_STATUSES.map((item) => <TouchableOpacity key={item} onPress={() => setStatusFilter(item)} style={[styles.chip, statusFilter === item && styles.chipActive]}><Text style={[styles.chipText, statusFilter === item && styles.chipTextActive]}>{item}</Text></TouchableOpacity>)}
          </ScrollView>
        </Card>

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>Equipment Inventory</Text>
          <Text style={styles.secondary}>{equipment.length} shown</Text>
        </View>

        {equipment.length === 0 ? (
          <Card style={styles.emptyCard}>
            <IconContainer name="hardware-chip-outline" size={30} color={colors.textMuted} backgroundColor={colors.teal50} />
            <Text style={styles.emptyTitle}>No matching equipment</Text>
            <Text style={styles.secondary}>Add your first ophthalmic device or change the current filters.</Text>
            <Button title="Add Equipment" icon="add-outline" size="sm" onPress={() => router.push("/hospital/equipment/new" as any)} style={styles.emptyButton} />
          </Card>
        ) : equipment.map((item) => (
          <TouchableOpacity key={item.id} activeOpacity={0.82} onPress={() => router.push(`/hospital/equipment/${item.id}` as any)}>
            <Card style={[styles.deviceCard, urgent.some((u) => u.id === item.id) && styles.urgentDeviceCard]}>
              <View style={styles.deviceTopRow}>
                <IconContainer name={equipmentIcon(item.type)} size={24} color={colors.teal800} backgroundColor={colors.teal100} />
                <View style={styles.deviceMain}>
                  <Text style={styles.deviceTitle}>{item.deviceName}</Text>
                  <Text style={styles.assetText}>{item.assetId} · {item.type}</Text>
                </View>
                <StatusBadge status={statusKind(item.status)} label={item.status} size="sm" />
              </View>
              <View style={styles.metaGrid}>
                <View style={styles.metaItem}><Text style={styles.metaLabel}>Department</Text><Text style={styles.metaValue}>{item.department || "Not set"}</Text></View>
                <View style={styles.metaItem}><Text style={styles.metaLabel}>Location</Text><Text style={styles.metaValue}>{item.location || "Not set"}</Text></View>
                <View style={styles.metaItem}><Text style={styles.metaLabel}>Next Service</Text><Text style={styles.metaValue}>{dateLabel(item.nextService)}</Text></View>
                <View style={styles.metaItem}><Text style={styles.metaLabel}>Next Calibration</Text><Text style={styles.metaValue}>{dateLabel(item.nextCalibration)}</Text></View>
              </View>
              <View style={styles.openRow}><Text style={styles.openText}>Open lifecycle record</Text><Ionicons name="chevron-forward" size={18} color={colors.teal800} /></View>
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl + 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  flex: { flex: 1 },
  secondary: { color: colors.textSecondary, fontSize: typography.sizes.small },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md, marginBottom: spacing.lg, flexWrap: "wrap" },
  headerMain: { flex: 1, minWidth: 230 },
  eyebrow: { color: colors.teal800, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, letterSpacing: 1.2, marginBottom: 3 },
  title: { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.bold },
  subtitle: { color: colors.textSecondary, fontSize: typography.sizes.body, marginTop: 5, lineHeight: 21 },
  errorBanner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.errorBg, borderColor: colors.errorBorder, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  errorText: { flex: 1, color: colors.error, fontSize: typography.sizes.small },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  metricCard: { flexGrow: 1, flexBasis: 140, minWidth: 135, backgroundColor: colors.surface, gap: 5 },
  metricValue: { color: colors.textPrimary, fontSize: typography.sizes.h2, fontWeight: typography.weights.bold },
  metricLabel: { color: colors.textSecondary, fontSize: typography.sizes.xs, fontWeight: typography.weights.medium },
  attentionCard: { backgroundColor: colors.warningBg, borderColor: colors.warningBorder, marginBottom: spacing.md },
  attentionRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  attentionTitle: { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.bold },
  attentionText: { color: colors.textSecondary, fontSize: typography.sizes.small, marginTop: 2 },
  filterCard: { backgroundColor: colors.surface, marginBottom: spacing.lg },
  searchRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: colors.surfaceSecondary, marginBottom: spacing.md },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: typography.sizes.body, paddingVertical: 10 },
  filterLabel: { color: colors.textSecondary, fontSize: typography.sizes.xs, fontWeight: typography.weights.bold, marginTop: 4, marginBottom: spacing.xs },
  chipsRow: { gap: spacing.xs, paddingBottom: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill },
  chipActive: { backgroundColor: colors.teal100, borderColor: colors.teal600 },
  chipText: { color: colors.textSecondary, fontSize: typography.sizes.xs, fontWeight: typography.weights.medium },
  chipTextActive: { color: colors.teal900, fontWeight: typography.weights.bold },
  listHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  sectionTitle: { color: colors.textPrimary, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold },
  emptyCard: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl, backgroundColor: colors.surface },
  emptyTitle: { color: colors.textPrimary, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold },
  emptyButton: { marginTop: spacing.sm },
  deviceCard: { backgroundColor: colors.surface, marginBottom: spacing.sm },
  urgentDeviceCard: { borderColor: colors.warningBorder, borderWidth: 1.5 },
  deviceTopRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  deviceMain: { flex: 1, minWidth: 0 },
  deviceTitle: { color: colors.textPrimary, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold },
  assetText: { color: colors.textSecondary, fontSize: typography.sizes.xs, marginTop: 2 },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  metaItem: { flexBasis: "47%", flexGrow: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.sm },
  metaLabel: { color: colors.textMuted, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold },
  metaValue: { color: colors.textPrimary, fontSize: typography.sizes.xs, fontWeight: typography.weights.medium, marginTop: 2 },
  openRow: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 3, marginTop: spacing.md },
  openText: { color: colors.teal800, fontSize: typography.sizes.xs, fontWeight: typography.weights.bold },
});
