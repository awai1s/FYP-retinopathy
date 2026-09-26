import BASE_URL from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ConversationPerson = {
  id: string;
  name: string;
  role: "Patient" | "Doctor";
  specialization?: string | null;
};

export type Conversation = {
  conversationId: string;
  person: ConversationPerson;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  unreadCount: number;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  message: string;
  messageType: string;
  createdAt: string;
  attachmentId?: string | null;
  attachmentType?: string | null;
};

export type MessageReference = {
  id: string;
  title: string;
  description: string;
};

const getToken = async () => {
  return AsyncStorage.getItem("token");
};

const request = async (endpoint: string, options: RequestInit = {}) => {
  const token = await getToken();

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.detail ||
        data?.message ||
        `Request failed with status ${response.status}`
    );
  }

  return data;
};

export const getConversations = async (): Promise<{
  conversations: Conversation[];
}> => {
  return request("/messages/conversations");
};

export const getMessages = async (
  conversationId: string
): Promise<{
  person: ConversationPerson;
  messages: ChatMessage[];
}> => {
  return request(`/messages/conversations/${conversationId}`);
};

export const sendMessage = async (
  conversationId: string,
  message: string
): Promise<ChatMessage> => {
  return request(`/messages/conversations/${conversationId}`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
};

export const markConversationRead = async (conversationId: string) => {
  return request(`/messages/conversations/${conversationId}/read`, {
    method: "POST",
  });
};

export const getShareableReferences = async (
  conversationId: string
): Promise<{
  references: MessageReference[];
}> => {
  return request(
    `/messages/conversations/${conversationId}/references`
  );
};

export const sendReportReference = async (
  conversationId: string,
  reference: MessageReference
): Promise<ChatMessage> => {
  return request(
    `/messages/conversations/${conversationId}/references`,
    {
      method: "POST",
      body: JSON.stringify({
        referenceId: reference.id,
      }),
    }
  );
};

export const shareReference = async (
  conversationId: string,
  reference: MessageReference
): Promise<ChatMessage> => {
  return request(`/messages/conversations/${conversationId}/references`, {
    method: "POST",
    body: JSON.stringify({
      referenceId: reference.id,
    }),
  });
};