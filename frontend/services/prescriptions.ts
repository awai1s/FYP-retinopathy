import BASE_URL from "./api";
import { getToken } from "./storage";
import { isLikelyNetworkError, readOfflineCache, writeOfflineCache } from "./offlineCache";
import { queueMedicationAdherence } from "./syncQueue";

export type MedicationStatus = "Pending" | "Taken" | "Missed" | "Skipped";

export interface Prescription {
  id: string;
  patientId?: string;
  doctorId?: string;
  doctorName?: string;

  medicationDetails: string;
  instructions?: string;
  date?: string;

  source?: "Doctor" | "Patient" | string;
  dosage?: string;
  times?: string[];
  intakeInstruction?: string;
  notes?: string;
  duration?: string;
  durationWeeks?: number;
  startDate?: string;
  endDate?: string;
  active?: boolean;
  stoppedAt?: string | null;
  lifecycleStatus?: "Active" | "Completed" | string;
  remainingDays?: number | null;
  completionReason?: "Changed" | "Stopped" | "Completed" | string | null;
  stoppedReason?: string;
  reconciliationStatus?: string;
  previousPrescriptionId?: string | null;
  replacedByPrescriptionId?: string | null;
}

export interface PrescriptionPayload {
  medicationDetails: string;
  dosage?: string;
  times?: string[];
  intakeInstruction?: string;
  notes?: string;
  duration?: string;
  durationWeeks?: number;
  startDate?: string;
  endDate?: string;
}

export interface AdherenceDay {
  date: string;
  percent: number;
  completed: number;
  expected: number;
  taken: number;
  missed: number;
  skipped: number;
  pending: number;
}

export interface MedicationDose {
  prescriptionId: string;
  medicationDetails: string;
  dosage?: string;
  intakeInstruction?: string;
  source?: string;
  doseKey: string;
  scheduledTime: string;
  status: MedicationStatus;
  takenAt?: string | null;
  snoozedUntil?: string | null;
  remainingDays?: number | null;
  lifecycleStatus?: string;
}

export interface MedicationAdherenceRecord {
  id: string;
  patientId?: string;
  prescriptionId: string;
  scheduledDate: string;
  doseKey: string;
  scheduledTime?: string;
  status: MedicationStatus;
  takenAt?: string | null;
  snoozedUntil?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface MissedDoseHistoryItem {
  id: string;
  prescriptionId: string;
  medicationDetails: string;
  dosage?: string;
  date: string;
  doseKey: string;
  scheduledTime: string;
  status: "Missed";
  derived?: boolean;
}

export interface MedicationAdherence {
  days: AdherenceDay[];
  expectedPerDay: number;
  overallPercent: number;
  windowDays: number;
  today: AdherenceDay;
  todayDoses: MedicationDose[];
  records: MedicationAdherenceRecord[];
  missedHistory: MissedDoseHistoryItem[];
}

export interface MedicationAdherenceUpdate {
  status?: MedicationStatus;
  taken?: boolean;
  scheduledDate?: string;
  doseKey?: string;
  scheduledTime?: string;
  snoozedUntil?: string;
  clientOperationId?: string;
}

const request = async (path: string, init?: RequestInit) => {
  const token = await getToken();

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error: any = new Error(
      data.detail || data.message || "Prescription request failed."
    );
    error.status = response.status;
    throw error;
  }

  return data;
};

const normalizePrescription = (item: any): Prescription => ({
  ...item,
  id: String(item.id || item._id || ""),
  times: Array.isArray(item.times) ? item.times : [],
  remainingDays:
    item.remainingDays === null || item.remainingDays === undefined
      ? null
      : Number(item.remainingDays),
});

export const getPatientPrescriptions = async (): Promise<Prescription[]> => {
  try {
    const data = await request("/api/patient/prescriptions");
    const prescriptions = (data.prescriptions || []).map(normalizePrescription);
    // Store the active medication plan/instructions only; old medication history is not duplicated offline.
    await writeOfflineCache(
      "patient-medications",
      prescriptions.filter((item: Prescription) => item.lifecycleStatus !== "Completed" && item.active !== false)
    );
    return prescriptions;
  } catch (error) {
    const cached = isLikelyNetworkError(error)
      ? await readOfflineCache<Prescription[]>("patient-medications")
      : null;
    if (cached) return cached;
    throw error;
  }
};

export const getPatientPrescription = async (
  prescriptionId: string
): Promise<Prescription> => {
  const data = await request(
    `/api/patient/prescriptions/${encodeURIComponent(prescriptionId)}`
  );
  return normalizePrescription(data.prescription || {});
};

export const createDoctorPrescription = (payload: {
  patientId: string;
  medicationDetails: string;
  instructions: string;
}) => {
  return request("/api/doctor/prescriptions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const createPatientPrescription = async (
  payload: PrescriptionPayload
): Promise<{ message: string; prescriptionId: string; prescription: Prescription }> => {
  const data = await request("/api/patient/prescriptions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return {
    ...data,
    prescription: normalizePrescription(data.prescription || {}),
  };
};

export const updatePatientPrescription = async (
  prescriptionId: string,
  payload: Partial<PrescriptionPayload> & { active?: boolean }
): Promise<{ message: string; prescriptionId: string; prescription: Prescription }> => {
  const data = await request(
    `/api/patient/prescriptions/${encodeURIComponent(prescriptionId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );
  return {
    ...data,
    prescription: normalizePrescription(data.prescription || {}),
  };
};

export const stopPatientPrescription = async (
  prescriptionId: string
): Promise<{ message: string; prescription: Prescription }> => {
  const data = await request(
    `/api/patient/prescriptions/${encodeURIComponent(prescriptionId)}`,
    { method: "DELETE" }
  );
  return {
    ...data,
    prescription: normalizePrescription(data.prescription || {}),
  };
};

export const getMedicationAdherence = async (
  days: number = 7
): Promise<MedicationAdherence> => {
  const safeDays = Math.max(1, Math.min(365, Math.trunc(days || 7)));
  const cacheName = safeDays <= 7 ? "patient-adherence-7" : "patient-adherence-30";
  try {
    const data = await request(`/api/patient/medication-adherence?days=${safeDays}`);
    const daysData: AdherenceDay[] = data.days || data.adherence || [];
    const fallbackToday = daysData[daysData.length - 1] || {
      date: "", percent: 0, completed: 0, expected: 0, taken: 0, missed: 0, skipped: 0, pending: 0,
    };
    const normalized: MedicationAdherence = {
      days: daysData,
      expectedPerDay: data.expectedPerDay || data.expected_per_day || 0,
      overallPercent: Number(data.overallPercent || 0),
      windowDays: Number(data.windowDays || safeDays),
      today: data.today || fallbackToday,
      todayDoses: Array.isArray(data.todayDoses) ? data.todayDoses : [],
      records: Array.isArray(data.records) ? data.records : [],
      missedHistory: Array.isArray(data.missedHistory) ? data.missedHistory : [],
    };
    await writeOfflineCache(cacheName, normalized);
    return normalized;
  } catch (error) {
    const cached = isLikelyNetworkError(error)
      ? await readOfflineCache<MedicationAdherence>(cacheName)
      : null;
    if (cached) return cached;
    throw error;
  }
};

export const recordMedicationAdherence = async (
  prescriptionId: string | number,
  input: boolean | MedicationAdherenceUpdate
) => {
  const payload: MedicationAdherenceUpdate = typeof input === "boolean" ? { taken: input } : input;
  try {
    return await request(
      `/api/patient/prescriptions/${encodeURIComponent(String(prescriptionId))}/adherence`,
      { method: "POST", body: JSON.stringify(payload) }
    );
  } catch (error) {
    if (!isLikelyNetworkError(error)) throw error;
    const operation = await queueMedicationAdherence(String(prescriptionId), payload);
    return {
      message: "Saved offline. This dose will synchronize when EyeCare AI reconnects.",
      queued: true,
      clientOperationId: operation.id,
    };
  }
};
