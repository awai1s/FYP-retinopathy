import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import BASE_URL from "../services/api";
import { flushSyncQueue, getPendingSyncCount } from "../services/syncQueue";
import { getLastOfflineSyncAt } from "../services/offlineCache";
import { refreshEssentialPatientOfflineCache } from "../services/offlineBootstrap";

interface NetworkContextValue {
  isOnline: boolean;
  checking: boolean;
  lastCheckedAt: string | null;
  lastSyncAt: string | null;
  pendingActions: number;
  refreshNetwork: () => Promise<boolean>;
  syncNow: () => Promise<void>;
}

const NetworkContext = createContext<NetworkContextValue>({
  isOnline: true,
  checking: true,
  lastCheckedAt: null,
  lastSyncAt: null,
  pendingActions: 0,
  refreshNetwork: async () => true,
  syncNow: async () => undefined,
});

async function backendReachable(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${BASE_URL}/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const initialBrowserState = Platform.OS === "web" && typeof navigator !== "undefined" ? navigator.onLine : true;
  const [isOnline, setIsOnline] = useState(initialBrowserState);
  const [checking, setChecking] = useState(true);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState(0);
  const syncingRef = useRef(false);
  const cacheBootstrappedRef = useRef(false);

  const refreshMetadata = useCallback(async () => {
    setLastSyncAt(await getLastOfflineSyncAt());
    setPendingActions(await getPendingSyncCount());
  }, []);

  const syncNow = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      const reachable = await backendReachable();
      setIsOnline(reachable);
      setLastCheckedAt(new Date().toISOString());
      if (reachable) {
        await flushSyncQueue();
        if (!cacheBootstrappedRef.current) {
          cacheBootstrappedRef.current = await refreshEssentialPatientOfflineCache();
        }
      } else {
        cacheBootstrappedRef.current = false;
      }
      await refreshMetadata();
    } finally {
      syncingRef.current = false;
      setChecking(false);
    }
  }, [refreshMetadata]);

  const refreshNetwork = useCallback(async () => {
    const reachable = await backendReachable();
    setIsOnline(reachable);
    setLastCheckedAt(new Date().toISOString());
    setChecking(false);
    if (reachable) {
      await flushSyncQueue();
      if (!cacheBootstrappedRef.current) {
        cacheBootstrappedRef.current = await refreshEssentialPatientOfflineCache();
      }
    } else {
      cacheBootstrappedRef.current = false;
    }
    await refreshMetadata();
    return reachable;
  }, [refreshMetadata]);

  useEffect(() => {
    void syncNow();
    const interval = setInterval(() => void syncNow(), 20000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncNow();
    });
    let cleanupWeb = () => undefined;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const handleOnline = () => void syncNow();
      const handleOffline = () => {
        setIsOnline(false);
        setLastCheckedAt(new Date().toISOString());
        void refreshMetadata();
      };
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      cleanupWeb = () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
    return () => {
      clearInterval(interval);
      subscription.remove();
      cleanupWeb();
    };
  }, [refreshMetadata, syncNow]);

  return (
    <NetworkContext.Provider value={{ isOnline, checking, lastCheckedAt, lastSyncAt, pendingActions, refreshNetwork, syncNow }}>
      {children}
    </NetworkContext.Provider>
  );
}

export const useNetwork = () => useContext(NetworkContext);
