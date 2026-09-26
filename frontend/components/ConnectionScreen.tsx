import { Alert } from "../services/alert";
import { useCallback, useState } from "react";
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
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  acceptConnection,
  blockConnection,
  cancelConnectionRequest,
  declineConnection,
  getConnectionRequests,
  getConnections,
  requestConnection,
  revokeConnection,
  searchConnectionDirectory,
  unblockConnection,
  type Connection,
  type ConnectionPerson,
} from "../services/connections";
import AppShell from "../design/components/AppShell";
import Card from "../design/components/card";
import IconContainer from "../design/components/IconContainer";
import StatusBadge from "../design/components/StatusBadge";
import Button from "../design/components/Button";
import colors from "../design/tokens/colors";
import spacing from "../design/tokens/spacing";
import typography from "../design/tokens/typography";
import radius from "../design/tokens/radius";
import { useLanguage } from "../services/i18n";
import { useThemeRefresh } from "../providers/AppThemeProvider";

type Props = { role: "Patient" | "Doctor" };

const formatDate = (value?: string | null) => {
  if (!value) return "Not available";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export default function ConnectionScreen({ role }: Props) {
  useThemeRefresh();
  const router = useRouter();
  const isPatient = role === "Patient";
  const [connections, setConnections] = useState<Connection[]>([]);
  const [incoming, setIncoming] = useState<Connection[]>([]);
  const [outgoing, setOutgoing] = useState<Connection[]>([]);
  const [blocked, setBlocked] = useState<Connection[]>([]);
  const [people, setPeople] = useState<ConnectionPerson[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const { t } = useLanguage();

  const load = useCallback(async () => {
    try {
      setError("");
      const [active, requests] = await Promise.all([getConnections(), getConnectionRequests()]);
      setConnections(active.connections || []);
      setIncoming(requests.incoming || []);
      setOutgoing(requests.outgoing || []);
      setBlocked(requests.blocked || []);
    } catch (err: any) {
      setError(err?.message || "Unable to load care connections.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const search = async () => {
    try {
      setSearching(true);
      setError("");
      const result = await searchConnectionDirectory(query);
      setPeople(result.people || []);
    } catch (err: any) {
      setError(err?.message || "Unable to search the care directory.");
    } finally {
      setSearching(false);
    }
  };

  const sendRequest = async (person: ConnectionPerson) => {
    try {
      setBusyId(person.id);
      await requestConnection(person.id);
      setPeople((items) => items.map((item) => item.id === person.id ? { ...item, connectionStatus: "pending" } : item));
      await load();
      Alert.alert("Request sent", isPatient ? "The doctor will be notified." : "The patient will be asked to approve clinical access.");
    } catch (err: any) {
      Alert.alert("Request not sent", err?.message || "This care connection could not be requested.");
    } finally {
      setBusyId("");
    }
  };

  const respond = async (item: Connection, action: "accept" | "decline") => {
    try {
      setBusyId(item.id);
      if (action === "accept") await acceptConnection(item.id);
      else await declineConnection(item.id);
      await load();
    } catch (err: any) {
      Alert.alert("Action unavailable", err?.message || "Please try again.");
    } finally {
      setBusyId("");
    }
  };

  const cancelOutgoing = (item: Connection) => {
    Alert.alert(
      "Cancel care request?",
      `Cancel the pending request to ${item.person.name || "this account"}?`,
      [
        { text: "Keep Request", style: "cancel" },
        {
          text: "Cancel Request",
          style: "destructive",
          onPress: async () => {
            try {
              setBusyId(item.id);
              await cancelConnectionRequest(item.id);
              await load();
            } catch (err: any) {
              Alert.alert("Unable to cancel", err?.message || "Please try again.");
            } finally {
              setBusyId("");
            }
          },
        },
      ]
    );
  };

  const removeAccepted = (item: Connection) => {
    const name = item.person.name || (isPatient ? "this doctor" : "this patient");
    Alert.alert(
      isPatient ? `Remove ${name} from your care team?` : `End connection with ${name}?`,
      isPatient
        ? "The doctor will no longer have general access to your current clinical records. Historical medical records and completed encounters are preserved."
        : "Your general ongoing access to this patient's current clinical records will end. Historical encounter records are preserved.",
      [
        { text: "Keep Connection", style: "cancel" },
        {
          text: "Remove Connection",
          style: "destructive",
          onPress: async () => {
            try {
              setBusyId(item.id);
              await revokeConnection(item.id);
              await load();
            } catch (err: any) {
              Alert.alert("Unable to remove", err?.message || "Please try again.");
            } finally {
              setBusyId("");
            }
          },
        },
      ]
    );
  };

  const blockItem = (item: Connection) => {
    Alert.alert(
      "Block care connection?",
      "The relationship will be unavailable until you unblock it.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            try {
              setBusyId(item.id);
              await blockConnection(item.id);
              await load();
            } catch (err: any) {
              Alert.alert("Unable to block", err?.message || "Please try again.");
            } finally {
              setBusyId("");
            }
          },
        },
      ]
    );
  };

  const unblockItem = async (item: Connection) => {
    try {
      setBusyId(item.id);
      await unblockConnection(item.id);
      await load();
    } catch (err: any) {
      Alert.alert("Unable to unblock", err?.message || "Only the account that created the block can remove it.");
    } finally {
      setBusyId("");
    }
  };

  if (loading) {
    return (
      <AppShell role={role} title={isPatient ? "My Care Team" : "My Patients"}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.teal800} />
          <Text style={styles.statusText}>Loading care connections...</Text>
        </View>
      </AppShell>
    );
  }

  const accepted = connections.filter((item) => item.status === "accepted");

  return (
    <AppShell
      role={role}
      title={isPatient ? "My Care Team" : "My Patients"}
      subtitle={isPatient ? (t("connectedClinicians") || "Verified doctors you have approved") : (t("connectedPatients") || "Patients who approved your clinical access")}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.teal800} />}
      >
        <View style={styles.headerGroup}>
          <Text style={styles.eyebrow}>CARE RELATIONSHIPS</Text>
          <Text style={styles.title}>{isPatient ? "My Care Team" : "My Patients"}</Text>
          <Text style={styles.subtitle}>
            {isPatient
              ? "Only verified doctors can connect. You stay in control of ongoing clinical access."
              : "Search only basic patient identity first. Clinical records unlock only after the patient accepts your request."}
          </Text>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => void search()}
            placeholder={isPatient ? "Find verified doctors by name or specialty" : "Find patients by name or username"}
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            style={styles.searchInput}
            accessibilityLabel={isPatient ? "Search verified doctors" : "Search patient directory"}
          />
          <TouchableOpacity style={styles.searchButton} onPress={() => void search()} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Search directory">
            {searching ? <ActivityIndicator color={colors.white} /> : <Ionicons name="search" size={20} color={colors.white} />}
          </TouchableOpacity>
        </View>

        {error ? <View style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text></View> : null}

        <Text style={styles.sectionHeaderTitle}>{isPatient ? `My Care Team (${accepted.length})` : `Connected Patients (${accepted.length})`}</Text>
        {accepted.length ? accepted.map((item) => (
          <Card key={item.id} style={styles.connectionCard}>
            <View style={styles.cardRow}>
              <IconContainer name={isPatient ? "medical-outline" : "person-outline"} size={24} color={colors.teal800} backgroundColor={colors.teal100} />
              <View style={styles.cardBody}>
                <View style={styles.nameLine}>
                  <Text style={styles.personName}>{item.person.name || item.person.username || "User"}</Text>
                  {isPatient && item.person.verified ? <View style={styles.verifiedPill}><Ionicons name="checkmark-circle" size={14} color={colors.success} /><Text style={styles.verifiedText}>Verified</Text></View> : null}
                </View>
                <Text style={styles.personSub}>{isPatient ? item.person.specialization || "Ophthalmologist" : `@${item.person.username || "patient"}`}</Text>
                <Text style={styles.metaText}>Connected since: {formatDate(item.connectedSince)}</Text>
                {!isPatient ? (
                  <Text style={styles.metaText}>
                    Last visit: {item.lastVisit ? formatDate(item.lastVisit) : "None"}  •  Next: {item.nextAppointment ? formatDate(item.nextAppointment) : "None"}
                  </Text>
                ) : item.person.hospital ? <Text style={styles.metaText}>{item.person.hospital}</Text> : null}
              </View>
              <StatusBadge status="Confirmed" label="Connected" size="sm" />
            </View>

            <View style={styles.cardActions}>
              {isPatient ? (
                <>
                  <Button title="View Profile" variant="outline" size="sm" icon="person-outline" onPress={() => router.push(`/doctor-profile?id=${item.doctorId}` as any)} />
                  <Button title="Book" size="sm" icon="calendar-outline" onPress={() => router.push({ pathname: "/book-appointment", params: { doctorId: item.doctorId } } as any)} />
                </>
              ) : (
                <>
                  <Button title="Open Patient" size="sm" icon="folder-open-outline" onPress={() => router.push({ pathname: "/doctor/patient-profile", params: { patientId: item.patientId } } as any)} />
                  <Button title="☆ Add to Watchlist" variant="outline" size="sm" icon="bookmark-outline" onPress={() => router.push({ pathname: "/doctor/watchlist", params: { patientId: item.patientId } } as any)} />
                </>
              )}
              <Button title="Remove" variant="ghost" size="sm" icon="unlink-outline" onPress={() => removeAccepted(item)} disabled={busyId === item.id} />
            </View>
          </Card>
        )) : (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{isPatient ? "No doctors in your care team yet" : "No connected patients yet"}</Text>
            <Text style={styles.emptyText}>{isPatient ? "Search above and send a request to a verified doctor." : "Search above and send a care request. The patient must approve it before clinical access begins."}</Text>
          </Card>
        )}

        {incoming.length ? (
          <>
            <Text style={styles.sectionHeaderTitle}>Incoming Requests ({incoming.length})</Text>
            {incoming.map((item) => (
              <Card key={item.id} style={styles.connectionCard}>
                <View style={styles.cardRow}>
                  <IconContainer name="person-add-outline" size={22} color={colors.warning} backgroundColor={colors.warningBg} />
                  <View style={styles.cardBody}>
                    <View style={styles.nameLine}>
                      <Text style={styles.personName}>{item.person.name || "User"}</Text>
                      {item.person.role === "Doctor" && item.person.verified ? <View style={styles.verifiedPill}><Ionicons name="checkmark-circle" size={14} color={colors.success} /><Text style={styles.verifiedText}>Verified</Text></View> : null}
                    </View>
                    <Text style={styles.personSub}>{item.person.role === "Doctor" ? item.person.specialization || "Doctor" : "Patient"}</Text>
                    <Text style={styles.metaText}>Accepting enables the formal care relationship.</Text>
                  </View>
                </View>
                <View style={styles.cardActions}>
                  <Button title={busyId === item.id ? "Working..." : "Accept"} size="sm" onPress={() => void respond(item, "accept")} disabled={busyId === item.id} />
                  <Button title="Decline" variant="outline" size="sm" onPress={() => void respond(item, "decline")} disabled={busyId === item.id} />
                  <Button title="Block" variant="ghost" size="sm" onPress={() => blockItem(item)} disabled={busyId === item.id} />
                </View>
              </Card>
            ))}
          </>
        ) : null}

        {outgoing.length ? (
          <>
            <Text style={styles.sectionHeaderTitle}>Outgoing Requests ({outgoing.length})</Text>
            {outgoing.map((item) => (
              <Card key={item.id} style={styles.connectionCard}>
                <View style={styles.cardRow}>
                  <IconContainer name="time-outline" size={22} color={colors.info} backgroundColor={colors.infoBg} />
                  <View style={styles.cardBody}>
                    <Text style={styles.personName}>{item.person.name || "User"}</Text>
                    <Text style={styles.personSub}>Waiting for approval</Text>
                  </View>
                  <StatusBadge status="Pending" size="sm" />
                </View>
                <View style={styles.cardActions}>
                  <Button title="Cancel Request" variant="outline" size="sm" onPress={() => cancelOutgoing(item)} disabled={busyId === item.id} />
                </View>
              </Card>
            ))}
          </>
        ) : null}

        {blocked.length ? (
          <>
            <Text style={styles.sectionHeaderTitle}>Blocked Relationships ({blocked.length})</Text>
            {blocked.map((item) => {
              const canUnblock = item.blockedBy && item.blockedBy === (isPatient ? item.patientId : item.doctorId);
              return (
                <Card key={item.id} style={styles.connectionCard}>
                  <View style={styles.cardRow}>
                    <IconContainer name="ban-outline" size={22} color={colors.error} backgroundColor={colors.errorBg} />
                    <View style={styles.cardBody}>
                      <Text style={styles.personName}>{item.person.name || "User"}</Text>
                      <Text style={styles.personSub}>Connection blocked</Text>
                    </View>
                    {canUnblock ? <Button title="Unblock" variant="outline" size="sm" onPress={() => void unblockItem(item)} disabled={busyId === item.id} /> : null}
                  </View>
                </Card>
              );
            })}
          </>
        ) : null}

        {people.length ? (
          <>
            <Text style={styles.sectionHeaderTitle}>Directory Results</Text>
            {people.map((person) => {
              const status = person.connectionStatus;
              const disabled = busyId === person.id || status === "pending" || status === "accepted" || status === "blocked";
              const buttonTitle = status === "accepted" ? "Connected" : status === "pending" ? "Pending" : status === "blocked" ? "Blocked" : "Connect";
              return (
                <Card key={person.id} style={styles.connectionCard}>
                  <View style={styles.cardRow}>
                    <IconContainer name={person.role === "Doctor" ? "medical-outline" : "person-outline"} size={22} color={colors.teal800} backgroundColor={colors.teal50} />
                    <View style={styles.cardBody}>
                      <View style={styles.nameLine}>
                        <Text style={styles.personName}>{person.name || person.username || "User"}</Text>
                        {person.role === "Doctor" && person.verified ? <View style={styles.verifiedPill}><Ionicons name="checkmark-circle" size={14} color={colors.success} /><Text style={styles.verifiedText}>Verified</Text></View> : null}
                      </View>
                      <Text style={styles.personSub}>{person.role === "Doctor" ? person.specialization || "Ophthalmologist" : `@${person.username || "patient"}`}</Text>
                      {person.role === "Doctor" && person.hospital ? <Text style={styles.metaText}>{person.hospital}</Text> : null}
                      {person.role === "Patient" ? <Text style={styles.metaText}>{[person.age ? `Age ${person.age}` : "", person.city || ""].filter(Boolean).join(" • ") || "Basic directory identity only"}</Text> : null}
                    </View>
                    <Button title={busyId === person.id ? "Working..." : buttonTitle} size="sm" onPress={() => void sendRequest(person)} disabled={disabled} />
                  </View>
                  {isPatient && person.role === "Doctor" ? (
                    <TouchableOpacity style={styles.profileLink} onPress={() => router.push(`/doctor-profile?id=${person.id}` as any)}>
                      <Text style={styles.profileLinkText}>View verified profile</Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.teal800} />
                    </TouchableOpacity>
                  ) : null}
                </Card>
              );
            })}
          </>
        ) : null}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl + 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  statusText: { marginTop: spacing.md, color: colors.textSecondary, fontSize: typography.sizes.body },
  headerGroup: { marginBottom: spacing.lg },
  eyebrow: { color: colors.teal800, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, letterSpacing: 1.2, marginBottom: 2 },
  title: { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.bold },
  subtitle: { color: colors.textSecondary, fontSize: typography.sizes.body, marginTop: 4, lineHeight: 22 },
  searchRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  searchInput: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, color: colors.textPrimary, paddingHorizontal: spacing.md, fontSize: typography.sizes.small },
  searchButton: { width: 48, height: 48, borderRadius: radius.md, marginLeft: spacing.sm, alignItems: "center", justifyContent: "center", backgroundColor: colors.teal800 },
  errorBanner: { backgroundColor: colors.errorBg, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  errorText: { color: colors.error, fontSize: typography.sizes.small },
  sectionHeaderTitle: { color: colors.textPrimary, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold, marginTop: spacing.lg, marginBottom: spacing.sm },
  connectionCard: { backgroundColor: colors.surface, marginBottom: spacing.sm },
  cardRow: { flexDirection: "row", alignItems: "center" },
  cardBody: { flex: 1, marginLeft: spacing.md, minWidth: 0 },
  nameLine: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  personName: { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.bold },
  personSub: { color: colors.teal800, fontSize: typography.sizes.xs, marginTop: 3 },
  metaText: { color: colors.textMuted, fontSize: typography.sizes.xs, marginTop: 3 },
  verifiedPill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.successBg },
  verifiedText: { color: colors.success, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold },
  cardActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.md, justifyContent: "flex-end" },
  emptyCard: { backgroundColor: colors.surface, alignItems: "center", paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  emptyTitle: { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.bold, textAlign: "center" },
  emptyText: { color: colors.textSecondary, fontSize: typography.sizes.small, textAlign: "center", marginTop: 4 },
  profileLink: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: spacing.sm },
  profileLinkText: { color: colors.teal800, fontSize: typography.sizes.xs, fontWeight: typography.weights.bold },
});
