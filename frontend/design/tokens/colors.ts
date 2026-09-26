/**
 * EyeCare AI legacy color token bridge.
 *
 * Existing screens can keep importing `colors.xxx`. The values are now resolved
 * from the active Phase 10B theme at render time so we do not have to maintain
 * duplicate light/dark screen files.
 */
import {
  designLightColors,
  makeDynamicDesignColors,
  type DesignColors,
} from "../theme/runtimeTheme";

export const colors: DesignColors = makeDynamicDesignColors();

/** Base light values are exported only for tooling/tests that need stable tokens. */
export const lightColorTokens = designLightColors;

export default colors;
