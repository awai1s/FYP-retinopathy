import BASE_URL from "./api";
import { getToken } from "./storage";

export type ConnectionStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "revoked"
  | "blocked";

export interface ConnectionPerson {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  role: "Patient" | "Doctor";
  specialization?: string;
  hospital?: string;
  experience?: string;
  yearsOfExperience?: number | string;
  qualification?: string;
  licenseNumber?: string;
  verified?: boolean;
  age?: number;
  city?: string;
  connectionStatus?: ConnectionStatus;
  connectionId?: string;
}

export interface Connection {
  id: string;
  status: ConnectionStatus;
  requestedBy?: "Patient" | "Doctor";
  requestedByUserId?: string;
  createdAt?: string;
  updatedAt?: string;
  acceptedAt?: string;
  declinedAt?: string;
  revokedAt?: string;
  blockedAt?: string;
  blockedBy?: string;
  connectedSince?: string;
  person: ConnectionPerson;
  doctorId: string;
  patientId: string;
  canAccessClinical?: boolean;
  lastVisit?: string | null;
  nextAppointment?: string | null;
  nextAppointmentTime?: string | null;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data: any = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { detail: text };
    }
  }

  if (!response.ok) {
    throw new Error(data.detail || data.message || "Care connection request failed");
  }
  return data as T;
}

export async function getConnections() {
  return request<{ connections: Connection[] }>("/api/connections");
}

export async function getConnectionRequests() {
  return request<{ incoming: Connection[]; outgoing: Connection[]; blocked: Connection[] }>(
    "/api/connections/requests"
  );
}

export async function searchConnectionDirectory(query = "") {
  const suffix = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
  return request<{ people: ConnectionPerson[]; targetRole: "Patient" | "Doctor" }>(
    `/api/connections/directory${suffix}`
  );
}

export async function getConnectionPerson(targetId: string) {
  return request<ConnectionPerson>(`/api/connections/directory/${encodeURIComponent(targetId)}`);
}

export async function requestConnection(targetId: string) {
  return request<Connection>("/api/connections/request", {
    method: "POST",
    body: JSON.stringify({ targetId }),
  });
}

export async function acceptConnection(connectionId: string) {
  return request<Connection>(`/api/connections/${connectionId}/accept`, { method: "PATCH" });
}

export async function declineConnection(connectionId: string, reason?: string) {
  return request<Connection>(`/api/connections/${connectionId}/decline`, {
    method: "PATCH",
    body: JSON.stringify({ reason: reason || undefined }),
  });
}

// Compatibility alias for older screens.
export const rejectConnection = declineConnection;

export async function cancelConnectionRequest(connectionId: string) {
  return request<Connection>(`/api/connections/${connectionId}/cancel`, { method: "PATCH" });
}

export async function revokeConnection(connectionId: string, reason?: string) {
  return request<Connection>(`/api/connections/${connectionId}/revoke`, {
    method: "PATCH",
    body: JSON.stringify({ reason: reason || undefined }),
  });
}

export async function blockConnection(connectionId: string) {
  return request<Connection>(`/api/connections/${connectionId}/block`, { method: "PATCH" });
}

export async function unblockConnection(connectionId: string) {
  return request<Connection>(`/api/connections/${connectionId}/unblock`, { method: "PATCH" });
}

// Existing callers used DELETE. Keep the public function but map it to the
// non-destructive Phase 10D revoke endpoint so history is never deleted.
export async function removeConnection(connectionId: string) {
  return revokeConnection(connectionId, "care_connection_removed");
}
