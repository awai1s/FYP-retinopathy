import { StyleSheet } from "react-native";

export type EffectiveThemeMode = "light" | "dark";
export type ThemeMode = "system" | EffectiveThemeMode;
export type TextScale = "normal" | "large" | "extraLarge";

export interface RuntimeThemeState {
  scheme: EffectiveThemeMode;
  eyeFriendly: boolean;
  textScale: TextScale;
  reduceMotion: boolean;
  revision: number;
}

const TEXT_SCALE_FACTORS: Record<TextScale, number> = {
  normal: 1,
  large: 1.12,
  extraLarge: 1.24,
};

let runtimeState: RuntimeThemeState = {
  scheme: "light",
  eyeFriendly: false,
  textScale: "normal",
  reduceMotion: false,
  revision: 0,
};

const listeners = new Set<() => void>();

export const semanticLight = {
  background: "#F4F8F8",
  surface: "#FFFFFF",
  surfaceRaised: "#FBFEFD",
  surfaceSecondary: "#EDF7F5",
  primary: "#0DB7A7",
  primaryStrong: "#087A73",
  primarySoft: "#D6FAF3",
  primaryText: "#052B29",
  textPrimary: "#102A2F",
  textSecondary: "#45646A",
  textMuted: "#718D92",
  border: "#D7E7E5",
  borderStrong: "#9CCFC8",
  success: "#0D8C6E",
  successSurface: "#E5F8F2",
  warning: "#B96F08",
  warningSurface: "#FFF4D6",
  error: "#C83F4C",
  errorSurface: "#FDECEE",
  info: "#247AB5",
  infoSurface: "#E9F4FC",
  scrim: "rgba(2,12,18,0.62)",
  inverseSurface: "#061B24",
  inverseText: "#FFFFFF",
  focusRing: "#27E5C6",
};

export const semanticDark = {
  background: "#061317",
  surface: "#0B2026",
  surfaceRaised: "#102A31",
  surfaceSecondary: "#0D282D",
  primary: "#31D8C4",
  primaryStrong: "#72E8D9",
  primarySoft: "#103B38",
  primaryText: "#03201E",
  textPrimary: "#F2FBFA",
  textSecondary: "#B7CED0",
  textMuted: "#86A0A4",
  border: "#28444A",
  borderStrong: "#3F676A",
  success: "#57D9AF",
  successSurface: "#10372E",
  warning: "#F1BB64",
  warningSurface: "#3C2C12",
  error: "#FF8E99",
  errorSurface: "#402027",
  info: "#79C9F6",
  infoSurface: "#15344A",
  scrim: "rgba(0,0,0,0.74)",
  inverseSurface: "#EAF7F5",
  inverseText: "#0B2026",
  focusRing: "#4BEAD4",
};

export type SemanticColors = typeof semanticLight;

export const designLightColors = {
  teal900: "#07505A",
  teal800: "#087A73",
  teal700: "#0B9487",
  teal600: "#0DB7A7",
  teal500: "#17C9B3",
  teal400: "#27E5C6",
  teal300: "#6EEFD8",
  teal200: "#A9F4E6",
  teal100: "#D6FAF3",
  teal50: "#F0FBF9",
  neonAqua: "#27E5C6",
  neonBlue: "#4CC9F0",
  navyInk: "#061B24",
  navActiveBg: "rgba(39,229,198,0.14)",
  navActiveIcon: "#27E5C6",
  navActiveText: "#FFFFFF",
  bottomNavBg: "#071F27",
  bottomNavBorder: "rgba(255,255,255,0.10)",
  bottomNavActivePill: "#0DB7A7",
  bottomNavActiveIcon: "#061B24",
  bottomNavActiveLabel: "#061B24",
  bottomNavInactiveIcon: "#9EC5C8",
  bottomNavInactiveLabel: "#AFC9CB",
  surface: "#FFFFFF",
  surfaceElevated: "#FCFFFE",
  surfaceRaised: "#FCFFFE",
  surfaceSecondary: "#F0F8F7",
  pageBackground: "#F4F8F8",
  drawerBackground: "#082A31",
  drawerBackgroundDark: "#061B24",
  backdropOverlay: "rgba(2,12,18,0.72)",
  textPrimary: "#102A2F",
  textSecondary: "#45646A",
  textMuted: "#7A9599",
  textLight: "#D2E9E7",
  textWhite: "#FEFFFF",
  success: "#0D9A78",
  successBg: "#E5F8F2",
  successBorder: "#B8E9D9",
  warning: "#C87908",
  warningBg: "#FFF4D6",
  warningBorder: "#F2DCA2",
  error: "#D84B57",
  errorBg: "#FDECEE",
  errorBorder: "#F5BEC4",
  info: "#247AB5",
  infoBg: "#E9F4FC",
  infoBorder: "#BBDCF1",
  white: "#FFFFFF",
  black: "#000000",
  border: "#D7E7E5",
  borderLight: "#E8F1F0",
  borderDark: "#087A73",
  shadowColor: "#05363B",
  shadowLight: "rgba(5,54,59,0.08)",
  shadowMedium: "rgba(5,54,59,0.14)",
  shadowHeavy: "rgba(2,27,32,0.24)",
  glassHighlight: "rgba(255,255,255,0.70)",
};

export const designDarkColors: typeof designLightColors = {
  teal900: "#CBFFF7",
  teal800: "#7DECDC",
  teal700: "#52E1CE",
  teal600: "#31D8C4",
  teal500: "#26CDB9",
  teal400: "#49EAD5",
  teal300: "#79F0DF",
  teal200: "#A8F5E9",
  teal100: "#163B39",
  teal50: "#0D2D2D",
  neonAqua: "#49EAD5",
  neonBlue: "#70D5FF",
  navyInk: "#041014",
  navActiveBg: "rgba(73,234,213,0.16)",
  navActiveIcon: "#49EAD5",
  navActiveText: "#F4FFFD",
  bottomNavBg: "#041317",
  bottomNavBorder: "rgba(193,239,235,0.14)",
  bottomNavActivePill: "#49EAD5",
  bottomNavActiveIcon: "#04211E",
  bottomNavActiveLabel: "#04211E",
  bottomNavInactiveIcon: "#8FB4B8",
  bottomNavInactiveLabel: "#A9C6C8",
  surface: "#0B2026",
  surfaceElevated: "#102A31",
  surfaceRaised: "#102A31",
  surfaceSecondary: "#0D282D",
  pageBackground: "#061317",
  drawerBackground: "#071F25",
  drawerBackgroundDark: "#030E12",
  backdropOverlay: "rgba(0,0,0,0.78)",
  textPrimary: "#F2FBFA",
  textSecondary: "#B7CED0",
  textMuted: "#86A0A4",
  textLight: "#C7E0E1",
  textWhite: "#F8FFFE",
  success: "#57D9AF",
  successBg: "#10372E",
  successBorder: "#235F50",
  warning: "#F1BB64",
  warningBg: "#3C2C12",
  warningBorder: "#705326",
  error: "#FF8E99",
  errorBg: "#402027",
  errorBorder: "#77404A",
  info: "#79C9F6",
  infoBg: "#15344A",
  infoBorder: "#285A79",
  white: "#F8FFFE",
  black: "#000000",
  border: "#28444A",
  borderLight: "#1C353B",
  borderDark: "#5ADFCF",
  shadowColor: "#000000",
  shadowLight: "rgba(0,0,0,0.18)",
  shadowMedium: "rgba(0,0,0,0.30)",
  shadowHeavy: "rgba(0,0,0,0.46)",
  glassHighlight: "rgba(176,238,232,0.16)",
};

export const compatLightColors = {
  primary: "#0DB7A7",
  primaryLight: "#27E5C6",
  primaryDark: "#087A73",
  secondary: "#4CC9F0",
  secondaryDark: "#0B6F8D",
  navy: "#061B24",
  navySurface: "#082A31",
  navySoft: "rgba(255,255,255,0.08)",
  background: "#F4F8F8",
  surface: "#FFFFFF",
  card: "#FEFFFF",
  surfaceMuted: "#EFF7F6",
  inputBackground: "#F8FBFB",
  inputFocused: "#FCFFFE",
  textPrimary: "#102A2F",
  textSecondary: "#45646A",
  textLight: "#7E999D",
  textPlaceholder: "#8CA4A8",
  textOnDark: "#FFFFFF",
  textOnDarkMuted: "#C8E4E2",
  success: "#0D9A78",
  successSoft: "#E5F8F2",
  warning: "#C87908",
  warningSoft: "#FFF4D6",
  danger: "#D84B57",
  dangerSoft: "#FDECEE",
  info: "#247AB5",
  infoSoft: "#E9F4FC",
  border: "#D7E7E5",
  borderStrong: "#A6D8D1",
  borderOnDark: "rgba(255,255,255,0.14)",
  shadow: "rgba(5,54,59,0.14)",
  overlay: "rgba(2,12,18,0.72)",
  glassLight: "rgba(255,255,255,0.10)",
  glassBorder: "rgba(255,255,255,0.16)",
  authGradientStart: "#04131B",
  authGradientMid: "#07343A",
  authGradientEnd: "#081D2C",
  aiGlow: "rgba(76,201,240,0.20)",
  primaryGlow: "rgba(39,229,198,0.26)",
  neonAqua: "#27E5C6",
  neonBlue: "#4CC9F0",
  white: "#FFFFFF",
  black: "#000000",
};

export const compatDarkColors: typeof compatLightColors = {
  primary: "#31D8C4",
  primaryLight: "#49EAD5",
  primaryDark: "#7DECDC",
  secondary: "#70D5FF",
  secondaryDark: "#8FDFFF",
  navy: "#030E12",
  navySurface: "#071F25",
  navySoft: "rgba(197,239,236,0.10)",
  background: "#061317",
  surface: "#0B2026",
  card: "#0D242A",
  surfaceMuted: "#0D282D",
  inputBackground: "#0A1B20",
  inputFocused: "#102A31",
  textPrimary: "#F2FBFA",
  textSecondary: "#B7CED0",
  textLight: "#86A0A4",
  textPlaceholder: "#789397",
  textOnDark: "#F8FFFE",
  textOnDarkMuted: "#BBD6D7",
  success: "#57D9AF",
  successSoft: "#10372E",
  warning: "#F1BB64",
  warningSoft: "#3C2C12",
  danger: "#FF8E99",
  dangerSoft: "#402027",
  info: "#79C9F6",
  infoSoft: "#15344A",
  border: "#28444A",
  borderStrong: "#3F676A",
  borderOnDark: "rgba(198,238,235,0.16)",
  shadow: "rgba(0,0,0,0.34)",
  overlay: "rgba(0,0,0,0.78)",
  glassLight: "rgba(196,239,235,0.09)",
  glassBorder: "rgba(196,239,235,0.15)",
  authGradientStart: "#020A0D",
  authGradientMid: "#062328",
  authGradientEnd: "#06151E",
  aiGlow: "rgba(112,213,255,0.18)",
  primaryGlow: "rgba(73,234,213,0.22)",
  neonAqua: "#49EAD5",
  neonBlue: "#70D5FF",
  white: "#F8FFFE",
  black: "#000000",
};

export type DesignColors = typeof designLightColors;
export type CompatColors = typeof compatLightColors;

export function getRuntimeTheme(): RuntimeThemeState {
  return runtimeState;
}

export function getSemanticColors(): SemanticColors {
  return (runtimeState.scheme === "dark" ? semanticDark : semanticLight) as SemanticColors;
}

export function getDesignColors(): DesignColors {
  return (runtimeState.scheme === "dark" ? designDarkColors : designLightColors) as DesignColors;
}

export function getCompatColors(): CompatColors {
  return (runtimeState.scheme === "dark" ? compatDarkColors : compatLightColors) as CompatColors;
}

export function getTextScaleFactor(): number {
  const requested = TEXT_SCALE_FACTORS[runtimeState.textScale];
  return requested * (runtimeState.eyeFriendly ? 1.06 : 1);
}

export function getSpacingScaleFactor(): number {
  return runtimeState.eyeFriendly ? 1.08 : 1;
}

export function setRuntimeTheme(next: Omit<RuntimeThemeState, "revision">): void {
  const changed =
    runtimeState.scheme !== next.scheme ||
    runtimeState.eyeFriendly !== next.eyeFriendly ||
    runtimeState.textScale !== next.textScale ||
    runtimeState.reduceMotion !== next.reduceMotion;

  if (!changed) return;
  runtimeState = { ...next, revision: runtimeState.revision + 1 };
  listeners.forEach((listener) => listener());
}

export function subscribeRuntimeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function makeDynamicDesignColors(): DesignColors {
  return new Proxy(designLightColors as DesignColors, {
    get(_target, prop: string | symbol) {
      if (typeof prop !== "string") return Reflect.get(designLightColors, prop);
      return (getDesignColors() as any)[prop];
    },
  });
}

export function makeDynamicCompatColors(): CompatColors {
  return new Proxy(compatLightColors as CompatColors, {
    get(_target, prop: string | symbol) {
      if (typeof prop !== "string") return Reflect.get(compatLightColors, prop);
      return (getCompatColors() as any)[prop];
    },
  });
}

type ColorCandidate = { family: "design" | "compat"; key: string };
const colorCandidates = new Map<string, ColorCandidate[]>();

function indexPalette(family: ColorCandidate["family"], palette: Record<string, string>) {
  Object.entries(palette).forEach(([key, value]) => {
    const normalized = value.toLowerCase();
    const current = colorCandidates.get(normalized) || [];
    if (!current.some((item) => item.family === family && item.key === key)) current.push({ family, key });
    colorCandidates.set(normalized, current);
  });
}

indexPalette("design", designLightColors as unknown as Record<string, string>);
indexPalette("design", designDarkColors as unknown as Record<string, string>);
indexPalette("compat", compatLightColors as unknown as Record<string, string>);
indexPalette("compat", compatDarkColors as unknown as Record<string, string>);

function rankCandidate(property: string, candidate: ColorCandidate): number {
  const key = candidate.key.toLowerCase();
  const prop = property.toLowerCase();
  let score = 0;

  if (prop.includes("background")) {
    if (key.includes("background") || key.includes("surface") || key.includes("card") || key.endsWith("bg") || key.endsWith("soft")) score += 40;
    if (key === "white" || key.includes("text")) score -= 15;
  }
  if (prop === "color" || prop.endsWith("color") && !prop.includes("background") && !prop.includes("border") && !prop.includes("shadow")) {
    if (key.includes("text") || key.startsWith("teal") || ["primary", "success", "warning", "danger", "error", "info", "secondary", "neonaqua", "neonblue"].includes(key)) score += 34;
    if (key.includes("surface") || key.includes("background") || key.endsWith("bg") || key.endsWith("soft")) score -= 18;
  }
  if (prop.includes("border")) {
    if (key.includes("border")) score += 45;
  }
  if (prop.includes("shadow")) {
    if (key.includes("shadow") || key === "black" || key === "navyink" || key === "navy") score += 45;
  }
  if (prop.includes("placeholder") && key.includes("placeholder")) score += 70;

  return score;
}

const DARK_DESIGN_BACKGROUND_OVERRIDES: Record<string, string> = {
  // Legacy teal tokens are used both as foregrounds and as filled surfaces.
  // A single dark-mode token value cannot satisfy both jobs. Keep filled
  // controls dark enough for white labels while foreground teal remains bright.
  teal900: "#053A3F",
  teal800: "#07505A",
  teal700: "#087A73",
  teal600: "#087A73",
  teal500: "#0A7068",
  teal400: "#0C665F",
  teal300: "#124B47",
  teal200: "#123E3A",
  teal100: "#103B38",
  teal50: "#0D2D2D",
  error: "#A93644",
  warning: "#8A580B",
  success: "#087055",
  info: "#205E83",
};

const DARK_COMPAT_BACKGROUND_OVERRIDES: Record<string, string> = {
  primary: "#087A73",
  primaryLight: "#0B837A",
  primaryDark: "#07505A",
  secondary: "#176987",
  secondaryDark: "#0B5068",
  danger: "#A93644",
  warning: "#8A580B",
  success: "#087055",
  info: "#205E83",
};

const DARK_DESIGN_FOREGROUND_OVERRIDES: Record<string, string> = {
  // Low-number teal tokens are often used as text on the permanently dark
  // drawer/header surfaces. They must stay light in dark mode.
  teal50: "#E5FAF6",
  teal100: "#D2E9E7",
  teal200: "#A8F5E9",
};

function isForegroundColorProperty(property: string): boolean {
  const prop = property.toLowerCase();
  return (
    (prop === "color" || prop.endsWith("color")) &&
    !prop.includes("background") &&
    !prop.includes("border") &&
    !prop.includes("shadow")
  );
}

function resolveContextualDarkColor(property: string, candidate: ColorCandidate): string | null {
  if (runtimeState.scheme !== "dark") return null;
  const prop = property.toLowerCase();

  if (prop.includes("background")) {
    const overrides = candidate.family === "design"
      ? DARK_DESIGN_BACKGROUND_OVERRIDES
      : DARK_COMPAT_BACKGROUND_OVERRIDES;
    return overrides[candidate.key] || null;
  }

  if (isForegroundColorProperty(property) && candidate.family === "design") {
    return DARK_DESIGN_FOREGROUND_OVERRIDES[candidate.key] || null;
  }

  return null;
}

function resolveIndexedColor(property: string, value: string): string | null {
  const candidates = colorCandidates.get(value.toLowerCase());
  if (!candidates?.length) return null;
  const chosen = [...candidates].sort((a, b) => rankCandidate(property, b) - rankCandidate(property, a))[0];
  const contextual = resolveContextualDarkColor(property, chosen);
  if (contextual) return contextual;
  const palette = chosen.family === "design" ? getDesignColors() : getCompatColors();
  return (palette as any)[chosen.key] || value;
}

function resolveRawColor(property: string, value: string): string | null {
  if (runtimeState.scheme !== "dark") return null;
  const prop = property.toLowerCase();
  const normalized = value.replace(/\s+/g, "").toLowerCase();

  if (prop.includes("background")) {
    if (normalized === "#fff" || normalized === "#ffffff") return semanticDark.surface;
    const whiteAlpha = normalized.match(/^rgba\(255,255,255,([0-9.]+)\)$/);
    if (whiteAlpha && Number(whiteAlpha[1]) >= 0.65) return semanticDark.surfaceRaised;
    if (["#f8fbfb", "#f4f8f8", "#f5f7fb", "#f0f8f7", "#eff7f6"].includes(normalized)) return semanticDark.background;
  }

  if (prop.includes("border")) {
    if (normalized === "#fff" || normalized === "#ffffff") return semanticDark.border;
    const whiteAlpha = normalized.match(/^rgba\(255,255,255,([0-9.]+)\)$/);
    if (whiteAlpha && Number(whiteAlpha[1]) >= 0.45) return semanticDark.border;
  }

  return null;
}

function isSpacingProperty(property: string): boolean {
  const prop = property.toLowerCase();
  return prop.includes("padding") || prop.includes("margin") || prop === "gap" || prop === "rowgap" || prop === "columngap";
}

function resolveDynamicStyleValue(property: string, value: unknown): unknown {
  if (typeof value === "string") {
    return resolveIndexedColor(property, value) || resolveRawColor(property, value) || value;
  }

  if (typeof value !== "number") return value;

  const prop = property.toLowerCase();
  if (prop === "fontsize") return Math.round(value * getTextScaleFactor() * 10) / 10;
  if (prop === "lineheight") return Math.round(value * getTextScaleFactor() * 10) / 10;
  if (isSpacingProperty(property) && value > 0) return Math.round(value * getSpacingScaleFactor() * 10) / 10;

  if (runtimeState.eyeFriendly) {
    if ((prop === "minheight" || prop === "minwidth") && value >= 32 && value < 48) return 48;
    if (prop === "borderwidth" && value > 0 && value < 1.5) return 1.5;
    if (prop === "shadowopacity") return Math.max(0, value * 0.72);
    if (prop === "elevation") return Math.max(0, Math.round(value * 0.72));
  }

  return value;
}

let styleSheetInstalled = false;

export function installDynamicStyleSheet(): void {
  if (styleSheetInstalled) return;
  styleSheetInstalled = true;

  const styleSheetAny = StyleSheet as any;
  const originalCreate = styleSheetAny.create.bind(StyleSheet);

  styleSheetAny.create = (input: Record<string, any>) => {
    const created = originalCreate(input);
    const output: Record<string, any> = {};

    Object.entries(created).forEach(([styleName, styleValue]) => {
      if (!styleValue || typeof styleValue !== "object" || Array.isArray(styleValue)) {
        output[styleName] = styleValue;
        return;
      }

      // React Native Web freezes StyleSheet.create() results in development.
      // Proxying that frozen object directly is invalid when a theme switch needs
      // to return a different value for a non-configurable property (for example
      // backgroundColor). Animated/StyleSheet.flatten then throws a Proxy invariant
      // error. Clone the style into a normal configurable object first, and proxy
      // the clone instead. This keeps runtime theme resolution while remaining safe
      // for Animated styles on web.
      const proxySafeStyle = { ...(styleValue as Record<string, unknown>) };

      output[styleName] = new Proxy(proxySafeStyle, {
        get(target, prop: string | symbol, receiver) {
          const raw = Reflect.get(target, prop, receiver);
          if (typeof prop !== "string") return raw;
          return resolveDynamicStyleValue(prop, raw);
        },
      });
    });

    return output;
  };
}

installDynamicStyleSheet();