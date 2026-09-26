import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import type { VisionPrescription } from "./visionPrescriptions";

const STORAGE_PREFIX = "@eyecare/vision-prescription-reminders/";
const CHANNEL_ID = "vision-prescription-reminders";

interface StoredState {
  prescriptionId: string;
  notificationIds: string[];
  updatedAt: string;
}

const storageKey = (id: string) => `${STORAGE_PREFIX}${id}`;

const parseLocalDate = (value?: string | null): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 9, 0, 0, 0);
  if (
    parsed.getFullYear() !== Number(match[1]) ||
    parsed.getMonth() !== Number(match[2]) - 1 ||
    parsed.getDate() !== Number(match[3])
  ) return null;
  return parsed;
};

const shiftDays = (value: Date, days: number) => {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
};

async function cancelForPrescription(id: string) {
  const raw = await AsyncStorage.getItem(storageKey(id));
  if (!raw) return;
  try {
    const state = JSON.parse(raw) as StoredState;
    if (Platform.OS !== "web") {
      const Notifications = await import("expo-notifications");
      await Promise.all(
        (state.notificationIds || []).map((notificationId) =>
          Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => undefined)
        )
      );
    }
  } catch {
    // Corrupted local reminder state is safe to discard.
  }
  await AsyncStorage.removeItem(storageKey(id));
}

export async function syncVisionPrescriptionNotifications(records: VisionPrescription[]) {
  const current = records.filter((item) => item.isCurrent && item.expiryDate);
  const currentIds = new Set(current.map((item) => item.id));
  const keys = await AsyncStorage.getAllKeys();
  for (const key of keys.filter((item) => item.startsWith(STORAGE_PREFIX))) {
    const id = key.slice(STORAGE_PREFIX.length);
    if (!currentIds.has(id)) await cancelForPrescription(id);
  }

  for (const record of current) await cancelForPrescription(record.id);
  if (Platform.OS === "web") return { supported: false, scheduledCount: 0 };

  const Notifications = await import("expo-notifications");
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Vision prescription reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 200, 150, 200],
      lightColor: "#0D9488",
    });
  }

  const permission = await Notifications.getPermissionsAsync();
  let status = permission.status;
  if (status !== "granted" && permission.canAskAgain) {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== "granted") return { supported: true, permissionGranted: false, scheduledCount: 0 };

  const now = new Date();
  let scheduledCount = 0;
  for (const record of current) {
    const expiry = parseLocalDate(record.expiryDate);
    if (!expiry) continue;
    const ids: string[] = [];
    const label = record.type === "glasses" ? "glasses" : "contact lens";

    for (const daysBefore of [30, 7, 1]) {
      const fireDate = shiftDays(expiry, -daysBefore);
      if (fireDate.getTime() <= now.getTime() + 30_000) continue;
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Vision prescription expiring soon",
          body: `Your ${label} prescription expires in ${daysBefore} ${daysBefore === 1 ? "day" : "days"}. Consider scheduling an eye examination.`,
          sound: "default",
          data: { route: "/vision-vault", prescriptionId: record.id, reminderType: "vision_prescription_expiry" },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireDate,
          ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
        },
      });
      ids.push(id);
      scheduledCount += 1;
    }

    const state: StoredState = { prescriptionId: record.id, notificationIds: ids, updatedAt: new Date().toISOString() };
    await AsyncStorage.setItem(storageKey(record.id), JSON.stringify(state));
  }

  return { supported: true, permissionGranted: true, scheduledCount };
}
