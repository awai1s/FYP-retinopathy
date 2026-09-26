/**
 * Compatibility color bridge for the older EyeCare UI components.
 * Values follow the global AppThemeProvider without changing existing imports.
 */
import {
  compatLightColors,
  makeDynamicCompatColors,
  type CompatColors,
} from "../design/theme/runtimeTheme";

const Colors: CompatColors = makeDynamicCompatColors();

export const lightCompatColors = compatLightColors;
export default Colors;
