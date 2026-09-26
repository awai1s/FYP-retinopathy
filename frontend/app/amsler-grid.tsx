
import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import AppText from "../components/ui/AppText";
import Colors from "../constants/Colors";
import Sizes from "../constants/Sizes";
import { saveVisionTest } from "../services/vision";
import { useLanguage } from "../services/i18n";

import { useThemeRefresh } from "../providers/AppThemeProvider";
type Eye = "right" | "left";
type Phase = "instructions" | "test" | "result";

interface Mark {
  id: number;
  x: number;
  y: number;
}

const GRID_SIZE = 11;
const GRID_PADDING = 18;

function getResult(
  rightMarks: number,
  leftMarks: number
) {
  const total = rightMarks + leftMarks;

  if (total === 0) {
    return {
      titleKey: "amslerNoAreasMarked" as const,
      descriptionKey: "amslerNoAreasDescription" as const,
      color: Colors.success,
      icon: "checkmark-circle" as keyof typeof Ionicons.glyphMap,
    };
  }

  if (total <= 2) {
    return {
      titleKey: "amslerMinorChanges" as const,
      descriptionKey: "amslerMinorChangesDescription" as const,
      color: Colors.warning,
      icon: "alert-circle" as keyof typeof Ionicons.glyphMap,
    };
  }

  return {
    titleKey: "amslerFollowUpRecommended" as const,
    descriptionKey: "amslerFollowUpDescription" as const,
    color: Colors.danger,
    icon: "warning" as keyof typeof Ionicons.glyphMap,
  };
}

export default function AmslerGridScreen() {
  useThemeRefresh();
  const { t } = useLanguage();

  const [phase, setPhase] =
    useState<Phase>("instructions");

  const [eye, setEye] =
    useState<Eye>("right");

  const [rightMarks, setRightMarks] =
    useState<Mark[]>([]);

  const [leftMarks, setLeftMarks] =
    useState<Mark[]>([]);

  const fadeAnimation = useRef(
    new Animated.Value(1)
  ).current;

  const scaleAnimation = useRef(
    new Animated.Value(1)
  ).current;

  const currentMarks =
    eye === "right"
      ? rightMarks
      : leftMarks;

  const result = useMemo(
    () =>
      getResult(
        rightMarks.length,
        leftMarks.length
      ),
    [rightMarks.length, leftMarks.length]
  );

  const animateTransition = useCallback(
    (callback: () => void) => {
      Animated.parallel([
        Animated.timing(fadeAnimation, {
          toValue: 0,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnimation, {
          toValue: 0.94,
          duration: 140,
          useNativeDriver: true,
        }),
      ]).start(() => {
        callback();

        Animated.parallel([
          Animated.spring(fadeAnimation, {
            toValue: 1,
            damping: 14,
            stiffness: 150,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnimation, {
            toValue: 1,
            damping: 14,
            stiffness: 150,
            useNativeDriver: true,
          }),
        ]).start();
      });
    },
    [fadeAnimation, scaleAnimation]
  );

  const startTest = () => {
    setRightMarks([]);
    setLeftMarks([]);
    setEye("right");
    setPhase("test");

    fadeAnimation.setValue(0);
    scaleAnimation.setValue(0);

    Animated.parallel([
      Animated.spring(fadeAnimation, {
        toValue: 1,
        damping: 14,
        stiffness: 150,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnimation, {
        toValue: 1,
        damping: 14,
        stiffness: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const toggleMark = (
    x: number,
    y: number
  ) => {
    const updateMarks = (
      previous: Mark[]
    ): Mark[] => {
      const existing = previous.find(
        (mark) =>
          Math.abs(mark.x - x) < 0.08 &&
          Math.abs(mark.y - y) < 0.08
      );

      if (existing) {
        return previous.filter(
          (mark) => mark.id !== existing.id
        );
      }

      return [
        ...previous,
        {
          id:
            Date.now() +
            previous.length,
          x,
          y,
        },
      ];
    };

    if (eye === "right") {
      setRightMarks(updateMarks);
    } else {
      setLeftMarks(updateMarks);
    }
  };

  const clearCurrentMarks = () => {
    if (eye === "right") {
      setRightMarks([]);
    } else {
      setLeftMarks([]);
    }
  };

  const switchToLeftEye = () => {
    animateTransition(() => {
      setEye("left");
    });
  };

  const finishTest = async () => {
    try {
      await saveVisionTest({
        testType: "Amsler Grid",
        result:
          rightMarks.length + leftMarks.length === 0
            ? "No marked distortion"
            : "Distortion areas recorded",
        metadata: {
          rightEye: {
            marks: rightMarks.map(
              ({ x, y }) => ({ x, y })
            ),
          },
          leftEye: {
            marks: leftMarks.map(
              ({ x, y }) => ({ x, y })
            ),
          },
        },
      });
    } catch (error) {
      console.error(
        "Failed to save Amsler Grid result:",
        error
      );
    }

    setPhase("result");
  };

  const restartTest = () => {
    setRightMarks([]);
    setLeftMarks([]);
    setEye("right");
    setPhase("instructions");
  };

  if (phase === "instructions") {
    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons
                name="arrow-back"
                size={21}
                color={Colors.white}
              />
            </TouchableOpacity>

            <View style={styles.headerText}>
              <AppText
                variant="tiny"
                color={Colors.secondary}
                weight="bold"
              >
                {t("visionScreening")}
              </AppText>

              <AppText
                variant="h2"
                color={Colors.textOnDark}
                weight="extraBold"
              >
                {t("amslerGrid")}
              </AppText>
            </View>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroIcon}>
              <Ionicons
                name="grid-outline"
                size={42}
                color={Colors.primary}
              />
            </View>

            <AppText
              variant="h3"
              color={Colors.textPrimary}
              weight="bold"
              style={styles.heroTitle}
            >
              {t("amslerCheckCentralVision")}
            </AppText>

            <AppText
              variant="small"
              color={Colors.textSecondary}
              style={styles.heroDescription}
            >
              {t("amslerDescription")}
            </AppText>
          </View>

          <AppText
            variant="h3"
            color={Colors.textOnDark}
            weight="bold"
            style={styles.sectionTitle}
          >
            {t("beforeYouStart")}
          </AppText>

          <Instruction
            number="1"
            icon="glasses-outline"
            title={t("amslerUseReadingGlasses")}
            description={t(
              "amslerUseReadingGlassesDescription"
            )}
          />

          <Instruction
            number="2"
            icon="eye-outline"
            title={t("amslerTestOneEye")}
            description={t(
              "amslerTestOneEyeDescription"
            )}
          />

          <Instruction
            number="3"
            icon="phone-portrait-outline"
            title={t("amslerKeepScreenComfortable")}
            description={t(
              "amslerKeepScreenComfortableDescription"
            )}
          />

          <Instruction
            number="4"
            icon="finger-print-outline"
            title={t("amslerMarkUnusualAreas")}
            description={t(
              "amslerMarkUnusualAreasDescription"
            )}
          />

          <View style={styles.notice}>
            <Ionicons
              name="information-circle-outline"
              size={22}
              color={Colors.warning}
            />

            <AppText
              variant="tiny"
              color={Colors.textSecondary}
              style={styles.noticeText}
            >
              {t("amslerScreeningNotice")}
            </AppText>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={startTest}
            style={styles.primaryButton}
          >
            <Ionicons
              name="play"
              size={20}
              color={Colors.white}
            />

            <AppText
              variant="title"
              color={Colors.white}
              weight="bold"
              style={styles.buttonText}
            >
              {t("startTest")}
            </AppText>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (phase === "result") {
    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons
                name="arrow-back"
                size={21}
                color={Colors.white}
              />
            </TouchableOpacity>

            <View style={styles.headerText}>
              <AppText
                variant="tiny"
                color={Colors.secondary}
                weight="bold"
              >
                {t("screeningComplete")}
              </AppText>

              <AppText
                variant="h2"
                color={Colors.textOnDark}
                weight="extraBold"
              >
                {t("yourResult")}
              </AppText>
            </View>
          </View>

          <View style={styles.resultCard}>
            <View
              style={[
                styles.resultIcon,
                {
                  backgroundColor:
                    result.color + "18",
                },
              ]}
            >
              <Ionicons
                name={result.icon}
                size={42}
                color={result.color}
              />
            </View>

            <AppText
              variant="h3"
              color={Colors.textPrimary}
              weight="bold"
              style={styles.resultTitle}
            >
              {t(result.titleKey)}
            </AppText>

            <AppText
              variant="small"
              color={Colors.textSecondary}
              style={styles.resultDescription}
            >
              {t(result.descriptionKey)}
            </AppText>
          </View>

          <View style={styles.statsGrid}>
            <ResultStat
              label={t("rightEye")}
              value={`${rightMarks.length}`}
              icon="eye-outline"
              color={Colors.primary}
            />

            <ResultStat
              label={t("leftEye")}
              value={`${leftMarks.length}`}
              icon="eye-outline"
              color={Colors.warning}
            />
          </View>

          <View style={styles.resultNotice}>
            <Ionicons
              name="medical-outline"
              size={22}
              color={Colors.primary}
            />

            <AppText
              variant="tiny"
              color={Colors.textSecondary}
              style={styles.noticeText}
            >
              {t("amslerResultNotice")}
            </AppText>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={restartTest}
            style={styles.primaryButton}
          >
            <Ionicons
              name="refresh"
              size={20}
              color={Colors.white}
            />

            <AppText
              variant="title"
              color={Colors.white}
              weight="bold"
              style={styles.buttonText}
            >
              {t("retakeTest")}
            </AppText>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.back()}
            style={styles.secondaryButton}
          >
            <AppText
              variant="title"
              color={Colors.primary}
              weight="bold"
            >
              {t("backToVisionTests")}
            </AppText>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.testContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.testHeader}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              setPhase("instructions");
              setRightMarks([]);
              setLeftMarks([]);
            }}
            style={styles.backButton}
          >
            <Ionicons
              name="close"
              size={21}
              color={Colors.white}
            />
          </TouchableOpacity>

          <View style={styles.progressInfo}>
            <AppText
              variant="small"
              color={Colors.textOnDark}
              weight="bold"
            >
              {t("amslerGrid")}
            </AppText>

            <AppText
              variant="tiny"
              color={Colors.textOnDarkMuted}
            >
              {eye === "right"
                ? t("rightEye")
                : t("leftEye")}
            </AppText>
          </View>

          <View style={styles.eyeBadge}>
            <Ionicons
              name="eye-outline"
              size={16}
              color={Colors.secondary}
            />

            <AppText
              variant="tiny"
              color={Colors.textOnDark}
              weight="bold"
              style={styles.timerText}
            >
              {currentMarks.length} {t("marked")}
            </AppText>
          </View>
        </View>

        <View style={styles.levelBadge}>
          <Ionicons
            name="locate-outline"
            size={17}
            color={Colors.primary}
          />

          <AppText
            variant="tiny"
            color={Colors.primary}
            weight="bold"
            style={styles.levelText}
          >
            {t("amslerFocusCenter")}
          </AppText>
        </View>

        <AppText
          variant="h3"
          color={Colors.textOnDark}
          weight="bold"
          style={styles.questionTitle}
        >
          {t("amslerDoesGridLookNormal")}
        </AppText>

        <AppText
          variant="small"
          color={Colors.textOnDarkMuted}
          style={styles.questionSubtitle}
        >
          {t("amslerTapDistortedAreas")}
        </AppText>

        <Animated.View
          style={[
            styles.gridCard,
            {
              opacity: fadeAnimation,
              transform: [
                {
                  scale: scaleAnimation,
                },
              ],
            },
          ]}
        >
          <AmslerGrid
            marks={currentMarks}
            onToggleMark={toggleMark}
          />
        </Animated.View>

        <View style={styles.centerHint}>
          <Ionicons
            name="eye-outline"
            size={18}
            color={Colors.secondary}
          />

          <AppText
            variant="tiny"
            color={Colors.textOnDarkMuted}
            style={styles.tipText}
          >
            {t("amslerKeepGazeCenter")}
          </AppText>
        </View>

        <View style={styles.testActions}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={clearCurrentMarks}
            style={styles.clearButton}
          >
            <Ionicons
              name="refresh-outline"
              size={19}
              color={Colors.textOnDark}
            />

            <AppText
              variant="small"
              color={Colors.textOnDark}
              weight="bold"
              style={styles.buttonText}
            >
              {t("clearMarks")}
            </AppText>
          </TouchableOpacity>

          {eye === "right" ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={switchToLeftEye}
              style={styles.switchButton}
            >
              <Ionicons
                name="arrow-forward"
                size={19}
                color={Colors.white}
              />

              <AppText
                variant="small"
                color={Colors.white}
                weight="bold"
                style={styles.buttonText}
              >
                {t("testLeftEye")}
              </AppText>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={finishTest}
              style={styles.switchButton}
            >
              <Ionicons
                name="checkmark"
                size={19}
                color={Colors.white}
              />

              <AppText
                variant="small"
                color={Colors.white}
                weight="bold"
                style={styles.buttonText}
              >
                {t("finishTest")}
              </AppText>
            </TouchableOpacity>
          )}
        </View>

        {eye === "right" && (
          <AppText
            variant="tiny"
            color={Colors.textOnDarkMuted}
            style={styles.bottomHint}
          >
            {t("amslerRightEyeCompleteHint")}
          </AppText>
        )}
      </ScrollView>
    </View>
  );
}

function AmslerGrid({
  marks,
  onToggleMark,
}: {
  marks: Mark[];
  onToggleMark: (
    x: number,
    y: number
  ) => void;
}) {
  const cells = Array.from(
    { length: GRID_SIZE },
    (_, index) => index
  );

  return (
    <View style={styles.grid}>
      {cells.map((row) => (
        <View
          key={`row-${row}`}
          style={styles.gridRow}
        >
          {cells.map((column) => {
            const x =
              column /
              (GRID_SIZE - 1);

            const y =
              row /
              (GRID_SIZE - 1);

            const isCenter =
              row ===
                Math.floor(
                  GRID_SIZE / 2
                ) &&
              column ===
                Math.floor(
                  GRID_SIZE / 2
                );

            const marked = marks.some(
              (mark) =>
                Math.abs(mark.x - x) <
                  0.08 &&
                Math.abs(mark.y - y) <
                  0.08
            );

            return (
              <TouchableOpacity
                key={`${row}-${column}`}
                activeOpacity={0.65}
                onPress={() =>
                  onToggleMark(x, y)
                }
                style={[
                  styles.gridCell,
                  isCenter &&
                    styles.centerCell,
                ]}
              >
                {isCenter && (
                  <View
                    style={
                      styles.centerDot
                    }
                  />
                )}

                {marked && (
                  <View
                    style={
                      styles.markOverlay
                    }
                  >
                    <Ionicons
                      name="close"
                      size={20}
                      color={
                        Colors.danger
                      }
                    />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function Instruction({
  number,
  icon,
  title,
  description,
}: {
  number: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.instruction}>
      <View style={styles.numberCircle}>
        <AppText
          variant="tiny"
          color={Colors.white}
          weight="bold"
        >
          {number}
        </AppText>
      </View>

      <View style={styles.instructionIcon}>
        <Ionicons
          name={icon}
          size={20}
          color={Colors.primary}
        />
      </View>

      <View style={styles.instructionContent}>
        <AppText
          variant="small"
          color={Colors.textPrimary}
          weight="bold"
        >
          {title}
        </AppText>

        <AppText
          variant="tiny"
          color={Colors.textSecondary}
          style={styles.instructionDescription}
        >
          {description}
        </AppText>
      </View>
    </View>
  );
}

function ResultStat({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}) {
  return (
    <View style={styles.resultStat}>
      <Ionicons
        name={icon}
        size={20}
        color={color}
      />

      <AppText
        variant="title"
        color={Colors.textPrimary}
        weight="bold"
        style={styles.resultStatValue}
      >
        {value}
      </AppText>

      <AppText
        variant="tiny"
        color={Colors.textSecondary}
      >
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.navy,
  },

  content: {
    paddingHorizontal: Sizes.spacing.lg,
    paddingTop: Sizes.spacing.huge,
    paddingBottom: Sizes.spacing.huge,
  },

  testContent: {
    paddingHorizontal: Sizes.spacing.lg,
    paddingTop: Sizes.spacing.xxl,
    paddingBottom: Sizes.spacing.huge,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Sizes.spacing.xl,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: Sizes.radius.pill,
    backgroundColor: Colors.navySoft,
    borderWidth: 1,
    borderColor: Colors.borderOnDark,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Sizes.spacing.md,
  },

  headerText: {
    flex: 1,
  },

  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: Sizes.radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Sizes.padding.xl,
    alignItems: "center",
    marginBottom: Sizes.spacing.xl,
  },

  heroIcon: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: Colors.primaryGlow,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Sizes.spacing.md,
  },

  heroTitle: {
    textAlign: "center",
  },

  heroDescription: {
    textAlign: "center",
    lineHeight: 20,
    marginTop: Sizes.spacing.xs,
  },

  sectionTitle: {
    marginBottom: Sizes.spacing.md,
  },

  instruction: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: Colors.surface,
    borderRadius: Sizes.radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Sizes.padding.md,
    marginBottom: Sizes.spacing.sm,
  },

  numberCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Sizes.spacing.sm,
  },

  instructionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primaryGlow,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Sizes.spacing.sm,
  },

  instructionContent: {
    flex: 1,
  },

  instructionDescription: {
    lineHeight: 18,
    marginTop: 3,
  },

  notice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.warningSoft,
    borderRadius: Sizes.radius.lg,
    padding: Sizes.padding.md,
    marginTop: Sizes.spacing.md,
  },

  noticeText: {
    flex: 1,
    marginLeft: Sizes.spacing.sm,
    lineHeight: 18,
  },

  primaryButton: {
    height: Sizes.control.buttonHeight,
    borderRadius: Sizes.radius.lg,
    backgroundColor: Colors.primary,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: Sizes.spacing.xl,
  },

  buttonText: {
    marginLeft: Sizes.spacing.sm,
  },

  secondaryButton: {
    height: Sizes.control.buttonHeight,
    borderRadius: Sizes.radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: "center",
    alignItems: "center",
    marginTop: Sizes.spacing.md,
  },

  testHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  progressInfo: {
    flex: 1,
  },

  eyeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.navySurface,
    borderWidth: 1,
    borderColor: Colors.borderOnDark,
    borderRadius: Sizes.radius.pill,
    paddingHorizontal: Sizes.spacing.sm,
    paddingVertical: 7,
  },

  timerText: {
    marginLeft: 4,
  },

  levelBadge: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primaryGlow,
    borderRadius: Sizes.radius.pill,
    paddingHorizontal: Sizes.spacing.md,
    paddingVertical: 7,
    marginTop: Sizes.spacing.xl,
  },

  levelText: {
    marginLeft: 5,
  },

  questionTitle: {
    textAlign: "center",
    marginTop: Sizes.spacing.lg,
  },

  questionSubtitle: {
    textAlign: "center",
    marginTop: 6,
    lineHeight: 19,
  },

  gridCard: {
    backgroundColor: Colors.white,
    borderRadius: Sizes.radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Sizes.spacing.xl,
    padding: GRID_PADDING,
    alignItems: "center",
    justifyContent: "center",
    aspectRatio: 1,
    width: "100%",
  },

  grid: {
    width: "100%",
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: Colors.black,
  },

  gridRow: {
    flex: 1,
    flexDirection: "row",
  },

  gridCell: {
    flex: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.black,
    justifyContent: "center",
    alignItems: "center",
  },

  centerCell: {
    borderWidth: 0,
  },

  centerDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: Colors.black,
  },

  markOverlay: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.dangerSoft,
    borderWidth: 2,
    borderColor: Colors.danger,
    justifyContent: "center",
    alignItems: "center",
  },

  centerHint: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.navySurface,
    borderRadius: Sizes.radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderOnDark,
    padding: Sizes.padding.md,
    marginTop: Sizes.spacing.md,
  },

  tipText: {
    flex: 1,
    marginLeft: Sizes.spacing.sm,
    lineHeight: 18,
  },

  testActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Sizes.spacing.md,
  },

  clearButton: {
    width: "48%",
    height: 50,
    borderRadius: Sizes.radius.lg,
    backgroundColor: Colors.navySurface,
    borderWidth: 1,
    borderColor: Colors.borderOnDark,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },

  switchButton: {
    width: "48%",
    height: 50,
    borderRadius: Sizes.radius.lg,
    backgroundColor: Colors.primary,
    borderWidth: 1,
    borderColor: Colors.borderOnDark,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },

  bottomHint: {
    textAlign: "center",
    lineHeight: 18,
    marginTop: Sizes.spacing.md,
  },

  resultCard: {
    backgroundColor: Colors.surface,
    borderRadius: Sizes.radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Sizes.padding.xl,
    alignItems: "center",
  },

  resultIcon: {
    width: 82,
    height: 82,
    borderRadius: 41,
    justifyContent: "center",
    alignItems: "center",
  },

  resultTitle: {
    textAlign: "center",
    marginTop: Sizes.spacing.md,
  },

  resultDescription: {
    textAlign: "center",
    lineHeight: 20,
    marginTop: Sizes.spacing.xs,
  },

  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Sizes.spacing.md,
  },

  resultStat: {
    width: "48%",
    backgroundColor: Colors.surface,
    borderRadius: Sizes.radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Sizes.padding.md,
  },

  resultStatValue: {
    marginTop: 5,
  },

  resultNotice: {
    flexDirection: "row",
    backgroundColor: Colors.infoSoft,
    borderRadius: Sizes.radius.lg,
    padding: Sizes.padding.md,
    marginTop: Sizes.spacing.md,
  },
});
