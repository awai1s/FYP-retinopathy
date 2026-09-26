import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import BASE_URL from "./api";
import { getToken } from "./storage";

export type ReportLanguage = "en" | "ur";

export interface GeneratedMedicalReport {
  reportId: string;
  reportNumber?: string;
  predictionId: string;
  language: ReportLanguage;
  fileName: string;
  status: string;
  generatedAt?: string;
  downloadUrl?: string;
  reused?: boolean;
}

const authHeaders = async (): Promise<Record<string, string>> => {
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const parseError = async (response: Response, fallback: string) => {
  const raw = await response.text();
  if (!raw) return fallback;
  try {
    const data = JSON.parse(raw);
    if (typeof data?.detail === "string") return data.detail;
    if (typeof data?.message === "string") return data.message;
  } catch {
    // Keep plain-text backend message.
  }
  return raw || fallback;
};

export const generateMedicalReport = async (
  predictionId: string,
  language: ReportLanguage = "en"
): Promise<GeneratedMedicalReport> => {
  const response = await fetch(
    `${BASE_URL}/api/patient/reports/generate/${encodeURIComponent(predictionId)}?language=${language}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeaders()),
      },
    }
  );

  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to generate the medical PDF report."));
  }

  const data = await response.json();
  return data.report as GeneratedMedicalReport;
};

export const getGeneratedReportsForPrediction = async (
  predictionId: string
): Promise<GeneratedMedicalReport[]> => {
  const response = await fetch(
    `${BASE_URL}/api/patient/reports/prediction/${encodeURIComponent(predictionId)}`,
    { headers: await authHeaders() }
  );

  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to load generated reports."));
  }

  const data = await response.json();
  return Array.isArray(data?.reports) ? data.reports : [];
};

const sanitizeFileName = (value: string) => {
  const clean = (value || "DR-Healthcare-Medical-Report.pdf")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return clean.toLowerCase().endsWith(".pdf") ? clean : `${clean}.pdf`;
};

const reportDownloadUrl = (report: GeneratedMedicalReport) => {
  if (report.downloadUrl) {
    if (/^https?:\/\//i.test(report.downloadUrl)) return report.downloadUrl;
    return `${BASE_URL}${report.downloadUrl.startsWith("/") ? "" : "/"}${report.downloadUrl}`;
  }
  return `${BASE_URL}/api/patient/reports/${encodeURIComponent(report.reportId)}/download`;
};

const downloadOnWeb = async (report: GeneratedMedicalReport): Promise<string> => {
  const response = await fetch(reportDownloadUrl(report), { headers: await authHeaders() });
  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to download the medical report."));
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = sanitizeFileName(report.fileName);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  return objectUrl;
};

const downloadOnNative = async (report: GeneratedMedicalReport): Promise<string> => {
  const baseDirectory = FileSystem.documentDirectory || FileSystem.cacheDirectory;
  if (!baseDirectory) {
    throw new Error("Local document storage is unavailable on this device.");
  }

  const folder = `${baseDirectory}dr-healthcare-reports/`;
  await FileSystem.makeDirectoryAsync(folder, { intermediates: true }).catch(() => undefined);

  const fileUri = `${folder}${sanitizeFileName(report.fileName)}`;
  const result = await FileSystem.downloadAsync(reportDownloadUrl(report), fileUri, {
    headers: await authHeaders(),
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Unable to download the medical report (HTTP ${result.status}).`);
  }
  return result.uri;
};

export const downloadMedicalReport = async (
  report: GeneratedMedicalReport
): Promise<string> => {
  if (Platform.OS === "web") return downloadOnWeb(report);
  return downloadOnNative(report);
};

export const shareMedicalReport = async (
  report: GeneratedMedicalReport
): Promise<string> => {
  if (Platform.OS === "web") {
    await downloadOnWeb(report);
    return "";
  }

  const uri = await downloadOnNative(report);
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error("The system share sheet is not available on this device.");
  }

  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: "Share DR Healthcare medical report",
    UTI: "com.adobe.pdf",
  });
  return uri;
};
