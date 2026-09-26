import React, { useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import SceneArtwork from "./SceneArtwork";
import colors from "../../design/tokens/colors";
import type { EffectLayerKey, VisionPreset, VisionSceneId } from "../../content/visionSimulationPresets";

interface SimulationCanvasProps {
  scene: VisionSceneId;
  customImageUri?: string | null;
  preset: VisionPreset;
  enabledLayers: Record<EffectLayerKey, boolean>;
  sliderPercent: number;
  onSliderChange: (percent: number) => void;
}

const SCOTOMAS = [
  { x: 0.71, y: 0.34, size: 0.18 },
  { x: 0.43, y: 0.68, size: 0.13 },
  { x: 0.82, y: 0.72, size: 0.16 },
  { x: 0.58, y: 0.51, size: 0.10 },
  { x: 0.29, y: 0.41, size: 0.12 },
  { x: 0.67, y: 0.18, size: 0.09 },
  { x: 0.88, y: 0.48, size: 0.11 },
  { x: 0.36, y: 0.24, size: 0.08 },
];

const FLOATERS = [
  { x: 0.61, y: 0.26, w: 0.050, h: 0.018, r: -10 },
  { x: 0.75, y: 0.58, w: 0.058, h: 0.022, r: 4 },
  { x: 0.48, y: 0.40, w: 0.035, h: 0.015, r: 18 },
  { x: 0.85, y: 0.31, w: 0.025, h: 0.012, r: -20 },
  { x: 0.57, y: 0.78, w: 0.024, h: 0.011, r: 12 },
  { x: 0.39, y: 0.62, w: 0.043, h: 0.016, r: 8 },
  { x: 0.70, y: 0.16, w: 0.030, h: 0.013, r: -5 },
  { x: 0.92, y: 0.68, w: 0.020, h: 0.010, r: 24 },
  { x: 0.52, y: 0.30, w: 0.018, h: 0.009, r: -18 },
  { x: 0.79, y: 0.83, w: 0.031, h: 0.012, r: 5 },
  { x: 0.34, y: 0.50, w: 0.022, h: 0.010, r: 15 },
  { x: 0.64, y: 0.45, w: 0.018, h: 0.009, r: -12 },
];

export default function SimulationCanvas({ scene, customImageUri, preset, enabledLayers, sliderPercent, onSliderChange }: SimulationCanvasProps) {
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const percentRef = useRef(sliderPercent);
  percentRef.current = sliderPercent;

  const setPercent = (value: number) => {
    const next = Math.max(8, Math.min(92, value));
    onSliderChange(next);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 5 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderGrant: () => undefined,
        onPanResponderMove: (event) => {
          if (!width) return;
          const x = Number(event.nativeEvent.locationX);
          if (Number.isFinite(x)) setPercent((x / width) * 100);
        },
      }),
    [width]
  );

  const sliderX = width * (sliderPercent / 100);
  const simulatedWidth = Math.max(0, width - sliderX);
  const hasEffects = preset.blurIntensity > 0 || preset.contrastWash > 0 || preset.obscuration > 0 || preset.floaters > 0 || preset.glare > 0;

  return (
    <View
      style={styles.shell}
      onLayout={(event) => {
        setWidth(event.nativeEvent.layout.width);
        setHeight(event.nativeEvent.layout.height);
      }}
      {...panResponder.panHandlers}
      accessible
      accessibilityLabel="Vision comparison. Drag horizontally to reveal more or less of the simulation."
    >
      <SceneArtwork scene={scene} customImageUri={customImageUri} />

      {width > 0 && height > 0 && hasEffects ? (
        <View pointerEvents="none" style={[styles.simulatedClip, { left: sliderX, width: simulatedWidth }]}>
          <View style={[styles.fullOverlayCoordinateSpace, { width, height, left: -sliderX }]}>
            {enabledLayers.blur && preset.blurIntensity > 0 ? (
              <BlurView intensity={Math.min(90, preset.blurIntensity)} tint="default" style={StyleSheet.absoluteFillObject} />
            ) : null}

            {enabledLayers.contrast && preset.contrastWash > 0 ? (
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: `rgba(234,241,240,${Math.min(0.45, preset.contrastWash)})` }]} />
            ) : null}

            {enabledLayers.glare && preset.glare > 0 ? (
              <LinearGradient
                colors={["rgba(255,255,255,0)", `rgba(255,255,255,${Math.min(0.52, preset.glare)})`, "rgba(255,255,255,0)"]}
                start={{ x: 0.08, y: 0.05 }}
                end={{ x: 0.82, y: 0.72 }}
                style={StyleSheet.absoluteFillObject}
              />
            ) : null}

            {enabledLayers.obscuration && preset.obscuration > 0
              ? SCOTOMAS.slice(0, preset.spotCount).map((spot, index) => (
                  <SoftSpot
                    key={`spot-${index}`}
                    width={width}
                    height={height}
                    x={spot.x}
                    y={spot.y}
                    size={spot.size}
                    opacity={preset.obscuration * (0.72 + (index % 3) * 0.10)}
                  />
                ))
              : null}

            {enabledLayers.floaters && preset.floaters > 0
              ? FLOATERS.slice(0, preset.floaterCount).map((floater, index) => (
                  <Floater
                    key={`floater-${index}`}
                    width={width}
                    height={height}
                    x={floater.x}
                    y={floater.y}
                    w={floater.w}
                    h={floater.h}
                    rotate={floater.r}
                    opacity={preset.floaters * (0.62 + (index % 4) * 0.08)}
                  />
                ))
              : null}
          </View>
        </View>
      ) : null}

      <View pointerEvents="none" style={[styles.topLabel, styles.normalLabel]}>
        <Text style={styles.topLabelText}>NORMAL</Text>
      </View>
      <View pointerEvents="none" style={[styles.topLabel, styles.simulatedLabel]}>
        <Text style={styles.topLabelText}>{hasEffects ? "SIMULATION" : "NORMAL"}</Text>
      </View>

      {width > 0 ? (
        <View pointerEvents="box-none" style={[styles.sliderLine, { left: sliderX - 1 }]}>
          <View
            style={styles.sliderHandle}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Comparison position"
            accessibilityValue={{ min: 8, max: 92, now: Math.round(sliderPercent), text: `${Math.round(sliderPercent)} percent normal view` }}
            accessibilityActions={[{ name: "increment", label: "Show more normal view" }, { name: "decrement", label: "Show more simulated view" }]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === "increment") setPercent(percentRef.current + 8);
              if (event.nativeEvent.actionName === "decrement") setPercent(percentRef.current - 8);
            }}
          >
            <Ionicons name="swap-horizontal" size={22} color="#FFFFFF" />
          </View>
        </View>
      ) : null}

      <View pointerEvents="none" style={styles.dragHint}>
        <Ionicons name="hand-left-outline" size={13} color="#FFFFFF" />
        <Text style={styles.dragHintText}>DRAG TO COMPARE</Text>
      </View>
    </View>
  );
}

function SoftSpot({ width, height, x, y, size, opacity }: { width: number; height: number; x: number; y: number; size: number; opacity: number }) {
  const diameter = Math.min(width, height * 1.6) * size;
  const left = width * x - diameter / 2;
  const top = height * y - diameter / 2;
  return (
    <View style={[styles.spotOuter, { width: diameter * 1.55, height: diameter * 1.55, borderRadius: diameter, left: left - diameter * 0.275, top: top - diameter * 0.275, backgroundColor: `rgba(20,24,29,${Math.max(0.01, opacity * 0.16)})` }]}>
      <View style={[styles.spotMiddle, { width: diameter * 1.18, height: diameter * 1.18, borderRadius: diameter, backgroundColor: `rgba(20,24,29,${Math.max(0.02, opacity * 0.34)})` }]}>
        <View style={{ width: diameter * 0.78, height: diameter * 0.78, borderRadius: diameter, backgroundColor: `rgba(16,19,23,${Math.min(0.72, opacity * 0.78)})` }} />
      </View>
    </View>
  );
}

function Floater({ width, height, x, y, w, h, rotate, opacity }: { width: number; height: number; x: number; y: number; w: number; h: number; rotate: number; opacity: number }) {
  const ovalW = Math.max(8, width * w);
  const ovalH = Math.max(5, height * h);
  return (
    <View style={{ position: "absolute", left: width * x - ovalW / 2, top: height * y - ovalH / 2, transform: [{ rotate: `${rotate}deg` }] }}>
      <View style={{ width: ovalW, height: ovalH, borderRadius: ovalH, backgroundColor: `rgba(45,48,52,${Math.min(0.58, opacity)})` }} />
      <View style={{ width: Math.max(12, ovalW * 0.9), height: 1.5, marginLeft: ovalW * 0.45, marginTop: -1, backgroundColor: `rgba(45,48,52,${Math.min(0.36, opacity * 0.65)})`, transform: [{ rotate: "20deg" }] }} />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { width: "100%", aspectRatio: 1.62, minHeight: 250, maxHeight: 520, borderRadius: 24, overflow: "hidden", backgroundColor: "#CAD7E4", borderWidth: 1, borderColor: colors.border, position: "relative" },
  simulatedClip: { position: "absolute", top: 0, bottom: 0, overflow: "hidden" },
  fullOverlayCoordinateSpace: { position: "absolute", top: 0 },
  spotOuter: { position: "absolute", alignItems: "center", justifyContent: "center" },
  spotMiddle: { alignItems: "center", justifyContent: "center" },
  topLabel: { position: "absolute", top: 14, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: "rgba(13,20,29,0.62)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  normalLabel: { left: 14 },
  simulatedLabel: { right: 14 },
  topLabelText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  sliderLine: { position: "absolute", top: 0, bottom: 0, width: 2, backgroundColor: "rgba(255,255,255,0.98)", alignItems: "center", justifyContent: "center", shadowColor: "#000000", shadowOpacity: 0.22, shadowRadius: 5, shadowOffset: { width: 0, height: 1 }, elevation: 3 },
  sliderHandle: { width: 50, height: 50, borderRadius: 26, backgroundColor: "#1D77EA", borderWidth: 3, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center", shadowColor: "#000000", shadowOpacity: 0.28, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 7 },
  dragHint: { position: "absolute", bottom: 12, left: 12, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 13, backgroundColor: "rgba(13,20,29,0.55)" },
  dragHintText: { color: "#FFFFFF", fontSize: 9, fontWeight: "800", letterSpacing: 0.7 },
});
