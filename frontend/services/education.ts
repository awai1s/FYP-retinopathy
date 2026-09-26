import BASE_URL from "./api";
import { getToken } from "./storage";
import { isLikelyNetworkError, readOfflineCache, writeOfflineCache } from "./offlineCache";

export type EducationAssignmentStatus = "assigned" | "viewed";

export interface PatientEducationAssignment {
  id: string;
  encounterId: string;
  topicKey: string;
  title: string;
  doctorId: string;
  doctorName: string;
  status: EducationAssignmentStatus | string;
  assignedAt?: string | null;
  viewedAt?: string | null;
}

const authHeaders = async () => {
  const token = await getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const request = async (path: string, init: RequestInit = {}) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...(await authHeaders()), ...(init.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error: any = new Error(data.detail || data.message || "Education request failed."); error.status = response.status; throw error; }
  return data;
};

export const getEducationAssignments = async (): Promise<PatientEducationAssignment[]> => {
  try {
    const data = await request("/api/patient/education/assignments");
    const assignments = Array.isArray(data.assignments) ? data.assignments : [];
    await writeOfflineCache("patient-education-assignments", assignments);
    return assignments;
  } catch (error) {
    const cached = isLikelyNetworkError(error)
      ? await readOfflineCache<PatientEducationAssignment[]>("patient-education-assignments")
      : null;
    if (cached) return cached;
    throw error;
  }
};

export const markEducationAssignmentViewed = async (assignmentId: string): Promise<PatientEducationAssignment> =>
  request(`/api/patient/education/assignments/${encodeURIComponent(assignmentId)}/viewed`, { method: "PATCH" });
