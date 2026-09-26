import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import BASE_URL from "./api";
import { getToken } from "./storage";

const authHeaders = async (): Promise<Record<string, string>> => {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const request = async (path: string) => {
  const response = await fetch(`${BASE_URL}${path}`, { headers: await authHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Clinical summary request failed.");
  return data;
};

export const getClinicalSummary = (predictionId: string) =>
  request(`/api/clinical/summary/${encodeURIComponent(predictionId)}`);

export const getLatestPatientClinicalSummary = (patientId: string) =>
  request(`/api/clinical/summary/patient/${encodeURIComponent(patientId)}/latest`);

export const downloadClinicalSummary = async (predictionId: string) => {
  const url = `${BASE_URL}/api/clinical/summary/${encodeURIComponent(predictionId)}/download`;
  const headers = await authHeaders();

  if (Platform.OS === "web") {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || "Unable to download the summary.");
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `DR-Healthcare-Clinical-Summary-${predictionId}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    return;
  }

  const baseDirectory = FileSystem.documentDirectory || FileSystem.cacheDirectory;
  if (!baseDirectory) throw new Error("Local document storage is unavailable on this device.");
  const folder = `${baseDirectory}dr-healthcare-reports/`;
  await FileSystem.makeDirectoryAsync(folder, { intermediates: true }).catch(() => undefined);
  const destination = `${folder}DR-Healthcare-Clinical-Summary-${predictionId}.pdf`;
  const downloaded = await FileSystem.downloadAsync(url, destination, { headers });
  if (downloaded.status < 200 || downloaded.status >= 300) {
    throw new Error(`Unable to download the summary (HTTP ${downloaded.status}).`);
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(downloaded.uri, {
      mimeType: "application/pdf",
      dialogTitle: "Share DR Healthcare clinical summary",
      UTI: "com.adobe.pdf",
    });
  }
};
