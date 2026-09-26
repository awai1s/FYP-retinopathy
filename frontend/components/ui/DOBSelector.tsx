import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Colors from "../../constants/Colors";
import Fonts from "../../constants/Fonts";
import Sizes from "../../constants/Sizes";

interface Props {
  day: number;
  month: number;
  year: number;
  setDay: (value: number) => void;
  setMonth: (value: number) => void;
  setYear: (value: number) => void;
}

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const weekdays = ["S", "M", "T", "W", "T", "F", "S"];
const firstYear = 1940;

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function isFutureDate(day: number, month: number, year: number) {
  return new Date(year, month - 1, day) > new Date();
}

export default function DOBSelector({
  day,
  month,
  year,
  setDay,
  setMonth,
  setYear,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [viewMonth, setViewMonth] = useState(month);
  const [viewYear, setViewYear] = useState(year);
  const [showYears, setShowYears] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = useMemo(
    () => Array.from({ length: currentYear - firstYear + 1 }, (_, index) => currentYear - index),
    [currentYear],
  );

  const calendarCells = useMemo(() => {
    const leadingEmptyCells = new Date(viewYear, viewMonth - 1, 1).getDay();
    const totalDays = daysInMonth(viewYear, viewMonth);
    return [
      ...Array.from({ length: leadingEmptyCells }, () => null),
      ...Array.from({ length: totalDays }, (_, index) => index + 1),
    ];
  }, [viewMonth, viewYear]);

  const openPicker = () => {
    setViewMonth(month);
    setViewYear(year);
    setShowYears(false);
    setVisible(true);
  };

  const closePicker = () => {
    setShowYears(false);
    setVisible(false);
  };

  const chooseDay = (selectedDay: number) => {
    if (isFutureDate(selectedDay, viewMonth, viewYear)) return;
    setDay(selectedDay);
    setMonth(viewMonth);
    setYear(viewYear);
    closePicker();
  };

  const changeMonth = (direction: -1 | 1) => {
    const nextMonth = viewMonth + direction;
    if (nextMonth < 1) {
      setViewMonth(12);
      setViewYear((value) => Math.max(firstYear, value - 1));
      return;
    }
    if (nextMonth > 12) {
      setViewMonth(1);
      setViewYear((value) => Math.min(currentYear, value + 1));
      return;
    }
    setViewMonth(nextMonth);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Date of Birth</Text>

      <Pressable
        style={({ pressed }) => [styles.summary, pressed && styles.pressed]}
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel="Choose date of birth"
      >
        <View style={styles.calendarIconShell}>
          <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
        </View>
        <View style={styles.summaryText}>
          <Text style={styles.summaryCaption}>Selected date</Text>
          <Text style={styles.summaryValue}>
            {day} {months[month - 1]} {year}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={21} color={Colors.textSecondary} />
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={closePicker}
      >
        <Pressable style={styles.modalBackdrop} onPress={closePicker}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalTopLine} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>DATE OF BIRTH</Text>
                <Text style={styles.modalTitle}>Choose your birthday</Text>
              </View>
              <Pressable onPress={closePicker} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close date picker">
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.selectedPreview}>
              <Ionicons name="calendar" size={22} color={Colors.white} />
              <Text style={styles.selectedPreviewText}>{day} {months[month - 1]} {year}</Text>
            </View>

            {showYears ? (
              <ScrollView style={styles.yearScroller} contentContainerStyle={styles.yearGrid} showsVerticalScrollIndicator={false}>
                {years.map((itemYear) => (
                  <Pressable
                    key={itemYear}
                    onPress={() => {
                      setViewYear(itemYear);
                      setShowYears(false);
                    }}
                    style={[styles.yearChip, itemYear === viewYear && styles.yearChipSelected]}
                  >
                    <Text style={[styles.yearText, itemYear === viewYear && styles.yearTextSelected]}>{itemYear}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <>
                <View style={styles.calendarToolbar}>
                  <Pressable style={styles.navButton} onPress={() => changeMonth(-1)} accessibilityRole="button" accessibilityLabel="Previous month">
                    <Ionicons name="chevron-back" size={19} color={Colors.textPrimary} />
                  </Pressable>
                  <Pressable onPress={() => setShowYears(true)} style={styles.monthTitleButton} accessibilityRole="button" accessibilityLabel="Choose year">
                    <Text style={styles.monthTitle}>{months[viewMonth - 1]}</Text>
                    <Text style={styles.yearTitle}>{viewYear} <Ionicons name="chevron-down" size={14} color={Colors.primary} /></Text>
                  </Pressable>
                  <Pressable style={styles.navButton} onPress={() => changeMonth(1)} accessibilityRole="button" accessibilityLabel="Next month">
                    <Ionicons name="chevron-forward" size={19} color={Colors.textPrimary} />
                  </Pressable>
                </View>

                <View style={styles.weekdayRow}>
                  {weekdays.map((weekday, index) => <Text key={`${weekday}-${index}`} style={styles.weekday}>{weekday}</Text>)}
                </View>

                <View style={styles.daysGrid}>
                  {calendarCells.map((cell, index) => {
                    const selected = cell === day && viewMonth === month && viewYear === year;
                    const disabled = typeof cell === "number" && isFutureDate(cell, viewMonth, viewYear);
                    return (
                      <Pressable
                        key={`${viewYear}-${viewMonth}-${index}`}
                        disabled={cell === null || disabled}
                        onPress={() => typeof cell === "number" && chooseDay(cell)}
                        style={[styles.dayCell, selected && styles.dayCellSelected, disabled && styles.dayCellDisabled]}
                      >
                        <Text style={[styles.dayText, selected && styles.dayTextSelected, disabled && styles.dayTextDisabled]}>{cell ?? ""}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            <Pressable style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]} onPress={closePicker} accessibilityRole="button">
              <Text style={styles.doneText}>Done</Text>
              <Ionicons name="checkmark" size={18} color={Colors.white} />
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 18 },
  label: { color: Colors.textPrimary, fontFamily: Fonts.headingFamily, fontSize: Fonts.small, fontWeight: Fonts.weight.semibold, marginBottom: 8 },
  summary: { minHeight: 68, borderRadius: Sizes.radius.lg, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: Colors.inputBackground, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  calendarIconShell: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: Colors.primaryGlow, borderWidth: 1, borderColor: Colors.borderStrong },
  summaryText: { flex: 1, marginLeft: 12 },
  summaryCaption: { color: Colors.textSecondary, fontSize: 11, fontWeight: "600", marginBottom: 3 },
  summaryValue: { color: Colors.textPrimary, fontSize: Fonts.body, fontWeight: "700" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.62)", alignItems: "center", justifyContent: "center", padding: 20 },
  modalCard: { width: "100%", maxWidth: 390, maxHeight: "88%", backgroundColor: Colors.surface, borderRadius: 28, padding: 20, borderWidth: 1, borderColor: Colors.border, shadowColor: Colors.black, shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.32, shadowRadius: 28, elevation: 16 },
  modalTopLine: { alignSelf: "center", width: 48, height: 4, borderRadius: 4, backgroundColor: Colors.primary, opacity: 0.9, marginBottom: 16 },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 },
  modalEyebrow: { color: Colors.primary, fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginBottom: 4 },
  modalTitle: { color: Colors.textPrimary, fontSize: 21, fontWeight: "800" },
  selectedPreview: { minHeight: 52, borderRadius: 16, backgroundColor: Colors.primary, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", marginBottom: 17, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 5 },
  selectedPreviewText: { color: Colors.white, fontSize: 16, fontWeight: "800", marginLeft: 10 },
  calendarToolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 15 },
  navButton: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: Colors.inputBackground, borderWidth: 1, borderColor: Colors.border },
  monthTitleButton: { alignItems: "center", paddingHorizontal: 12, paddingVertical: 3 },
  monthTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: "800" },
  yearTitle: { color: Colors.primary, fontSize: 13, fontWeight: "700", marginTop: 2 },
  weekdayRow: { flexDirection: "row", marginBottom: 5 },
  weekday: { width: "14.2857%", textAlign: "center", color: Colors.textSecondary, fontSize: 11, fontWeight: "800" },
  daysGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 15 },
  dayCell: { width: "14.2857%", aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 14, marginVertical: 2 },
  dayCellSelected: { backgroundColor: Colors.primary, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.24, shadowRadius: 8, elevation: 4 },
  dayCellDisabled: { opacity: 0.35 },
  dayText: { color: Colors.textPrimary, fontSize: 14, fontWeight: "700" },
  dayTextSelected: { color: Colors.white, fontWeight: "800" },
  dayTextDisabled: { color: Colors.textLight },
  yearScroller: { maxHeight: 300, marginBottom: 15 },
  yearGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9, paddingVertical: 2 },
  yearChip: { width: "30%", minHeight: 43, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: Colors.inputBackground, borderWidth: 1, borderColor: Colors.border },
  yearChipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  yearText: { color: Colors.textPrimary, fontSize: 13, fontWeight: "700" },
  yearTextSelected: { color: Colors.white },
  doneButton: { minHeight: 48, borderRadius: 15, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.24, shadowRadius: 10, elevation: 5 },
  doneText: { color: Colors.white, fontSize: 15, fontWeight: "800" },
});