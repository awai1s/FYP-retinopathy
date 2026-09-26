import { getToken } from "./storage";
import BASE_URL from "./api";

export type NotificationType =
  | "appointment"
  | "screening"
  | "follow_up"
  | "medication"
  | "abnormal_result"
  | "report"
  | "message"
  | "verification"
  | "connection"
  | "privacy_access"
  | "consultation"
  | "vision_prescription"
  | "equipment"
  | "privilege";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  relatedId?: string;
}

const getAuthHeaders = async () => {
  const token = await getToken();

  return {
    "Content-Type": "application/json",
    ...(token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {}),
  };
};

const handleResponse = async (
  response: Response,
  defaultMessage: string
) => {
  if (!response.ok) {
    const errorText = await response.text();

    let message = defaultMessage;

    try {
      const errorData = JSON.parse(errorText);

      message =
        errorData.detail ||
        errorData.message ||
        errorData.error ||
        message;
    } catch {
      if (errorText) {
        message = errorText;
      }
    }

    throw new Error(message);
  }

  /*
   * Some PATCH endpoints may return 204 No Content.
   * Avoid calling response.json() in that case.
   */
  if (response.status === 204) {
    return null;
  }

  const contentType =
    response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    return null;
  }

  return response.json();
};

/**
 * Get notifications for the logged-in account.
 *
 * BACKEND CONTRACT:
 * GET /api/notifications
 */
export const getNotifications = async (): Promise<
  AppNotification[]
> => {
  try {
    const headers = await getAuthHeaders();

    const response = await fetch(
      `${BASE_URL}/api/notifications`,
      {
        method: "GET",
        headers,
      }
    );

    const data = await handleResponse(
      response,
      "Failed to load notifications."
    );

    const notifications = Array.isArray(data)
      ? data
      : data?.notifications ||
        data?.results ||
        [];

    return notifications.map(
      (item: any): AppNotification => ({
        id: String(
          item.id ??
            item.notificationId ??
            ""
        ),

        title:
          item.title ??
          "Notification",

        message:
          item.message ??
          item.description ??
          "",

        type:
          item.type ??
          "screening",

        read:
          item.read ??
          item.isRead ??
          item.is_read ??
          false,

        createdAt:
          item.createdAt ??
          item.created_at ??
          item.date ??
          "",

        relatedId:
          item.relatedId ??
          item.related_id ??
          undefined,
      })
    );
  } catch (error) {
    console.error(
      "getNotifications error:",
      error
    );

    throw error;
  }
};

/**
 * Mark one notification as read.
 *
 * BACKEND CONTRACT:
 * PATCH /api/notifications/{id}/read
 */
export const markNotificationAsRead = async (
  notificationId: string
) => {
  try {
    const headers = await getAuthHeaders();

    const response = await fetch(
      `${BASE_URL}/api/notifications/${notificationId}/read`,
      {
        method: "PATCH",
        headers,
      }
    );

    return await handleResponse(
      response,
      "Failed to mark notification as read."
    );
  } catch (error) {
    console.error(
      "markNotificationAsRead error:",
      error
    );

    throw error;
  }
};

/**
 * Mark all notifications as read.
 *
 * BACKEND CONTRACT:
 * PATCH /api/notifications/read-all
 */
export const markAllNotificationsAsRead =
  async () => {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(
        `${BASE_URL}/api/notifications/read-all`,
        {
          method: "PATCH",
          headers,
        }
      );

      return await handleResponse(
        response,
        "Failed to mark notifications as read."
      );
    } catch (error) {
      console.error(
        "markAllNotificationsAsRead error:",
        error
      );

      throw error;
    }
  };
