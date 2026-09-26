import React from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AuthBackground from "./AuthBackground";
import AppText from "./AppText";
import SignupProgress from "./SignupProgress";
import Colors from "../../constants/Colors";
import Sizes from "../../constants/Sizes";

interface Props {
  title: string;
  subtitle: string;
  eyebrow?: string;
  currentStep?: number;
  totalSteps?: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function AuthScaffold({
  title,
  subtitle,
  eyebrow = "SECURE RETINAL CARE",
  currentStep,
  totalSteps = 4,
  children,
  footer,
}: Props) {
  return (
    <AuthBackground>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.shell}>
            <View style={styles.logoShell}>
              <View style={styles.logoGlow} />
              <Image source={require("../../assets/images/logo.png")} style={styles.logo} />
            </View>

            <View style={styles.eyebrowPill}>
              <View style={styles.liveDot} />
              <AppText variant="eyebrow" color={Colors.neonAqua} weight="bold">
                {eyebrow}
              </AppText>
            </View>

            <AppText variant="h1" color={Colors.white} weight="extraBold" style={styles.title}>
              {title}
            </AppText>
            <AppText variant="body" color={Colors.textOnDarkMuted} style={styles.subtitle}>
              {subtitle}
            </AppText>

            {typeof currentStep === "number" ? (
              <SignupProgress currentStep={currentStep} totalSteps={totalSteps} />
            ) : null}

            <View style={styles.cardShadow}>
              <View style={styles.card}>
                <LinearGradient
                  colors={[Colors.neonAqua, Colors.neonBlue, "rgba(76,201,240,0)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.accentLine}
                />
                {children}
              </View>
            </View>

            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Sizes.spacing.lg,
    paddingVertical: Sizes.spacing.xxl,
  },
  shell: {
    width: "100%",
    maxWidth: 460,
    alignItems: "center",
  },
  logoShell: {
    width: 78,
    height: 78,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: "rgba(39,229,198,0.38)",
    marginBottom: 15,
    shadowColor: Colors.neonAqua,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.34,
    shadowRadius: 22,
    elevation: 10,
  },
  logoGlow: {
    position: "absolute",
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.primaryGlow,
  },
  logo: { width: 63, height: 63, resizeMode: "contain" },
  eyebrowPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: Sizes.radius.pill,
    borderWidth: 1,
    borderColor: "rgba(39,229,198,0.24)",
    backgroundColor: "rgba(5,33,39,0.66)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.neonAqua,
    shadowColor: Colors.neonAqua,
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  title: { textAlign: "center", letterSpacing: -0.75 },
  subtitle: {
    textAlign: "center",
    maxWidth: 390,
    marginTop: 7,
    marginBottom: 18,
  },
  cardShadow: {
    width: "100%",
    borderRadius: 26,
    shadowColor: "#001417",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.34,
    shadowRadius: 34,
    elevation: 14,
  },
  card: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.975)",
    borderRadius: 26,
    padding: Sizes.padding.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.75)",
    overflow: "hidden",
  },
  accentLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  footer: { width: "100%", marginTop: 18, alignItems: "center" },
});
