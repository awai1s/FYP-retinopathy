import AsyncStorage from "@react-native-async-storage/async-storage";
import BASE_URL from "./api";
import { getToken } from "./storage";
import { getOfflinePrivateStorageKey, readOfflineCache, writeOfflineCache } from "./offlineCache";
import type { MedicationAdherence, MedicationAdherenceUpdate } from "./prescriptions";


export interface MedicationSyncOperation {
  id: string;
  type: "medication_adherence";
  prescriptionId: string;
  payload: MedicationAdherenceUpdate;
  createdAt: string;
  attempts: number;
  lastError?: string;
  terminal?: boolean;
}

function operationId(): string {
  return `med-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function localDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function queueKey() { return getOfflinePrivateStorageKey("sync-queue"); }

let queueMutation: Promise<unknown> = Promise.resolve();
function withQueueLock<T>(work: () => Promise<T>): Promise<T> {
  const result = queueMutation.then(work, work);
  queueMutation = result.catch(() => undefined);
  return result;
}

async function readQueue(): Promise<MedicationSyncOperation[]> {
  const raw = await AsyncStorage.getItem(await queueKey());
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: MedicationSyncOperation[]): Promise<void> {
  if (!queue.length) await AsyncStorage.removeItem(await queueKey());
  else await AsyncStorage.setItem(await queueKey(), JSON.stringify(queue));
}

export async function getPendingSyncCount(): Promise<number> {
  return (await readQueue()).length;
}

export async function clearSyncQueue(): Promise<void> {
  await withQueueLock(async () => { await AsyncStorage.removeItem(await queueKey()); });
}

function computeTodaySummary(data: MedicationAdherence): MedicationAdherence {
  const doses = data.todayDoses || [];
  const taken = doses.filter((item) => item.status === "Taken").length;
  const missed = doses.filter((item) => item.status === "Missed").length;
  const skipped = doses.filter((item) => item.status === "Skipped").length;
  const pending = doses.filter((item) => item.status === "Pending").length;
  const expected = doses.length;
  const completed = taken + missed + skipped;
  const percent = expected ? Math.round((taken / expected) * 100) : 0;
  return {
    ...data,
    today: { ...data.today, taken, missed, skipped, pending, expected, completed, percent },
  };
}

async function optimisticallyUpdateAdherence(operation: MedicationSyncOperation): Promise<void> {
  for (const days of [7, 30] as const) {
    const key = days === 7 ? "patient-adherence-7" : "patient-adherence-30";
    const cached = await readOfflineCache<MedicationAdherence>(key);
    if (!cached) continue;
    const doseKey = operation.payload.doseKey || "Daily";
    const next = {
      ...cached,
      todayDoses: (cached.todayDoses || []).map((dose) =>
        dose.prescriptionId === operation.prescriptionId && dose.doseKey === doseKey
          ? {
              ...dose,
              status: operation.payload.status || (operation.payload.taken ? "Taken" : "Skipped"),
              snoozedUntil: operation.payload.snoozedUntil || null,
              takenAt: operation.payload.status === "Taken" || operation.payload.taken ? new Date().toISOString() : null,
            }
          : dose
      ),
    } as MedicationAdherence;
    // Local optimistic edits are not a server sync; preserve the previous Last Sync timestamp.
    await writeOfflineCache(key, computeTodaySummary(next), { markSynced: false });
  }
}

export async function queueMedicationAdherence(
  prescriptionId: string,
  payload: MedicationAdherenceUpdate
): Promise<MedicationSyncOperation> {
  return withQueueLock(async () => {
  const queue = await readQueue();
  const operation: MedicationSyncOperation = {
    id: operationId(),
    type: "medication_adherence",
    prescriptionId,
    payload: { ...payload, scheduledDate: payload.scheduledDate || localDateKey() },
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  queue.push(operation);
  await saveQueue(queue);
  await optimisticallyUpdateAdherence(operation);
  return operation;
  });
}

export async function flushSyncQueue(): Promise<{ synced: number; pending: number }> {
  return withQueueLock(flushSyncQueueUnlocked);
}

async function flushSyncQueueUnlocked(): Promise<{ synced: number; pending: number }> {
  const token = await getToken();
  if (!token) return { synced: 0, pending: await getPendingSyncCount() };
  const queue = await readQueue();
  if (!queue.length) return { synced: 0, pending: 0 };

  const remaining: MedicationSyncOperation[] = [];
  let synced = 0;

  for (const operation of queue) {
    if (operation.terminal) {
      remaining.push(operation);
      continue;
    }
    try {
      const response = await fetch(
        `${BASE_URL}/api/patient/prescriptions/${encodeURIComponent(operation.prescriptionId)}/adherence`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...operation.payload, clientOperationId: operation.id }),
        }
      );
      if (response.ok) {
        synced += 1;
        continue;
      }
      const retryable = response.status === 401 || response.status === 408 || response.status === 429 || response.status >= 500;
      const data = await response.json().catch(() => ({}));
      remaining.push({
        ...operation,
        attempts: operation.attempts + 1,
        terminal: !retryable,
        lastError: data.detail || data.message || `HTTP ${response.status}`,
      });
    } catch (error: any) {
      remaining.push({
        ...operation,
        attempts: operation.attempts + 1,
        lastError: error?.message || "Network unavailable",
      });
      // If the network is down, later operations will fail too. Preserve them untouched.
      remaining.push(...queue.slice(queue.indexOf(operation) + 1));
      break;
    }
  }

  await saveQueue(remaining);
  return { synced, pending: remaining.length };
}
