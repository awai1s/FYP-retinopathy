import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import BASE_URL from "./api";
import { getToken } from "./storage";
import type { ProviderVerification } from "./providerVerification";

export interface SuperAdminDashboardCounts {
  pending: number;
  underReview: number;
  needsChanges: number;
  verified: number;
  suspended: number;
  doctors: number;
  hospitals: number;
}

export interface VerificationAuditEvent {
  id: string;
  verificationId: string;
  userId: string;
  providerName: string;
  role: string;
  decision: string;
  reviewerName: string;
  reason: string;
  previousStatus?: string | null;
  newStatus?: string | null;
  previousAccountStatus?: string | null;
  newAccountStatus?: string | null;
  timestamp: string;
}

async function authHeaders(json = false): Promise<Record<string, string>> {
  const token = await getToken();
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parse(response: Response, fallback: string) {
  const text = await response.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
  if (!response.ok) {
    const detail = data?.detail;
    if (typeof detail === "string") throw new Error(detail);
    if (detail?.message) throw new Error(detail.message);
    throw new Error(data?.message || fallback);
  }
  return data;
}

export async function getSuperAdminDashboard(): Promise<SuperAdminDashboardCounts> {
  const response = await fetch(`${BASE_URL}/api/superadmin/dashboard`, { headers: await authHeaders() });
  const data = await parse(response, "Unable to load SuperAdmin dashboard.");
  return data.counts;
}

export async function listProviderVerifications(filters?: {
  status?: string;
  role?: string;
  accountStatus?: string;
  query?: string;
}): Promise<ProviderVerification[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.role) params.set("role", filters.role);
  if (filters?.accountStatus) params.set("accountStatus", filters.accountStatus);
  if (filters?.query) params.set("query", filters.query);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`${BASE_URL}/api/superadmin/verifications${suffix}`, { headers: await authHeaders() });
  const data = await parse(response, "Unable to load provider verifications.");
  return data.verifications || [];
}

export async function getProviderVerificationById(id: string): Promise<ProviderVerification> {
  const response = await fetch(`${BASE_URL}/api/superadmin/verifications/${encodeURIComponent(id)}`, { headers: await authHeaders() });
  return parse(response, "Unable to load provider verification.");
}

export async function decideProviderVerification(
  id: string,
  decision: "verify" | "request_changes" | "reject" | "suspend" | "reactivate" | "disable",
  reason: string,
): Promise<ProviderVerification> {
  const response = await fetch(`${BASE_URL}/api/superadmin/verifications/${encodeURIComponent(id)}/decision`, {
    method: "POST",
    headers: await authHeaders(true),
    body: JSON.stringify({ decision, reason }),
  });
  return parse(response, "Unable to update provider verification.");
}

export async function getVerificationAudit(): Promise<VerificationAuditEvent[]> {
  const response = await fetch(`${BASE_URL}/api/superadmin/audit`, { headers: await authHeaders() });
  const data = await parse(response, "Unable to load verification audit history.");
  return data.events || [];
}

export async function downloadAdminVerificationDocument(
  verificationId: string,
  fileId: string,
  filename: string,
) {
  const url = `${BASE_URL}/api/superadmin/verifications/${encodeURIComponent(verificationId)}/documents/${encodeURIComponent(fileId)}/download`;
  const headers = await authHeaders();

  if (Platform.OS === "web") {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error("Unable to download verification document.");
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename || "verification-document";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    return objectUrl;
  }

  const baseDirectory = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!baseDirectory) throw new Error("Local document storage is unavailable on this device.");
  const safeName = (filename || "verification-document").replace(/[\\/:*?"<>|]+/g, "-");
  const folder = `${baseDirectory}eyecare-provider-verification/`;
  await FileSystem.makeDirectoryAsync(folder, { intermediates: true }).catch(() => undefined);
  const result = await FileSystem.downloadAsync(url, `${folder}${safeName}`, { headers });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Unable to download verification document (HTTP ${result.status}).`);
  }
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri, { dialogTitle: "Provider verification document" });
  }
  return result.uri;
}

export interface SuperAdminDoctorCredential {
  doctorId: string;
  name: string;
  email?: string;
  verificationStatus: string;
  accountStatus: string;
  credentialState: string;
  medicalLicenseNumber: string;
  licensingAuthority: string;
  specialization: string;
  qualification: string;
  licenseIssueDate: string;
  licenseExpiryDate: string;
  licenseDaysRemaining?: number | null;
}

export async function getSuperAdminDoctorCredential(doctorId: string): Promise<SuperAdminDoctorCredential> {
  const response = await fetch(`${BASE_URL}/api/superadmin/doctors/${encodeURIComponent(doctorId)}/credentials`, {
    headers: await authHeaders(),
  });
  return parse(response, "Unable to load doctor credential.");
}

export async function updateSuperAdminDoctorCredential(
  doctorId: string,
  payload: {
    medicalLicenseNumber: string;
    licensingAuthority: string;
    specialization: string;
    licenseIssueDate: string;
    licenseExpiryDate: string;
    qualification?: string;
    reason: string;
  },
): Promise<SuperAdminDoctorCredential> {
  const response = await fetch(`${BASE_URL}/api/superadmin/doctors/${encodeURIComponent(doctorId)}/credentials`, {
    method: "PATCH",
    headers: await authHeaders(true),
    body: JSON.stringify(payload),
  });
  return parse(response, "Unable to update doctor credential.");
}
