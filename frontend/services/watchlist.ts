import BASE_URL from "./api";
import { getToken } from "./storage";

export type WatchlistPriority = "normal" | "important";

export interface DoctorWatchlistEntry {
  id: string;
  doctorId: string;
  patientId: string;
  patientName: string;
  username?: string | null;
  reason: string;
  priority: WatchlistPriority;
  reviewDate: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  accessAvailable: boolean;
  connectionStatus?: string | null;
}

export interface WatchlistPatientState {
  patient: {
    id: string;
    name: string;
    username?: string | null;
  };
  entry: DoctorWatchlistEntry | null;
  accessAvailable: boolean;
  connectionStatus?: string | null;
}

interface WatchlistPayload {
  patientId?: string;
  reason: string;
  priority: WatchlistPriority;
  reviewDate: string;
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
    throw new Error(data.detail || data.message || "Watchlist request failed");
  }
  return data as T;
}

export async function getDoctorWatchlist(limit = 50) {
  return request<{ watchlist: DoctorWatchlistEntry[] }>(`/api/doctor/watchlist?limit=${Math.max(1, Math.min(100, limit))}`);
}

export async function getWatchlistPatientState(patientId: string) {
  return request<WatchlistPatientState>(`/api/doctor/watchlist/patient/${encodeURIComponent(patientId)}`);
}

export async function createWatchlistEntry(payload: Required<WatchlistPayload>) {
  return request<DoctorWatchlistEntry>("/api/doctor/watchlist", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateWatchlistEntry(
  watchlistId: string,
  payload: Omit<WatchlistPayload, "patientId">
) {
  return request<DoctorWatchlistEntry>(`/api/doctor/watchlist/${encodeURIComponent(watchlistId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function removeWatchlistEntry(watchlistId: string) {
  return request<{ message: string }>(`/api/doctor/watchlist/${encodeURIComponent(watchlistId)}`, {
    method: "DELETE",
  });
}
