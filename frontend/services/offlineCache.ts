import AsyncStorage from "@react-native-async-storage/async-storage";

export const OFFLINE_SCHEMA_VERSION = 1;
const PRIVATE_PREFIX = `@eyecare/offline/v${OFFLINE_SCHEMA_VERSION}`;
const OWNER_KEY = "@eyecare/offline-owner";
const SAVED_EDUCATION_KEY = "@eyecare/offline-education-saved";

export type OfflineCacheName =
  | "patient-medications"
  | "patient-adherence-7"
  | "patient-adherence-30"
  | "patient-appointments"
  | "patient-health-card"
  | "patient-dashboard"
  | "patient-education-assignments";

export interface OfflineEnvelope<T> {
  schemaVersion: number;
  updatedAt: string;
  data: T;
}

export interface OfflineCacheSummary {
  lastSyncAt: string | null;
  available: Record<OfflineCacheName, boolean>;
}

function hashIdentity(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export async function setOfflineOwnerIdentity(identity: string): Promise<void> {
  const normalized = identity.trim().toLowerCase();
  if (!normalized) return;
  const next = hashIdentity(normalized);
  const current = await AsyncStorage.getItem(OWNER_KEY);
  if (current && current !== next) {
    await clearAllPrivateOfflineData();
  }
  await AsyncStorage.setItem(OWNER_KEY, next);
}

export async function getOfflineOwnerKey(): Promise<string> {
  return (await AsyncStorage.getItem(OWNER_KEY)) || "session";
}

export async function getOfflinePrivateStorageKey(name: string): Promise<string> {
  return `${PRIVATE_PREFIX}/${await getOfflineOwnerKey()}/${name}`;
}

export async function writeOfflineCache<T>(
  name: OfflineCacheName,
  data: T,
  options: { markSynced?: boolean } = {}
): Promise<void> {
  const envelope: OfflineEnvelope<T> = {
    schemaVersion: OFFLINE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    data,
  };
  await AsyncStorage.setItem(await getOfflinePrivateStorageKey(name), JSON.stringify(envelope));
  if (options.markSynced !== false) await markOfflineSyncSuccess(envelope.updatedAt);
}

export async function readOfflineEnvelope<T>(name: OfflineCacheName): Promise<OfflineEnvelope<T> | null> {
  const raw = await AsyncStorage.getItem(await getOfflinePrivateStorageKey(name));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OfflineEnvelope<T>;
    if (parsed.schemaVersion !== OFFLINE_SCHEMA_VERSION || !parsed.updatedAt) {
      await AsyncStorage.removeItem(await getOfflinePrivateStorageKey(name));
      return null;
    }
    return parsed;
  } catch {
    await AsyncStorage.removeItem(await getOfflinePrivateStorageKey(name));
    return null;
  }
}

export async function readOfflineCache<T>(name: OfflineCacheName): Promise<T | null> {
  return (await readOfflineEnvelope<T>(name))?.data ?? null;
}

export async function markOfflineSyncSuccess(value = new Date().toISOString()): Promise<void> {
  await AsyncStorage.setItem(await getOfflinePrivateStorageKey("last-sync"), value);
}

export async function getLastOfflineSyncAt(): Promise<string | null> {
  return AsyncStorage.getItem(await getOfflinePrivateStorageKey("last-sync"));
}

export async function getOfflineCacheSummary(): Promise<OfflineCacheSummary> {
  const names: OfflineCacheName[] = [
    "patient-medications",
    "patient-adherence-7",
    "patient-adherence-30",
    "patient-appointments",
    "patient-health-card",
    "patient-dashboard",
    "patient-education-assignments",
  ];
  const available = {} as Record<OfflineCacheName, boolean>;
  for (const name of names) available[name] = Boolean(await AsyncStorage.getItem(await getOfflinePrivateStorageKey(name)));
  return { lastSyncAt: await getLastOfflineSyncAt(), available };
}

export async function clearAllPrivateOfflineData(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const privateKeys = keys.filter((key) => key.startsWith(`${PRIVATE_PREFIX}/`));
  if (privateKeys.length) await AsyncStorage.multiRemove(privateKeys);
  await AsyncStorage.removeItem(OWNER_KEY);
}

export async function getSavedEducationArticleIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(SAVED_EDUCATION_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export async function setEducationArticleSaved(articleId: string, saved: boolean): Promise<string[]> {
  const ids = new Set(await getSavedEducationArticleIds());
  if (saved) ids.add(articleId);
  else ids.delete(articleId);
  const next = Array.from(ids);
  await AsyncStorage.setItem(SAVED_EDUCATION_KEY, JSON.stringify(next));
  return next;
}

export function isLikelyNetworkError(error: unknown): boolean {
  const item = error as any;
  const status = Number(item?.status || 0);
  if (status === 401 || status === 403 || status === 404 || status === 422) return false;
  if (status >= 500 || status === 408 || status === 429) return true;
  const message = String(item?.message || error || "").toLowerCase();
  return (
    item instanceof TypeError ||
    message.includes("network request failed") ||
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("cannot reach") ||
    message.includes("timed out") ||
    message.includes("server is temporarily unavailable")
  );
}
