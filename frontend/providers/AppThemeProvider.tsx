import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SystemUI from "expo-system-ui";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance, useColorScheme } from "react-native";

import {
  semanticDark,
  semanticLight,
  setRuntimeTheme,
  type EffectiveThemeMode,
  type SemanticColors,
  type TextScale,
  type ThemeMode,
} from "../design/theme/runtimeTheme";

export const THEME_STORAGE_KEYS = {
  themeMode: "@eyecare/theme-mode",
  eyeFriendly: "@eyecare/eye-friendly",
  textScale: "@eyecare/text-scale",
  reduceMotion: "@eyecare/reduce-motion",
} as const;

export interface AccessibilitySettings {
  eyeFriendly: boolean;
  textScale: TextScale;
  reduceMotion: boolean;
}

interface AppThemeContextValue extends AccessibilitySettings {
  themeMode: ThemeMode;
  effectiveMode: EffectiveThemeMode;
  isDark: boolean;
  colors: SemanticColors;
  textScaleFactor: number;
  revision: number;
  hydrated: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setEyeFriendly: (enabled: boolean) => Promise<void>;
  setTextScale: (scale: TextScale) => Promise<void>;
  setReduceMotion: (enabled: boolean) => Promise<void>;
  resetAppearance: () => Promise<void>;
}

const defaultContext: AppThemeContextValue = {
  themeMode: "system",
  effectiveMode: "light",
  isDark: false,
  colors: semanticLight,
  eyeFriendly: false,
  textScale: "normal",
  reduceMotion: false,
  textScaleFactor: 1,
  revision: 0,
  hydrated: false,
  setThemeMode: async () => undefined,
  setEyeFriendly: async () => undefined,
  setTextScale: async () => undefined,
  setReduceMotion: async () => undefined,
  resetAppearance: async () => undefined,
};

const AppThemeContext = createContext<AppThemeContextValue>(defaultContext);

function parseBoolean(value: string | null, fallback = false): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

function isTextScale(value: string | null): value is TextScale {
  return value === "normal" || value === "large" || value === "extraLarge";
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");
  const [eyeFriendly, setEyeFriendlyState] = useState(false);
  const [textScale, setTextScaleState] = useState<TextScale>("normal");
  const [reduceMotion, setReduceMotionState] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [revision, setRevision] = useState(0);

  const effectiveMode: EffectiveThemeMode =
    themeMode === "system" ? (systemScheme === "dark" ? "dark" : "light") : themeMode;

  const colors = effectiveMode === "dark" ? semanticDark : semanticLight;
  const textScaleFactor = ({ normal: 1, large: 1.12, extraLarge: 1.24 } as const)[textScale] * (eyeFriendly ? 1.06 : 1);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const entries = await AsyncStorage.multiGet([
          THEME_STORAGE_KEYS.themeMode,
          THEME_STORAGE_KEYS.eyeFriendly,
          THEME_STORAGE_KEYS.textScale,
          THEME_STORAGE_KEYS.reduceMotion,
        ]);
        if (!active) return;
        const stored = Object.fromEntries(entries);

        const storedTheme = stored[THEME_STORAGE_KEYS.themeMode] ?? null;
        const storedScale = stored[THEME_STORAGE_KEYS.textScale] ?? null;
        setThemeModeState(isThemeMode(storedTheme) ? storedTheme : "system");
        setEyeFriendlyState(parseBoolean(stored[THEME_STORAGE_KEYS.eyeFriendly] ?? null));
        setTextScaleState(isTextScale(storedScale) ? storedScale : "normal");
        setReduceMotionState(parseBoolean(stored[THEME_STORAGE_KEYS.reduceMotion] ?? null));
      } catch {
        // Safe defaults remain active if local preferences cannot be read.
      } finally {
        if (active) setHydrated(true);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setRuntimeTheme({
      scheme: effectiveMode,
      eyeFriendly,
      textScale,
      reduceMotion,
    });
    setRevision((value) => value + 1);

    try {
      Appearance.setColorScheme(themeMode === "system" ? null : themeMode);
    } catch {
      // Some targets do not expose setColorScheme. The context still controls the app theme.
    }

    void SystemUI.setBackgroundColorAsync(colors.background).catch(() => undefined);
  }, [colors.background, effectiveMode, eyeFriendly, reduceMotion, textScale, themeMode]);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await AsyncStorage.setItem(THEME_STORAGE_KEYS.themeMode, mode);
  }, []);

  const setEyeFriendly = useCallback(async (enabled: boolean) => {
    setEyeFriendlyState(enabled);
    await AsyncStorage.setItem(THEME_STORAGE_KEYS.eyeFriendly, String(enabled));
  }, []);

  const setTextScale = useCallback(async (scale: TextScale) => {
    setTextScaleState(scale);
    await AsyncStorage.setItem(THEME_STORAGE_KEYS.textScale, scale);
  }, []);

  const setReduceMotion = useCallback(async (enabled: boolean) => {
    setReduceMotionState(enabled);
    await AsyncStorage.setItem(THEME_STORAGE_KEYS.reduceMotion, String(enabled));
  }, []);

  const resetAppearance = useCallback(async () => {
    setThemeModeState("system");
    setEyeFriendlyState(false);
    setTextScaleState("normal");
    setReduceMotionState(false);
    await AsyncStorage.multiRemove(Object.values(THEME_STORAGE_KEYS));
  }, []);

  const contextValue = useMemo<AppThemeContextValue>(
    () => ({
      themeMode,
      effectiveMode,
      isDark: effectiveMode === "dark",
      colors,
      eyeFriendly,
      textScale,
      reduceMotion,
      textScaleFactor,
      revision,
      hydrated,
      setThemeMode,
      setEyeFriendly,
      setTextScale,
      setReduceMotion,
      resetAppearance,
    }),
    [
      colors,
      effectiveMode,
      eyeFriendly,
      hydrated,
      reduceMotion,
      resetAppearance,
      revision,
      setEyeFriendly,
      setReduceMotion,
      setTextScale,
      setThemeMode,
      textScale,
      textScaleFactor,
      themeMode,
    ]
  );

  return <AppThemeContext.Provider value={contextValue}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme(): AppThemeContextValue {
  return useContext(AppThemeContext);
}

/**
 * Legacy screens call this once so they refresh when a global appearance setting changes.
 * Their existing StyleSheet values are resolved dynamically by runtimeTheme.ts.
 */
export function useThemeRefresh(): number {
  return useContext(AppThemeContext).revision;
}

export function useReducedMotion(): boolean {
  return useContext(AppThemeContext).reduceMotion;
}

export default AppThemeProvider;
