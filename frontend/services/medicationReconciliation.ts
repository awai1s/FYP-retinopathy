import BASE_URL from "./api";
import { getToken } from "./storage";

export type ReconciliationActionType = "confirmed" | "changed" | "stopped" | "started";

export interface ReconciliationMedication {
  id: string;
  patientId?: string;
  doctorId?: string;
  doctorName?: string;
  source?: string;
  medicationDetails: string;
  dosage?: string;
  times?: string[];
  intakeInstruction?: string;
  instructions?: string;
  notes?: string;
  active?: boolean;
  startedAt?: string;
  stoppedAt?: string | null;
  reconciliationStatus?: string;
  previousPrescriptionId?: string | null;
}

export interface ReconciliationAction {
  actionId: string;
  action: ReconciliationActionType;
  prescriptionId?: string | null;
  newPrescriptionId?: string | null;
  medicationDetails?: string;
  newMedicationDetails?: string;
  reason?: string;
  performedAt?: string;
}

export interface MedicationReconciliation {
  id: string;
  encounterId: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  status: "in_progress" | "completed" | string;
  actions: ReconciliationAction[];
  notes: string;
  startedAt?: string | null;
  performedAt?: string | null;
  medications: ReconciliationMedication[];
}

export interface MedicationPlanInput {
  medicationDetails: string;
  dosage?: string;
  times?: string[];
  intakeInstruction?: string;
  instructions?: string;
  notes?: string;
}

const request = async (path: string, init: RequestInit = {}) => {
  const token = await getToken();
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.message || "Medication reconciliation request failed.");
  return data;
};

export const getMedicationReconciliation = (encounterId: string): Promise<MedicationReconciliation> =>
  request(`/api/medication-reconciliations/encounter/${encodeURIComponent(encounterId)}`);

export const applyMedicationReconciliationAction = (
  encounterId: string,
  payload: {
    actionId: string;
    action: ReconciliationActionType;
    prescriptionId?: string;
    reason?: string;
    medication?: MedicationPlanInput;
  }
): Promise<MedicationReconciliation> =>
  request(`/api/medication-reconciliations/encounter/${encodeURIComponent(encounterId)}/actions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const completeMedicationReconciliation = (
  encounterId: string,
  notes: string
): Promise<MedicationReconciliation> =>
  request(`/api/medication-reconciliations/encounter/${encodeURIComponent(encounterId)}/complete`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
