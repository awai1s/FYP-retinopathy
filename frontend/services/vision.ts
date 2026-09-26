import BASE_URL from "./api";
import { getToken } from "./storage";
import { appendUploadFile } from "./uploadFile";

export type VisionTestPayload = {
  testType: string;
  score?: number;
  result?: string;
  durationSeconds?: number;
  metadata?: Record<string, unknown>;
};

const headers = async () => {
  const token = await getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const parse = async (response: Response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Vision request failed.");
  return data;
};

export const saveVisionTest = async (payload: VisionTestPayload) => {
  const response = await fetch(`${BASE_URL}/api/vision-tests`, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify(payload),
  });
  return parse(response);
};

export const getVisionTests = async () => {
  const response = await fetch(`${BASE_URL}/api/vision-tests`, { headers: await headers() });
  return parse(response);
};

export const getGamification = async () => {
  const response = await fetch(`${BASE_URL}/api/gamification`, { headers: await headers() });
  return parse(response);
};

export const evaluateImageQuality = async (file: { uri: string; name: string; type: string }) => {
  const token = await getToken();
  const form = new FormData();
  await appendUploadFile(form, "file", file, "retinal-image");
  const response = await fetch(`${BASE_URL}/api/patient/image-quality`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  return parse(response);
};
