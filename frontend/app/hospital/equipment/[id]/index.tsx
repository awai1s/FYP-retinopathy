import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import AppShell from "../../../../design/components/AppShell";
import Card from "../../../../design/components/card";
import Button from "../../../../design/components/Button";
import IconContainer from "../../../../design/components/IconContainer";
import StatusBadge from "../../../../design/components/StatusBadge";
import colors from "../../../../design/tokens/colors";
import spacing from "../../../../design/tokens/spacing";
import typography from "../../../../design/tokens/typography";
import radius from "../../../../design/tokens/radius";
import { useThemeRefresh } from "../../../../providers/AppThemeProvider";
import {
  getEquipment,
  listEquipmentEvents,
  type EquipmentEvent,
  type EquipmentEventType,
  type EquipmentStatus,
  type EyeEquipment,
} from "../../../../services/equipment";

const dateLabel = (value?: string) => {
  if (!value) return "Not set";
  const parsed = new Date(value.includes("T") ? value : `${value}T00:00:00`);
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

const eventLabel = (eventType: EquipmentEventType) => {
  const labels: Record<EquipmentEventType, string> = {
    SERVICE: "Service Record",
    CALIBRATION: "Calibration",
    DOWNTIME_START: "Downtime Started",
    DOWNTIME_END: "Downtime Ended",
    REPAIR: "Repair",
    STATUS_CHANGE: "Status Change",
    RETIREMENT: "Retirement",
  };
  return labels[eventType];
};

const eventIcon = (eventType: EquipmentEventType): keyof typeof Ionicons.glyphMap => {
  if (eventType === "SERVICE") return "construct-outline";
  if (eventType === "CALIBRATION") return "options-outline";
  if (eventType === "DOWNTIME_START") return "warning-outline";
  if (eventType === "DOWNTIME_END") return "play-circle-outline";
  if (eventType === "REPAIR") return "hammer-outline";
  if (eventType === "RETIREMENT") return "archive-outline";
  return "swap-horizontal-outline";
};

function DetailRow({ label, value }: { label: string; value?: string }) {
  return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value || "—"}</Text></View>;
}

function DueCard({ title, last, next, state }: { title: string; last?: string; next?: string; state?: { days: number | null; state: string } }) {
  const due = state?.days;
  const urgent = due != null && due <= 7;
  return (
    <Card style={[styles.dueCard, urgent && styles.dueCardUrgent]}>
      <Text style={styles.dueTitle}>{title}</Text>
      <DetailRow label="Last" value={dateLabel(last)} />
      <DetailRow label="Next" value={dateLabel(next)} />
      {due != null ? (
        <Text style={[styles.dueHint, urgent && styles.dueHintUrgent]}>
          {due < 0 ? `Overdue by ${Math.abs(due)} day${Math.abs(due) === 1 ? "" : "s"}` : due === 0 ? "Due today" : `${due} day${due === 1 ? "" : "s"} remaining`}
        </Text>
      ) : null}
    </Card>
  );
}

export default function EquipmentDetailScreen() {
  useThemeRefresh();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const equipmentId = String(id || "");
  const [equipment, setEquipment] = useState<EyeEquipment | null>(null);
  const [events, setEvents] = useState<EquipmentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!equipmentId) return;
    try {
      setError("");
      const [device, history] = await Promise.all([getEquipment(equipmentId), listEquipmentEvents(equipmentId)]);
      setEquipment(device);
      setEvents(history);
    } catch (err: any) {
      setError(err?.message || "Unable to load equipment lifecycle record.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [equipmentId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const openEvent = (eventType: EquipmentEventType) => {
    router.push(`/hospital/equipment/${equipmentId}/event?type=${eventType}` as any);
  };

  if (loading) {
    return <AppShell role="Hospital" title="Equipment" showBack onBackPress={() => router.back()} showAssistant={false}><View style={styles.center}><ActivityIndicator size="large" color={colors.teal800} /></View></AppShell>;
  }

  if (!equipment) {
    return <AppShell role="Hospital" title="Equipment" showBack onBackPress={() => router.back()} showAssistant={false}><Card style={styles.errorCard}><Text style={styles.errorTitle}>Equipment unavailable</Text><Text style={styles.secondary}>{error || "This lifecycle record was not found."}</Text></Card></AppShell>;
  }

  const retired = equipment.status === "Retired";
  const out = equipment.status === "Out of Service";

  return (
    <AppShell role="Hospital" title="Equipment Lifecycle" showBack onBackPress={() => router.back()} showAssistant={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.teal800} />}
      >
        {error ? <View style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text></View> : null}

        <Card variant="elevated" style={styles.heroCard}>
          <View style={styles.heroTop}>
            <IconContainer name="hardware-chip-outline" size={28} color={colors.teal800} backgroundColor={colors.teal100} />
            <View style={styles.heroMain}>
              <Text style={styles.eyebrow}>ASSET {equipment.assetId}</Text>
              <Text style={styles.title}>{equipment.deviceName}</Text>
              <Text style={styles.secondary}>{equipment.manufacturer || "Manufacturer not set"}{equipment.model ? ` · ${equipment.model}` : ""}</Text>
            </View>
            <StatusBadge status={statusKind(equipment.status)} label={equipment.status} />
          </View>
          <View style={styles.heroMeta}>
            <View style={styles.heroMetaItem}><Text style={styles.detailLabel}>TYPE</Text><Text style={styles.heroMetaValue}>{equipment.type}</Text></View>
            <View style={styles.heroMetaItem}><Text style={styles.detailLabel}>DEPARTMENT</Text><Text style={styles.heroMetaValue}>{equipment.department || "Not set"}</Text></View>
            <View style={styles.heroMetaItem}><Text style={styles.detailLabel}>LOCATION</Text><Text style={styles.heroMetaValue}>{equipment.location || "Not set"}</Text></View>
          </View>
        </Card>

        {!retired ? (
          <View style={styles.actionWrap}>
            <Button title="Service Record" icon="construct-outline" size="sm" onPress={() => openEvent("SERVICE")} />
            <Button title="Calibrate" icon="options-outline" size="sm" onPress={() => openEvent("CALIBRATION")} />
            {!out ? <Button title="Report Downtime" variant="outline" icon="warning-outline" size="sm" onPress={() => openEvent("DOWNTIME_START")} /> : <Button title="End Downtime" variant="outline" icon="play-circle-outline" size="sm" onPress={() => openEvent("DOWNTIME_END")} />}
            <Button title="Repair" variant="outline" icon="hammer-outline" size="sm" onPress={() => openEvent("REPAIR")} />
            <Button title="Change Status" variant="ghost" icon="swap-horizontal-outline" size="sm" onPress={() => openEvent("STATUS_CHANGE")} />
            <Button title="Edit Asset" variant="ghost" icon="create-outline" size="sm" onPress={() => router.push(`/hospital/equipment/${equipmentId}/edit` as any)} />
          </View>
        ) : null}

        <View style={styles.dueGrid}>
          <DueCard title="SERVICE" last={equipment.lastService} next={equipment.nextService} state={equipment.serviceDue} />
          <DueCard title="CALIBRATION" last={equipment.lastCalibration} next={equipment.nextCalibration} state={equipment.calibrationDue} />
        </View>

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Device Information</Text>
          <DetailRow label="Asset ID" value={equipment.assetId} />
          <DetailRow label="Serial Number" value={equipment.serialNumber} />
          <DetailRow label="Manufacturer" value={equipment.manufacturer} />
          <DetailRow label="Model" value={equipment.model} />
          <DetailRow label="Purchase Date" value={dateLabel(equipment.purchaseDate)} />
          {equipment.notes ? <View style={styles.notesBox}><Text style={styles.detailLabel}>NOTES</Text><Text style={styles.notesText}>{equipment.notes}</Text></View> : null}
        </Card>

        <View style={styles.sectionHeaderRow}><Text style={styles.sectionTitle}>Lifecycle History</Text><Text style={styles.secondary}>{events.length} event{events.length === 1 ? "" : "s"}</Text></View>
        {events.length === 0 ? (
          <Card style={styles.emptyHistory}><Ionicons name="time-outline" size={26} color={colors.textMuted} /><Text style={styles.emptyTitle}>No lifecycle events yet</Text><Text style={styles.secondary}>Service, calibration, repair and downtime records will appear here.</Text></Card>
        ) : events.map((event, index) => (
          <Card key={event.id} style={styles.eventCard}>
            <View style={styles.eventRow}>
              <View style={styles.timelineCol}>
                <IconContainer name={eventIcon(event.eventType)} size={20} color={colors.teal800} backgroundColor={colors.teal100} />
                {index < events.length - 1 ? <View style={styles.timelineLine} /> : null}
              </View>
              <View style={styles.eventMain}>
                <Text style={styles.eventTitle}>{eventLabel(event.eventType)}</Text>
                <Text style={styles.eventDate}>{dateLabel(event.eventDate)}</Text>
                {event.targetStatus ? <Text style={styles.eventMeta}>Status: {event.targetStatus}</Text> : null}
                {event.nextDueDate ? <Text style={styles.eventMeta}>Next due: {dateLabel(event.nextDueDate)}</Text> : null}
                {event.performedBy ? <Text style={styles.eventMeta}>Performed by: {event.performedBy}</Text> : null}
                {event.reference ? <Text style={styles.eventMeta}>Reference: {event.reference}</Text> : null}
                {event.cost != null ? <Text style={styles.eventMeta}>Cost: {event.cost}</Text> : null}
                {event.notes ? <Text style={styles.eventNotes}>{event.notes}</Text> : null}
              </View>
            </View>
          </Card>
        ))}

        {!retired ? (
          <Card style={styles.retireCard}>
            <View style={styles.retireRow}>
              <View style={styles.flex}><Text style={styles.retireTitle}>Retirement</Text><Text style={styles.secondary}>Retirement preserves this asset and its complete history but makes the lifecycle record read-only.</Text></View>
              <Button title="Retire Device" variant="danger" size="sm" icon="archive-outline" onPress={() => openEvent("RETIREMENT")} />
            </View>
          </Card>
        ) : (
          <Card style={styles.retiredNotice}><Text style={styles.retiredTitle}>Retired Asset</Text><Text style={styles.secondary}>This lifecycle record is retained for audit/history and cannot be reactivated.</Text></Card>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl + 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  secondary: { color: colors.textSecondary, fontSize: typography.sizes.small, lineHeight: 18 },
  heroCard: { backgroundColor: colors.surface, marginBottom: spacing.md },
  heroTop: { flexDirection: "row", alignItems: "center", gap: spacing.md, flexWrap: "wrap" },
  heroMain: { flex: 1, minWidth: 180 },
  eyebrow: { color: colors.teal800, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, letterSpacing: 1.2 },
  title: { color: colors.textPrimary, fontSize: typography.sizes.h2, fontWeight: typography.weights.bold, marginTop: 2 },
  heroMeta: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  heroMetaItem: { flex: 1, minWidth: 130, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.sm },
  heroMetaValue: { color: colors.textPrimary, fontSize: typography.sizes.small, fontWeight: typography.weights.bold, marginTop: 2 },
  actionWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.md },
  dueGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginBottom: spacing.md },
  dueCard: { flex: 1, minWidth: 240, backgroundColor: colors.surface },
  dueCardUrgent: { borderWidth: 1.5, borderColor: colors.warningBorder },
  dueTitle: { color: colors.teal800, fontSize: typography.sizes.xs, fontWeight: typography.weights.bold, letterSpacing: 1, marginBottom: spacing.sm },
  dueHint: { color: colors.textSecondary, fontSize: typography.sizes.xs, marginTop: spacing.sm, fontWeight: typography.weights.medium },
  dueHintUrgent: { color: colors.warning, fontWeight: typography.weights.bold },
  sectionCard: { backgroundColor: colors.surface, marginBottom: spacing.md },
  sectionTitle: { color: colors.textPrimary, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.md, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight },
  detailLabel: { color: colors.textMuted, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, letterSpacing: 0.5 },
  detailValue: { flex: 1, textAlign: "right", color: colors.textPrimary, fontSize: typography.sizes.small, fontWeight: typography.weights.medium },
  notesBox: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  notesText: { color: colors.textSecondary, fontSize: typography.sizes.small, lineHeight: 19, marginTop: 5 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  eventCard: { backgroundColor: colors.surface, marginBottom: spacing.xs },
  eventRow: { flexDirection: "row", gap: spacing.md },
  timelineCol: { alignItems: "center", width: 36 },
  timelineLine: { width: 2, flex: 1, minHeight: 24, backgroundColor: colors.border, marginTop: 5 },
  eventMain: { flex: 1 },
  eventTitle: { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.bold },
  eventDate: { color: colors.teal800, fontSize: typography.sizes.xs, fontWeight: typography.weights.bold, marginTop: 2 },
  eventMeta: { color: colors.textSecondary, fontSize: typography.sizes.xs, marginTop: 3 },
  eventNotes: { color: colors.textPrimary, fontSize: typography.sizes.small, lineHeight: 18, marginTop: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  emptyHistory: { alignItems: "center", gap: spacing.xs, paddingVertical: spacing.xl, backgroundColor: colors.surface },
  emptyTitle: { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.bold },
  retireCard: { marginTop: spacing.lg, backgroundColor: colors.errorBg, borderColor: colors.errorBorder },
  retireRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, flexWrap: "wrap" },
  retireTitle: { color: colors.error, fontSize: typography.sizes.body, fontWeight: typography.weights.bold },
  retiredNotice: { marginTop: spacing.lg, backgroundColor: colors.surfaceSecondary },
  retiredTitle: { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.bold },
  errorCard: { backgroundColor: colors.errorBg, borderColor: colors.errorBorder },
  errorTitle: { color: colors.error, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold },
  errorBanner: { backgroundColor: colors.errorBg, borderColor: colors.errorBorder, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  errorText: { color: colors.error, fontSize: typography.sizes.small },
});
