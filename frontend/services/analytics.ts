import BASE_URL from "./api";
import { getToken } from "./storage";

export type AnalyticsRangeDays = 30 | 90 | 180 | 365;

export interface NumericTrendPoint {
  id?: string;
  date: string;
  value: number;
  source?: string;
  bloodGlucose?: number | null;
}

export interface DRTrendPoint {
  id?: string;
  date: string;
  stage: string;
  severity: number | null;
  confidence?: string | number | null;
  riskScore?: number | null;
}

export interface MedicationTrendPoint {
  date: string;
  percent: number;
  completed: number;
  expected: number;
  taken: number;
  missed: number;
  skipped: number;
  pending: number;
}

export interface PatientAnalyticsSummary {
  latestHbA1c: number | null;
  previousHbA1c: number | null;
  baselineHbA1c: number | null;
  hba1cDelta: number | null;
  latestRisk: number | null;
  previousRisk: number | null;
  baselineRisk: number | null;
  riskDelta: number | null;
  medicationAdherence: number | null;
  previousMedicationAdherence: number | null;
  medicationAdherenceDelta: number | null;
}

export interface PatientAnalytics {
  screenings: number;
  reports: number;
  appointments: number;
  visionTests: number;
  rangeDays: number;
  generatedAt?: string;
  latestPrediction?: {
    id?: string;
    stage?: string;
    confidence?: string | number;
    riskScore?: number | null;
    date?: string;
    status?: string;
  } | null;
  summary: PatientAnalyticsSummary;
  hba1cTrend: NumericTrendPoint[];
  bloodGlucoseTrend: NumericTrendPoint[];
  riskTrend: NumericTrendPoint[];
  drTrend: DRTrendPoint[];
  medicationTrend: MedicationTrendPoint[];
}

export interface HealthMetric {
  id: string;
  patientId?: string;
  hba1c?: number | null;
  bloodGlucose?: number | null;
  recordedAt: string;
  source?: string;
  createdAt?: string;
}

export interface CreateHealthMetricPayload {
  hba1c?: number;
  bloodGlucose?: number;
  recordedAt?: string;
}

const request = async <T = any>(path: string, init: RequestInit = {}): Promise<T> => {
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
  if (!response.ok) {
    throw new Error(data.detail || data.message || "Request failed.");
  }
  return data as T;
};

export const getPatientAnalytics = (
  days: AnalyticsRangeDays | number = 30
): Promise<PatientAnalytics> =>
  request(`/api/patient/analytics?days=${encodeURIComponent(String(days))}`);

export const getHealthMetrics = async (): Promise<HealthMetric[]> => {
  const data = await request<{ metrics?: HealthMetric[] }>("/api/patient/health-metrics");
  return data.metrics || [];
};

export const createHealthMetric = (
  payload: CreateHealthMetricPayload
): Promise<{ message: string; healthMetricId: string; metric: HealthMetric }> =>
  request("/api/patient/health-metrics", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getHospitalStatistics = () => request("/api/hospital/statistics");
export const getHospitalActivity = () => request("/api/hospital/activity");
export const getHospitalPatients = (query = "") =>
  request(`/api/hospital/patients${query ? `?query=${encodeURIComponent(query)}` : ""}`);
export const getHospitalDoctors = (query = "") =>
  request(`/api/hospital/doctors${query ? `?query=${encodeURIComponent(query)}` : ""}`);
