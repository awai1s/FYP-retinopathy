import BASE_URL from "./api";
import { getToken } from "./storage";

export interface AuditLog { id: string; userId?: string; role?: string; action: string; resource: string; resourceId?: string; createdAt?: string; }

export const getHospitalAuditLogs = async (): Promise<AuditLog[]> => {
  const token = await getToken();
  const response = await fetch(`${BASE_URL}/api/hospital/audit-logs`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Unable to load audit logs.");
  return data.logs || [];
};
