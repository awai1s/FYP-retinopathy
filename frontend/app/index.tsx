import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import Colors from "../constants/Colors";
import Fonts from "../constants/Fonts";
import AppText from "../components/ui/AppText";

import { useAppTheme, useThemeRefresh } from "../providers/AppThemeProvider";
import { getToken, getUserRole } from "../services/storage";
export default function SplashScreen() {
  useThemeRefresh();
  const { reduceMotion } = useAppTheme();
  const logoScale = useRef(new Animated.Value(0.55)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  const glowScale = useRef(new Animated.Value(0.75)).current;
  const glowOpacity = useRef(new Animated.Value(0.2)).current;

  const ringRotation = useRef(new Animated.Value(0)).current;
  const ringRotationReverse = useRef(new Animated.Value(0)).current;

  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslate = useRef(new Animated.Value(18)).current;

  const loaderWidth = useRef(new Animated.Value(0)).current;

  const routeAfterSplash = async () => {
    const [token, role] = await Promise.all([getToken(), getUserRole()]);
    if (!token || !role) { router.replace("/auth/login"); return; }
    if (role === "Patient") router.replace("/tabs/dashboard" as any);
    else if (role === "Doctor") router.replace("/doctor/dashboard" as any);
    else if (role === "Hospital") router.replace("/hospital/dashboard" as any);
    else if (role === "SuperAdmin") router.replace("/superadmin/dashboard" as any);
    else router.replace("/auth/login");
  };

  const pulseLogo = () => {
    if (reduceMotion) return;
    Animated.sequence([
      Animated.timing(logoScale, {
        toValue: 1.08,
        duration: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 4,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();
  };

  useEffect(() => {
    if (reduceMotion) {
      logoScale.setValue(1);
      logoOpacity.setValue(1);
      glowScale.setValue(1);
      glowOpacity.setValue(0.16);
      ringRotation.setValue(0);
      ringRotationReverse.setValue(0);
      contentOpacity.setValue(1);
      contentTranslate.setValue(0);
      loaderWidth.setValue(1);
      const reducedTimer = setTimeout(() => { void routeAfterSplash(); }, 900);
      return () => clearTimeout(reducedTimer);
    }

    // Logo entrance
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),

      Animated.spring(logoScale, {
        toValue: 1,
        friction: 5,
        tension: 55,
        useNativeDriver: true,
      }),

      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 900,
        delay: 650,
        useNativeDriver: true,
      }),

      Animated.timing(contentTranslate, {
        toValue: 0,
        duration: 800,
        delay: 650,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Glowing pulse
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(glowScale, {
            toValue: 1.18,
            duration: 1100,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.42,
            duration: 1100,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),

        Animated.parallel([
          Animated.timing(glowScale, {
            toValue: 0.92,
            duration: 1100,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.2,
            duration: 1100,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();

    // Outer ring rotation
    Animated.loop(
      Animated.timing(ringRotation, {
        toValue: 1,
        duration: 5000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Inner ring reverse rotation
    Animated.loop(
      Animated.timing(ringRotationReverse, {
        toValue: 1,
        duration: 3500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Loading progress
    Animated.timing(loaderWidth, {
      toValue: 1,
      duration: 3300,
      delay: 300,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();

    // Go to login after splash
    const timer = setTimeout(() => {
      void routeAfterSplash();
    }, 3800);

    return () => clearTimeout(timer);
  }, [reduceMotion]);

  const outerRotate = ringRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const innerRotate = ringRotationReverse.interpolate({
    inputRange: [0, 1],
    outputRange: ["360deg", "0deg"],
  });

  return (
    <Pressable style={styles.pressable} onPress={pulseLogo}>
      <LinearGradient
        colors={[
          "#070B20",
          Colors.authGradientMid,
          Colors.authGradientEnd,
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        {/* Background glow */}
        <Animated.View
          style={[
            styles.mainGlow,
            {
              opacity: glowOpacity,
              transform: [{ scale: glowScale }],
            },
          ]}
        />

        {/* Secondary glow */}
        <View style={styles.secondaryGlow} />

        {/* Animated logo system */}
        <View style={styles.logoSystem}>
          {/* Outer rotating ring */}
          <Animated.View
            style={[
              styles.outerRing,
              {
                transform: [{ rotate: outerRotate }],
              },
            ]}
          >
            <View style={styles.ringDotTop} />
            <View style={styles.ringDotBottom} />
            <View style={styles.ringDotLeft} />
          </Animated.View>

          {/* Inner rotating ring */}
          <Animated.View
            style={[
              styles.innerRing,
              {
                transform: [{ rotate: innerRotate }],
              },
            ]}
          >
            <View style={styles.innerDotRight} />
            <View style={styles.innerDotLeft} />
          </Animated.View>

          {/* Logo circle */}
          <Animated.View
            style={[
              styles.logoContainer,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }],
              },
            ]}
          >
            <View style={styles.logoCircle}>
              <Animated.Image
                source={require("../assets/images/logo.png")}
                style={styles.logo}
              />
            </View>
          </Animated.View>
        </View>

        {/* Brand text */}
        <Animated.View
          style={[
            styles.textContainer,
            {
              opacity: contentOpacity,
              transform: [{ translateY: contentTranslate }],
            },
          ]}
        >
          <AppText
            variant="h1"
            color={Colors.white}
            weight="extraBold"
            style={styles.title}
          >
            EyeCare AI
          </AppText>

          <AppText
            variant="body"
            color={Colors.textOnDarkMuted}
            style={styles.subtitle}
          >
            AI-powered retinal health assistant
          </AppText>

          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <AppText
              variant="small"
              color={Colors.textOnDarkMuted}
              style={styles.statusText}
            >
              Preparing your secure health workspace
            </AppText>
          </View>

          {/* Animated progress bar */}
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressBar,
                {
                  width: loaderWidth.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", "100%"],
                  }),
                },
              ]}
            />
          </View>
        </Animated.View>

        {/* Bottom branding */}
        <Animated.View
          style={[
            styles.bottomText,
            {
              opacity: contentOpacity,
            },
          ]}
        >
          <AppText
            variant="tiny"
            color="rgba(255,255,255,0.45)"
            style={styles.secureText}
          >
            SECURE • INTELLIGENT • PATIENT-CENTERED
          </AppText>
        </Animated.View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
  },

  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    paddingHorizontal: 24,
  },

  mainGlow: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: Colors.primaryGlow,
  },

  secondaryGlow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: Colors.aiGlow,
    opacity: 0.5,
  },

  logoSystem: {
    width: 260,
    height: 260,
    justifyContent: "center",
    alignItems: "center",
  },

  outerRing: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 1,
    borderColor: "rgba(34,211,238,0.28)",
  },

  innerRing: {
    position: "absolute",
    width: 205,
    height: 205,
    borderRadius: 103,
    borderWidth: 1,
    borderColor: "rgba(39,229,198,0.30)",
    borderStyle: "dashed",
  },

  ringDotTop: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.secondary,
    top: -4,
    left: "50%",
    marginLeft: -4,
  },

  ringDotBottom: {
    position: "absolute",
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.primaryLight,
    bottom: 10,
    right: 20,
  },

  ringDotLeft: {
    position: "absolute",
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.secondary,
    left: 15,
    top: "50%",
  },

  innerDotRight: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.secondary,
    right: -3,
    top: "50%",
  },

  innerDotLeft: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primaryLight,
    left: 18,
    top: 30,
  },

  logoContainer: {
    justifyContent: "center",
    alignItems: "center",
  },

  logoCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.96)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(34,211,238,0.5)",
    shadowColor: Colors.secondary,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.55,
    shadowRadius: 28,
    elevation: 15,
  },

  logo: {
    width: 120,
    height: 120,
    resizeMode: "contain",
  },

  textContainer: {
    alignItems: "center",
    marginTop: 10,
    width: "100%",
  },

  title: {
    letterSpacing: -0.8,
  },

  subtitle: {
    textAlign: "center",
    marginTop: 7,
    maxWidth: 300,
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 32,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.secondary,
    marginRight: 9,
    shadowColor: Colors.secondary,
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },

  statusText: {
    fontFamily: Fonts.family,
  },

  progressTrack: {
    width: 220,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginTop: 16,
    overflow: "hidden",
  },

  progressBar: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: Colors.secondary,
  },

  bottomText: {
    position: "absolute",
    bottom: 38,
  },

  secureText: {
    letterSpacing: 1.2,
  },
});