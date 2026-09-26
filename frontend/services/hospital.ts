import BASE_URL from "./api";
import { getToken } from "./storage";
import { appendUploadFile } from "./uploadFile";

export interface HospitalReport {
  id: string;
  reportType: string;
  hospitalName: string;
  doctorName?: string;
  uploadDate: string;
  status: string;
  description?: string;
  fileName?: string;
}

const authHeaders = async (): Promise<Record<string, string>> => {
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const parseResponse = async (response: Response, fallback: string) => {
  const text = await response.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
  if (!response.ok) throw new Error(data.detail || data.message || fallback);
  return data;
};

export const getHospitalReports = async (): Promise<HospitalReport[]> => {
  const response = await fetch(`${BASE_URL}/api/hospital/reports`, { method: "GET", headers: { "Content-Type": "application/json", ...(await authHeaders()) } });
  const data = await parseResponse(response, "Failed to load hospital reports.");
  const reports = Array.isArray(data) ? data : data.reports || data.results || [];
  return reports.map((item: any) => ({
    id: String(item.id || item.reportId || item._id || ""),
    reportType: item.reportType || "Clinical Report",
    hospitalName: item.hospitalName || "",
    doctorName: item.doctorName || "",
    uploadDate: item.uploadDate || item.date || item.created_at || "",
    status: item.status || "Completed",
    description: item.description || "",
    fileName: item.fileName || "",
  }));
};

export type HospitalUploadFile = { uri: string; name?: string; mimeType?: string; type?: string; };

export const uploadHospitalReport = async (payload: { reportType: string; hospitalName: string; doctorName: string; description: string; patientId?: string; file?: HospitalUploadFile | null; }) => {
  const form = new FormData();
  form.append("reportType", payload.reportType);
  form.append("hospitalName", payload.hospitalName);
  form.append("doctorName", payload.doctorName);
  form.append("description", payload.description);
  if (payload.patientId) form.append("patientId", payload.patientId);
  if (payload.file) await appendUploadFile(form, "file", payload.file, "clinical-report");
  const response = await fetch(`${BASE_URL}/api/hospital/reports/upload`, { method: "POST", headers: await authHeaders(), body: form });
  return parseResponse(response, "Failed to upload clinical report.");
};

export const downloadHospitalReport = async (reportId: string) => {
  const response = await fetch(`${BASE_URL}/api/hospital/reports/${encodeURIComponent(reportId)}/download`, { headers: await authHeaders() });
  if (!response.ok) throw new Error((await response.text()) || "Failed to download the report.");
  const blob = await response.blob();
  if (typeof window === "undefined") throw new Error("Native file sharing is not configured for this device yet.");
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `clinical-report-${reportId}`;
  anchor.click();
  URL.revokeObjectURL(url);
};

export interface HospitalProfile {
  userId?: string;
  name?: string;
  email?: string;
  hospitalName?: string;
  licenseNumber?: string;
  phone?: string;
  address?: string;
}

export const getHospitalProfile = async (): Promise<HospitalProfile> => {
  const response = await fetch(`${BASE_URL}/api/hospital/profile`, {
    method: "GET",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
  });
  return parseResponse(response, "Failed to load hospital profile.");
};

export const updateHospitalProfile = async (payload: HospitalProfile) => {
  const form = new FormData();
  if (payload.hospitalName != null) form.append("hospitalName", payload.hospitalName);
  if (payload.licenseNumber != null) form.append("licenseNumber", payload.licenseNumber);
  if (payload.phone != null) form.append("phone", payload.phone);
  if (payload.address != null) form.append("address", payload.address);
  const response = await fetch(`${BASE_URL}/api/hospital/profile`, {
    method: "PUT",
    headers: await authHeaders(),
    body: form,
  });
  return parseResponse(response, "Failed to update hospital profile.");
};
