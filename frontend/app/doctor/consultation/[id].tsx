import { Alert } from "../../../services/alert";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import AppShell from "../../../design/components/AppShell";
import Card from "../../../design/components/card";
import Button from "../../../design/components/Button";
import StatusBadge from "../../../design/components/StatusBadge";
import IconContainer from "../../../design/components/IconContainer";
import colors from "../../../design/tokens/colors";
import spacing from "../../../design/tokens/spacing";
import typography from "../../../design/tokens/typography";
import radius from "../../../design/tokens/radius";
import { useThemeRefresh } from "../../../providers/AppThemeProvider";
import {
  addConsultationAddendum,
  ClinicalEncounter,
  completeConsultation,
  EducationOption,
  EncounterFinding,
  EncounterObservation,
  EncounterProcedure,
  EyeSide,
  FindingSeverity,
  getConsultation,
  getConsultationEducationOptions,
  NextActionType,
  saveConsultation,
} from "../../../services/consultations";
import { getDoctorHospitalAffiliations, type HospitalDoctorAffiliation } from "../../../services/credentialsPrivileges";

const nextActions: Array<{ value: NextActionType; label: string }> = [
  { value: "none", label: "No immediate action" },
  { value: "follow_up", label: "Follow-up" },
  { value: "new_screening", label: "New screening" },
  { value: "referral", label: "Referral" },
  { value: "medication_change", label: "Medication change" },
  { value: "further_investigation", label: "Further investigation" },
];

const procedureOptions = [
  { code: "retinal_examination", label: "Retinal Examination" },
  { code: "fundus_image_review", label: "Fundus Image Review" },
  { code: "oct_review", label: "OCT Review" },
  { code: "laser_procedure", label: "Laser Procedure" },
  { code: "surgical_procedure", label: "Surgical Procedure" },
  { code: "", label: "Other / Documentation Only" },
] as const;


const formatDateTime = (value?: string | null) => {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const formatShortDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

function ChoiceChips<T extends string>({
  values,
  value,
  onChange,
  disabled,
}: {
  values: readonly T[];
  value: T;
  onChange: (next: T) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.chipRow}>
      {values.map((item) => (
        <TouchableOpacity
          key={item}
          disabled={disabled}
          onPress={() => onChange(item)}
          style={[styles.chip, value === item && styles.chipActive, disabled && styles.disabled]}
          accessibilityRole="button"
          accessibilityState={{ selected: value === item, disabled }}
        >
          <Text style={[styles.chipText, value === item && styles.chipTextActive]}>{item}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function ConsultationCockpitScreen() {
  useThemeRefresh();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const encounterId = Array.isArray(params.id) ? params.id[0] : params.id || "";

  const [encounter, setEncounter] = useState<ClinicalEncounter | null>(null);
  const [educationOptions, setEducationOptions] = useState<EducationOption[]>([]);
  const [affiliations, setAffiliations] = useState<HospitalDoctorAffiliation[]>([]);
  const [hospitalId, setHospitalId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const hydrated = useRef(false);
  const saveSequence = useRef(0);

  const [findings, setFindings] = useState<EncounterFinding[]>([]);
  const [observations, setObservations] = useState<EncounterObservation[]>([]);
  const [procedures, setProcedures] = useState<EncounterProcedure[]>([]);
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [patientInstructions, setPatientInstructions] = useState("");
  const [medReviewed, setMedReviewed] = useState(false);
  const [medNotes, setMedNotes] = useState("");
  const [selectedEducation, setSelectedEducation] = useState<string[]>([]);
  const [nextAction, setNextAction] = useState<NextActionType>("");
  const [nextActionDetails, setNextActionDetails] = useState("");
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpReason, setFollowUpReason] = useState("");

  const [findingText, setFindingText] = useState("");
  const [findingSeverity, setFindingSeverity] = useState<FindingSeverity>("Not specified");
  const [findingEye, setFindingEye] = useState<EyeSide>("Not specified");
  const [findingNote, setFindingNote] = useState("");
  const [observationText, setObservationText] = useState("");
  const [observationNote, setObservationNote] = useState("");
  const [procedureType, setProcedureType] = useState("");
  const [procedureCode, setProcedureCode] = useState("");
  const [procedureOutcome, setProcedureOutcome] = useState("");
  const [procedureNotes, setProcedureNotes] = useState("");
  const [addendumText, setAddendumText] = useState("");
  const [addingAddendum, setAddingAddendum] = useState(false);

  const readOnly = encounter?.status === "completed";

  const hydrate = useCallback((item: ClinicalEncounter) => {
    hydrated.current = false;
    setEncounter(item);
    setFindings(item.findings || []);
    setObservations(item.observations || []);
    setProcedures(item.procedures || []);
    setHospitalId(item.hospitalId || "");
    setClinicalNotes(item.clinicalNotes || "");
    setPatientInstructions(item.patientInstructions || "");
    setMedReviewed(Boolean(item.medicationReview?.reviewed));
    setMedNotes(item.medicationReview?.notes || "");
    setSelectedEducation((item.educationAssignments || []).map((entry) => entry.topicKey));
    setNextAction(item.nextAction?.type || "");
    setNextActionDetails(item.nextAction?.details || "");
    setFollowUpRequired(Boolean(item.followUp?.required));
    setFollowUpDate(item.followUp?.dueDate || "");
    setFollowUpReason(item.followUp?.reason || "");
    setDirty(false);
    setTimeout(() => { hydrated.current = true; }, 0);
  }, []);

  const load = useCallback(async () => {
    if (!encounterId) {
      setError("Consultation ID is missing.");
      setLoading(false);
      return;
    }
    try {
      setError("");
      const [consultation, topics, hospitalAffiliations] = await Promise.all([
        getConsultation(encounterId),
        getConsultationEducationOptions(),
        getDoctorHospitalAffiliations(),
      ]);
      hydrate(consultation as ClinicalEncounter);
      setEducationOptions(topics);
      setAffiliations(hospitalAffiliations.filter((item) => item.status === "active"));
    } catch (err: any) {
      setError(err?.message || "Unable to load consultation.");
    } finally {
      setLoading(false);
    }
  }, [encounterId, hydrate]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const markDirty = () => {
    if (hydrated.current && !readOnly) setDirty(true);
  };

  const payload = useMemo(() => ({
    hospitalId,
    findings,
    observations,
    procedures,
    clinicalNotes,
    medicationReview: { reviewed: medReviewed, notes: medNotes },
    educationTopicKeys: selectedEducation,
    nextAction: { type: nextAction, details: nextActionDetails },
    patientInstructions,
    followUp: { required: followUpRequired, dueDate: followUpDate, reason: followUpReason },
  }), [hospitalId, findings, observations, procedures, clinicalNotes, medReviewed, medNotes, selectedEducation, nextAction, nextActionDetails, patientInstructions, followUpRequired, followUpDate, followUpReason]);

  const saveNow = useCallback(async () => {
    if (!encounterId || readOnly) return encounter;
    const sequence = ++saveSequence.current;
    setSaving(true);
    try {
      const saved = await saveConsultation(encounterId, payload);
      if (sequence === saveSequence.current) {
        setEncounter((current) => current ? { ...saved, patientContext: saved.patientContext || current.patientContext } : saved);
        setDirty(false);
        setSavedAt(new Date().toISOString());
      }
      return saved;
    } catch (err: any) {
      setError(err?.message || "Autosave failed. Your changes are still on this screen.");
      throw err;
    } finally {
      if (sequence === saveSequence.current) setSaving(false);
    }
  }, [encounterId, encounter, payload, readOnly]);

  useEffect(() => {
    if (!dirty || readOnly || !hydrated.current) return;
    const timer = setTimeout(() => { void saveNow().catch(() => undefined); }, 900);
    return () => clearTimeout(timer);
  }, [dirty, readOnly, saveNow]);

  const updateField = <T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: NoInfer<T>) => {
    setter(value);
    markDirty();
  };

  const addFinding = () => {
    if (!findingText.trim()) return;
    setFindings((items) => [...items, {
      finding: findingText.trim(), severity: findingSeverity, eye: findingEye, note: findingNote.trim(),
    }]);
    setFindingText(""); setFindingNote(""); setFindingSeverity("Not specified"); setFindingEye("Not specified"); markDirty();
  };

  const addObservation = () => {
    if (!observationText.trim()) return;
    setObservations((items) => [...items, {
      observation: observationText.trim(),
      clinicalNote: observationNote.trim(),
      recordedAt: new Date().toISOString(),
      doctorId: encounter?.doctorId || "",
      doctorName: encounter?.doctorName || "Doctor",
    }]);
    setObservationText(""); setObservationNote(""); markDirty();
  };

  const addProcedure = () => {
    if (!procedureType.trim()) return;
    setProcedures((items) => [...items, { procedureType: procedureType.trim(), procedureCode, outcome: procedureOutcome.trim(), notes: procedureNotes.trim() }]);
    setProcedureType(""); setProcedureCode(""); setProcedureOutcome(""); setProcedureNotes(""); markDirty();
  };

  const selectedAffiliation = affiliations.find((item) => item.hospitalId === hospitalId);
  const activePrivilegeCodes = new Set((selectedAffiliation?.privileges || []).filter((item) => item.status === "active").map((item) => item.code));
  const hasGeneralHospitalPrivilege = !hospitalId || activePrivilegeCodes.has("general_eye_consultation");
  const canUseProcedure = (code: string) => !code || (Boolean(hospitalId) && activePrivilegeCodes.has(code) && hasGeneralHospitalPrivilege);

  const removeAt = <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>, index: number) => {
    setter((items) => items.filter((_, itemIndex) => itemIndex !== index));
    markDirty();
  };

  const toggleEducation = (key: string) => {
    setSelectedEducation((items) => items.includes(key) ? items.filter((item) => item !== key) : [...items, key]);
    markDirty();
  };

  const selectAction = (value: NextActionType) => {
    setNextAction(value);
    if (value === "follow_up") setFollowUpRequired(true);
    markDirty();
  };

  const completionMissing = useMemo(() => {
    const missing: string[] = [];
    if (!clinicalNotes.trim()) missing.push("Clinical notes");
    if (!medReviewed) missing.push("Medication reviewed");
    if (!patientInstructions.trim()) missing.push("Patient instructions");
    if (!nextAction) missing.push("Next action / follow-up decision");
    if ((nextAction === "follow_up" || followUpRequired) && !followUpDate.trim()) missing.push("Follow-up date");
    if ((nextAction === "follow_up" || followUpRequired) && !followUpReason.trim()) missing.push("Follow-up reason");
    return missing;
  }, [clinicalNotes, medReviewed, patientInstructions, nextAction, followUpRequired, followUpDate, followUpReason]);

  const requestComplete = async () => {
    try {
      await saveNow();
    } catch {
      Alert.alert("Save required", "The consultation could not be saved. Please retry before completing the visit.");
      return;
    }
    if (completionMissing.length) {
      Alert.alert("Consultation checklist", `Complete these items first:\n\n• ${completionMissing.join("\n• ")}`);
      return;
    }
    Alert.alert(
      "Complete this visit?",
      "The completed encounter becomes read-only. Later corrections must be added as an addendum.",
      [
        { text: "Keep Editing", style: "cancel" },
        {
          text: "Complete Visit",
          onPress: async () => {
            setCompleting(true);
            try {
              const completed = await completeConsultation(encounterId);
              hydrate(completed);
              Alert.alert("Visit completed", "The appointment, visit history and patient summary were updated.");
            } catch (err: any) {
              Alert.alert("Unable to complete visit", err?.message || "Please try again.");
            } finally { setCompleting(false); }
          },
        },
      ]
    );
  };

  const submitAddendum = async () => {
    if (!addendumText.trim()) return;
    setAddingAddendum(true);
    try {
      await addConsultationAddendum(encounterId, addendumText.trim());
      setAddendumText("");
      const refreshed = await getConsultation(encounterId);
      hydrate(refreshed as ClinicalEncounter);
    } catch (err: any) {
      Alert.alert("Unable to add addendum", err?.message || "Please try again.");
    } finally { setAddingAddendum(false); }
  };

  if (loading) {
    return <AppShell role="Doctor" title="Consultation Cockpit" showBack onBackPress={() => router.back()}><View style={styles.center}><ActivityIndicator size="large" color={colors.teal800} /><Text style={styles.muted}>Loading consultation...</Text></View></AppShell>;
  }

  if (!encounter || error && !encounter) {
    return <AppShell role="Doctor" title="Consultation Cockpit" showBack onBackPress={() => router.back()}><Card><Text style={styles.errorText}>{error || "Consultation not found."}</Text><Button title="Back to Appointments" onPress={() => router.replace("/doctor/appointments" as any)} style={styles.topGap} /></Card></AppShell>;
  }

  const context = encounter.patientContext;
  const draftFound = !readOnly && encounter.revision > 0;

  return (
    <AppShell role="Doctor" title="Consultation Cockpit" showBack onBackPress={() => router.back()}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? <View style={styles.errorBanner}><Ionicons name="warning-outline" size={18} color={colors.error} /><Text style={styles.errorText}>{error}</Text></View> : null}
        {draftFound ? <View style={styles.draftBanner}><Ionicons name="cloud-done-outline" size={20} color={colors.teal800} /><View style={styles.flex}><Text style={styles.draftTitle}>Consultation Draft Found</Text><Text style={styles.smallMuted}>Your previous work was restored. Continue consultation from where you left off.</Text></View></View> : null}

        <View style={styles.headerRow}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>CONSULTATION</Text>
            <Text style={styles.pageTitle}>{encounter.patientName}</Text>
            <Text style={styles.subtitle}>Visit started: {formatDateTime(encounter.startedAt)}</Text>
          </View>
          <StatusBadge status={readOnly ? "Completed" : "Processing"} label={readOnly ? "Completed" : "In Progress"} size="sm" />
        </View>

        <Card variant="accent" style={styles.reasonCard}>
          <Text style={styles.label}>REASON FOR VISIT</Text>
          <Text style={styles.valueText}>{encounter.reasonForVisit || "No reason recorded"}</Text>
        </Card>

        <Text style={styles.sectionTitle}>Recent Clinical Information</Text>
        <View style={styles.statGrid}>
          <Card style={styles.statCard}><Text style={styles.statLabel}>Latest Screening</Text><Text style={styles.statValue}>{context?.latestScreening?.stage || "No completed screening"}</Text><Text style={styles.statMeta}>{formatShortDate(context?.latestScreening?.date)}</Text></Card>
          <Card style={styles.statCard}><Text style={styles.statLabel}>Latest HbA1c</Text><Text style={styles.statValue}>{String(context?.latestHbA1c?.value ?? "—")}</Text><Text style={styles.statMeta}>{formatShortDate(context?.latestHbA1c?.date)}</Text></Card>
          <Card style={styles.statCard}><Text style={styles.statLabel}>Current Medication</Text><Text style={styles.statValue}>{context?.activeMedicationCount ?? 0} active</Text><Text style={styles.statMeta}>Live medication record</Text></Card>
          <Card style={styles.statCard}><Text style={styles.statLabel}>Recent Reports</Text><Text style={styles.statValue}>{context?.recentReportCount ?? 0}</Text><Text style={styles.statMeta}>Available reports</Text></Card>
        </View>
        {context?.lastConsultation ? <Card style={styles.lastVisitCard}><IconContainer name="time-outline" size={20} color={colors.teal800} backgroundColor={colors.teal50} /><View style={styles.cardBody}><Text style={styles.label}>LAST CONSULTATION</Text><Text style={styles.valueText}>{context.lastConsultation.reason || "Previous consultation"}</Text><Text style={styles.smallMuted}>{context.lastConsultation.doctorName} · {formatShortDate(context.lastConsultation.date)}</Text></View></Card> : null}

        <Text style={styles.sectionTitle}>Today's Consultation</Text>

        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}><Text style={styles.cardTitle}>Findings</Text><Text style={styles.countText}>{findings.length}</Text></View>
          {findings.map((item, index) => <View key={`${item.finding}-${index}`} style={styles.recordRow}><View style={styles.flex}><Text style={styles.recordTitle}>{item.finding}</Text><Text style={styles.smallMuted}>{item.severity} · {item.eye} eye{item.note ? ` · ${item.note}` : ""}</Text></View>{!readOnly ? <TouchableOpacity onPress={() => removeAt(setFindings, index)}><Ionicons name="trash-outline" size={20} color={colors.error} /></TouchableOpacity> : null}</View>)}
          {!readOnly ? <>
            <TextInput value={findingText} onChangeText={setFindingText} placeholder="Finding, e.g. Reduced visual clarity" placeholderTextColor={colors.textMuted} style={styles.input} />
            <Text style={styles.fieldLabel}>Severity</Text><ChoiceChips values={["Not specified", "Mild", "Moderate", "Severe"] as const} value={findingSeverity} onChange={setFindingSeverity} />
            <Text style={styles.fieldLabel}>Eye</Text><ChoiceChips values={["Not specified", "Right", "Left", "Both"] as const} value={findingEye} onChange={setFindingEye} />
            <TextInput value={findingNote} onChangeText={setFindingNote} placeholder="Optional note" placeholderTextColor={colors.textMuted} style={styles.input} />
            <Button title="Add Finding" icon="add-outline" size="sm" onPress={addFinding} disabled={!findingText.trim()} />
          </> : null}
        </Card>

        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}><Text style={styles.cardTitle}>Observations</Text><Text style={styles.countText}>{observations.length}</Text></View>
          {observations.map((item, index) => <View key={`${item.observation}-${index}`} style={styles.recordRow}><View style={styles.flex}><Text style={styles.recordTitle}>{item.observation}</Text>{item.clinicalNote ? <Text style={styles.smallMuted}>{item.clinicalNote}</Text> : null}<Text style={styles.smallMuted}>{item.doctorName || encounter.doctorName} · {formatDateTime(item.recordedAt)}</Text></View>{!readOnly ? <TouchableOpacity onPress={() => removeAt(setObservations, index)}><Ionicons name="trash-outline" size={20} color={colors.error} /></TouchableOpacity> : null}</View>)}
          {!readOnly ? <><TextInput value={observationText} onChangeText={setObservationText} placeholder="Observation" placeholderTextColor={colors.textMuted} style={styles.input} /><TextInput value={observationNote} onChangeText={setObservationNote} placeholder="Clinical note" placeholderTextColor={colors.textMuted} style={[styles.input, styles.multiline]} multiline /><Button title="Add Observation" icon="add-outline" size="sm" onPress={addObservation} disabled={!observationText.trim()} /></> : null}
        </Card>

        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}><Text style={styles.cardTitle}>Medication Reconciliation</Text>{medReviewed ? <Text style={styles.completeText}>✓ Completed</Text> : <Text style={styles.pendingText}>Review required</Text>}</View>
          {context?.activeMedications?.length ? context.activeMedications.map((med) => <View key={med.id} style={styles.medRow}><Ionicons name="medical-outline" size={18} color={colors.teal800} /><View style={styles.flex}><Text style={styles.recordTitle}>{med.medicationDetails}</Text><Text style={styles.smallMuted}>{[med.dosage, med.instructions].filter(Boolean).join(" · ") || med.source || "Active medication"}</Text></View></View>) : <Text style={styles.smallMuted}>No active medication is recorded.</Text>}
          {medNotes ? <Text style={[styles.smallMuted, { marginTop: spacing.sm }]}>{medNotes}</Text> : null}
          {!readOnly ? <Button title={medReviewed ? "Review Medication Decisions" : "Open Medication Reconciliation"} icon="medical-outline" onPress={() => router.push(`/doctor/medication-reconciliation/${encounterId}` as any)} style={{ marginTop: spacing.md }} /> : null}
          <Text style={styles.infoText}>Confirmed, changed, stopped and newly started medications are recorded without overwriting the old prescription history.</Text>
        </Card>

        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}><Text style={styles.cardTitle}>Hospital Context & Privileges</Text><Ionicons name="business-outline" size={22} color={colors.teal800} /></View>
          <Text style={styles.smallMuted}>Choose a hospital only when this encounter is being documented under that institution. The backend re-checks affiliation, license validity and privileges on every save and again on completion.</Text>
          <View style={styles.chipRow}>
            <TouchableOpacity disabled={readOnly} onPress={() => updateField(setHospitalId, "")} style={[styles.chip, !hospitalId && styles.chipActive]}><Text style={[styles.chipText, !hospitalId && styles.chipTextActive]}>Independent / No Hospital</Text></TouchableOpacity>
            {affiliations.map((item) => <TouchableOpacity key={item.id} disabled={readOnly} onPress={() => updateField(setHospitalId, item.hospitalId)} style={[styles.chip, hospitalId === item.hospitalId && styles.chipActive]}><Text style={[styles.chipText, hospitalId === item.hospitalId && styles.chipTextActive]}>{item.hospitalName}</Text></TouchableOpacity>)}
          </View>
          {hospitalId && !hasGeneralHospitalPrivilege ? <View style={styles.privilegeWarning}><Ionicons name="lock-closed" size={18} color={colors.error} /><Text style={styles.privilegeWarningText}>General Eye Consultation privilege is not active for this hospital. This hospital context cannot be saved until the hospital grants it.</Text></View> : null}
          {selectedAffiliation ? <Text style={styles.infoText}>Hospital role: {selectedAffiliation.position} • {selectedAffiliation.department} • {(selectedAffiliation.privileges || []).filter((item) => item.status === "active").length} active privilege(s)</Text> : null}
        </Card>

        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}><Text style={styles.cardTitle}>Procedures</Text><Text style={styles.countText}>{procedures.length}</Text></View>
          {procedures.map((item, index) => <View key={`${item.procedureType}-${index}`} style={styles.recordRow}><View style={styles.flex}><Text style={styles.recordTitle}>{item.procedureType}</Text><Text style={styles.smallMuted}>{item.procedureCode ? `Hospital privilege: ${item.procedureCode.replace(/_/g, " ")} • ` : ""}{item.outcome || "Outcome not recorded"}{item.notes ? ` · ${item.notes}` : ""}</Text></View>{!readOnly ? <TouchableOpacity onPress={() => removeAt(setProcedures, index)}><Ionicons name="trash-outline" size={20} color={colors.error} /></TouchableOpacity> : null}</View>)}
          {!readOnly ? <>
            <Text style={styles.fieldLabel}>Procedure catalogue</Text>
            <View style={styles.optionList}>{procedureOptions.map((item) => { const allowed = canUseProcedure(item.code); const selected = procedureCode === item.code && procedureType === item.label; return <TouchableOpacity key={item.label} disabled={!allowed && Boolean(item.code)} onPress={() => { setProcedureCode(item.code); setProcedureType(item.code ? item.label : ""); }} style={[styles.actionChoice, selected && styles.actionChoiceActive, !allowed && Boolean(item.code) && styles.disabled]}><Ionicons name={allowed ? (selected ? "radio-button-on" : "radio-button-off") : "lock-closed"} size={19} color={allowed ? (selected ? colors.teal800 : colors.textMuted) : colors.error} /><View style={styles.flex}><Text style={styles.recordTitle}>{item.label}</Text>{item.code && !allowed ? <Text style={styles.smallMuted}>Not authorized in the selected hospital</Text> : null}</View></TouchableOpacity>; })}</View>
            {!procedureCode ? <TextInput value={procedureType} onChangeText={setProcedureType} placeholder="Other procedure / clinical activity" placeholderTextColor={colors.textMuted} style={styles.input} /> : null}
            <TextInput value={procedureOutcome} onChangeText={setProcedureOutcome} placeholder="Result / outcome" placeholderTextColor={colors.textMuted} style={styles.input} />
            <TextInput value={procedureNotes} onChangeText={setProcedureNotes} placeholder="Procedure notes" placeholderTextColor={colors.textMuted} style={[styles.input, styles.multiline]} multiline />
            <Button title="Add Procedure" icon="add-outline" size="sm" onPress={addProcedure} disabled={!procedureType.trim() || Boolean(procedureCode && !canUseProcedure(procedureCode))} />
          </> : null}
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.cardTitle}>Assign Education</Text>
          <Text style={styles.smallMuted}>Selected topics appear in the patient Eye Health Library as Recommended by you after the consultation is completed.</Text>
          <View style={styles.optionList}>{educationOptions.map((topic) => { const selected = selectedEducation.includes(topic.key); return <TouchableOpacity key={topic.key} disabled={readOnly} onPress={() => toggleEducation(topic.key)} style={[styles.educationOption, selected && styles.educationSelected]}><Ionicons name={selected ? "checkbox" : "square-outline"} size={22} color={selected ? colors.teal800 : colors.textMuted} /><View style={styles.flex}><Text style={styles.recordTitle}>{topic.title}</Text><Text style={styles.smallMuted}>{topic.description}</Text></View></TouchableOpacity>; })}</View>
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.cardTitle}>Clinical Notes</Text>
          <TextInput editable={!readOnly} value={clinicalNotes} onChangeText={(value) => updateField(setClinicalNotes, value)} placeholder="Document the clinical encounter..." placeholderTextColor={colors.textMuted} style={[styles.input, styles.notesInput]} multiline />
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.cardTitle}>Patient Instructions</Text>
          <TextInput editable={!readOnly} value={patientInstructions} onChangeText={(value) => updateField(setPatientInstructions, value)} placeholder="Instructions the patient can read in their visit summary..." placeholderTextColor={colors.textMuted} style={[styles.input, styles.notesInput]} multiline />
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.cardTitle}>Next Action</Text>
          <View style={styles.actionChoices}>{nextActions.map((item) => <TouchableOpacity key={item.value} disabled={readOnly} onPress={() => selectAction(item.value)} style={[styles.actionChoice, nextAction === item.value && styles.actionChoiceActive]}><Ionicons name={nextAction === item.value ? "radio-button-on" : "radio-button-off"} size={19} color={nextAction === item.value ? colors.teal800 : colors.textMuted} /><Text style={styles.recordTitle}>{item.label}</Text></TouchableOpacity>)}</View>
          <TextInput editable={!readOnly} value={nextActionDetails} onChangeText={(value) => updateField(setNextActionDetails, value)} placeholder="Optional next-action details" placeholderTextColor={colors.textMuted} style={[styles.input, styles.multiline]} multiline />

          {(nextAction === "follow_up" || followUpRequired || readOnly && encounter.followUp?.required) ? <View style={styles.followBox}>
            {!readOnly ? <TouchableOpacity onPress={() => updateField(setFollowUpRequired, !followUpRequired)} style={styles.reviewToggle}><Ionicons name={followUpRequired ? "checkbox" : "square-outline"} size={22} color={followUpRequired ? colors.teal800 : colors.textMuted} /><Text style={styles.reviewText}>Create follow-up task</Text></TouchableOpacity> : null}
            <Text style={styles.fieldLabel}>Follow-up date (YYYY-MM-DD)</Text><TextInput editable={!readOnly} value={followUpDate} onChangeText={(value) => updateField(setFollowUpDate, value)} placeholder="2026-10-15" placeholderTextColor={colors.textMuted} style={styles.input} />
            <Text style={styles.fieldLabel}>Follow-up reason</Text><TextInput editable={!readOnly} value={followUpReason} onChangeText={(value) => updateField(setFollowUpReason, value)} placeholder="Reason for follow-up" placeholderTextColor={colors.textMuted} style={[styles.input, styles.multiline]} multiline />
          </View> : null}
        </Card>

        {!readOnly ? <Card variant="bordered" style={styles.completionCard}>
          <Text style={styles.cardTitle}>Completion Checklist</Text>
          {[{ label: "Clinical notes completed", ok: Boolean(clinicalNotes.trim()) }, { label: "Medication reviewed", ok: medReviewed }, { label: "Patient instructions added", ok: Boolean(patientInstructions.trim()) }, { label: "Follow-up decision recorded", ok: Boolean(nextAction) }].map((item) => <View key={item.label} style={styles.checkRow}><Ionicons name={item.ok ? "checkmark-circle" : "ellipse-outline"} size={20} color={item.ok ? colors.success : colors.textMuted} /><Text style={styles.checkText}>{item.label}</Text></View>)}
          <View style={styles.footerActions}><Button title={saving ? "Saving..." : "Save Draft"} variant="outline" icon="save-outline" onPress={() => void saveNow().catch((err: any) => Alert.alert("Save failed", err?.message || "Please try again."))} loading={saving} style={styles.flexButton} /><Button title="Complete Visit" icon="checkmark-done-outline" onPress={() => void requestComplete()} loading={completing} disabled={saving} style={styles.flexButton} /></View>
          <Text style={styles.autosaveText}>{saving ? "Autosaving..." : dirty ? "Changes pending autosave" : savedAt ? `Saved ${formatDateTime(savedAt)}` : "Autosave is on"}</Text>
        </Card> : <Card variant="accent" style={styles.completedCard}><View style={styles.completedHeader}><Ionicons name="lock-closed" size={22} color={colors.teal800} /><View style={styles.flex}><Text style={styles.cardTitle}>Completed encounter — read only</Text><Text style={styles.smallMuted}>Completed {formatDateTime(encounter.completedAt)}. Corrections are appended without rewriting the original visit.</Text></View></View></Card>}

        {readOnly ? <Card style={styles.sectionCard}>
          <Text style={styles.cardTitle}>Addenda</Text>
          {(encounter.addenda || []).length ? (encounter.addenda || []).map((item) => <View key={item.id} style={styles.addendum}><Text style={styles.recordTitle}>{item.doctorName}</Text><Text style={styles.valueText}>{item.text}</Text><Text style={styles.smallMuted}>{formatDateTime(item.createdAt)}</Text></View>) : <Text style={styles.smallMuted}>No addenda have been added.</Text>}
          <TextInput value={addendumText} onChangeText={setAddendumText} placeholder="Add a dated correction or clarification..." placeholderTextColor={colors.textMuted} style={[styles.input, styles.notesInput]} multiline />
          <Button title="Add Addendum" icon="add-circle-outline" size="sm" onPress={() => void submitAddendum()} loading={addingAddendum} disabled={!addendumText.trim()} />
        </Card> : null}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl + 60 },
  center: { minHeight: 300, alignItems: "center", justifyContent: "center", gap: spacing.md },
  flex: { flex: 1, minWidth: 0 },
  topGap: { marginTop: spacing.md },
  muted: { color: colors.textSecondary, fontSize: typography.sizes.body },
  errorBanner: { flexDirection: "row", gap: spacing.sm, alignItems: "center", backgroundColor: colors.errorBg, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  errorText: { color: colors.error, fontSize: typography.sizes.small, flex: 1 },
  draftBanner: { flexDirection: "row", gap: spacing.sm, alignItems: "center", backgroundColor: colors.teal50, borderColor: colors.teal200, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  draftTitle: { color: colors.teal800, fontWeight: typography.weights.bold, fontSize: typography.sizes.body },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, marginBottom: spacing.md },
  eyebrow: { color: colors.teal800, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, letterSpacing: 1.2 },
  pageTitle: { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.bold, marginTop: 2 },
  subtitle: { color: colors.textSecondary, fontSize: typography.sizes.small, marginTop: 3 },
  reasonCard: { marginBottom: spacing.md },
  label: { color: colors.teal800, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, letterSpacing: 0.7 },
  valueText: { color: colors.textPrimary, fontSize: typography.sizes.body, marginTop: 3 },
  sectionTitle: { color: colors.textPrimary, fontSize: typography.sizes.h3, fontWeight: typography.weights.bold, marginTop: spacing.lg, marginBottom: spacing.sm },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  statCard: { flexGrow: 1, flexBasis: "46%", minWidth: 150, backgroundColor: colors.surface },
  statLabel: { color: colors.textMuted, fontSize: typography.sizes.xs, fontWeight: typography.weights.medium },
  statValue: { color: colors.textPrimary, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold, marginTop: 4 },
  statMeta: { color: colors.textSecondary, fontSize: typography.sizes.tiny, marginTop: 3 },
  lastVisitCard: { flexDirection: "row", gap: spacing.md, alignItems: "center", marginTop: spacing.sm },
  cardBody: { flex: 1 },
  sectionCard: { marginBottom: spacing.md, backgroundColor: colors.surface },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, marginBottom: spacing.sm },
  cardTitle: { color: colors.textPrimary, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold },
  countText: { color: colors.textMuted, fontSize: typography.sizes.xs },
  recordRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  recordTitle: { color: colors.textPrimary, fontSize: typography.sizes.small, fontWeight: typography.weights.bold },
  smallMuted: { color: colors.textSecondary, fontSize: typography.sizes.xs, marginTop: 2 },
  fieldLabel: { color: colors.textSecondary, fontSize: typography.sizes.xs, fontWeight: typography.weights.bold, marginTop: spacing.sm, marginBottom: 4 },
  input: { minHeight: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: typography.sizes.small, marginVertical: spacing.xs },
  multiline: { minHeight: 78, textAlignVertical: "top" },
  notesInput: { minHeight: 130, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.xs },
  chip: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 7 },
  chipActive: { backgroundColor: colors.teal100, borderColor: colors.teal700 },
  chipText: { color: colors.textSecondary, fontSize: typography.sizes.xs },
  chipTextActive: { color: colors.teal900, fontWeight: typography.weights.bold },
  disabled: { opacity: 0.6 },
  medRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center", paddingVertical: spacing.xs },
  completeText: { color: colors.success, fontSize: typography.sizes.xs, fontWeight: typography.weights.bold },
  pendingText: { color: colors.warning, fontSize: typography.sizes.xs, fontWeight: typography.weights.bold },
  reviewToggle: { flexDirection: "row", gap: spacing.sm, alignItems: "center", paddingVertical: spacing.sm },
  reviewToggleActive: { backgroundColor: colors.successBg, borderRadius: radius.md, paddingHorizontal: spacing.sm },
  reviewText: { color: colors.textPrimary, fontSize: typography.sizes.small, fontWeight: typography.weights.medium },
  infoText: { color: colors.textMuted, fontSize: typography.sizes.tiny, marginTop: spacing.sm, lineHeight: 17 },
  privilegeWarning: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.errorBg, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  privilegeWarningText: { color: colors.error, flex: 1, fontSize: typography.sizes.xs, lineHeight: 17, fontWeight: "700" },
  optionList: { gap: spacing.xs, marginTop: spacing.sm },
  educationOption: { flexDirection: "row", gap: spacing.sm, borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.md, padding: spacing.sm, backgroundColor: colors.surfaceRaised },
  educationSelected: { borderColor: colors.teal700, backgroundColor: colors.teal50 },
  actionChoices: { gap: spacing.xs, marginTop: spacing.sm },
  actionChoice: { flexDirection: "row", gap: spacing.sm, alignItems: "center", borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.md, padding: spacing.sm },
  actionChoiceActive: { backgroundColor: colors.teal50, borderColor: colors.teal700 },
  followBox: { marginTop: spacing.md, backgroundColor: colors.teal50, borderRadius: radius.md, padding: spacing.md },
  completionCard: { marginTop: spacing.md, marginBottom: spacing.md },
  checkRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  checkText: { color: colors.textPrimary, fontSize: typography.sizes.small },
  footerActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg },
  flexButton: { flexGrow: 1, minWidth: 150 },
  autosaveText: { color: colors.textMuted, fontSize: typography.sizes.tiny, marginTop: spacing.sm },
  completedCard: { marginTop: spacing.md, marginBottom: spacing.md },
  completedHeader: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  addendum: { backgroundColor: colors.surfaceRaised, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm, borderWidth: 1, borderColor: colors.borderLight },
});
