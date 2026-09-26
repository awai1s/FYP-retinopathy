import React from "react";
import {
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useNavigation } from "expo-router";
import { DrawerActions } from "@react-navigation/native";

import AppText from "../ui/AppText";
import Colors from "../../constants/Colors";
import Sizes from "../../constants/Sizes";

interface Props {
  onNotificationPress?: () => void;
}

export default function DashboardHeader({
  onNotificationPress,
}: Props) {
  const navigation = useNavigation();

  const toggleDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const handleNotificationPress = () => {
    if (onNotificationPress) {
      onNotificationPress();
      return;
    }

    // Change "./notifications" to absolute route "/notifications" (or "/tabs/notifications")
    router.push("/notifications");
  };

  return (
    <View style={styles.container}>
      {/* ---------------- LEFT DRAWER BUTTON & TEXT ---------------- */}
      <View style={styles.leftSection}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={toggleDrawer}
          accessibilityRole="button"
          accessibilityLabel="Open menu drawer"
          style={styles.menuButton}
        >
          <Ionicons
            name="menu-outline"
            size={24}
            color={Colors.textOnDark}
          />
        </TouchableOpacity>

        <View style={styles.textContainer}>
          <AppText
            variant="tiny"
            color={Colors.secondary}
            weight="bold"
            style={styles.eyebrow}
          >
            EYECare AI
          </AppText>

          <AppText
            variant="h2"
            color={Colors.textOnDark}
            weight="extraBold"
          >
            Dashboard
          </AppText>

          <AppText
            variant="small"
            color={Colors.textOnDarkMuted}
            style={styles.subtitle}
          >
            Stay on top of your diabetic eye health.
          </AppText>
        </View>
      </View>

      {/* ---------------- RIGHT NOTIFICATION BUTTON ---------------- */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleNotificationPress}
        accessibilityRole="button"
        accessibilityLabel="Open notifications"
        style={styles.notification}
      >
        <Ionicons
          name="notifications-outline"
          size={22}
          color={Colors.white}
        />

        <View style={styles.notificationDot} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  /* ---------------- CONTAINER ---------------- */

  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Sizes.spacing.xl,
  },

  /* ---------------- LEFT SECTION ---------------- */

  leftSection: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Sizes.spacing.sm,
    paddingRight: Sizes.spacing.sm,
  },

  menuButton: {
    width: 46,
    height: 46,
    borderRadius: Sizes.radius.lg,
    backgroundColor: Colors.navySoft,
    borderWidth: 1,
    borderColor: Colors.borderOnDark,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },

  /* ---------------- TEXT ---------------- */

  textContainer: {
    flex: 1,
  },

  eyebrow: {
    marginBottom: 4,
    letterSpacing: 1,
  },

  subtitle: {
    marginTop: 6,
    lineHeight: 19,
  },

  /* ---------------- NOTIFICATION BUTTON ---------------- */

  notification: {
    width: 46,
    height: 46,
    borderRadius: Sizes.radius.pill,
    backgroundColor: Colors.navySoft,
    borderWidth: 1,
    borderColor: Colors.borderOnDark,
    justifyContent: "center",
    alignItems: "center",

    shadowColor: Colors.black,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },

  notificationDot: {
    position: "absolute",
    top: 9,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.secondary,
    borderWidth: 1,
    borderColor: Colors.navySoft,
  },
});