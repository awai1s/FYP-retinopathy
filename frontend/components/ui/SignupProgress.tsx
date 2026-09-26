import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "../../constants/Colors";
import Sizes from "../../constants/Sizes";
import Fonts from "../../constants/Fonts";

interface Props {
  currentStep: number;
  totalSteps?: number;
}

const SignupProgress = ({ currentStep, totalSteps = 4 }: Props) => (
  <View style={styles.outer} accessibilityLabel={`Signup step ${currentStep} of ${totalSteps}`}>
    <Text style={styles.caption}>STEP {currentStep} OF {totalSteps}</Text>
    <View style={styles.container}>
      {Array.from({ length: totalSteps }).map((_, index) => {
        const step = index + 1;
        const active = step <= currentStep;
        const completed = step < currentStep;
        const current = step === currentStep;

        return (
          <React.Fragment key={index}>
            <View style={[styles.circle, active && styles.activeCircle, current && styles.currentCircle]}>
              {completed ? (
                <Ionicons name="checkmark" size={12} color={Colors.navy} />
              ) : (
                <Text style={[styles.number, active && styles.activeNumber]}>{step}</Text>
              )}
            </View>
            {index !== totalSteps - 1 ? <View style={[styles.line, completed && styles.activeLine]} /> : null}
          </React.Fragment>
        );
      })}
    </View>
  </View>
);

export default SignupProgress;

const styles = StyleSheet.create({
  outer: { alignItems: "center", marginBottom: Sizes.spacing.lg, marginTop: 2 },
  caption: { color: Colors.textOnDarkMuted, fontFamily: Fonts.headingFamily, fontSize: 10, fontWeight: Fonts.weight.bold, letterSpacing: 1.3, marginBottom: 9 },
  container: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  circle: { width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.10)", borderWidth: 1, borderColor: "rgba(255,255,255,0.20)", alignItems: "center", justifyContent: "center" },
  activeCircle: { backgroundColor: Colors.neonAqua, borderColor: Colors.neonAqua },
  currentCircle: { width: 28, height: 28, borderRadius: 14, shadowColor: Colors.neonAqua, shadowOpacity: 0.65, shadowRadius: 10, elevation: 5 },
  number: { color: Colors.textOnDarkMuted, fontFamily: Fonts.headingFamily, fontSize: 10, fontWeight: Fonts.weight.bold },
  activeNumber: { color: Colors.navy },
  line: { width: 38, height: 2, backgroundColor: "rgba(255,255,255,0.17)", marginHorizontal: 5, borderRadius: Sizes.radius.pill },
  activeLine: { backgroundColor: Colors.neonAqua },
});
