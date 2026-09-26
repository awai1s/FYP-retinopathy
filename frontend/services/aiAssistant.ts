import { Platform } from "react-native";

import BASE_URL from "./api";
import { getToken } from "./storage";

export type AssistantLanguage = "en" | "ur";
export type AssistantMessageRole = "user" | "assistant";

export interface AssistantSource {
  id: string;
  title: string;
  url?: string;
  kind?: "knowledge" | "patient_context" | string;
}

export interface AssistantSession {
  id: string;
  ownerUserId: string;
  ownerRole: "Patient" | "Doctor" | "Hospital";
  patientId?: string | null;
  contextScope: string;
  status: "active" | "archived";
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface AssistantMessage {
  id: string;
  sessionId: string;
  role: AssistantMessageRole;
  content: string;
  language?: AssistantLanguage;
  mode?: "rag_llm" | "rag_extract" | "patient_context" | "scope" | string | null;
  sources?: AssistantSource[];
  createdAt: string;
}

export interface AuthorizedAssistantPatient {
  id: string;
  name: string;
  username?: string | null;
}

export interface AssistantHealth {
  status: string;
  rag: boolean;
  languages: AssistantLanguage[];
  answerMode: string;
  nativeVoiceTranscriptionConfigured: boolean;
  webVoiceRecognition: string;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();
  let data: any = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data?.detail ||
        data?.message ||
        `AI Assistant request failed (${response.status})`
    );
  }

  return data as T;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
      ...(options.headers || {}),
    },
  });
  return parseResponse<T>(response);
}

export const getAssistantHealth = () =>
  request<AssistantHealth>("/api/ai-assistant/health");

export const getAuthorizedAssistantPatients = () =>
  request<{ patients: AuthorizedAssistantPatient[] }>(
    "/api/ai-assistant/authorized-patients"
  );

export const getAssistantSessions = () =>
  request<{ sessions: AssistantSession[] }>("/api/ai-assistant/sessions");

export const createAssistantSession = (patientId?: string) =>
  request<AssistantSession>("/api/ai-assistant/sessions", {
    method: "POST",
    body: JSON.stringify(patientId ? { patientId } : {}),
  });

export const getAssistantMessages = (sessionId: string) =>
  request<{ session: AssistantSession; messages: AssistantMessage[] }>(
    `/api/ai-assistant/sessions/${encodeURIComponent(sessionId)}/messages`
  );

export const sendAssistantMessage = (
  sessionId: string,
  message: string,
  language: AssistantLanguage
) =>
  request<{
    sessionId: string;
    language: AssistantLanguage;
    mode: string;
    userMessage: AssistantMessage;
    assistantMessage: AssistantMessage;
  }>(`/api/ai-assistant/sessions/${encodeURIComponent(sessionId)}/messages`, {
    method: "POST",
    body: JSON.stringify({ message, language }),
  });

export const getAssistantContextOptions = () =>
  request<{
    role: "Patient" | "Doctor" | "Hospital";
    availableScopes: string[];
    patientContextEnabled: boolean;
    languages?: AssistantLanguage[];
    message: string;
  }>("/api/ai-assistant/context-options");

/**
 * Upload a short voice recording for speech-to-text on Android/iOS.
 * Expo Web normally uses the browser SpeechRecognition API instead.
 */
export const transcribeAssistantAudio = async (
  uri: string,
  language: AssistantLanguage
): Promise<{ text: string; language: AssistantLanguage }> => {
  const formData = new FormData();
  formData.append("language", language);

  if (Platform.OS === "web") {
    const audioResponse = await fetch(uri);
    const blob = await audioResponse.blob();
    formData.append("file", blob, "assistant-voice.webm");
  } else {
    formData.append(
      "file",
      {
        uri,
        name: "assistant-voice.m4a",
        type: "audio/m4a",
      } as any
    );
  }

  const response = await fetch(`${BASE_URL}/api/ai-assistant/transcribe`, {
    method: "POST",
    headers: await authHeaders(),
    body: formData,
  });

  return parseResponse<{ text: string; language: AssistantLanguage }>(response);
};
