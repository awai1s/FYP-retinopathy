import BASE_URL from "./api";
import { getToken } from "./storage";

export type EncounterStatus = "draft" | "in_progress" | "completed";
export type FindingSeverity = "Not specified" | "Mild" | "Moderate" | "Severe";
export type EyeSide = "Not specified" | "Right" | "Left" | "Both";
export type NextActionType =
  | ""
  | "none"
  | "follow_up"
  | "new_screening"
  | "referral"
  | "medication_change"
  | "further_investigation";

export interface EncounterFinding {
  finding: string;
  severity: FindingSeverity;
  eye: EyeSide;
  note: string;
}

export interface EncounterObservation {
  observation: string;
  clinicalNote: string;
  recordedAt?: string;
  doctorId?: string;
  doctorName?: string;
}

export interface EncounterProcedure {
  procedureType: string;
  procedureCode?: string;
  outcome: string;
  notes: string;
}

export interface MedicationReview {
  reviewed: boolean;
  notes: string;
}

export interface MedicationReconciliationSummary {
  id: string;
  status: string;
  notes: string;
  performedAt?: string | null;
  actions: Array<{
    action: string;
    medicationDetails?: string;
    newMedicationDetails?: string;
    reason?: string;
    performedAt?: string | null;
  }>;
}

export interface EducationAssignment {
  topicKey: string;
  title: string;
}

export interface NextAction {
  type: NextActionType;
  details: string;
}

export interface FollowUpDecision {
  required: boolean;
  dueDate: string;
  reason: string;
}

export interface EncounterAddendum {
  id: string;
  encounterId: string;
  doctorId: string;
  doctorName: string;
  text: string;
  createdAt?: string | null;
}

export interface PatientContext {
  latestScreening?: {
    id: string;
    stage: string;
    confidence?: unknown;
    riskScore?: unknown;
    date?: string | null;
  } | null;
  latestHbA1c?: { value: unknown; date?: string | null } | null;
  activeMedicationCount?: number;
  activeMedications?: Array<{
    id: string;
    medicationDetails: string;
    dosage?: string;
    instructions?: string;
    source?: string;
    doctorName?: string;
  }>;
  recentReportCount?: number;
  recentReports?: Array<{ id: string; title: string; date?: string | null; kind?: string }>;
  lastConsultation?: {
    id: string;
    doctorName: string;
    reason: string;
    date?: string | null;
  } | null;
}

export interface ClinicalEncounter {
  id: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  hospitalId?: string;
  hospitalName?: string;
  reasonForVisit: string;
  status: EncounterStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  findings: EncounterFinding[];
  observations: EncounterObservation[];
  procedures: EncounterProcedure[];
  clinicalNotes: string;
  medicationReconciliationId?: string | null;
  medicationReview: MedicationReview;
  medicationReconciliation?: MedicationReconciliationSummary | null;
  educationAssignments: EducationAssignment[];
  nextAction: NextAction;
  patientInstructions: string;
  followUp: FollowUpDecision;
  revision: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  patientContext?: PatientContext;
  addenda?: EncounterAddendum[];
}

export interface PatientVisitSummary {
  id: string;
  appointmentId: string;
  doctorId: string;
  doctorName: string;
  hospitalId?: string;
  hospitalName?: string;
  reasonForVisit: string;
  status: EncounterStatus;
  completedAt?: string | null;
  patientInstructions: string;
  nextAction: NextAction;
  followUp: FollowUpDecision;
  educationAssignments: EducationAssignment[];
  medicationReview: MedicationReview;
  medicationReconciliation?: MedicationReconciliationSummary | null;
  procedures: EncounterProcedure[];
  addenda?: EncounterAddendum[];
}

export interface EducationOption {
  key: string;
  title: string;
  description: string;
}

export interface EncounterUpdatePayload {
  hospitalId?: string;
  findings?: EncounterFinding[];
  observations?: EncounterObservation[];
  procedures?: EncounterProcedure[];
  clinicalNotes?: string;
  medicationReview?: MedicationReview;
  educationTopicKeys?: string[];
  nextAction?: NextAction;
  patientInstructions?: string;
  followUp?: FollowUpDecision;
}

const headers = async () => {
  const token = await getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const request = async (path: string, init: RequestInit = {}) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...(await headers()), ...(init.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.message || "Consultation request failed.");
  return data;
};

export const startConsultation = (appointmentId: string): Promise<ClinicalEncounter> =>
  request(`/api/consultations/from-appointment/${encodeURIComponent(appointmentId)}`, { method: "POST" });

export const getConsultation = (encounterId: string): Promise<ClinicalEncounter | PatientVisitSummary> =>
  request(`/api/consultations/${encodeURIComponent(encounterId)}`);

export const getDoctorConsultations = async (status?: EncounterStatus): Promise<ClinicalEncounter[]> => {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const data = await request(`/api/consultations/doctor${query}`);
  return Array.isArray(data.consultations) ? data.consultations : [];
};

export const getPatientConsultations = async (): Promise<PatientVisitSummary[]> => {
  const data = await request("/api/consultations/patient");
  return Array.isArray(data.consultations) ? data.consultations : [];
};

export const getConsultationEducationOptions = async (): Promise<EducationOption[]> => {
  const data = await request("/api/consultations/education-options");
  return Array.isArray(data.topics) ? data.topics : [];
};

export const saveConsultation = (encounterId: string, payload: EncounterUpdatePayload): Promise<ClinicalEncounter> =>
  request(`/api/consultations/${encodeURIComponent(encounterId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const completeConsultation = (encounterId: string): Promise<ClinicalEncounter> =>
  request(`/api/consultations/${encodeURIComponent(encounterId)}/complete`, { method: "POST" });

export const addConsultationAddendum = (encounterId: string, text: string): Promise<EncounterAddendum> =>
  request(`/api/consultations/${encodeURIComponent(encounterId)}/addenda`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
