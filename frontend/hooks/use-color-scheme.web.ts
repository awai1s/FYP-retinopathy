import { useAppTheme } from "../providers/AppThemeProvider";

/** Web uses the same persisted EyeCare appearance preference as native. */
export function useColorScheme() {
  return useAppTheme().effectiveMode;
}
