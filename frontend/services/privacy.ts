import BASE_URL from "./api";
import { getToken } from "./storage";
import { isLikelyNetworkError, readOfflineCache, writeOfflineCache } from "./offlineCache";

export type HealthCardFields = {
  basicIdentity: boolean;
  emergencyContact: boolean;
  bloodGroup: boolean;
  allergies: boolean;
  activeMedication: boolean;
  latestDrResult: boolean;
  latestHba1c: boolean;
};

export type HealthCardData = {
  patientId: string;
  name: string;
  eyeCareId: string;
  bloodGroup?: string;
  emergencyContact?: string;
  allergies?: string | string[];
  avatarInitial?: string;
};

export type QrShare = {
  id: string;
  type: "emergency" | "temporary";
  scopes: string[];
  createdAt?: string | null;
  expiresAt?: string | null;
  revoked: boolean;
  revokedAt?: string | null;
  revokedReason?: string;
  usedCount: number;
  maxUses?: number | null;
  lastUsedAt?: string | null;
  status: "active" | "revoked" | "expired" | "exhausted" | string;
  shareUrl?: string;
};

export type AccessLog = {
  id: string;
  actorUserId?: string;
  actorName: string;
  actorRole: string;
  action: string;
  actionLabel: string;
  resourceType?: string;
  resourceId?: string;
  accessChannel: string;
  scope?: string;
  createdAt: string;
};

export type ConnectedProviderPrivacy = {
  connectionId: string;
  doctorId: string;
  name: string;
  specialization?: string;
  hospital?: string;
  verified?: boolean;
  connectedSince?: string;
};

export type PrivacySummary = {
  recentAccess: AccessLog[];
  connectedProviders: ConnectedProviderPrivacy[];
  shares: QrShare[];
  consents: { scope: string; granted: boolean; updatedAt?: string | null }[];
  healthCardSettings: HealthCardFields;
};

type QrResponse = { share: QrShare; qrSvg: string };

async function request<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
  const token = authenticated ? await getToken() : null;
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  let data: any = {};
  if (text) {
    try { data = JSON.parse(text); } catch { data = { detail: text }; }
  }
  if (!response.ok) {
    const error = new Error(data.detail || data.message || "Privacy request failed") as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return data as T;
}

export const getPrivacySummary = () => request<PrivacySummary>("/api/patient/privacy/summary");

export const getAccessLogs = (limit = 50, offset = 0) =>
  request<{ logs: AccessLog[]; total: number; limit: number; offset: number }>(
    `/api/patient/privacy/access-logs?limit=${limit}&offset=${offset}`
  );

export const getHealthCard = async () => {
  try {
    const data = await request<{ card: HealthCardData; settings: HealthCardFields }>("/api/patient/privacy/health-card");
    // This is the only health-card payload stored offline: the patient's own minimal emergency card.
    await writeOfflineCache("patient-health-card", data);
    return data;
  } catch (error) {
    const cached = isLikelyNetworkError(error)
      ? await readOfflineCache<{ card: HealthCardData; settings: HealthCardFields }>("patient-health-card")
      : null;
    if (cached) return cached;
    throw error;
  }
};

export const updateHealthCardSettings = async (settings: Partial<HealthCardFields>) => {
  const result = await request<{ message: string; settings: HealthCardFields }>("/api/patient/privacy/health-card/settings", {
    method: "PATCH",
    body: JSON.stringify(settings),
  });
  const cached = await readOfflineCache<{ card: HealthCardData; settings: HealthCardFields }>("patient-health-card");
  if (cached) await writeOfflineCache("patient-health-card", { ...cached, settings: result.settings });
  return result;
};

export const getEmergencyQr = (rotate = false) =>
  request<QrResponse>("/api/patient/privacy/health-card/emergency-qr", {
    method: "POST",
    body: JSON.stringify({ rotate }),
  });

export const createTemporaryQr = (data: { scopes: string[]; durationMinutes: 15 | 60 | 1440; maxUses?: number | null }) =>
  request<QrResponse>("/api/patient/privacy/health-card/temporary-qr", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const listQrShares = () => request<{ shares: QrShare[] }>("/api/patient/privacy/health-card/shares");

export const revokeQrShare = (shareId: string, reason = "patient_revoked") =>
  request<{ message: string; share: QrShare }>(`/api/patient/privacy/health-card/shares/${encodeURIComponent(shareId)}/revoke`, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  });

export const revokeAllQrShares = () =>
  request<{ message: string; updated: number }>("/api/patient/privacy/health-card/shares/revoke-all", { method: "POST" });

export const getPublicHealthCard = (token: string) =>
  request<{ share: any; data: any }>(`/api/public/health-card/${encodeURIComponent(token)}`, {}, false);

export const publicReportDownloadUrl = (token: string, reportId: string) =>
  `${BASE_URL}/api/public/health-card/${encodeURIComponent(token)}/reports/${encodeURIComponent(reportId)}/download`;
