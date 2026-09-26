import BASE_URL from "./api";
import { getToken } from "./storage";

export type ConsentItem = {
  scope: string;
  granted: boolean;
  updatedAt?: string;
};

const request = async (path: string, init?: RequestInit) => {
  const token = await getToken();
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Consent request failed.");
  return data;
};

export const getConsents = async (): Promise<ConsentItem[]> => {
  const data = await request("/api/patient/consent");
  return Array.isArray(data.consents) ? data.consents : [];
};

export const getConsent = async (scope: string, defaultValue = false) => {
  const items = await getConsents();
  const match = items.find((item) => String(item.scope || "").toLowerCase() === scope.toLowerCase());
  return match ? Boolean(match.granted) : defaultValue;
};

export const setConsent = (scope: string, granted: boolean) =>
  request("/api/patient/consent", {
    method: "POST",
    body: JSON.stringify({ scope, granted }),
  });

export const getScreeningConsent = async () => getConsent("screening", false);
export const setScreeningConsent = (granted: boolean) => setConsent("screening", granted);
