import BASE_URL from "./api";
import { getToken } from "./storage";

export interface RetinalImage { id: string; fileId: string; fileName: string; contentType: string; createdAt?: string; url: string; }
type ImageSource = { uri: string; headers: Record<string, string> };

export const getPatientRetinalImages = async (patientId: string): Promise<RetinalImage[]> => {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${BASE_URL}/api/clinical/patients/${encodeURIComponent(patientId)}/retinal-images`, { headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Unable to load retinal images.");
  return (data.images || []).map((item: any) => ({ ...item, id: String(item.id || ""), fileId: String(item.fileId || ""), url: String(item.url || "") }));
};

export const getRetinalImageSource = async (relativeUrl: string): Promise<ImageSource> => {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return { uri: relativeUrl.startsWith("http") ? relativeUrl : `${BASE_URL}${relativeUrl}`, headers };
};
