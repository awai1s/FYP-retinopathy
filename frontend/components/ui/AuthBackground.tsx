import React from "react";
import { ImageBackground, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "../../constants/Colors";

interface Props {
  children: React.ReactNode;
}

export default function AuthBackground({ children }: Props) {
  return (
    <ImageBackground
      source={require("../../assets/images/retina_bg.jpg")}
      style={styles.background}
      imageStyle={styles.image}
      resizeMode="cover"
    >
      <LinearGradient
        colors={[
          "rgba(2, 11, 18, 0.95)",
          "rgba(3, 31, 35, 0.91)",
          "rgba(3, 17, 28, 0.96)",
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.overlay}
      >
        <View pointerEvents="none" style={styles.glowA} />
        <View pointerEvents="none" style={styles.glowB} />
        <View pointerEvents="none" style={styles.vignette} />
        {children}
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: Colors.authGradientStart,
  },
  image: {
    opacity: 0.38,
  },
  overlay: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  },
  glowA: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: Colors.primaryGlow,
    top: -120,
    right: -110,
    opacity: 0.75,
  },
  glowB: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: Colors.aiGlow,
    bottom: -120,
    left: -100,
    opacity: 0.72,
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 9, 14, 0.16)",
  },
});
