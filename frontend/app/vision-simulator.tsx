import { Alert } from "../services/alert";
import React, { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";

import AppShell from "../design/components/AppShell";
import Card from "../design/components/card";
import Button from "../design/components/Button";
import SimulationCanvas from "../components/vision-simulator/SimulationCanvas";
import colors from "../design/tokens/colors";
import spacing from "../design/tokens/spacing";
import typography from "../design/tokens/typography";
import radius from "../design/tokens/radius";
import { useAppTheme, useThemeRefresh } from "../providers/AppThemeProvider";
import { useLanguage } from "../services/i18n";
import {
  defaultLayerState,
  drStageOrder,
  drStagePresets,
  effectLayerLabels,
  effectStrengthLabel,
  mapPredictionStageToDRStage,
  severityOrder,
  severityPresets,
  visionScenes,
  type DRStageLevel,
  type EffectLayerKey,
  type SeverityLevel,
  type SimulationMode,
  type VisionSceneId,
} from "../content/visionSimulationPresets";

const LAYERS: EffectLayerKey[] = ["blur", "contrast", "obscuration", "floaters", "glare"];

export default function VisionSimulatorScreen() {
  useThemeRefresh();
  const params = useLocalSearchParams();
  const { language } = useLanguage();
  const { eyeFriendly } = useAppTheme();
  const isUrdu = language === "ur";

  const [mode, setMode] = useState<SimulationMode>("impairment");
  const [scene, setScene] = useState<VisionSceneId>("driving");
  const [severity, setSeverity] = useState<SeverityLevel>("moderate");
  const [drStage, setDrStage] = useState<DRStageLevel>("moderate_dr");
  const [customImageUri, setCustomImageUri] = useState<string | null>(null);
  const [enabledLayers, setEnabledLayers] = useState<Record<EffectLayerKey, boolean>>({ ...defaultLayerState });
  const [comparisonPercent, setComparisonPercent] = useState(50);

  useEffect(() => {
    const requestedMode = String(params.mode || "").toLowerCase();
    const requestedStage = String(params.stage || params.drStage || "");
    if (requestedMode === "dr" || requestedStage) {
      setMode("dr");
      setDrStage(mapPredictionStageToDRStage(requestedStage));
    }
    const requestedScene = String(params.scene || "").toLowerCase();
    if (["reading", "driving", "street", "face", "phone"].includes(requestedScene)) {
      setScene(requestedScene as VisionSceneId);
    }
  }, [params.drStage, params.mode, params.scene, params.stage]);

  const preset = mode === "dr" ? drStagePresets[drStage] : severityPresets[severity];

  const toggleLayer = (key: EffectLayerKey) => {
    setEnabledLayers((current) => ({ ...current, [key]: !current[key] }));
  };

  const selectBuiltInScene = (next: VisionSceneId) => {
    setScene(next);
    if (next !== "custom") setCustomImageUri(null);
  };

  const pickOwnImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          isUrdu ? "اجازت درکار ہے" : "Permission Required",
          isUrdu ? "اپنی تصویر منتخب کرنے کے لیے فوٹو لائبریری کی اجازت درکار ہے۔" : "Photo library access is needed to choose an image for the local simulator."
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      setCustomImageUri(result.assets[0].uri);
      setScene("custom");
    } catch (error) {
      console.error("Vision simulator image picker error:", error);
      Alert.alert(isUrdu ? "تصویر منتخب نہیں ہو سکی" : "Unable to Select Image", isUrdu ? "براہِ کرم دوبارہ کوشش کریں۔" : "Please try again.");
    }
  };

  const reset = () => {
    setMode("impairment");
    setScene("driving");
    setSeverity("moderate");
    setDrStage("moderate_dr");
    setCustomImageUri(null);
    setEnabledLayers({ ...defaultLayerState });
    setComparisonPercent(50);
  };

  const effectRows = useMemo(
    () => [
      { label: isUrdu ? "وضاحت میں کمی" : "Clarity reduction", value: preset.blurIntensity, display: effectStrengthLabel(preset.blurIntensity, "blur"), active: enabledLayers.blur },
      { label: isUrdu ? "کنٹراسٹ واش" : "Contrast wash", value: Math.round(preset.contrastWash * 100), display: effectStrengthLabel(preset.contrastWash, "fraction"), active: enabledLayers.contrast },
      { label: isUrdu ? "اوٹ / دھندلے حصے" : "Obscuration", value: Math.round(preset.obscuration * 100), display: effectStrengthLabel(preset.obscuration, "fraction"), active: enabledLayers.obscuration },
      { label: isUrdu ? "فلوٹرز" : "Floaters", value: Math.round(preset.floaters * 100), display: effectStrengthLabel(preset.floaters, "fraction"), active: enabledLayers.floaters },
      { label: isUrdu ? "چمک" : "Glare", value: Math.round(preset.glare * 100), display: effectStrengthLabel(preset.glare, "fraction"), active: enabledLayers.glare },
    ],
    [enabledLayers, isUrdu, preset]
  );

  return (
    <AppShell
      role="Patient"
      title={isUrdu ? "وژن ایکسپیرینس سمیولیٹر" : "Vision Experience Simulator"}
      subtitle={isUrdu ? "تعلیمی بصری موازنہ" : "Interactive educational visual comparison"}
      showBack
      onBackPress={() => router.back()}
      showAssistant={false}
    >
      <View style={[styles.hero, eyeFriendly && styles.heroEyeFriendly]}>
        <View style={styles.heroIcon}><Ionicons name="eye-outline" size={28} color={colors.teal800} /></View>
        <View style={styles.flex}>
          <Text style={[styles.eyebrow, isUrdu && styles.urdu]}>VISION EXPERIENCE LAB</Text>
          <Text style={[styles.title, isUrdu && styles.urdu]}>{isUrdu ? "روزمرہ مناظر میں بصری تبدیلیوں کو سمجھیں" : "Explore how visual changes can alter everyday scenes"}</Text>
          <Text style={[styles.subtitle, isUrdu && styles.urdu]}>{isUrdu ? "منظر منتخب کریں، بصری اثرات تبدیل کریں اور سلائیڈر سے اصل اور تبدیل شدہ منظر کا موازنہ کریں۔" : "Choose a scene, adjust the visual effects, and drag the slider to compare the original and simulated views."}</Text>
        </View>
      </View>

      <Card variant="bordered" style={styles.safetyCard}>
        <View style={styles.safetyIcon}><Ionicons name="information-circle-outline" size={23} color={colors.info} /></View>
        <View style={styles.flex}>
          <Text style={[styles.safetyTitle, isUrdu && styles.urdu]}>{isUrdu ? "صرف تعلیمی simulation" : "Educational simulation only"}</Text>
          <Text style={[styles.safetyText, isUrdu && styles.urdu]}>{isUrdu ? "یہ آپ کی ذاتی بینائی کی پیش گوئی، تشخیص یا DR stage کا exact visual model نہیں ہے۔ حقیقی علامات فرد بہ فرد مختلف ہوتی ہیں۔" : "This is not a diagnosis, a personal eyesight prediction, or an exact visual model of a DR stage. Real symptoms and visual function vary between people."}</Text>
        </View>
      </Card>

      <View style={styles.sectionHeading}>
        <Text style={[styles.sectionTitle, isUrdu && styles.urdu]}>{isUrdu ? "منظر منتخب کریں" : "Choose a scene"}</Text>
        <Text style={[styles.sectionSub, isUrdu && styles.urdu]}>{isUrdu ? "بلٹ اِن منظر استعمال کریں یا اپنی تصویر مقامی طور پر منتخب کریں۔" : "Choose an illustrated scene or try your own image."}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sceneRow}>
        {visionScenes.map((item) => {
          const active = scene === item.id && !customImageUri;
          return (
            <TouchableOpacity key={item.id} onPress={() => selectBuiltInScene(item.id)} style={[styles.sceneChip, active && styles.sceneChipActive]} accessibilityRole="button" accessibilityState={{ selected: active }}>
              <Ionicons name={item.icon as any} size={19} color={active ? colors.navyInk : colors.teal800} />
              <Text style={[styles.sceneChipText, active && styles.sceneChipTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity onPress={() => void pickOwnImage()} style={[styles.sceneChip, scene === "custom" && styles.sceneChipActive]} accessibilityRole="button" accessibilityState={{ selected: scene === "custom" }}>
          <Ionicons name="images-outline" size={19} color={scene === "custom" ? colors.navyInk : colors.teal800} />
          <Text style={[styles.sceneChipText, scene === "custom" && styles.sceneChipTextActive]}>{isUrdu ? "میری تصویر" : "My Image"}</Text>
        </TouchableOpacity>
      </ScrollView>

      {scene === "custom" ? (
        <View style={styles.localOnlyChip}>
          <Ionicons name="phone-portrait-outline" size={15} color={colors.success} />
          <Text style={styles.localOnlyText}>{isUrdu ? "آپ کی تصویر آپ کے آلے پر ہی رہتی ہے۔" : "Your photo stays on your device."}</Text>
        </View>
      ) : null}

      <View style={styles.modeRow}>
        <ModeButton active={mode === "impairment"} icon="options-outline" label={isUrdu ? "شدت کے presets" : "Severity presets"} onPress={() => setMode("impairment")} />
        <ModeButton active={mode === "dr"} icon="medical-outline" label={isUrdu ? "DR تعلیمی presets" : "DR illustration presets"} onPress={() => setMode("dr")} />
      </View>

      {mode === "dr" ? (
        <Card style={styles.drNotice}>
          <Ionicons name="warning-outline" size={20} color={colors.warning} />
          <Text style={[styles.drNoticeText, isUrdu && styles.urdu]}>{isUrdu ? "DR stage کو subjective vision سے براہِ راست map نہیں کیا جا سکتا۔ یہ stage labels صرف ایک illustrative effect preset منتخب کرتے ہیں۔" : "DR stage does not map one-to-one to subjective vision. These stage labels only select an illustrative effect preset."}</Text>
        </Card>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
        {mode === "impairment"
          ? severityOrder.map((item) => <PresetButton key={item} active={severity === item} label={severityPresets[item].shortLabel} onPress={() => setSeverity(item)} />)
          : drStageOrder.map((item) => <PresetButton key={item} active={drStage === item} label={drStagePresets[item].shortLabel} onPress={() => setDrStage(item)} />)}
      </ScrollView>

      <Card variant="elevated" style={styles.canvasCard}>
        <View style={styles.canvasHeader}>
          <View style={styles.flex}>
            <Text style={[styles.canvasEyebrow, isUrdu && styles.urdu]}>{mode === "dr" ? (isUrdu ? "DR تعلیمی preset" : "DR ILLUSTRATION PRESET") : (isUrdu ? "شدت کا preset" : "VISUAL EFFECT PRESET")}</Text>
            <Text style={[styles.canvasTitle, isUrdu && styles.urdu]}>{preset.label}</Text>
            <Text style={[styles.canvasDescription, isUrdu && styles.urdu]}>{preset.description}</Text>
          </View>
          <View style={styles.percentBadge}><Text style={styles.percentBadgeValue}>{Math.round(comparisonPercent)}%</Text><Text style={styles.percentBadgeLabel}>normal</Text></View>
        </View>
        <SimulationCanvas scene={scene} customImageUri={customImageUri} preset={preset} enabledLayers={enabledLayers} sliderPercent={comparisonPercent} onSliderChange={setComparisonPercent} />
        <View style={styles.compareFooter}>
          <View style={styles.compareSide}><View style={[styles.compareDot, { backgroundColor: colors.success }]} /><Text style={styles.compareText}>{isUrdu ? "اصل منظر" : "Original scene"}</Text></View>
          <View style={styles.compareSide}><Text style={styles.compareText}>{isUrdu ? "تعلیمی simulation" : "Educational simulation"}</Text><View style={[styles.compareDot, { backgroundColor: colors.warning }]} /></View>
        </View>
      </Card>

      <View style={styles.sectionHeading}>
        <Text style={[styles.sectionTitle, isUrdu && styles.urdu]}>{isUrdu ? "بصری اثرات دیکھیں" : "Explore visual effects"}</Text>
        <Text style={[styles.sectionSub, isUrdu && styles.urdu]}>{isUrdu ? "ہر بصری اثر کو بند یا چالو کر کے منظر میں تبدیلی دیکھیں۔" : "Turn each effect on or off to explore how it changes the scene."}</Text>
      </View>

      <View style={styles.layerGrid}>
        {LAYERS.map((key) => {
          const meta = effectLayerLabels[key];
          const active = enabledLayers[key];
          return (
            <TouchableOpacity key={key} onPress={() => toggleLayer(key)} style={[styles.layerCard, active && styles.layerCardActive]} accessibilityRole="switch" accessibilityState={{ checked: active }}>
              <View style={[styles.layerIcon, active && styles.layerIconActive]}><Ionicons name={meta.icon as any} size={19} color={active ? colors.navyInk : colors.textMuted} /></View>
              <View style={styles.flex}>
                <Text style={[styles.layerTitle, active && styles.layerTitleActive]}>{meta.label}</Text>
                <Text style={styles.layerState}>{active ? "ON" : "OFF"}</Text>
              </View>
              <Ionicons name={active ? "checkmark-circle" : "ellipse-outline"} size={20} color={active ? colors.success : colors.textMuted} />
            </TouchableOpacity>
          );
        })}
      </View>

      <Card style={styles.effectCard}>
        <View style={styles.effectHeader}>
          <View><Text style={[styles.sectionTitle, isUrdu && styles.urdu]}>{isUrdu ? "بصری اثرات" : "Visual effects"}</Text><Text style={[styles.sectionSub, isUrdu && styles.urdu]}>{isUrdu ? "اس تعلیمی منظر کی شکل اپنی پسند کے مطابق بدلیں۔" : "Adjust the look of this educational scene."}</Text></View>
          <Ionicons name="analytics-outline" size={22} color={colors.teal800} />
        </View>
        {effectRows.map((row) => (
          <View key={row.label} style={styles.effectRow}>
            <Text style={[styles.effectLabel, !row.active && styles.effectDisabled]}>{row.label}</Text>
            <View style={styles.effectTrack}><View style={[styles.effectFill, { width: `${row.active ? Math.min(100, row.value) : 0}%` }]} /></View>
            <Text style={[styles.effectStrength, !row.active && styles.effectDisabled]}>{row.active ? row.display : "Off"}</Text>
          </View>
        ))}
      </Card>

      <View style={styles.footerActions}>
        <Button title={isUrdu ? "Reset" : "Reset Simulator"} variant="outline" icon="refresh-outline" onPress={reset} />
        <Button title={isUrdu ? "آنکھوں کی صحت کی لائبریری" : "Eye Health Library"} variant="ghost" icon="library-outline" onPress={() => router.push("/education" as any)} />
      </View>

      <Card style={styles.finalDisclaimer}>
        <Ionicons name="medical-outline" size={19} color={colors.textMuted} />
        <Text style={[styles.finalDisclaimerText, isUrdu && styles.urdu]}>{isUrdu ? "یہ feature بیماری کی شدت، visual acuity، retina damage یا علاج کی ضرورت کو quantify نہیں کرتا۔ اچانک نظر کم ہونا، نئے floaters/flashes یا پردہ سا آنا urgent eye assessment کا سبب ہو سکتا ہے۔" : "This feature does not quantify disease severity, visual acuity, retinal damage, or treatment need. Sudden vision loss, new flashes/floaters, or a curtain-like shadow warrants urgent eye assessment."}</Text>
      </Card>
    </AppShell>
  );
}

function ModeButton({ active, icon, label, onPress }: { active: boolean; icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.modeButton, active && styles.modeButtonActive]} accessibilityRole="button" accessibilityState={{ selected: active }}>
      <Ionicons name={icon as any} size={19} color={active ? colors.navyInk : colors.teal800} />
      <Text style={[styles.modeButtonText, active && styles.modeButtonTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function PresetButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.presetButton, active && styles.presetButtonActive]} accessibilityRole="button" accessibilityState={{ selected: active }}>
      <Text style={[styles.presetText, active && styles.presetTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  urdu: { textAlign: "right", writingDirection: "rtl" },
  hero: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start", marginBottom: spacing.md },
  heroEyeFriendly: { gap: spacing.lg },
  heroIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.teal100, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.teal200 },
  eyebrow: { color: colors.teal800, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, letterSpacing: 1.3, marginBottom: 4 },
  title: { color: colors.textPrimary, fontSize: typography.sizes.h2, fontWeight: typography.weights.bold, lineHeight: 31 },
  subtitle: { color: colors.textSecondary, fontSize: typography.sizes.small, lineHeight: 21, marginTop: 5 },
  safetyCard: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, marginBottom: spacing.sm },
  safetyIcon: { paddingTop: 1 },
  safetyTitle: { color: colors.textPrimary, fontSize: typography.sizes.small, fontWeight: typography.weights.bold, marginBottom: 3 },
  safetyText: { color: colors.textSecondary, fontSize: typography.sizes.xs, lineHeight: 19 },
  sectionHeading: { marginTop: spacing.xl, marginBottom: spacing.sm },
  sectionTitle: { color: colors.textPrimary, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold },
  sectionSub: { color: colors.textMuted, fontSize: typography.sizes.xs, lineHeight: 18, marginTop: 3 },
  sceneRow: { gap: spacing.sm, paddingRight: spacing.md },
  sceneChip: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 22, backgroundColor: colors.surface },
  sceneChipActive: { backgroundColor: colors.neonAqua, borderColor: colors.neonAqua },
  sceneChipText: { color: colors.textSecondary, fontSize: typography.sizes.small, fontWeight: typography.weights.semibold },
  sceneChipTextActive: { color: colors.navyInk },
  localOnlyChip: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs + 2, borderRadius: radius.md, backgroundColor: colors.successBg, borderWidth: 1, borderColor: colors.successBorder },
  localOnlyText: { flex: 1, color: colors.success, fontSize: typography.sizes.tiny, lineHeight: 17 },
  modeRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xl },
  modeButton: { flex: 1, minHeight: 52, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: spacing.sm },
  modeButtonActive: { backgroundColor: colors.neonAqua, borderColor: colors.neonAqua },
  modeButtonText: { color: colors.textSecondary, fontSize: typography.sizes.small, fontWeight: typography.weights.bold, textAlign: "center" },
  modeButtonTextActive: { color: colors.navyInk },
  drNotice: { marginTop: spacing.sm, flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, backgroundColor: colors.warningBg, borderColor: colors.warningBorder, borderWidth: 1 },
  drNoticeText: { flex: 1, color: colors.warning, fontSize: typography.sizes.xs, lineHeight: 18 },
  presetRow: { gap: spacing.sm, paddingTop: spacing.md, paddingBottom: spacing.xs, paddingRight: spacing.md },
  presetButton: { minHeight: 42, borderRadius: 21, paddingHorizontal: spacing.md, justifyContent: "center", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  presetButtonActive: { backgroundColor: colors.teal800, borderColor: colors.teal800 },
  presetText: { color: colors.textSecondary, fontSize: typography.sizes.small, fontWeight: typography.weights.semibold },
  presetTextActive: { color: colors.white, fontWeight: typography.weights.bold },
  canvasCard: { padding: spacing.md, marginTop: spacing.sm },
  canvasHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, marginBottom: spacing.md },
  canvasEyebrow: { color: colors.teal800, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, letterSpacing: 0.9 },
  canvasTitle: { color: colors.textPrimary, fontSize: typography.sizes.h3, fontWeight: typography.weights.bold, marginTop: 2 },
  canvasDescription: { color: colors.textSecondary, fontSize: typography.sizes.xs, lineHeight: 18, marginTop: 3 },
  percentBadge: { minWidth: 62, alignItems: "center", paddingHorizontal: 9, paddingVertical: 8, borderRadius: radius.md, backgroundColor: colors.teal50, borderWidth: 1, borderColor: colors.teal200 },
  percentBadgeValue: { color: colors.teal900, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold },
  percentBadgeLabel: { color: colors.textMuted, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.7 },
  compareFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, marginTop: spacing.sm },
  compareSide: { flexDirection: "row", alignItems: "center", gap: 6 },
  compareDot: { width: 8, height: 8, borderRadius: 5 },
  compareText: { color: colors.textMuted, fontSize: typography.sizes.tiny, fontWeight: typography.weights.semibold },
  layerGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  layerCard: { width: "48%", minWidth: 145, flexGrow: 1, minHeight: 68, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  layerCardActive: { borderColor: colors.teal300, backgroundColor: colors.teal50 },
  layerIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary },
  layerIconActive: { backgroundColor: colors.neonAqua },
  layerTitle: { color: colors.textSecondary, fontSize: typography.sizes.small, fontWeight: typography.weights.bold },
  layerTitleActive: { color: colors.textPrimary },
  layerState: { color: colors.textMuted, fontSize: 9, marginTop: 2, fontWeight: typography.weights.bold, letterSpacing: 0.8 },
  effectCard: { marginTop: spacing.lg },
  effectHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm, marginBottom: spacing.md },
  effectRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 34 },
  effectLabel: { width: 116, color: colors.textSecondary, fontSize: typography.sizes.xs },
  effectTrack: { flex: 1, height: 7, borderRadius: 5, backgroundColor: colors.surfaceSecondary, overflow: "hidden" },
  effectFill: { height: "100%", borderRadius: 5, backgroundColor: colors.teal600 },
  effectStrength: { width: 72, color: colors.textPrimary, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, textAlign: "right" },
  effectDisabled: { opacity: 0.45 },
  engineeringCard: { marginTop: spacing.lg },
  engineeringHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  pipelineRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 5 },
  pipelineNode: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, borderRadius: 12, backgroundColor: colors.teal50, borderWidth: 1, borderColor: colors.teal100 },
  pipelineText: { color: colors.teal900, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold },
  engineeringText: { color: colors.textSecondary, fontSize: typography.sizes.xs, lineHeight: 19, marginTop: spacing.md },
  footerActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap", marginTop: spacing.lg },
  finalDisclaimer: { marginTop: spacing.lg, marginBottom: spacing.xxxl + 30, flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, backgroundColor: colors.surfaceSecondary },
  finalDisclaimerText: { flex: 1, color: colors.textMuted, fontSize: typography.sizes.tiny, lineHeight: 18 },
});
