import { useAppTheme } from "../providers/AppThemeProvider";

/** Returns the effective EyeCare theme after applying System/Light/Dark preference. */
export function useColorScheme() {
  return useAppTheme().effectiveMode;
}
