import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import BASE_URL from "./api";
import { appendUploadFile } from "./uploadFile";
import { getToken } from "./storage";

export type VisionPrescriptionType = "glasses" | "contact_lens";

export interface VisionPrescriptionAttachment {
  fileId: string;
  filename: string;
  contentType: string;
  uploadedAt?: string;
}

export interface VisionPrescription {
  id: string;
  type: VisionPrescriptionType;
  isCurrent: boolean;
  lifecycleStatus: "current" | "history" | string;
  issuedDate: string;
  expiryDate: string;
  daysUntilExpiry: number | null;
  expiryState: "none" | "valid" | "expiring" | "expired" | string;
  doctorOptometrist: string;
  clinic: string;
  notes: string;
  glasses: {
    right?: { sph?: number | null; cyl?: number | null; axis?: number | null };
    left?: { sph?: number | null; cyl?: number | null; axis?: number | null };
    add?: number | null;
    pd?: number | null;
  };
  contactLens: {
    rightPower?: number | null;
    leftPower?: number | null;
    baseCurve?: number | null;
    diameter?: number | null;
    brand?: string;
    lensType?: string;
    replacementSchedule?: string;
  };
  attachment?: VisionPrescriptionAttachment | null;
  createdAt?: string;
  updatedAt?: string;
  supersededAt?: string;
}

export interface VisionVaultResponse {
  currentGlasses: VisionPrescription | null;
  currentContactLens: VisionPrescription | null;
  history: VisionPrescription[];
  expiringSoon: VisionPrescription[];
  records: VisionPrescription[];
}

export interface VisionPrescriptionCreateInput {
  type: VisionPrescriptionType;
  issuedDate: string;
  expiryDate?: string;
  doctorOptometrist?: string;
  clinic?: string;
  notes?: string;
  rightSph?: number;
  rightCyl?: number;
  rightAxis?: number;
  leftSph?: number;
  leftCyl?: number;
  leftAxis?: number;
  add?: number;
  pd?: number;
  rightPower?: number;
  leftPower?: number;
  baseCurve?: number;
  diameter?: number;
  brand?: string;
  lensType?: string;
  replacementSchedule?: string;
}

async function authHeaders(json = false): Promise<Record<string, string>> {
  const token = await getToken();
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parseResponse(response: Response, fallback: string) {
  const text = await response.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
  if (!response.ok) {
    const detail = data?.detail;
    if (typeof detail === "string" && detail.trim()) throw new Error(detail);
    if (Array.isArray(detail)) {
      const joined = detail.map((item: any) => item?.msg || item?.message || "").filter(Boolean).join(" ");
      if (joined) throw new Error(joined);
    }
    throw new Error(data?.message || fallback);
  }
  return data;
}

export async function getVisionVault(): Promise<VisionVaultResponse> {
  const response = await fetch(`${BASE_URL}/api/patient/vision-prescriptions`, {
    headers: await authHeaders(),
  });
  return parseResponse(response, "Unable to load Vision & Lens Vault.");
}

export async function getVisionPrescription(id: string): Promise<VisionPrescription> {
  const response = await fetch(`${BASE_URL}/api/patient/vision-prescriptions/${encodeURIComponent(id)}`, {
    headers: await authHeaders(),
  });
  return parseResponse(response, "Unable to load this vision prescription.");
}

export async function createVisionPrescription(input: VisionPrescriptionCreateInput): Promise<VisionPrescription> {
  const response = await fetch(`${BASE_URL}/api/patient/vision-prescriptions`, {
    method: "POST",
    headers: await authHeaders(true),
    body: JSON.stringify(input),
  });
  return parseResponse(response, "Unable to save the vision prescription.");
}

export async function pickVisionPrescriptionAttachment() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/pdf", "image/jpeg", "image/png"],
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0];
}

export async function uploadVisionPrescriptionAttachment(
  prescriptionId: string,
  asset: DocumentPicker.DocumentPickerAsset
): Promise<VisionPrescription> {
  const form = new FormData();
  await appendUploadFile(form, "file", asset as any, "vision-prescription.pdf");

  const response = await fetch(
    `${BASE_URL}/api/patient/vision-prescriptions/${encodeURIComponent(prescriptionId)}/attachment`,
    { method: "POST", headers: await authHeaders(false), body: form }
  );
  return parseResponse(response, "Unable to upload the prescription attachment.");
}

function safeFilename(value: string) {
  const clean = String(value || "vision-prescription")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return clean || "vision-prescription";
}

function attachmentUrl(prescriptionId: string) {
  return `${BASE_URL}/api/patient/vision-prescriptions/${encodeURIComponent(prescriptionId)}/attachment/download`;
}

export async function downloadVisionPrescriptionAttachment(record: VisionPrescription): Promise<string> {
  if (!record.attachment) throw new Error("This prescription does not have an attachment.");
  const url = attachmentUrl(record.id);
  const headers = await authHeaders(false);
  const filename = safeFilename(record.attachment.filename);

  if (Platform.OS === "web") {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error("Unable to download the prescription attachment.");
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    return objectUrl;
  }

  const base = FileSystem.documentDirectory || FileSystem.cacheDirectory;
  if (!base) throw new Error("Local document storage is unavailable on this device.");
  const folder = `${base}eyecare-vision-prescriptions/`;
  await FileSystem.makeDirectoryAsync(folder, { intermediates: true }).catch(() => undefined);
  const result = await FileSystem.downloadAsync(url, `${folder}${filename}`, { headers });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Unable to download the prescription attachment (HTTP ${result.status}).`);
  }
  return result.uri;
}

export async function shareVisionPrescriptionAttachment(record: VisionPrescription): Promise<string> {
  if (Platform.OS === "web") return downloadVisionPrescriptionAttachment(record);
  const uri = await downloadVisionPrescriptionAttachment(record);
  if (!(await Sharing.isAvailableAsync())) return uri;
  await Sharing.shareAsync(uri, {
    mimeType: record.attachment?.contentType || "application/octet-stream",
    dialogTitle: "Share vision prescription",
  });
  return uri;
}
