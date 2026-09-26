/**
 * DR-Healthcare Central Theme Definition
 */

import colors from "../tokens/colors";
import spacing from "../tokens/spacing";
import typography from "../tokens/typography";
import shadows from "../tokens/shadows";
import radius from "../tokens/radius";
import breakpoints from "../tokens/breakpoints";

export const theme = {
  colors,
  spacing,
  typography,
  shadows,
  radius,
  breakpoints,
};

export type Theme = typeof theme;
export default theme;
