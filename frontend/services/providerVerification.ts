import * as DocumentPicker from "expo-document-picker";

import BASE_URL from "./api";
import { appendUploadFile } from "./uploadFile";
import { getToken } from "./storage";

export type VerificationStatus = "pending" | "under_review" | "needs_changes" | "verified" | "rejected";
export type AccountStatus = "active" | "suspended" | "disabled";

export interface VerificationDocument {
  type: string;
  fileId: string;
  filename: string;
  contentType?: string;
  uploadedAt?: string;
}

export interface ProviderVerification {
  id: string;
  userId: string;
  role: "Doctor" | "Hospital";
  status: VerificationStatus;
  accountStatus: AccountStatus;
  details: Record<string, any>;
  documents: VerificationDocument[];
  submittedAt?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  decisionReason?: string;
  createdAt?: string;
  updatedAt?: string;
  missingFields: string[];
  missingDocuments: string[];
  readyToSubmit: boolean;
  provider?: {
    id: string;
    name: string;
    email: string;
    username?: string;
    mobile?: string;
    role: string;
  };
}

async function headers(json = false): Promise<Record<string, string>> {
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

export async function getProviderVerification(): Promise<ProviderVerification> {
  const response = await fetch(`${BASE_URL}/api/provider-verification/status`, { headers: await headers() });
  return parse(response, "Unable to load verification status.");
}

export async function saveProviderVerificationDetails(details: Record<string, any>): Promise<ProviderVerification> {
  const payload: Record<string, any> = { ...details };
  if (payload.yearsOfExperience === "" || payload.yearsOfExperience == null) delete payload.yearsOfExperience;
  else payload.yearsOfExperience = Number(payload.yearsOfExperience);
  if (payload.officialEmail === "") delete payload.officialEmail;

  const response = await fetch(`${BASE_URL}/api/provider-verification/details`, {
    method: "PUT",
    headers: await headers(true),
    body: JSON.stringify(payload),
  });
  return parse(response, "Unable to save verification details.");
}

export async function pickVerificationDocument() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/pdf", "image/jpeg", "image/png"],
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0];
}

export async function uploadProviderVerificationDocument(
  documentType: string,
  asset: { uri: string; name: string; mimeType?: string | null }
): Promise<ProviderVerification> {
  const form = new FormData();
  await appendUploadFile(form, "file", asset, `${documentType}.pdf`);

  const response = await fetch(`${BASE_URL}/api/provider-verification/documents/${encodeURIComponent(documentType)}`, {
    method: "POST",
    headers: await headers(false),
    body: form,
  });
  return parse(response, "Unable to upload verification document.");
}

export async function removeProviderVerificationDocument(fileId: string) {
  const response = await fetch(`${BASE_URL}/api/provider-verification/documents/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    headers: await headers(false),
  });
  return parse(response, "Unable to remove verification document.");
}

export async function submitProviderVerification(): Promise<ProviderVerification> {
  const response = await fetch(`${BASE_URL}/api/provider-verification/submit`, {
    method: "POST",
    headers: await headers(false),
  });
  return parse(response, "Unable to submit verification.");
}
