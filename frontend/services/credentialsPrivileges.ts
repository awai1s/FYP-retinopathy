import BASE_URL from "./api";
import { getToken } from "./storage";

export type CredentialState = "valid" | "expiring" | "expired" | "unverified" | "inactive_account";
export type AffiliationStatus = "active" | "inactive" | "ended";
export type PrivilegeStatus = "active" | "revoked" | "expired" | "not_granted";

export interface DoctorCredential {
  doctorId: string;
  name: string;
  email?: string;
  username?: string;
  verificationStatus: string;
  accountStatus: string;
  credentialState: CredentialState;
  medicalLicenseNumber: string;
  licensingAuthority: string;
  specialization: string;
  qualification: string;
  licenseIssueDate: string;
  licenseExpiryDate: string;
  licenseDaysRemaining?: number | null;
  currentHospitalClinic?: string;
  verifiedAt?: string | null;
}

export interface PrivilegeDefinition {
  code: string;
  label: string;
  description: string;
  procedure?: boolean;
  highRisk?: boolean;
}

export interface DoctorPrivilege extends PrivilegeDefinition {
  id: string;
  hospitalId: string;
  doctorId: string;
  privilege: string;
  status: PrivilegeStatus;
  storedStatus: string;
  grantedBy?: string | null;
  grantedAt?: string | null;
  expiresAt: string;
  daysRemaining?: number | null;
  revokedBy?: string | null;
  revokedAt?: string | null;
  updatedAt?: string | null;
}

export interface HospitalDoctorAffiliation {
  id: string;
  hospitalId: string;
  hospitalName: string;
  doctorId: string;
  department: string;
  position: string;
  status: AffiliationStatus;
  joinedAt: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  credential?: DoctorCredential | null;
  privileges?: DoctorPrivilege[];
  activePrivilegeCount?: number;
  privilegeCount?: number;
}

export interface HospitalPrivilegeSummary {
  affiliatedDoctors: number;
  activeDoctors: number;
  licenseExpiring60: number;
  licenseExpired: number;
  privilegeExpiring30: number;
  privilegeExpired: number;
}

async function headers(json = false): Promise<Record<string, string>> {
  const token = await getToken();
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...(await headers(Boolean(init.body))), ...(init.headers || {}) },
  });
  const text = await response.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
  if (!response.ok) {
    const detail = data?.detail;
    if (typeof detail === "string") throw new Error(detail);
    if (detail?.message) throw new Error(detail.message);
    throw new Error(data?.message || "Credential/privilege request failed.");
  }
  return data;
}

export async function getPrivilegeCatalog(): Promise<PrivilegeDefinition[]> {
  const data = await request("/api/credentials-privileges/catalog");
  return Array.isArray(data.privileges) ? data.privileges : [];
}

export async function getHospitalPrivilegeSummary(): Promise<HospitalPrivilegeSummary> {
  return request("/api/credentials-privileges/hospital/dashboard");
}

export async function searchVerifiedDoctors(query: string): Promise<DoctorCredential[]> {
  const params = new URLSearchParams();
  if (query.trim()) params.set("query", query.trim());
  const data = await request(`/api/credentials-privileges/hospital/doctor-directory?${params.toString()}`);
  return Array.isArray(data.doctors) ? data.doctors : [];
}

export async function listHospitalAffiliatedDoctors(): Promise<HospitalDoctorAffiliation[]> {
  const data = await request("/api/credentials-privileges/hospital/doctors");
  return Array.isArray(data.doctors) ? data.doctors : [];
}

export async function createHospitalAffiliation(payload: {
  doctorId: string;
  department: string;
  position: string;
  joinedAt?: string;
}): Promise<HospitalDoctorAffiliation> {
  return request("/api/credentials-privileges/hospital/affiliations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateHospitalAffiliation(
  doctorId: string,
  payload: Partial<{ department: string; position: string; joinedAt: string; status: AffiliationStatus }>,
): Promise<HospitalDoctorAffiliation> {
  return request(`/api/credentials-privileges/hospital/affiliations/${encodeURIComponent(doctorId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function getHospitalDoctorPrivilegeDetail(doctorId: string): Promise<{
  affiliation: HospitalDoctorAffiliation;
  privileges: DoctorPrivilege[];
}> {
  return request(`/api/credentials-privileges/hospital/doctors/${encodeURIComponent(doctorId)}`);
}

export async function saveHospitalDoctorPrivileges(
  doctorId: string,
  privileges: Array<{ code: string; enabled: boolean; expiresAt?: string }>,
): Promise<{ affiliation: HospitalDoctorAffiliation; privileges: DoctorPrivilege[] }> {
  return request(`/api/credentials-privileges/hospital/doctors/${encodeURIComponent(doctorId)}/privileges`, {
    method: "PUT",
    body: JSON.stringify({ privileges }),
  });
}

export async function getDoctorHospitalAffiliations(): Promise<HospitalDoctorAffiliation[]> {
  const data = await request("/api/credentials-privileges/doctor/affiliations");
  return Array.isArray(data.affiliations) ? data.affiliations : [];
}

export async function getDoctorHospitalAffiliation(hospitalId: string): Promise<{
  affiliation: HospitalDoctorAffiliation;
  credential: DoctorCredential;
  privileges: DoctorPrivilege[];
}> {
  return request(`/api/credentials-privileges/doctor/affiliations/${encodeURIComponent(hospitalId)}`);
}
