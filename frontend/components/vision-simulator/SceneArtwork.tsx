import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import type { VisionSceneId } from "../../content/visionSimulationPresets";

interface SceneArtworkProps {
  scene: VisionSceneId;
  customImageUri?: string | null;
}

export default function SceneArtwork({ scene, customImageUri }: SceneArtworkProps) {
  if (scene === "custom" && customImageUri) {
    return <Image source={{ uri: customImageUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />;
  }

  switch (scene) {
    case "reading":
      return <ReadingScene />;
    case "street":
      return <StreetScene />;
    case "face":
      return <FaceScene />;
    case "phone":
      return <PhoneScene />;
    case "driving":
    default:
      return <DrivingScene />;
  }
}

function ReadingScene() {
  return (
    <View style={styles.scene}>
      <LinearGradient colors={["#E7F3FF", "#F7F0DE"]} style={StyleSheet.absoluteFillObject} />
      <View style={[styles.window, { left: "7%", top: "8%" }]}>
        <LinearGradient colors={["#8FD4FF", "#D9F2FF"]} style={StyleSheet.absoluteFillObject} />
        <View style={styles.windowBarV} /><View style={styles.windowBarH} />
      </View>
      <View style={styles.readingShelf}>
        {["#4D6A87", "#CE7B5A", "#789B6D", "#D7A64B", "#8B6FA9"].map((c, i) => <View key={c} style={[styles.bookSpine, { backgroundColor: c, height: 38 + (i % 3) * 9 }]} />)}
      </View>
      <View style={styles.desk} />
      <View style={styles.lampStem} /><View style={styles.lampShade} /><View style={styles.lampGlow} />
      <View style={styles.bookLeft}><View style={styles.bookLineWide} /><View style={styles.bookLine} /><View style={styles.bookLine} /><View style={styles.bookLineShort} /></View>
      <View style={styles.bookRight}><View style={styles.bookLineWide} /><View style={styles.bookLine} /><View style={styles.bookLine} /><View style={styles.bookLineShort} /></View>
      <View style={styles.bookCenter} />
      <View style={styles.mug}><View style={styles.mugHandle} /></View>
      <View style={styles.sceneTag}><Ionicons name="book-outline" size={15} color="#143F5B" /><Text style={styles.sceneTagText}>READING</Text></View>
    </View>
  );
}

function DrivingScene() {
  return (
    <View style={styles.scene}>
      <LinearGradient colors={["#72B9F1", "#DCEEFF"]} style={StyleSheet.absoluteFillObject} />
      <View style={styles.horizon} />
      <View style={styles.leftField} /><View style={styles.rightField} />
      <View style={styles.road}>
        <View style={styles.roadShoulderLeft} /><View style={styles.roadShoulderRight} />
        <View style={[styles.laneMark, { left: "42%", top: "12%", height: "18%" }]} />
        <View style={[styles.laneMark, { left: "45%", top: "39%", height: "24%" }]} />
        <View style={[styles.laneMark, { left: "48%", top: "72%", height: "28%" }]} />
      </View>
      <View style={[styles.tree, { left: "6%", top: "30%" }]}><View style={styles.treeTop} /><View style={styles.treeTrunk} /></View>
      <View style={[styles.tree, { right: "7%", top: "35%" }]}><View style={styles.treeTop} /><View style={styles.treeTrunk} /></View>
      <View style={styles.roadSign}><Text style={styles.roadSignText}>EYE CLINIC{`\n`}2 km</Text></View>
      <View style={styles.carAhead}><View style={styles.carWindow} /><View style={styles.carLightL} /><View style={styles.carLightR} /></View>
      <View style={styles.dashboard}><View style={styles.steering}><View style={styles.steeringInner} /></View><View style={styles.dashboardGlow} /></View>
      <View style={styles.sceneTag}><Ionicons name="car-outline" size={15} color="#143F5B" /><Text style={styles.sceneTagText}>DRIVING</Text></View>
    </View>
  );
}

function StreetScene() {
  return (
    <View style={styles.scene}>
      <LinearGradient colors={["#9AD7FF", "#E8F6FF"]} style={StyleSheet.absoluteFillObject} />
      <View style={[styles.building, { left: 0, width: "25%", height: "58%", backgroundColor: "#D17E64" }]}>{[0,1,2,3].map(i => <View key={i} style={[styles.buildingWindow, { top: 25 + i * 18 }]} />)}</View>
      <View style={[styles.building, { left: "24%", width: "22%", height: "66%", backgroundColor: "#E8C06A" }]}>{[0,1,2].map(i => <View key={i} style={[styles.buildingWindow, { top: 30 + i * 24 }]} />)}</View>
      <View style={[styles.building, { right: 0, width: "32%", height: "62%", backgroundColor: "#6E8E9E" }]}>{[0,1,2].map(i => <View key={i} style={[styles.buildingWindow, { top: 28 + i * 22 }]} />)}</View>
      <View style={styles.sidewalk} /><View style={styles.streetRoad} />
      {[0,1,2,3,4].map(i => <View key={i} style={[styles.crosswalk, { left: `${22 + i * 12}%` }]} />)}
      <View style={[styles.person, { left: "51%", top: "50%" }]}><View style={styles.personHead} /><View style={styles.personBody} /><View style={styles.personLegL} /><View style={styles.personLegR} /></View>
      <View style={[styles.streetTree, { left: "11%" }]}><View style={styles.streetTreeTop} /><View style={styles.streetTreeTrunk} /></View>
      <View style={[styles.streetTree, { right: "17%" }]}><View style={styles.streetTreeTop} /><View style={styles.streetTreeTrunk} /></View>
      <View style={styles.sceneTag}><Ionicons name="business-outline" size={15} color="#143F5B" /><Text style={styles.sceneTagText}>STREET</Text></View>
    </View>
  );
}

function FaceScene() {
  return (
    <View style={styles.scene}>
      <LinearGradient colors={["#DDE8F3", "#EFE5D8"]} style={StyleSheet.absoluteFillObject} />
      <View style={styles.faceWindow}><LinearGradient colors={["#9BCBEA", "#E7F7FF"]} style={StyleSheet.absoluteFillObject} /></View>
      <View style={styles.portraitTorso} />
      <View style={styles.portraitNeck} />
      <View style={styles.portraitEarL} /><View style={styles.portraitEarR} />
      <View style={styles.portraitFace}>
        <View style={styles.hair} />
        <View style={styles.eyeL}><View style={styles.eyePupil} /></View><View style={styles.eyeR}><View style={styles.eyePupil} /></View>
        <View style={styles.nose} /><View style={styles.mouth} />
      </View>
      <View style={styles.plantPot}><View style={[styles.leaf, { transform: [{ rotate: "-25deg" }], left: -6 }]} /><View style={[styles.leaf, { transform: [{ rotate: "28deg" }], right: -5 }]} /></View>
      <View style={styles.sceneTag}><Ionicons name="person-circle-outline" size={15} color="#143F5B" /><Text style={styles.sceneTagText}>FACE</Text></View>
    </View>
  );
}

function PhoneScene() {
  return (
    <View style={styles.scene}>
      <LinearGradient colors={["#B9C7D7", "#E1D9CF"]} style={StyleSheet.absoluteFillObject} />
      <View style={styles.phoneDesk} />
      <View style={styles.phoneShadow} />
      <View style={styles.phoneDevice}>
        <View style={styles.phoneSpeaker} />
        <LinearGradient colors={["#F7FBFF", "#EAF7F5"]} style={styles.phoneScreen}>
          <View style={styles.phoneHeader}><View style={styles.avatar} /><View><View style={styles.phoneTextWide} /><View style={styles.phoneTextTiny} /></View></View>
          <View style={styles.messageBubbleLeft}><View style={styles.phoneTextWide} /><View style={styles.phoneTextMid} /></View>
          <View style={styles.messageBubbleRight}><View style={styles.phoneTextWideLight} /><View style={styles.phoneTextTinyLight} /></View>
          <View style={styles.messageBubbleLeft}><View style={styles.phoneTextMid} /><View style={styles.phoneTextTiny} /></View>
        </LinearGradient>
        <View style={styles.phoneHomeBar} />
      </View>
      <View style={styles.glasses}><View style={styles.glassLens} /><View style={styles.glassBridge} /><View style={styles.glassLens} /></View>
      <View style={styles.sceneTag}><Ionicons name="phone-portrait-outline" size={15} color="#143F5B" /><Text style={styles.sceneTagText}>PHONE</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { ...StyleSheet.absoluteFillObject, overflow: "hidden", backgroundColor: "#DCE8F5" },
  sceneTag: { position: "absolute", top: 12, left: 12, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.82)", borderWidth: 1, borderColor: "rgba(20,63,91,0.12)" },
  sceneTagText: { color: "#143F5B", fontSize: 10, fontWeight: "800", letterSpacing: 0.7 },
  window: { position: "absolute", width: "31%", height: "42%", borderRadius: 8, overflow: "hidden", borderWidth: 5, borderColor: "#F6F0E6" },
  windowBarV: { position: "absolute", width: 4, top: 0, bottom: 0, left: "48%", backgroundColor: "rgba(255,255,255,0.82)" },
  windowBarH: { position: "absolute", height: 4, left: 0, right: 0, top: "49%", backgroundColor: "rgba(255,255,255,0.82)" },
  readingShelf: { position: "absolute", right: "5%", top: "10%", width: "30%", height: "34%", borderRadius: 8, backgroundColor: "#6C5544", borderWidth: 5, borderColor: "#8B725E", flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 8, paddingBottom: 7, gap: 5 },
  bookSpine: { flex: 1, borderRadius: 2 },
  desk: { position: "absolute", left: 0, right: 0, bottom: 0, height: "37%", backgroundColor: "#A67954" },
  lampStem: { position: "absolute", left: "16%", bottom: "28%", width: 6, height: "25%", backgroundColor: "#4B5966" },
  lampShade: { position: "absolute", left: "9%", bottom: "48%", width: "18%", height: "11%", borderTopLeftRadius: 45, borderTopRightRadius: 45, backgroundColor: "#3D5264", transform: [{ rotate: "-8deg" }] },
  lampGlow: { position: "absolute", left: "11%", bottom: "31%", width: "20%", height: "17%", borderRadius: 100, backgroundColor: "rgba(255,236,173,0.28)" },
  bookLeft: { position: "absolute", left: "29%", bottom: "8%", width: "22%", height: "24%", borderTopLeftRadius: 9, borderBottomLeftRadius: 6, backgroundColor: "#FFFDF6", padding: 10, transform: [{ rotate: "-3deg" }] },
  bookRight: { position: "absolute", left: "50%", bottom: "8%", width: "22%", height: "24%", borderTopRightRadius: 9, borderBottomRightRadius: 6, backgroundColor: "#FFFDF6", padding: 10, transform: [{ rotate: "3deg" }] },
  bookCenter: { position: "absolute", left: "49.5%", bottom: "8%", width: 3, height: "24%", backgroundColor: "#D3CAB9" },
  bookLineWide: { height: 3, width: "88%", backgroundColor: "#BCC1C5", marginBottom: 7, borderRadius: 2 },
  bookLine: { height: 3, width: "78%", backgroundColor: "#C7CBCF", marginBottom: 6, borderRadius: 2 },
  bookLineShort: { height: 3, width: "52%", backgroundColor: "#C7CBCF", borderRadius: 2 },
  mug: { position: "absolute", right: "14%", bottom: "14%", width: 45, height: 42, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, backgroundColor: "#E8EBE9" },
  mugHandle: { position: "absolute", right: -14, top: 8, width: 18, height: 22, borderWidth: 5, borderColor: "#E8EBE9", borderRadius: 12, backgroundColor: "transparent" },
  horizon: { position: "absolute", left: 0, right: 0, top: "43%", height: 4, backgroundColor: "#B6CCB0" },
  leftField: { position: "absolute", left: 0, top: "44%", bottom: "23%", width: "36%", backgroundColor: "#6FA76F" },
  rightField: { position: "absolute", right: 0, top: "44%", bottom: "23%", width: "36%", backgroundColor: "#7FB679" },
  road: { position: "absolute", left: "25%", right: "25%", top: "41%", bottom: "20%", backgroundColor: "#686B70", transform: [{ perspective: 500 }, { rotateX: "6deg" }] },
  roadShoulderLeft: { position: "absolute", left: -9, top: 0, bottom: 0, width: 7, backgroundColor: "#E6D8A6" },
  roadShoulderRight: { position: "absolute", right: -9, top: 0, bottom: 0, width: 7, backgroundColor: "#E6D8A6" },
  laneMark: { position: "absolute", width: 5, backgroundColor: "#F8F1BE", borderRadius: 3 },
  tree: { position: "absolute", width: 54, height: 90, alignItems: "center" },
  treeTop: { width: 50, height: 52, borderRadius: 28, backgroundColor: "#3E8459" },
  treeTrunk: { width: 8, height: 40, backgroundColor: "#704B32", marginTop: -5 },
  roadSign: { position: "absolute", right: "16%", top: "28%", width: 88, height: 50, borderRadius: 5, backgroundColor: "#2C7B58", borderWidth: 3, borderColor: "#F2F4E9", alignItems: "center", justifyContent: "center" },
  roadSignText: { color: "#FFFFFF", fontSize: 10, textAlign: "center", fontWeight: "800" },
  carAhead: { position: "absolute", left: "43%", top: "47%", width: 62, height: 42, borderTopLeftRadius: 13, borderTopRightRadius: 13, borderBottomLeftRadius: 7, borderBottomRightRadius: 7, backgroundColor: "#3E5368" },
  carWindow: { position: "absolute", left: 10, right: 10, top: 6, height: 13, borderRadius: 4, backgroundColor: "#97B3C9" },
  carLightL: { position: "absolute", left: 8, bottom: 5, width: 9, height: 5, borderRadius: 3, backgroundColor: "#E74F48" },
  carLightR: { position: "absolute", right: 8, bottom: 5, width: 9, height: 5, borderRadius: 3, backgroundColor: "#E74F48" },
  dashboard: { position: "absolute", left: -10, right: -10, bottom: -12, height: "27%", borderTopLeftRadius: 50, borderTopRightRadius: 50, backgroundColor: "#242D36" },
  steering: { position: "absolute", left: "13%", top: 8, width: 94, height: 94, borderRadius: 50, borderWidth: 12, borderColor: "#111820", alignItems: "center", justifyContent: "center" },
  steeringInner: { width: 28, height: 28, borderRadius: 16, backgroundColor: "#111820" },
  dashboardGlow: { position: "absolute", right: "15%", top: 18, width: 95, height: 28, borderRadius: 12, backgroundColor: "#1B6C6A" },
  building: { position: "absolute", bottom: "30%", borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  buildingWindow: { position: "absolute", left: "22%", width: "56%", height: 12, borderRadius: 3, backgroundColor: "rgba(210,235,244,0.85)" },
  sidewalk: { position: "absolute", left: 0, right: 0, bottom: "21%", height: "17%", backgroundColor: "#D7D0C7" },
  streetRoad: { position: "absolute", left: 0, right: 0, bottom: 0, height: "23%", backgroundColor: "#51575E" },
  crosswalk: { position: "absolute", bottom: "5%", width: "8%", height: "12%", backgroundColor: "#F1EEE8", transform: [{ skewX: "-12deg" }] },
  person: { position: "absolute", width: 38, height: 92, alignItems: "center" },
  personHead: { width: 23, height: 23, borderRadius: 13, backgroundColor: "#C58B68" },
  personBody: { width: 31, height: 42, borderRadius: 10, backgroundColor: "#4E6F92", marginTop: 2 },
  personLegL: { position: "absolute", width: 8, height: 33, backgroundColor: "#3B4148", bottom: 0, left: 7, transform: [{ rotate: "5deg" }] },
  personLegR: { position: "absolute", width: 8, height: 33, backgroundColor: "#3B4148", bottom: 0, right: 7, transform: [{ rotate: "-5deg" }] },
  streetTree: { position: "absolute", bottom: "24%", width: 52, height: 100, alignItems: "center" },
  streetTreeTop: { width: 52, height: 58, borderRadius: 30, backgroundColor: "#4E8F65" },
  streetTreeTrunk: { width: 8, height: 44, backgroundColor: "#765239", marginTop: -5 },
  faceWindow: { position: "absolute", right: "7%", top: "8%", width: "24%", height: "32%", borderRadius: 8, overflow: "hidden", borderWidth: 5, borderColor: "#F3F0EB" },
  portraitTorso: { position: "absolute", left: "31%", bottom: -28, width: "38%", height: "39%", borderTopLeftRadius: 85, borderTopRightRadius: 85, backgroundColor: "#416B78" },
  portraitNeck: { position: "absolute", left: "46%", top: "59%", width: "9%", height: "18%", borderRadius: 14, backgroundColor: "#C88968" },
  portraitEarL: { position: "absolute", left: "35.5%", top: "37%", width: 18, height: 31, borderRadius: 11, backgroundColor: "#C88968" },
  portraitEarR: { position: "absolute", right: "35.5%", top: "37%", width: 18, height: 31, borderRadius: 11, backgroundColor: "#C88968" },
  portraitFace: { position: "absolute", left: "37%", top: "19%", width: "27%", height: "47%", borderRadius: 80, backgroundColor: "#D69A74", alignItems: "center" },
  hair: { position: "absolute", left: 0, right: 0, top: -3, height: "31%", borderTopLeftRadius: 70, borderTopRightRadius: 70, borderBottomLeftRadius: 24, borderBottomRightRadius: 18, backgroundColor: "#3E302D" },
  eyeL: { position: "absolute", left: "22%", top: "42%", width: 24, height: 11, borderRadius: 9, backgroundColor: "#F7F4ED", alignItems: "center", justifyContent: "center" },
  eyeR: { position: "absolute", right: "22%", top: "42%", width: 24, height: 11, borderRadius: 9, backgroundColor: "#F7F4ED", alignItems: "center", justifyContent: "center" },
  eyePupil: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#303E45" },
  nose: { position: "absolute", top: "51%", width: 4, height: 24, borderRadius: 3, backgroundColor: "rgba(128,75,55,0.38)" },
  mouth: { position: "absolute", top: "70%", width: 38, height: 7, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, borderBottomWidth: 3, borderColor: "#8D4F49" },
  plantPot: { position: "absolute", left: "10%", bottom: "9%", width: 46, height: 40, borderBottomLeftRadius: 11, borderBottomRightRadius: 11, backgroundColor: "#B6744E" },
  leaf: { position: "absolute", bottom: 28, width: 29, height: 62, borderRadius: 20, backgroundColor: "#4E8C5C" },
  phoneDesk: { position: "absolute", left: 0, right: 0, bottom: 0, height: "100%", backgroundColor: "rgba(98,87,76,0.15)" },
  phoneShadow: { position: "absolute", left: "35%", top: "9%", width: "31%", height: "83%", borderRadius: 34, backgroundColor: "rgba(0,0,0,0.18)", transform: [{ translateX: 9 }, { translateY: 10 }] },
  phoneDevice: { position: "absolute", left: "35%", top: "7%", width: "31%", height: "83%", borderRadius: 30, backgroundColor: "#16202A", padding: 8, overflow: "hidden" },
  phoneSpeaker: { alignSelf: "center", width: "28%", height: 5, borderRadius: 4, backgroundColor: "#35424E", marginBottom: 5 },
  phoneScreen: { flex: 1, borderRadius: 22, padding: 12, gap: 12 },
  phoneHeader: { flexDirection: "row", alignItems: "center", gap: 9 },
  avatar: { width: 29, height: 29, borderRadius: 16, backgroundColor: "#59A69A" },
  phoneTextWide: { width: 77, height: 5, borderRadius: 3, backgroundColor: "#8EA0AA", marginBottom: 4 },
  phoneTextMid: { width: 58, height: 5, borderRadius: 3, backgroundColor: "#A4B2BA", marginBottom: 4 },
  phoneTextTiny: { width: 38, height: 4, borderRadius: 3, backgroundColor: "#C0C8CD" },
  phoneTextWideLight: { width: 70, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.88)", marginBottom: 4 },
  phoneTextTinyLight: { width: 39, height: 4, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.63)" },
  messageBubbleLeft: { alignSelf: "flex-start", width: "72%", minHeight: 52, borderRadius: 14, borderTopLeftRadius: 4, backgroundColor: "#FFFFFF", padding: 10 },
  messageBubbleRight: { alignSelf: "flex-end", width: "68%", minHeight: 50, borderRadius: 14, borderTopRightRadius: 4, backgroundColor: "#2C8A7D", padding: 10 },
  phoneHomeBar: { position: "absolute", bottom: 8, left: "38%", width: "24%", height: 4, borderRadius: 3, backgroundColor: "#65717B" },
  glasses: { position: "absolute", left: "9%", top: "43%", flexDirection: "row", alignItems: "center" },
  glassLens: { width: 56, height: 37, borderRadius: 18, borderWidth: 4, borderColor: "#48423E", backgroundColor: "rgba(205,232,242,0.22)" },
  glassBridge: { width: 20, height: 4, backgroundColor: "#48423E" },
});
