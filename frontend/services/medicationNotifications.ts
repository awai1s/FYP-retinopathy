import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import type { MedicationDose, Prescription } from "./prescriptions";

const STORAGE_PREFIX = "@dr-healthcare/medication-reminders/";
const CHANNEL_ID = "medication-reminders";
const MAX_SCHEDULED_EVENTS = 60;
const ROLLING_WINDOW_DAYS = 14;

const TIME_CONFIG: Record<string, { hour: number; minute: number; label: string }> = {
  Morning: { hour: 8, minute: 0, label: "8:00 AM" },
  Noon: { hour: 12, minute: 0, label: "12:00 PM" },
  Evening: { hour: 18, minute: 0, label: "6:00 PM" },
  Night: { hour: 21, minute: 0, label: "9:00 PM" },
};

interface StoredReminderState {
  prescriptionId: string;
  notificationIds: string[];
  updatedAt: string;
}

interface ReminderCandidate {
  prescriptionId: string;
  medicationDetails: string;
  dosage?: string;
  intakeInstruction?: string;
  doseKey?: string;
  fireDate: Date;
  type: "dose" | "refill";
}

export interface NotificationSyncResult {
  supported: boolean;
  permissionGranted: boolean;
  scheduledCount: number;
}

let handlerConfigured = false;

const storageKey = (prescriptionId: string) =>
  `${STORAGE_PREFIX}${prescriptionId}`;

const parseLocalDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, month, day, 0, 0, 0, 0);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
};

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const addDays = (value: Date, days: number) => {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
};

const medicationIsActive = (prescription: Prescription) => {
  if (prescription.active === false || prescription.lifecycleStatus === "Completed") {
    return false;
  }

  const today = startOfToday();
  const end = parseLocalDate(prescription.endDate);
  return !end || end >= today;
};

const loadStoredState = async (
  prescriptionId: string
): Promise<StoredReminderState | null> => {
  const raw = await AsyncStorage.getItem(storageKey(prescriptionId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredReminderState;
  } catch {
    await AsyncStorage.removeItem(storageKey(prescriptionId));
    return null;
  }
};

const saveStoredState = async (
  prescriptionId: string,
  notificationIds: string[]
) => {
  const state: StoredReminderState = {
    prescriptionId,
    notificationIds,
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(storageKey(prescriptionId), JSON.stringify(state));
};

export const configureMedicationNotificationHandler = async () => {
  if (handlerConfigured || Platform.OS === "web") return;

  try {
    const Notifications = await import("expo-notifications");
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    handlerConfigured = true;
  } catch (error) {
    console.warn("Medication notification handler unavailable:", error);
  }
};

const prepareNotifications = async () => {
  if (Platform.OS === "web") {
    return { supported: false as const, granted: false as const, Notifications: null };
  }

  const Notifications = await import("expo-notifications");
  await configureMedicationNotificationHandler();

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Medication reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#0D9488",
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted" && existing.canAskAgain) {
    status = (await Notifications.requestPermissionsAsync()).status;
  }

  return {
    supported: true as const,
    granted: status === "granted",
    Notifications,
  };
};

export const cancelMedicationNotifications = async (
  prescriptionId: string
) => {
  const state = await loadStoredState(prescriptionId);
  if (!state) return;

  if (Platform.OS !== "web") {
    try {
      const Notifications = await import("expo-notifications");
      await Promise.all(
        state.notificationIds.map((id) =>
          Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)
        )
      );
    } catch (error) {
      console.warn("Unable to cancel medication reminders:", error);
    }
  }

  await AsyncStorage.removeItem(storageKey(prescriptionId));
};

const buildCandidates = (prescriptions: Prescription[]): ReminderCandidate[] => {
  const now = new Date();
  const today = startOfToday();
  const horizon = addDays(today, ROLLING_WINDOW_DAYS - 1);
  const candidates: ReminderCandidate[] = [];

  for (const prescription of prescriptions) {
    if (!prescription.id || !medicationIsActive(prescription)) continue;

    const startDate = parseLocalDate(prescription.startDate) || today;
    const endDate = parseLocalDate(prescription.endDate) || horizon;
    const windowStart = startDate > today ? startDate : today;
    const windowEnd = endDate < horizon ? endDate : horizon;

    const doseKeys = (prescription.times || []).filter((time) => TIME_CONFIG[time]);

    for (
      let day = new Date(windowStart);
      day <= windowEnd;
      day = addDays(day, 1)
    ) {
      for (const doseKey of doseKeys) {
        const config = TIME_CONFIG[doseKey];
        const fireDate = new Date(
          day.getFullYear(),
          day.getMonth(),
          day.getDate(),
          config.hour,
          config.minute,
          0,
          0
        );

        if (fireDate.getTime() <= now.getTime() + 15_000) continue;

        candidates.push({
          prescriptionId: prescription.id,
          medicationDetails: prescription.medicationDetails,
          dosage: prescription.dosage,
          intakeInstruction: prescription.intakeInstruction,
          doseKey,
          fireDate,
          type: "dose",
        });
      }
    }

    // Refill/course-end reminder two days before the medication finishes.
    if (prescription.endDate) {
      const refillDate = parseLocalDate(prescription.endDate);
      if (refillDate) {
        refillDate.setDate(refillDate.getDate() - 2);
        refillDate.setHours(9, 0, 0, 0);
        if (refillDate.getTime() > now.getTime() + 15_000) {
          candidates.push({
            prescriptionId: prescription.id,
            medicationDetails: prescription.medicationDetails,
            dosage: prescription.dosage,
            intakeInstruction: prescription.intakeInstruction,
            fireDate: refillDate,
            type: "refill",
          });
        }
      }
    }
  }

  candidates.sort((a, b) => a.fireDate.getTime() - b.fireDate.getTime());
  return candidates.slice(0, MAX_SCHEDULED_EVENTS);
};

export const syncMedicationNotifications = async (
  prescriptions: Prescription[]
): Promise<NotificationSyncResult> => {
  const knownIds = new Set(prescriptions.map((item) => item.id).filter(Boolean));

  // Clean reminders belonging to medications that no longer appear in the API.
  const allKeys = await AsyncStorage.getAllKeys();
  const reminderKeys = allKeys.filter((key) => key.startsWith(STORAGE_PREFIX));
  for (const key of reminderKeys) {
    const prescriptionId = key.slice(STORAGE_PREFIX.length);
    if (!knownIds.has(prescriptionId)) {
      await cancelMedicationNotifications(prescriptionId);
    }
  }

  // Rebuild the rolling reminder window so edits and completed medications never
  // keep stale local notifications on the device.
  await Promise.all(
    prescriptions
      .filter((item) => item.id)
      .map((item) => cancelMedicationNotifications(item.id))
  );

  const prepared = await prepareNotifications();
  if (!prepared.supported) {
    return { supported: false, permissionGranted: false, scheduledCount: 0 };
  }
  if (!prepared.granted || !prepared.Notifications) {
    return { supported: true, permissionGranted: false, scheduledCount: 0 };
  }

  const idsByPrescription = new Map<string, string[]>();
  const candidates = buildCandidates(prescriptions);

  for (const candidate of candidates) {
    const isDose = candidate.type === "dose";
    const details = [candidate.dosage, candidate.intakeInstruction]
      .filter(Boolean)
      .join(" • ");

    const notificationId = await prepared.Notifications.scheduleNotificationAsync({
      content: {
        title: isDose ? "Medication reminder" : "Refill reminder",
        body: isDose
          ? `${candidate.medicationDetails}${details ? ` — ${details}` : ""}`
          : `${candidate.medicationDetails} is due to finish soon. Check whether you need a refill or follow-up.`,
        sound: "default",
        data: {
          route: "/prescriptions",
          prescriptionId: candidate.prescriptionId,
          doseKey: candidate.doseKey || "",
          reminderType: candidate.type,
        },
      },
      trigger: {
        type: prepared.Notifications.SchedulableTriggerInputTypes.DATE,
        date: candidate.fireDate,
        ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
      },
    });

    const bucket = idsByPrescription.get(candidate.prescriptionId) || [];
    bucket.push(notificationId);
    idsByPrescription.set(candidate.prescriptionId, bucket);
  }

  await Promise.all(
    prescriptions
      .filter((item) => item.id)
      .map((item) => saveStoredState(item.id, idsByPrescription.get(item.id) || []))
  );

  return {
    supported: true,
    permissionGranted: true,
    scheduledCount: candidates.length,
  };
};

export const snoozeMedicationDose = async (
  dose: MedicationDose,
  minutes: number = 10
): Promise<NotificationSyncResult> => {
  const prepared = await prepareNotifications();
  if (!prepared.supported) {
    return { supported: false, permissionGranted: false, scheduledCount: 0 };
  }
  if (!prepared.granted || !prepared.Notifications) {
    return { supported: true, permissionGranted: false, scheduledCount: 0 };
  }

  const fireDate = new Date(Date.now() + Math.max(1, minutes) * 60_000);
  const notificationId = await prepared.Notifications.scheduleNotificationAsync({
    content: {
      title: "Snoozed medication reminder",
      body: `${dose.medicationDetails}${dose.dosage ? ` — ${dose.dosage}` : ""}`,
      sound: "default",
      data: {
        route: "/prescriptions",
        prescriptionId: dose.prescriptionId,
        doseKey: dose.doseKey,
        reminderType: "snooze",
      },
    },
    trigger: {
      type: prepared.Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireDate,
      ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
    },
  });

  const state = await loadStoredState(dose.prescriptionId);
  await saveStoredState(dose.prescriptionId, [
    ...(state?.notificationIds || []),
    notificationId,
  ]);

  return { supported: true, permissionGranted: true, scheduledCount: 1 };
};

export const medicationTimeLabel = (doseKey: string) =>
  TIME_CONFIG[doseKey]?.label || doseKey || "Any time today";