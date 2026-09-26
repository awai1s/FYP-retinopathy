import React, {
  useCallback,
  useEffect,
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
import { saveVisionTest } from "../services/vision";
import { Ionicons } from "@expo/vector-icons";
import AppText from "../components/ui/AppText";
import Colors from "../constants/Colors";
import Sizes from "../constants/Sizes";
import {
  useLanguage,
  type TranslationKey,
} from "../services/i18n";

import { useThemeRefresh } from "../providers/AppThemeProvider";
type Phase = "instructions" | "test" | "result";

interface Dot {
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: number;
}

interface ColorPlateData {
  id: number;
  number: number;
  correctAnswer: string;
  options: string[];
  description: string;
  dots: Dot[];
}

interface AnswerOptionProps {
  label: string;
  selected: boolean;
  correct: boolean;
  showResult: boolean;
  onPress: () => void;
}

const PLATE_SIZE = 260;
const TOTAL_PLATES = 6;

const BACKGROUND_COLORS = [
  "#84CC16",
  "#22C55E",
  "#10B981",
  "#14B8A6",
  "#06B6D4",
  "#A3E635",
];

const DIGIT_COLORS = [
  "#EA580C",
  "#EF4444",
  "#E11D48",
  "#F59E0B",
  "#D97706",
  "#DC2626",
];

/*
 * IMPORTANT:
 * This is ColorPlateData[], not Omit<ColorPlateData, "dots">[].
 * Each plate contains dots: [] initially, which fixes the TS2353 errors.
 */
const PLATES_DATA: ColorPlateData[] = [
  {
    id: 1,
    number: 12,
    correctAnswer: "12",
    options: ["8", "12", "17", "21"],
    description:
      "Most people with normal color vision should be able to identify the number.",
    dots: [],
  },
  {
    id: 2,
    number: 8,
    correctAnswer: "8",
    options: ["3", "8", "6", "5"],
    description:
      "Identify the number formed by the differently colored dots.",
    dots: [],
  },
  {
    id: 3,
    number: 6,
    correctAnswer: "6",
    options: ["5", "6", "8", "9"],
    description:
      "Look carefully at the center of the plate.",
    dots: [],
  },
  {
    id: 4,
    number: 29,
    correctAnswer: "29",
    options: ["29", "70", "45", "None"],
    description:
      "Try to identify both digits in the center.",
    dots: [],
  },
  {
    id: 5,
    number: 74,
    correctAnswer: "74",
    options: ["21", "74", "17", "None"],
    description:
      "The two digits should appear clearly inside the circle.",
    dots: [],
  },
  {
    id: 6,
    number: 45,
    correctAnswer: "45",
    options: ["45", "5", "3", "None"],
    description:
      "Identify the final number before viewing your result.",
    dots: [],
  },
];

const seededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

const DIGIT_PATHS: Record<
  string,
  [number, number, number, number][]
> = {
  "0": [
    [0.25, 0.1, 0.75, 0.1],
    [0.75, 0.1, 0.75, 0.9],
    [0.75, 0.9, 0.25, 0.9],
    [0.25, 0.9, 0.25, 0.1],
  ],

  "1": [
    [0.3, 0.2, 0.5, 0.1],
    [0.5, 0.1, 0.5, 0.9],
    [0.25, 0.9, 0.75, 0.9],
  ],

  "2": [
    [0.2, 0.15, 0.8, 0.15],
    [0.8, 0.15, 0.8, 0.5],
    [0.8, 0.5, 0.2, 0.5],
    [0.2, 0.5, 0.2, 0.85],
    [0.2, 0.85, 0.85, 0.85],
  ],

  "3": [
    [0.2, 0.15, 0.8, 0.15],
    [0.8, 0.15, 0.8, 0.85],
    [0.2, 0.85, 0.8, 0.85],
    [0.25, 0.5, 0.8, 0.5],
  ],

  "4": [
    [0.2, 0.1, 0.2, 0.5],
    [0.2, 0.5, 0.85, 0.5],
    [0.75, 0.1, 0.75, 0.9],
  ],

  "5": [
    [0.8, 0.15, 0.2, 0.15],
    [0.2, 0.15, 0.2, 0.5],
    [0.2, 0.5, 0.8, 0.5],
    [0.8, 0.5, 0.8, 0.85],
    [0.8, 0.85, 0.2, 0.85],
  ],

  "6": [
    [0.75, 0.15, 0.2, 0.15],
    [0.2, 0.15, 0.2, 0.85],
    [0.2, 0.85, 0.8, 0.85],
    [0.8, 0.85, 0.8, 0.5],
    [0.8, 0.5, 0.2, 0.5],
  ],

  "7": [
    [0.15, 0.12, 0.85, 0.12],
    [0.85, 0.12, 0.35, 0.88],
  ],

  "8": [
    [0.25, 0.15, 0.75, 0.15],
    [0.75, 0.15, 0.75, 0.85],
    [0.75, 0.85, 0.25, 0.85],
    [0.25, 0.85, 0.25, 0.15],
    [0.25, 0.5, 0.75, 0.5],
  ],

  "9": [
    [0.2, 0.5, 0.8, 0.5],
    [0.8, 0.15, 0.8, 0.85],
    [0.2, 0.15, 0.8, 0.15],
    [0.2, 0.15, 0.2, 0.5],
    [0.2, 0.85, 0.8, 0.85],
  ],
};

const isPointNearSegment = (
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  thickness: number
) => {
  const l2 =
    (bx - ax) ** 2 +
    (by - ay) ** 2;

  if (l2 === 0) {
    return (
      Math.hypot(px - ax, py - ay) <=
      thickness
    );
  }

  let t =
    ((px - ax) * (bx - ax) +
      (py - ay) * (by - ay)) /
    l2;

  t = Math.max(0, Math.min(1, t));

  const projX =
    ax + t * (bx - ax);

  const projY =
    ay + t * (by - ay);

  return (
    Math.hypot(
      px - projX,
      py - projY
    ) <= thickness
  );
};

const isPointInsideNumber = (
  x: number,
  y: number,
  number: number
) => {
  const center = PLATE_SIZE / 2;

  const localX = x - center;
  const localY = y - center;

  const digits = String(number);
  const isDoubleDigit =
    digits.length > 1;

  const digitWidth = isDoubleDigit
    ? 42
    : 55;

  const digitHeight = isDoubleDigit
    ? 85
    : 110;

  const gap = isDoubleDigit
    ? 18
    : 0;

  const strokeWidth = isDoubleDigit
    ? 12
    : 16;

  const totalWidth =
    digits.length * digitWidth +
    (digits.length - 1) * gap;

  const startX =
    -totalWidth / 2;

  for (
    let i = 0;
    i < digits.length;
    i += 1
  ) {
    const digit = digits[i];

    const digitX =
      startX +
      i * (digitWidth + gap);

    const paths =
      DIGIT_PATHS[digit];

    if (!paths) {
      continue;
    }

    for (const [
      ax,
      ay,
      bx,
      by,
    ] of paths) {
      const pAx =
        digitX +
        ax * digitWidth;

      const pAy =
        -digitHeight / 2 +
        ay * digitHeight;

      const pBx =
        digitX +
        bx * digitWidth;

      const pBy =
        -digitHeight / 2 +
        by * digitHeight;

      if (
        isPointNearSegment(
          localX,
          localY,
          pAx,
          pAy,
          pBx,
          pBy,
          strokeWidth
        )
      ) {
        return true;
      }
    }
  }

  return false;
};

const createDots = (
  plateId: number,
  number: number
): Dot[] => {
  const dots: Dot[] = [];
  const TOTAL_DOTS = 650;

  for (
    let i = 0;
    i < TOTAL_DOTS;
    i += 1
  ) {
    const randomA =
      seededRandom(
        plateId * 1000 +
          i * 13
      );

    const randomB =
      seededRandom(
        plateId * 2000 +
          i * 17
      );

    const randomC =
      seededRandom(
        plateId * 3000 +
          i * 19
      );

    const randomD =
      seededRandom(
        plateId * 4000 +
          i * 23
      );

    const radius =
      Math.sqrt(randomA) *
      (PLATE_SIZE / 2 - 8);

    const angle =
      randomB *
      Math.PI *
      2;

    const centerX =
      PLATE_SIZE / 2 +
      Math.cos(angle) *
        radius;

    const centerY =
      PLATE_SIZE / 2 +
      Math.sin(angle) *
        radius;

    const digitVisible =
      isPointInsideNumber(
        centerX,
        centerY,
        number
      );

    const palette =
      digitVisible
        ? DIGIT_COLORS
        : BACKGROUND_COLORS;

    const colorIndex =
      Math.floor(
        randomC *
          palette.length
      );

    dots.push({
      x: centerX,
      y: centerY,
      size:
        5 + randomD * 7,
      color:
        palette[colorIndex],
      opacity:
        0.88 +
        randomD * 0.12,
    });
  }

  return dots;
};

const buildPlates =
  (): ColorPlateData[] => {
    return PLATES_DATA.map(
      (plate) => ({
        ...plate,
        dots: createDots(
          plate.id,
          plate.number
        ),
      })
    );
  };

const getResult = (
  score: number,
  total: number
) => {
  const percentage =
    total > 0
      ? Math.round(
          (score / total) * 100
        )
      : 0;

  if (percentage >= 85) {
    return {
      title:
        "Normal Screening Result",
      description:
        "You identified most of the color vision plates correctly.",
      color: Colors.success,
      icon:
        "checkmark-circle" as const,
    };
  }

  if (percentage >= 60) {
    return {
      title:
        "Some Difficulty Detected",
      description:
        "Some color plates were difficult to identify. Consider repeating the screening or discussing the result with an eye-care professional.",
      color: Colors.warning,
      icon:
        "alert-circle" as const,
    };
  }

  return {
    title:
      "Further Evaluation Recommended",
    description:
      "Several color plates were difficult to identify. A professional color vision assessment may be helpful.",
    color: Colors.danger,
    icon: "warning" as const,
  };
};

function AnswerOption({
  label,
  selected,
  correct,
  showResult,
  onPress,
}: AnswerOptionProps) {
  let borderColor =
    Colors.border;

  let backgroundColor =
    Colors.surface;

  if (
    showResult &&
    selected
  ) {
    borderColor = correct
      ? Colors.success
      : Colors.danger;

    backgroundColor = correct
      ? Colors.successSoft
      : Colors.dangerSoft;
  } else if (selected) {
    borderColor =
      Colors.primary;

    backgroundColor =
      Colors.primaryGlow;
  }

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.answerOption,
        {
          borderColor,
          backgroundColor,
        },
      ]}
    >
      <View
        style={
          styles.answerRadio
        }
      >
        {selected && (
          <View
            style={[
              styles.answerRadioInner,
              {
                backgroundColor:
                  showResult
                    ? correct
                      ? Colors.success
                      : Colors.danger
                    : Colors.primary,
              },
            ]}
          />
        )}
      </View>

      <AppText
        variant="title"
        color={Colors.textPrimary}
        weight="bold"
      >
        {label}
      </AppText>

      {showResult &&
        selected && (
          <Ionicons
            name={
              correct
                ? "checkmark-circle"
                : "close-circle"
            }
            size={22}
            color={
              correct
                ? Colors.success
                : Colors.danger
            }
            style={
              styles.answerIcon
            }
          />
        )}
    </TouchableOpacity>
  );
}

function ColorPlateView({
  plate,
  animatedStyle,
}: {
  plate: ColorPlateData;
  animatedStyle: any;
}) {
  return (
    <Animated.View
      style={[
        styles.plate,
        animatedStyle,
      ]}
    >
      {plate.dots.map(
        (dot, index) => (
          <View
            key={`${plate.id}-${index}`}
            style={[
              styles.dot,
              {
                left:
                  dot.x -
                  dot.size / 2,
                top:
                  dot.y -
                  dot.size / 2,
                width: dot.size,
                height: dot.size,
                borderRadius:
                  dot.size / 2,
                backgroundColor:
                  dot.color,
                opacity:
                  dot.opacity,
              },
            ]}
          />
        )
      )}
    </Animated.View>
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
    <View
      style={styles.instruction}
    >
      <View
        style={styles.numberCircle}
      >
        <AppText
          variant="tiny"
          color={Colors.white}
          weight="bold"
        >
          {number}
        </AppText>
      </View>

      <View
        style={
          styles.instructionIcon
        }
      >
        <Ionicons
          name={icon}
          size={20}
          color={Colors.primary}
        />
      </View>

      <View
        style={
          styles.instructionContent
        }
      >
        <AppText
          variant="small"
          color={Colors.textPrimary}
          weight="bold"
        >
          {title}
        </AppText>

        <AppText
          variant="tiny"
          color={
            Colors.textSecondary
          }
          style={
            styles.instructionDescription
          }
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
    <View
      style={styles.resultStat}
    >
      <Ionicons
        name={icon}
        size={20}
        color={color}
      />

      <AppText
        variant="title"
        color={Colors.textPrimary}
        weight="bold"
        style={
          styles.resultStatValue
        }
      >
        {value}
      </AppText>

      <AppText
        variant="tiny"
        color={
          Colors.textSecondary
        }
      >
        {label}
      </AppText>
    </View>
  );
}

export default function ColorVisionScreen() {
  useThemeRefresh();
  const { t } =
    useLanguage();

  const [phase, setPhase] =
    useState<Phase>(
      "instructions"
    );

  const [plates, setPlates] =
    useState<ColorPlateData[]>(
      []
    );

  const [currentIndex, setCurrentIndex] =
    useState(0);

  const [score, setScore] =
    useState(0);

  const [selectedAnswer, setSelectedAnswer] =
    useState<string | null>(
      null
    );

  const [showAnswer, setShowAnswer] =
    useState(false);

  const [elapsedSeconds, setElapsedSeconds] =
    useState(0);

  const fadeAnimation =
    useRef(
      new Animated.Value(1)
    ).current;

  const scaleAnimation =
    useRef(
      new Animated.Value(1)
    ).current;

  const resultAnimation =
    useRef(
      new Animated.Value(0)
    ).current;

  const timerRef =
    useRef<ReturnType<
      typeof setInterval
    > | null>(null);

  const currentPlate =
    plates[currentIndex];

  const progress =
    plates.length > 0
      ? (currentIndex + 1) /
        plates.length
      : 0;

  const result = useMemo(
    () =>
      getResult(
        score,
        plates.length
      ),
    [score, plates.length]
  );

  /*
   * Typed mapping prevents the dynamic
   * template literal from becoming an
   * invalid TranslationKey.
   */
  const plateDescriptionKeys: Record<
    number,
    TranslationKey
  > = {
    1: "colorVisionPlate1Description",
    2: "colorVisionPlate2Description",
    3: "colorVisionPlate3Description",
    4: "colorVisionPlate4Description",
    5: "colorVisionPlate5Description",
    6: "colorVisionPlate6Description",
  };

  const startTimer =
    useCallback(() => {
      if (timerRef.current) {
        clearInterval(
          timerRef.current
        );
      }

      timerRef.current =
        setInterval(() => {
          setElapsedSeconds(
            (previous) =>
              previous + 1
          );
        }, 1000);
    }, []);

  const stopTimer =
    useCallback(() => {
      if (timerRef.current) {
        clearInterval(
          timerRef.current
        );

        timerRef.current =
          null;
      }
    }, []);

  useEffect(() => {
    return () => {
      stopTimer();
    };
  }, [stopTimer]);

  const animateNextPlate =
    useCallback(
      (callback: () => void) => {
        Animated.parallel([
          Animated.timing(
            fadeAnimation,
            {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }
          ),

          Animated.timing(
            scaleAnimation,
            {
              toValue: 0.9,
              duration: 150,
              useNativeDriver: true,
            }
          ),
        ]).start(() => {
          callback();

          Animated.parallel([
            Animated.spring(
              fadeAnimation,
              {
                toValue: 1,
                useNativeDriver: true,
                damping: 14,
                stiffness: 160,
              }
            ),

            Animated.spring(
              scaleAnimation,
              {
                toValue: 1,
                useNativeDriver: true,
                damping: 14,
                stiffness: 160,
              }
            ),
          ]).start();
        });
      },
      [
        fadeAnimation,
        scaleAnimation,
      ]
    );

  const startTest = () => {
    setPlates(
      buildPlates()
    );

    setCurrentIndex(0);
    setScore(0);
    setSelectedAnswer(null);
    setShowAnswer(false);
    setElapsedSeconds(0);
    setPhase("test");

    resultAnimation.setValue(
      0
    );

    startTimer();
  };

  const finishTest = (
    finalScore = score
  ) => {
    stopTimer();

    void saveVisionTest({
      testType:
        "Color Vision",
      score:
        plates.length > 0
          ? Math.round(
              (finalScore /
                plates.length) *
                100
            )
          : 0,
      result:
        getResult(
          finalScore,
          plates.length
        ).title,
      durationSeconds:
        elapsedSeconds,
      metadata: {
        plates:
          plates.length,
      },
    }).catch(
      (error) =>
        console.error(
          "Failed to save Color Vision result:",
          error
        )
    );

    setPhase("result");

    Animated.spring(
      resultAnimation,
      {
        toValue: 1,
        useNativeDriver: true,
        damping: 13,
        stiffness: 120,
      }
    ).start();
  };

  const handleAnswer = (
    answer: string
  ) => {
    if (
      showAnswer ||
      !currentPlate
    ) {
      return;
    }

    const isCorrect =
      answer ===
      currentPlate.correctAnswer;

    setSelectedAnswer(
      answer
    );

    if (isCorrect) {
      setScore(
        (previous) =>
          previous + 1
      );
    }

    setShowAnswer(true);

    setTimeout(() => {
      const isLast =
        currentIndex >=
        plates.length - 1;

      if (isLast) {
        finishTest(
          score +
            (isCorrect ? 1 : 0)
        );

        return;
      }

      animateNextPlate(() => {
        setCurrentIndex(
          (previous) =>
            previous + 1
        );

        setSelectedAnswer(
          null
        );

        setShowAnswer(false);
      });
    }, 800);
  };

  const restartTest = () => {
    stopTimer();

    setPhase(
      "instructions"
    );

    setPlates([]);
    setCurrentIndex(0);
    setScore(0);
    setSelectedAnswer(null);
    setShowAnswer(false);
    setElapsedSeconds(0);

    resultAnimation.setValue(
      0
    );
  };

  const minutes =
    Math.floor(
      elapsedSeconds / 60
    );

  const seconds =
    elapsedSeconds % 60;

  const formattedTime =
    `${minutes}:${seconds
      .toString()
      .padStart(2, "0")}`;

  /*
   * ----------------------------------------------------
   * INSTRUCTIONS
   * ----------------------------------------------------
   */
  if (
    phase ===
    "instructions"
  ) {
    return (
      <View
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={
            styles.content
          }
          showsVerticalScrollIndicator={
            false
          }
        >
          <View
            style={styles.header}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() =>
                router.back()
              }
              style={
                styles.backButton
              }
            >
              <Ionicons
                name="arrow-back"
                size={21}
                color={
                  Colors.white
                }
              />
            </TouchableOpacity>

            <View
              style={
                styles.headerText
              }
            >
              <AppText
                variant="tiny"
                color={
                  Colors.secondary
                }
                weight="bold"
                style={
                  styles.eyebrow
                }
              >
                {t(
                  "visionScreening"
                )}
              </AppText>

              <AppText
                variant="h2"
                color={
                  Colors.textOnDark
                }
                weight="extraBold"
              >
                {t(
                  "colorVision"
                )}
              </AppText>

              <AppText
                variant="small"
                color={
                  Colors.textOnDarkMuted
                }
                style={
                  styles.headerSubtitle
                }
              >
                {t(
                  "colorVisionSubtitle"
                )}
              </AppText>
            </View>
          </View>

          <View
            style={
              styles.heroCard
            }
          >
            <View
              style={
                styles.heroIcon
              }
            >
              <Ionicons
                name="color-palette-outline"
                size={42}
                color={
                  Colors.primary
                }
              />
            </View>

            <AppText
              variant="h3"
              color={
                Colors.textPrimary
              }
              weight="bold"
              style={
                styles.heroTitle
              }
            >
              {t(
                "testYourColorVision"
              )}
            </AppText>

            <AppText
              variant="small"
              color={
                Colors.textSecondary
              }
              style={
                styles.heroDescription
              }
            >
              {t(
                "colorVisionTestDescription"
              )}
            </AppText>
          </View>

          <AppText
            variant="h3"
            color={
              Colors.textOnDark
            }
            weight="bold"
            style={
              styles.sectionTitle
            }
          >
            {t(
              "beforeYouStart"
            )}
          </AppText>

          <Instruction
            number="1"
            icon="sunny-outline"
            title={t(
              "useGoodLighting"
            )}
            description={t(
              "useGoodLightingDescription"
            )}
          />

          <Instruction
            number="2"
            icon="phone-portrait-outline"
            title={t(
              "keepScreenSteady"
            )}
            description={t(
              "keepScreenSteadyDescription"
            )}
          />

          <Instruction
            number="3"
            icon="eye-outline"
            title={t(
              "lookCarefully"
            )}
            description={t(
              "lookCarefullyDescription"
            )}
          />

          <Instruction
            number="4"
            icon="hand-left-outline"
            title={t(
              "answerHonestly"
            )}
            description={t(
              "answerHonestlyDescription"
            )}
          />

          <View
            style={styles.notice}
          >
            <Ionicons
              name="information-circle-outline"
              size={22}
              color={
                Colors.warning
              }
            />

            <AppText
              variant="tiny"
              color={
                Colors.textSecondary
              }
              style={
                styles.noticeText
              }
            >
              {t(
                "colorVisionEducationalNotice"
              )}
            </AppText>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={
              startTest
            }
            style={
              styles.primaryButton
            }
          >
            <Ionicons
              name="play"
              size={20}
              color={
                Colors.white
              }
            />

            <AppText
              variant="title"
              color={
                Colors.white
              }
              weight="bold"
              style={
                styles.buttonText
              }
            >
              {t(
                "startTest"
              )}
            </AppText>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  /*
   * ----------------------------------------------------
   * RESULT
   * ----------------------------------------------------
   */
  if (
    phase === "result"
  ) {
    const percentage =
      plates.length > 0
        ? Math.round(
            (score /
              plates.length) *
              100
          )
        : 0;

    return (
      <View
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={
            styles.content
          }
          showsVerticalScrollIndicator={
            false
          }
        >
          <View
            style={styles.header}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() =>
                router.back()
              }
              style={
                styles.backButton
              }
            >
              <Ionicons
                name="arrow-back"
                size={21}
                color={
                  Colors.white
                }
              />
            </TouchableOpacity>

            <View
              style={
                styles.headerText
              }
            >
              <AppText
                variant="tiny"
                color={
                  Colors.secondary
                }
                weight="bold"
              >
                {t(
                  "screeningComplete"
                )}
              </AppText>

              <AppText
                variant="h2"
                color={
                  Colors.textOnDark
                }
                weight="extraBold"
              >
                {t(
                  "yourResult"
                )}
              </AppText>
            </View>
          </View>

          <Animated.View
            style={[
              styles.resultCard,
              {
                opacity:
                  resultAnimation,

                transform: [
                  {
                    scale:
                      resultAnimation.interpolate(
                        {
                          inputRange: [
                            0,
                            1,
                          ],
                          outputRange: [
                            0.9,
                            1,
                          ],
                        }
                      ),
                  },
                ],
              },
            ]}
          >
            <View
              style={[
                styles.resultIcon,
                {
                  backgroundColor:
                    `${result.color}18`,
                },
              ]}
            >
              <Ionicons
                name={
                  result.icon
                }
                size={42}
                color={
                  result.color
                }
              />
            </View>

            <AppText
              variant="h3"
              color={
                Colors.textPrimary
              }
              weight="bold"
              style={
                styles.resultTitle
              }
            >
              {result.title}
            </AppText>

            <AppText
              variant="small"
              color={
                Colors.textSecondary
              }
              style={
                styles.resultDescription
              }
            >
              {result.description}
            </AppText>

            <View
              style={[
                styles.scoreCircle,
                {
                  borderColor:
                    `${result.color}40`,
                },
              ]}
            >
              <AppText
                variant="h2"
                color={
                  result.color
                }
                weight="extraBold"
              >
                {percentage}%
              </AppText>

              <AppText
                variant="tiny"
                color={
                  Colors.textSecondary
                }
              >
                {t(
                  "accuracy"
                )}
              </AppText>
            </View>
          </Animated.View>

          <View
            style={
              styles.statsGrid
            }
          >
            <ResultStat
              label={t(
                "correct"
              )}
              value={`${score}`}
              icon="checkmark-circle-outline"
              color={
                Colors.success
              }
            />

            <ResultStat
              label={t(
                "plates"
              )}
              value={`${plates.length}`}
              icon="color-palette-outline"
              color={
                Colors.primary
              }
            />

            <ResultStat
              label={t(
                "time"
              )}
              value={
                formattedTime
              }
              icon="time-outline"
              color={
                Colors.secondaryDark
              }
            />

            <ResultStat
              label={t(
                "completed"
              )}
              value={t(
                "today"
              )}
              icon="calendar-outline"
              color={
                Colors.warning
              }
            />
          </View>

          <View
            style={
              styles.resultNotice
            }
          >
            <Ionicons
              name="medical-outline"
              size={22}
              color={
                Colors.primary
              }
            />

            <AppText
              variant="tiny"
              color={
                Colors.textSecondary
              }
              style={
                styles.noticeText
              }
            >
              {t(
                "colorVisionResultNotice"
              )}
            </AppText>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={
              restartTest
            }
            style={
              styles.primaryButton
            }
          >
            <Ionicons
              name="refresh"
              size={20}
              color={
                Colors.white
              }
            />

            <AppText
              variant="title"
              color={
                Colors.white
              }
              weight="bold"
              style={
                styles.buttonText
              }
            >
              {t(
                "retakeTest"
              )}
            </AppText>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() =>
              router.back()
            }
            style={
              styles.secondaryButton
            }
          >
            <AppText
              variant="title"
              color={
                Colors.primary
              }
              weight="bold"
            >
              {t(
                "backToVisionTests"
              )}
            </AppText>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  /*
   * ----------------------------------------------------
   * LOADING
   * ----------------------------------------------------
   */
  if (!currentPlate) {
    return (
      <View
        style={
          styles.loadingContainer
        }
      >
        <AppText
          variant="small"
          color={
            Colors.textOnDarkMuted
          }
        >
          {t(
            "preparingColorVisionTest"
          )}
        </AppText>
      </View>
    );
  }

  /*
   * ----------------------------------------------------
   * TEST
   * ----------------------------------------------------
   */

  const plateDescriptionKey =
    plateDescriptionKeys[
      currentPlate.id
    ];

  return (
    <View
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={
          styles.testContent
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <View
          style={
            styles.testHeader
          }
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              stopTimer();
              setPhase(
                "instructions"
              );
            }}
            style={
              styles.backButton
            }
          >
            <Ionicons
              name="close"
              size={21}
              color={
                Colors.white
              }
            />
          </TouchableOpacity>

          <View
            style={
              styles.progressInfo
            }
          >
            <AppText
              variant="small"
              color={
                Colors.textOnDark
              }
              weight="bold"
            >
              {t(
                "colorVision"
              )}
            </AppText>

            <AppText
              variant="tiny"
              color={
                Colors.textOnDarkMuted
              }
            >
              {currentIndex + 1} {t("of")} {TOTAL_PLATES}
            </AppText>
          </View>

          <View
            style={
              styles.timer
            }
          >
            <Ionicons
              name="time-outline"
              size={16}
              color={
                Colors.secondary
              }
            />

            <AppText
              variant="tiny"
              color={
                Colors.textOnDark
              }
              weight="bold"
              style={
                styles.timerText
              }
            >
              {formattedTime}
            </AppText>
          </View>
        </View>

        <View
          style={
            styles.progressTrack
          }
        >
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: `${progress * 100}%`,
              },
            ]}
          />
        </View>

        <View
          style={
            styles.levelBadge
          }
        >
          <Ionicons
            name="color-palette-outline"
            size={17}
            color={
              Colors.primary
            }
          />

          <AppText
            variant="tiny"
            color={
              Colors.primary
            }
            weight="bold"
            style={
              styles.levelText
            }
          >
            {t(
              "colorPlate"
            )}{" "}
            {currentIndex + 1}
          </AppText>
        </View>

        <AppText
          variant="h3"
          color={
            Colors.textOnDark
          }
          weight="bold"
          style={
            styles.questionTitle
          }
        >
          {t(
            "whatNumberDoYouSee"
          )}
        </AppText>

        <AppText
          variant="small"
          color={
            Colors.textOnDarkMuted
          }
          style={
            styles.questionSubtitle
          }
        >
          {t(
            plateDescriptionKey
          )}
        </AppText>

        <ColorPlateView
          plate={currentPlate}
          animatedStyle={{
            opacity:
              fadeAnimation,

            transform: [
              {
                scale:
                  scaleAnimation,
              },
            ],
          }}
        />

        <AppText
          variant="small"
          color={
            Colors.textOnDarkMuted
          }
          weight="bold"
          style={
            styles.chooseText
          }
        >
          {t(
            "selectYourAnswer"
          )}
        </AppText>

        <View
          style={
            styles.answers
          }
        >
          {currentPlate.options.map(
            (option) => {
              /*
               * "None" is translated
               * only for display.
               * The actual answer value
               * remains "None".
               */
              const displayOption =
                option === "None"
                  ? t("none")
                  : option;

              return (
                <AnswerOption
                  key={option}
                  label={
                    displayOption
                  }
                  selected={
                    selectedAnswer ===
                    option
                  }
                  correct={
                    option ===
                    currentPlate.correctAnswer
                  }
                  showResult={
                    showAnswer
                  }
                  onPress={() =>
                    handleAnswer(
                      option
                    )
                  }
                />
              );
            }
          )}
        </View>

        {showAnswer && (
          <View
            style={[
              styles.feedback,
              {
                backgroundColor:
                  selectedAnswer ===
                  currentPlate.correctAnswer
                    ? Colors.successSoft
                    : Colors.warningSoft,
              },
            ]}
          >
            <Ionicons
              name={
                selectedAnswer ===
                currentPlate.correctAnswer
                  ? "checkmark-circle"
                  : "information-circle"
              }
              size={20}
              color={
                selectedAnswer ===
                currentPlate.correctAnswer
                  ? Colors.success
                  : Colors.warning
              }
            />

            <AppText
              variant="tiny"
              color={
                Colors.textSecondary
              }
              weight="bold"
              style={
                styles.feedbackText
              }
            >
              {selectedAnswer ===
              currentPlate.correctAnswer
                ? t("correct")
                : `${t(
                    "expectedAnswer"
                  )} ${
                    currentPlate.correctAnswer
                  }`}
            </AppText>
          </View>
        )}

        <View
          style={
            styles.testTip
          }
        >
          <Ionicons
            name="bulb-outline"
            size={19}
            color={
              Colors.secondary
            }
          />

          <AppText
            variant="tiny"
            color={
              Colors.textOnDarkMuted
            }
            style={
              styles.tipText
            }
          >
            {t(
              "colorVisionTestTip"
            )}
          </AppText>
        </View>
      </ScrollView>
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        Colors.navy,
    },

    content: {
      paddingHorizontal:
        Sizes.spacing.lg,
      paddingTop:
        Sizes.spacing.huge,
      paddingBottom:
        Sizes.spacing.huge,
    },

    testContent: {
      paddingHorizontal:
        Sizes.spacing.lg,
      paddingTop:
        Sizes.spacing.xxl,
      paddingBottom:
        Sizes.spacing.huge,
    },

    loadingContainer: {
      flex: 1,
      backgroundColor:
        Colors.navy,
      justifyContent:
        "center",
      alignItems:
        "center",
    },

    header: {
      flexDirection:
        "row",
      alignItems:
        "center",
      marginBottom:
        Sizes.spacing.xl,
    },

    backButton: {
      width: 44,
      height: 44,
      borderRadius:
        Sizes.radius.pill,
      backgroundColor:
        Colors.navySoft,
      borderWidth: 1,
      borderColor:
        Colors.borderOnDark,
      justifyContent:
        "center",
      alignItems:
        "center",
      marginRight:
        Sizes.spacing.md,
    },

    headerText: {
      flex: 1,
    },

    eyebrow: {
      letterSpacing: 1,
      marginBottom: 4,
    },

    headerSubtitle: {
      marginTop: 4,
    },

    heroCard: {
      backgroundColor:
        Colors.surface,
      borderRadius:
        Sizes.radius.xl,
      borderWidth: 1,
      borderColor:
        Colors.border,
      padding:
        Sizes.padding.xl,
      alignItems:
        "center",
      marginBottom:
        Sizes.spacing.xl,
    },

    heroIcon: {
      width: 82,
      height: 82,
      borderRadius: 41,
      backgroundColor:
        Colors.primaryGlow,
      justifyContent:
        "center",
      alignItems:
        "center",
      marginBottom:
        Sizes.spacing.md,
    },

    heroTitle: {
      textAlign:
        "center",
    },

    heroDescription: {
      textAlign:
        "center",
      lineHeight: 20,
      marginTop:
        Sizes.spacing.xs,
    },

    sectionTitle: {
      marginBottom:
        Sizes.spacing.md,
    },

    instruction: {
      flexDirection:
        "row",
      alignItems:
        "flex-start",
      backgroundColor:
        Colors.surface,
      borderRadius:
        Sizes.radius.lg,
      borderWidth: 1,
      borderColor:
        Colors.border,
      padding:
        Sizes.padding.md,
      marginBottom:
        Sizes.spacing.sm,
    },

    numberCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor:
        Colors.primary,
      justifyContent:
        "center",
      alignItems:
        "center",
      marginRight:
        Sizes.spacing.sm,
    },

    instructionIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor:
        Colors.primaryGlow,
      justifyContent:
        "center",
      alignItems:
        "center",
      marginRight:
        Sizes.spacing.sm,
    },

    instructionContent: {
      flex: 1,
    },

    instructionDescription: {
      lineHeight: 18,
      marginTop: 3,
    },

    notice: {
      flexDirection:
        "row",
      alignItems:
        "center",
      backgroundColor:
        Colors.warningSoft,
      borderRadius:
        Sizes.radius.lg,
      padding:
        Sizes.padding.md,
      marginTop:
        Sizes.spacing.md,
    },

    noticeText: {
      flex: 1,
      marginLeft:
        Sizes.spacing.sm,
      lineHeight: 18,
    },

    primaryButton: {
      height:
        Sizes.control
          .buttonHeight,
      borderRadius:
        Sizes.radius.lg,
      backgroundColor:
        Colors.primary,
      flexDirection:
        "row",
      justifyContent:
        "center",
      alignItems:
        "center",
      marginTop:
        Sizes.spacing.xl,
    },

    buttonText: {
      marginLeft:
        Sizes.spacing.sm,
    },

    secondaryButton: {
      height:
        Sizes.control
          .buttonHeight,
      borderRadius:
        Sizes.radius.lg,
      backgroundColor:
        Colors.surface,
      borderWidth: 1,
      borderColor:
        Colors.border,
      justifyContent:
        "center",
      alignItems:
        "center",
      marginTop:
        Sizes.spacing.md,
    },

    testHeader: {
      flexDirection:
        "row",
      alignItems:
        "center",
    },

    progressInfo: {
      flex: 1,
    },

    timer: {
      flexDirection:
        "row",
      alignItems:
        "center",
      backgroundColor:
        Colors.navySurface,
      borderWidth: 1,
      borderColor:
        Colors.borderOnDark,
      borderRadius:
        Sizes.radius.pill,
      paddingHorizontal:
        Sizes.spacing.sm,
      paddingVertical: 7,
    },

    timerText: {
      marginLeft: 4,
    },

    progressTrack: {
      height: 7,
      backgroundColor:
        Colors.navySurface,
      borderRadius:
        Sizes.radius.pill,
      overflow:
        "hidden",
      marginTop:
        Sizes.spacing.lg,
    },

    progressFill: {
      height: "100%",
      backgroundColor:
        Colors.secondary,
      borderRadius:
        Sizes.radius.pill,
    },

    levelBadge: {
      alignSelf:
        "center",
      flexDirection:
        "row",
      alignItems:
        "center",
      backgroundColor:
        Colors.primaryGlow,
      borderRadius:
        Sizes.radius.pill,
      paddingHorizontal:
        Sizes.spacing.md,
      paddingVertical: 7,
      marginTop:
        Sizes.spacing.xl,
    },

    levelText: {
      marginLeft: 5,
    },

    questionTitle: {
      textAlign:
        "center",
      marginTop:
        Sizes.spacing.lg,
    },

    questionSubtitle: {
      textAlign:
        "center",
      marginTop: 6,
      lineHeight: 19,
    },

    plate: {
      width:
        PLATE_SIZE,
      height:
        PLATE_SIZE,
      borderRadius:
        PLATE_SIZE / 2,
      backgroundColor:
        "#E7E9EC",
      alignSelf:
        "center",
      marginTop:
        Sizes.spacing.xl,
      overflow:
        "hidden",
      borderWidth: 1,
      borderColor:
        Colors.borderStrong,
      position:
        "relative",
      shadowColor:
        Colors.black,
      shadowOffset: {
        width: 0,
        height: 8,
      },
      shadowOpacity:
        0.18,
      shadowRadius:
        18,
      elevation: 8,
    },

    dot: {
      position:
        "absolute",
    },

    chooseText: {
      textAlign:
        "center",
      marginTop:
        Sizes.spacing.xl,
      marginBottom:
        Sizes.spacing.md,
    },

    answers: {
      flexDirection:
        "row",
      flexWrap:
        "wrap",
      justifyContent:
        "space-between",
    },

    answerOption: {
      width: "48%",
      minHeight: 58,
      borderRadius:
        Sizes.radius.lg,
      borderWidth: 1.5,
      justifyContent:
        "center",
      alignItems:
        "center",
      flexDirection:
        "row",
      marginBottom:
        Sizes.spacing.sm,
      position:
        "relative",
    },

    answerRadio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor:
        Colors.borderStrong,
      marginRight: 8,
      justifyContent:
        "center",
      alignItems:
        "center",
    },

    answerRadioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },

    answerIcon: {
      position:
        "absolute",
      right: 10,
    },

    feedback: {
      flexDirection:
        "row",
      alignItems:
        "center",
      borderRadius:
        Sizes.radius.lg,
      padding:
        Sizes.padding.md,
      marginTop:
        Sizes.spacing.md,
    },

    feedbackText: {
      marginLeft:
        Sizes.spacing.sm,
    },

    testTip: {
      flexDirection:
        "row",
      alignItems:
        "center",
      backgroundColor:
        Colors.navySurface,
      borderRadius:
        Sizes.radius.lg,
      borderWidth: 1,
      borderColor:
        Colors.borderOnDark,
      padding:
        Sizes.padding.md,
      marginTop:
        Sizes.spacing.md,
    },

    tipText: {
      flex: 1,
      marginLeft:
        Sizes.spacing.sm,
      lineHeight: 18,
    },

    resultCard: {
      backgroundColor:
        Colors.surface,
      borderRadius:
        Sizes.radius.xl,
      borderWidth: 1,
      borderColor:
        Colors.border,
      padding:
        Sizes.padding.xl,
      alignItems:
        "center",
    },

    resultIcon: {
      width: 82,
      height: 82,
      borderRadius: 41,
      justifyContent:
        "center",
      alignItems:
        "center",
    },

    resultTitle: {
      textAlign:
        "center",
      marginTop:
        Sizes.spacing.md,
    },

    resultDescription: {
      textAlign:
        "center",
      lineHeight: 20,
      marginTop:
        Sizes.spacing.xs,
    },

    scoreCircle: {
      width: 118,
      height: 118,
      borderRadius: 59,
      borderWidth: 7,
      justifyContent:
        "center",
      alignItems:
        "center",
      marginTop:
        Sizes.spacing.xl,
    },

    statsGrid: {
      flexDirection:
        "row",
      flexWrap:
        "wrap",
      justifyContent:
        "space-between",
      marginTop:
        Sizes.spacing.md,
    },

    resultStat: {
      width: "48%",
      backgroundColor:
        Colors.surface,
      borderRadius:
        Sizes.radius.lg,
      borderWidth: 1,
      borderColor:
        Colors.border,
      padding:
        Sizes.padding.md,
      marginBottom:
        Sizes.spacing.sm,
    },

    resultStatValue: {
      marginTop: 5,
    },

    resultNotice: {
      flexDirection:
        "row",
      backgroundColor:
        Colors.infoSoft,
      borderRadius:
        Sizes.radius.lg,
      padding:
        Sizes.padding.md,
      marginTop:
        Sizes.spacing.md,
    },
  });
