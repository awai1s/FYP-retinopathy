export type SimulationMode = "impairment" | "dr";
export type VisionSceneId = "reading" | "driving" | "street" | "face" | "phone" | "custom";
export type SeverityLevel = "normal" | "mild" | "moderate" | "severe" | "advanced";
export type DRStageLevel = "no_dr" | "mild_dr" | "moderate_dr" | "severe_dr" | "proliferative_dr";
export type EffectLayerKey = "blur" | "contrast" | "obscuration" | "floaters" | "glare";

export interface VisionPreset {
  key: string;
  label: string;
  shortLabel: string;
  blurIntensity: number;
  contrastWash: number;
  obscuration: number;
  floaters: number;
  glare: number;
  spotCount: number;
  floaterCount: number;
  description: string;
}

export const visionScenes: Array<{
  id: Exclude<VisionSceneId, "custom">;
  label: string;
  icon: string;
  description: string;
}> = [
  { id: "reading", label: "Reading", icon: "book-outline", description: "Fine print, page contrast and near-detail." },
  { id: "driving", label: "Driving", icon: "car-outline", description: "Road signs, lane markings and distance detail." },
  { id: "street", label: "Street", icon: "business-outline", description: "Pedestrians, storefronts and outdoor contrast." },
  { id: "face", label: "Face", icon: "person-circle-outline", description: "Facial detail, expression and central focus." },
  { id: "phone", label: "Phone", icon: "phone-portrait-outline", description: "Small text, icons and bright-screen glare." },
];

export const severityOrder: SeverityLevel[] = ["normal", "mild", "moderate", "severe", "advanced"];
export const drStageOrder: DRStageLevel[] = ["no_dr", "mild_dr", "moderate_dr", "severe_dr", "proliferative_dr"];

export const severityPresets: Record<SeverityLevel, VisionPreset> = {
  normal: {
    key: "normal",
    label: "Normal",
    shortLabel: "Normal",
    blurIntensity: 0,
    contrastWash: 0,
    obscuration: 0,
    floaters: 0,
    glare: 0,
    spotCount: 0,
    floaterCount: 0,
    description: "No visual effects are applied.",
  },
  mild: {
    key: "mild",
    label: "Mild",
    shortLabel: "Mild",
    blurIntensity: 16,
    contrastWash: 0.07,
    obscuration: 0.08,
    floaters: 0.10,
    glare: 0.06,
    spotCount: 2,
    floaterCount: 3,
    description: "A light reduction in clarity with subtle contrast and floater effects.",
  },
  moderate: {
    key: "moderate",
    label: "Moderate",
    shortLabel: "Moderate",
    blurIntensity: 34,
    contrastWash: 0.14,
    obscuration: 0.18,
    floaters: 0.20,
    glare: 0.11,
    spotCount: 4,
    floaterCount: 6,
    description: "Noticeable blur, lower contrast, several obscured regions and floaters.",
  },
  severe: {
    key: "severe",
    label: "Severe",
    shortLabel: "Severe",
    blurIntensity: 54,
    contrastWash: 0.22,
    obscuration: 0.31,
    floaters: 0.31,
    glare: 0.17,
    spotCount: 6,
    floaterCount: 9,
    description: "Strong loss of detail with heavier obscuration and distracting floaters.",
  },
  advanced: {
    key: "advanced",
    label: "Advanced",
    shortLabel: "Advanced",
    blurIntensity: 72,
    contrastWash: 0.30,
    obscuration: 0.43,
    floaters: 0.44,
    glare: 0.24,
    spotCount: 8,
    floaterCount: 12,
    description: "An intense combination of blur, lower contrast, obscured regions and floaters.",
  },
};

export const drStagePresets: Record<DRStageLevel, VisionPreset> = {
  no_dr: {
    ...severityPresets.normal,
    key: "no_dr",
    label: "No DR",
    shortLabel: "No DR",
    description: "No stage-linked effect is applied. This is still not a clinical vision test.",
  },
  mild_dr: {
    ...severityPresets.mild,
    key: "mild_dr",
    label: "Mild DR",
    shortLabel: "Mild DR",
    blurIntensity: 12,
    contrastWash: 0.05,
    obscuration: 0.06,
    floaters: 0.07,
    glare: 0.04,
    spotCount: 2,
    floaterCount: 2,
    description: "An illustrative light-effect preset. Mild DR may cause no noticeable symptoms at all.",
  },
  moderate_dr: {
    ...severityPresets.moderate,
    key: "moderate_dr",
    label: "Moderate DR",
    shortLabel: "Moderate DR",
    blurIntensity: 26,
    contrastWash: 0.12,
    obscuration: 0.16,
    floaters: 0.16,
    glare: 0.09,
    spotCount: 4,
    floaterCount: 5,
    description: "A moderate illustrative effect mix; it is not a prediction of how Moderate DR personally looks.",
  },
  severe_dr: {
    ...severityPresets.severe,
    key: "severe_dr",
    label: "Severe DR",
    shortLabel: "Severe DR",
    blurIntensity: 44,
    contrastWash: 0.20,
    obscuration: 0.29,
    floaters: 0.26,
    glare: 0.15,
    spotCount: 6,
    floaterCount: 8,
    description: "A stronger educational rendering preset, not a stage-to-vision conversion.",
  },
  proliferative_dr: {
    ...severityPresets.advanced,
    key: "proliferative_dr",
    label: "Proliferative DR",
    shortLabel: "PDR",
    blurIntensity: 58,
    contrastWash: 0.27,
    obscuration: 0.39,
    floaters: 0.42,
    glare: 0.19,
    spotCount: 8,
    floaterCount: 12,
    description: "A high-intensity illustrative preset. Real symptoms and visual function vary widely.",
  },
};

export const effectLayerLabels: Record<EffectLayerKey, { label: string; icon: string; description: string }> = {
  blur: { label: "Clarity", icon: "water-outline", description: "Softens fine detail using a local blur layer." },
  contrast: { label: "Contrast", icon: "contrast-outline", description: "Adds a neutral wash that flattens scene contrast." },
  obscuration: { label: "Obscuration", icon: "ellipse-outline", description: "Adds soft dark regions to demonstrate missing/blocked detail." },
  floaters: { label: "Floaters", icon: "sparkles-outline", description: "Adds translucent drifting-shape style overlays." },
  glare: { label: "Glare", icon: "sunny-outline", description: "Adds a bright wash to simulate glare sensitivity." },
};

export const defaultLayerState: Record<EffectLayerKey, boolean> = {
  blur: true,
  contrast: true,
  obscuration: true,
  floaters: true,
  glare: true,
};

export function mapPredictionStageToDRStage(raw?: string | null): DRStageLevel {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return "moderate_dr";
  if (value.includes("proliferative") || value.includes("pdr")) return "proliferative_dr";
  if (value.includes("severe")) return "severe_dr";
  if (value.includes("moderate")) return "moderate_dr";
  if (value.includes("mild")) return "mild_dr";
  if (value.includes("no dr") || value.includes("no diabetic") || value === "normal" || value.includes("stage 0")) return "no_dr";
  return "moderate_dr";
}

export function effectStrengthLabel(value: number, kind: "blur" | "fraction"): string {
  const normalized = kind === "blur" ? value / 100 : value;
  if (normalized <= 0.01) return "Off";
  if (normalized < 0.14) return "Light";
  if (normalized < 0.28) return "Moderate";
  if (normalized < 0.45) return "Strong";
  return "Very strong";
}
