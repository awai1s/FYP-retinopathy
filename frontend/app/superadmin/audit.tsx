import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import AppShell from "../../design/components/AppShell";
import { useAppTheme, useThemeRefresh } from "../../providers/AppThemeProvider";
import { getVerificationAudit, type VerificationAuditEvent } from "../../services/superadmin";

function pretty(value: string) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function VerificationAuditScreen() {
  useThemeRefresh();
  const { colors } = useAppTheme();
  const [events, setEvents] = useState<VerificationAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void getVerificationAudit().then(setEvents).catch((err) => setError(err?.message || "Unable to load audit history.")).finally(() => setLoading(false));
  }, []);

  return (
    <AppShell role="SuperAdmin" title="Verification Audit" subtitle="Immutable provider review history" showAssistant={false}>
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? <ActivityIndicator size="large" color={colors.primary} /> : null}
        {error ? <Text style={{ color: colors.error }}>{error}</Text> : null}
        {!loading && !events.length ? <Text style={{ color: colors.textSecondary }}>No SuperAdmin verification decisions have been recorded yet.</Text> : null}
        {events.map((event) => (
          <View key={event.id} style={[styles.event, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.topRow}>
              <Text style={[styles.provider, { color: colors.textPrimary }]}>{event.providerName}</Text>
              <Text style={[styles.decision, { color: event.decision === "verify" ? colors.success : event.decision === "reject" || event.decision === "suspend" ? colors.error : colors.warning }]}>{pretty(event.decision)}</Text>
            </View>
            <Text style={[styles.meta, { color: colors.textSecondary }]}>{event.role} • reviewed by {event.reviewerName}</Text>
            <Text style={[styles.reason, { color: colors.textPrimary }]}>{event.reason}</Text>
            <Text style={[styles.timestamp, { color: colors.textMuted }]}>{event.timestamp ? new Date(event.timestamp).toLocaleString() : ""}</Text>
          </View>
        ))}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 48, gap: 10 },
  event: { borderWidth: 1, borderRadius: 16, padding: 14 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  provider: { fontSize: 15, fontWeight: "900", flex: 1 },
  decision: { fontSize: 11, fontWeight: "900", letterSpacing: 0.4 },
  meta: { fontSize: 12, marginTop: 3 },
  reason: { fontSize: 13, lineHeight: 18, marginTop: 9 },
  timestamp: { fontSize: 11, marginTop: 8 },
});
