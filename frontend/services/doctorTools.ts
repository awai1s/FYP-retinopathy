import BASE_URL from "./api";
import { getToken } from "./storage";

const request = async (path: string, init?: RequestInit) => {
  const token = await getToken();
  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.message || "Doctor tools request failed.");
  return data;
};

export const getDoctorAlerts = async () => (await request("/api/doctor/alerts")).alerts || [];
export const createDoctorNote = (patientId: string, content: string, predictionId?: string) => request("/api/doctor/notes", { method: "POST", body: JSON.stringify({ patientId, content, predictionId }) });
export const createDoctorFollowUp = (patientId: string, dueDate: string, reason: string) => request("/api/doctor/follow-ups", { method: "POST", body: JSON.stringify({ patientId, dueDate, reason }) });
