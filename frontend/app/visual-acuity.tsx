import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import AppShell from "../design/components/AppShell";
import colors from "../design/tokens/colors";
import spacing from "../design/tokens/spacing";
import typography from "../design/tokens/typography";

import { useThemeRefresh } from "../providers/AppThemeProvider";
type TestLevel = {
  acuity: string;
  size: number;
};

const LEVELS: TestLevel[] = [
  { acuity: "20/200", size: 90 },
  { acuity: "20/160", size: 80 },
  { acuity: "20/125", size: 70 },
  { acuity: "20/100", size: 60 },
  { acuity: "20/80", size: 50 },
  { acuity: "20/60", size: 40 },
  { acuity: "20/40", size: 30 },
  { acuity: "20/20", size: 24 },
];

const SNELLEN_LETTERS = ['C', 'D', 'E', 'F', 'L', 'N', 'O', 'P', 'T', 'Z'];

const generateLetters = (level: number) => {
  // Use 2 letters for the first 3 levels, then 3 letters for harder levels
  const count = level >= 3 ? 3 : 2;
  return Array.from({ length: count }, () => 
    SNELLEN_LETTERS[Math.floor(Math.random() * SNELLEN_LETTERS.length)]
  ).join(' ');
};

const generateOptions = (correctAnswer: string) => {
  const options = new Set<string>();
  options.add(correctAnswer);
  
  const count = correctAnswer.replace(/ /g, '').length;
  while (options.size < 4) {
    const randomOption = Array.from({ length: count }, () => 
      SNELLEN_LETTERS[Math.floor(Math.random() * SNELLEN_LETTERS.length)]
    ).join(' ');
    options.add(randomOption);
  }
  return Array.from(options).sort(() => Math.random() - 0.5);
};

export default function VisualAcuityScreen() {
  useThemeRefresh();
  const [phase, setPhase] = useState<'instructions' | 'right' | 'left' | 'results'>('instructions');
  const [question, setQuestion] = useState(1);
  
  const [rightScore, setRightScore] = useState(0);
  const [leftScore, setLeftScore] = useState(0);
  
  const [currentLetters, setCurrentLetters] = useState("");
  const [options, setOptions] = useState<string[]>([]);

  // Calculate overall progress (14 questions total: 7 right, 7 left)
  const totalQuestions = 14;
  const currentOverallQuestion = phase === 'right' ? question : (phase === 'left' ? question + 7 : 14);
  const progress = phase === 'results' ? 100 : ((currentOverallQuestion - 1) / totalQuestions) * 100;

  const startTest = () => {
    const initial = generateLetters(0);
    setCurrentLetters(initial);
    setOptions(generateOptions(initial));
    setRightScore(0);
    setLeftScore(0);
    setQuestion(1);
    setPhase('right');
  };

  const handleAnswer = (selectedOption: string) => {
    const isCorrect = selectedOption === currentLetters;
    const nextLevelIndex = Math.min(question, LEVELS.length - 1);
    
    if (phase === 'right') {
      if (isCorrect) setRightScore((prev) => prev + 1);
      
      if (question >= 7) {
        setPhase('left'); // Switch to left eye
        setQuestion(1);
        const next = generateLetters(0);
        setCurrentLetters(next);
        setOptions(generateOptions(next));
      } else {
        setQuestion((q) => q + 1);
        const next = generateLetters(nextLevelIndex);
        setCurrentLetters(next);
        setOptions(generateOptions(next));
      }
    } else if (phase === 'left') {
      if (isCorrect) setLeftScore((prev) => prev + 1);
      
      if (question >= 7) {
        setPhase('results'); // End test
      } else {
        setQuestion((q) => q + 1);
        const next = generateLetters(nextLevelIndex);
        setCurrentLetters(next);
        setOptions(generateOptions(next));
      }
    }
  };

  const handleBack = () => {
    if (phase === 'instructions' || phase === 'results') {
      router.replace('/vision-tests' as any); // Change this to your exact previous screen route if needed
    } else {
      setPhase('instructions'); // Reset test back to instructions if they are mid-test
    }
  };
  // Generate Diagnosis Message
  const getDiagnosis = () => {
    if (rightScore >= 5 && leftScore >= 5) {
      return "Your visual acuity is generally normal for both eyes.";
    } else if (rightScore <= 3 || leftScore <= 3) {
      return "We detected some visual impairment. A professional consultation is highly recommended.";
    } else {
      return "Your vision shows mild irregularity. Keep monitoring it regularly.";
    }
  };

  // 1. RESULTS SCREEN
  if (phase === 'results') {
    return (
      <AppShell
        role="Patient"
        title="Visual Acuity"
        showBack
        onBackPress={handleBack}
      >
        <ScrollView contentContainerStyle={styles.resultContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.resultIcon}>
            <Ionicons name="checkmark-circle-outline" size={58} color={colors.teal800} />
          </View>

          <Text style={styles.resultTitle}>Screening Complete</Text>
          <Text style={styles.resultSubtitle}>{getDiagnosis()}</Text>

          <View style={styles.resultCard}>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Right Eye Score</Text>
              <Text style={styles.resultValue}>{rightScore} / 7</Text>
            </View>

            <View style={styles.resultDivider} />

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Left Eye Score</Text>
              <Text style={styles.resultValue}>{leftScore} / 7</Text>
            </View>

            <View style={styles.resultDivider} />

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Screening status</Text>
              <Text style={styles.resultStatus}>Completed</Text>
            </View>
          </View>

          <View style={styles.disclaimer}>
            <Ionicons name="information-circle-outline" size={20} color={colors.teal800} />
            <Text style={styles.disclaimerText}>
              This digital screening is for educational and monitoring purposes. It does not replace a calibrated professional eye examination.
            </Text>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()} activeOpacity={0.85}>
            <Text style={styles.primaryButtonText}>Return to Vision Tests</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => setPhase('instructions')} activeOpacity={0.85}>
            <Text style={styles.secondaryButtonText}>Repeat Screening</Text>
          </TouchableOpacity>
        </ScrollView>
      </AppShell>
    );
  }

  // 2. INSTRUCTIONS SCREEN
  if (phase === 'instructions') {
    return (
      <AppShell
        role="Patient"
        title="Visual Acuity"
        subtitle="Standard letter screening"
        showBack
        onBackPress={handleBack}
      >
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.welcomeCard}>
            <View style={styles.welcomeIconContainer}>
              <Ionicons name="eye-outline" size={32} color={colors.teal800} />
            </View>
            <Text style={styles.welcomeTitle}>Test your visual acuity</Text>
            <Text style={styles.welcomeSubtitle}>
              You will see a series of standard letters. Look carefully and select the exact combination you see from the options provided.
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Before you start</Text>

          {[
            { id: 1, icon: 'sunny-outline', title: 'Use good lighting', text: 'Perform the test in a well-lit environment and avoid screen glare.' },
            { id: 2, icon: 'resize-outline', title: 'Keep the screen steady', text: 'Hold your device exactly 40 cm (16 inches) away from your eyes.' },
            { id: 3, icon: 'eye-off-outline', title: 'Test one eye at a time', text: 'You will be prompted to cover one eye gently with your hand. Do not press on it.' },
            { id: 4, icon: 'hand-left-outline', title: 'Answer honestly', text: 'Select the option you genuinely see rather than guessing repeatedly.' }
          ].map((step) => (
            <View key={step.id} style={styles.stepCard}>
              <View style={styles.stepNumberBadge}>
                <Text style={styles.stepNumberText}>{step.id}</Text>
              </View>
              <View style={styles.stepIconBadge}>
                <Ionicons name={step.icon as any} size={18} color={colors.teal800} />
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepText}>{step.text}</Text>
              </View>
            </View>
          ))}

          <View style={styles.warningCard}>
            <Ionicons name="information-circle-outline" size={20} color="#92400E" />
            <Text style={styles.warningText}>
              This is an educational screening tool. It is not a calibrated diagnostic visual acuity examination.
            </Text>
          </View>

          <TouchableOpacity style={styles.startButton} onPress={startTest} activeOpacity={0.85}>
            <Ionicons name="play" size={20} color={colors.white} />
            <Text style={styles.startButtonText}>Start Test</Text>
          </TouchableOpacity>
        </ScrollView>
      </AppShell>
    );
  }

  // 3. MAIN TESTING SCREEN
  return (
    <AppShell
      role="Patient"
      title="Visual Acuity"
      subtitle="Standard letter screening"
      showBack
      onBackPress={handleBack}
    >
      <View style={styles.container}>
        {/* Progress */}
        <View style={styles.progressSection}>
          <View style={styles.progressTop}>
            <Text style={styles.progressLabel}>OVERALL PROGRESS</Text>
            <Text style={styles.progressPercent}>{Math.round(progress)}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(progress, 100)}%` }]} />
          </View>
        </View>

        {/* Eye Indicator */}
        <View style={[styles.eyeCard, phase === 'right' ? styles.eyeCardRight : styles.eyeCardLeft]}>
          <View>
            <Text style={styles.eyeLabel}>CURRENTLY TESTING</Text>
            <Text style={styles.eyeTitle}>{phase === 'right' ? 'Right Eye' : 'Left Eye'}</Text>
          </View>
          <View style={styles.coverBadge}>
            <Ionicons name="hand-right-outline" size={16} color="#92400E" />
            <Text style={styles.coverText}>
              Cover {phase === 'right' ? 'Left' : 'Right'} Eye
            </Text>
          </View>
        </View>

        {/* Main test card */}
        <View style={styles.testCard}>
          <View style={styles.testHeader}>
            <View>
              <Text style={styles.questionLabel}>Question {question} of 7</Text>
              <Text style={styles.instruction}>Select the letters you see</Text>
            </View>
            <View style={styles.acuityBadge}>
              <Text style={styles.acuitySmall}>ACUITY</Text>
              <Text style={styles.acuityValue}>{LEVELS[Math.min(question - 1, LEVELS.length - 1)].acuity}</Text>
            </View>
          </View>

          {/* Optotypes */}
          <View style={styles.chartArea}>
            <Text style={[styles.optotype, { fontSize: LEVELS[Math.min(question - 1, LEVELS.length - 1)].size }]}>
              {currentLetters}
            </Text>
          </View>

          {/* Answer section */}
          <View style={styles.answerSection}>
            <Text style={styles.answerTitle}>Select the correct option</Text>
            <View style={styles.answerGrid}>
              {options.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.answerButton}
                  onPress={() => handleAnswer(option)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.answerText}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Bottom guidance */}
        <View style={styles.guidanceCard}>
          <Ionicons name="resize-outline" size={20} color={colors.teal800} />
          <View style={styles.guidanceContent}>
            <Text style={styles.guidanceTitle}>Maintain 40 cm distance</Text>
            <Text style={styles.guidanceText}>
              Keep the device steady. Use your normal corrective glasses if prescribed.
            </Text>
          </View>
        </View>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: spacing.xxxl + 20,
  },
  
  // LANDING PAGE STYLES
  welcomeCard: { backgroundColor: colors.white, borderRadius: 16, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.xl, borderWidth: 1, borderColor: colors.borderLight },
  welcomeIconContainer: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.teal50, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  welcomeTitle: { fontSize: typography.sizes.h2, fontWeight: typography.weights.bold, color: colors.textPrimary, marginBottom: spacing.sm, textAlign: 'center' },
  welcomeSubtitle: { fontSize: typography.sizes.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  sectionTitle: { fontSize: typography.sizes.h3, fontWeight: typography.weights.bold, color: colors.textPrimary, marginBottom: spacing.md },
  stepCard: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 12, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.borderLight, alignItems: 'center' },
  stepNumberBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.teal800, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  stepNumberText: { color: colors.white, fontSize: typography.sizes.xs, fontWeight: typography.weights.bold },
  stepIconBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.teal50, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: typography.sizes.body, fontWeight: typography.weights.bold, color: colors.textPrimary, marginBottom: 2 },
  stepText: { fontSize: typography.sizes.small, color: colors.textSecondary, lineHeight: 18 },
  warningCard: { flexDirection: 'row', backgroundColor: colors.warningBg, borderRadius: 12, padding: spacing.md, marginTop: spacing.md, marginBottom: spacing.xl, alignItems: 'center' },
  warningText: { flex: 1, marginLeft: spacing.sm, color: colors.warning, fontSize: typography.sizes.xs, lineHeight: 18 },
  startButton: { flexDirection: 'row', width: '100%', height: 56, borderRadius: 12, backgroundColor: colors.teal800, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  startButtonText: { color: colors.white, fontSize: typography.sizes.body, fontWeight: typography.weights.bold },

  // TEST STYLES
  progressSection: { marginBottom: spacing.md },
  progressTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
  progressLabel: { fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, color: colors.textMuted, letterSpacing: 0.8 },
  progressPercent: { fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, color: colors.teal800 },
  progressTrack: { height: 6, borderRadius: 10, backgroundColor: colors.teal50, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: colors.teal800, borderRadius: 10 },
  
  eyeCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 14, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderWidth: 1, marginBottom: spacing.md },
  eyeCardRight: { backgroundColor: colors.successBg, borderColor: colors.successBorder },
  eyeCardLeft: { backgroundColor: colors.infoBg, borderColor: colors.infoBorder },
  eyeLabel: { fontSize: typography.sizes.tiny, color: colors.textMuted, fontWeight: typography.weights.bold, letterSpacing: 0.7 },
  eyeTitle: { fontSize: typography.sizes.body, fontWeight: typography.weights.bold, color: colors.textPrimary, marginTop: 2 },
  coverBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 7, backgroundColor: colors.warningBg, borderRadius: 20 },
  coverText: { fontSize: typography.sizes.xs, fontWeight: typography.weights.bold, color: colors.warning },

  testCard: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.borderLight, overflow: "hidden" },
  testHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  questionLabel: { fontSize: typography.sizes.body, fontWeight: typography.weights.bold, color: colors.textPrimary },
  instruction: { fontSize: typography.sizes.small, color: colors.textSecondary, marginTop: 3 },
  acuityBadge: { alignItems: "flex-end" },
  acuitySmall: { fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, color: colors.textMuted, letterSpacing: 0.7 },
  acuityValue: { fontSize: typography.sizes.h3, fontWeight: typography.weights.bold, color: colors.teal800, marginTop: 1 },
  
  chartArea: { minHeight: 250, alignItems: "center", justifyContent: "center", backgroundColor: "#FAFCFC", paddingVertical: spacing.xl },
  optotype: { fontWeight: "900", color: "#123D3B", includeFontPadding: false, letterSpacing: 4 },
  
  answerSection: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.borderLight },
  answerTitle: { textAlign: "center", fontSize: typography.sizes.small, fontWeight: typography.weights.bold, color: colors.textSecondary, marginBottom: spacing.md },
  answerGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: 'space-between', gap: spacing.sm },
  answerButton: { width: "48%", minHeight: 54, borderWidth: 1, borderColor: colors.borderLight, borderRadius: 12, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  answerText: { fontSize: typography.sizes.h3, fontWeight: typography.weights.bold, color: colors.textPrimary, letterSpacing: 2 },
  
  guidanceCard: { flexDirection: "row", marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.borderLight },
  guidanceContent: { flex: 1, marginLeft: spacing.md },
  guidanceTitle: { fontSize: typography.sizes.small, fontWeight: typography.weights.bold, color: colors.textPrimary },
  guidanceText: { fontSize: typography.sizes.xs, color: colors.textSecondary, lineHeight: 17, marginTop: 3 },
  
  // RESULTS STYLES
  resultContainer: { flexGrow: 1, alignItems: "center", paddingTop: spacing.xl, paddingBottom: spacing.xxxl },
  resultIcon: { width: 90, height: 90, borderRadius: 45, backgroundColor: colors.teal50, alignItems: "center", justifyContent: "center" },
  resultTitle: { fontSize: typography.sizes.h1, fontWeight: typography.weights.bold, color: colors.textPrimary, marginTop: spacing.lg },
  resultSubtitle: { fontSize: typography.sizes.body, color: colors.textSecondary, textAlign: "center", maxWidth: '90%', lineHeight: 21, marginTop: spacing.sm },
  resultCard: { width: "100%", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, borderRadius: 16, marginTop: spacing.xl, padding: spacing.md },
  resultRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm },
  resultLabel: { color: colors.textSecondary, fontSize: typography.sizes.body, fontWeight: '500' },
  resultValue: { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.bold },
  resultStatus: { color: colors.teal800, fontSize: typography.sizes.small, fontWeight: typography.weights.bold },
  resultDivider: { height: 1, backgroundColor: colors.borderLight, marginVertical: spacing.xs },
  disclaimer: { width: "100%", flexDirection: "row", backgroundColor: colors.teal50, borderRadius: 14, padding: spacing.md, marginTop: spacing.md },
  disclaimerText: { flex: 1, marginLeft: spacing.sm, color: colors.textSecondary, fontSize: typography.sizes.xs, lineHeight: 17 },
  primaryButton: { width: "100%", height: 50, borderRadius: 12, backgroundColor: colors.teal800, alignItems: "center", justifyContent: "center", marginTop: spacing.xl },
  primaryButtonText: { color: colors.white, fontSize: typography.sizes.body, fontWeight: typography.weights.bold },
  secondaryButton: { width: "100%", height: 50, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  secondaryButtonText: { color: colors.teal800, fontSize: typography.sizes.body, fontWeight: typography.weights.bold },
});