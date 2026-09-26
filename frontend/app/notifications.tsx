import { Alert } from "../services/alert";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  AppNotification,
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../services/notification";
import { useLanguage } from "../services/i18n";

import AppShell from "../design/components/AppShell";
import Card from "../design/components/card";
import IconContainer from "../design/components/IconContainer";
import StatusBadge from "../design/components/StatusBadge";
import Button from "../design/components/Button";
import colors from "../design/tokens/colors";
import spacing from "../design/tokens/spacing";
import typography from "../design/tokens/typography";
import radius from "../design/tokens/radius";

import { useThemeRefresh } from "../providers/AppThemeProvider";
import { getUserRole, type UserRole } from "../services/storage";
const getNotificationIcon = (type: AppNotification["type"]): keyof typeof Ionicons.glyphMap => {
  switch (type) {
    case "appointment":
      return "calendar-outline";
    case "screening":
      return "eye-outline";
    case "follow_up":
      return "repeat-outline";
    case "medication":
      return "medkit-outline";
    case "abnormal_result":
      return "warning-outline";
    case "report":
      return "document-text-outline";
    case "message":
      return "chatbubbles-outline";
    case "verification":
      return "shield-checkmark-outline";
    case "connection":
      return "people-outline";
    case "privacy_access":
      return "shield-checkmark-outline";
    case "consultation":
      return "clipboard-outline";
    case "vision_prescription":
      return "glasses-outline";
    case "equipment":
      return "hardware-chip-outline";
    case "privilege":
      return "key-outline";
    default:
      return "notifications-outline";
  }
};

const getNotificationColor = (type: AppNotification["type"]) => {
  switch (type) {
    case "appointment":
      return colors.teal800;
    case "screening":
      return colors.info;
    case "follow_up":
      return colors.teal700;
    case "medication":
      return colors.warning;
    case "abnormal_result":
      return colors.error;
    case "report":
      return colors.teal900;
    case "message":
      return colors.teal800;
    case "verification":
      return colors.info;
    case "connection":
      return colors.teal800;
    case "privacy_access":
      return colors.teal700;
    case "consultation":
      return colors.teal800;
    case "vision_prescription":
      return colors.warning;
    case "equipment":
      return colors.info;
    case "privilege":
      return colors.teal800;
    default:
      return colors.teal800;
  }
};

export default function NotificationsScreen() {
  useThemeRefresh();
  const router = useRouter();
  const { t, language } = useLanguage();
  const isUrdu = language === "ur";

  const [role, setRole] = useState<UserRole>("Patient");
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifications = async () => {
    try {
      setError("");
      const storedRole = await getUserRole();
      if (storedRole) setRole(storedRole);
      const data = await getNotifications();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Notifications loading error:", err);
      setError(
        err?.message || (isUrdu ? "اطلاعات لوڈ کرنے میں ناکامی ہوئی۔" : "Unable to load notifications.")
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
  };

  const handleNotificationPress = async (notification: AppNotification) => {
    if (!notification.read) {
      try {
        await markNotificationAsRead(notification.id);
        setNotifications((current) =>
          current.map((item) => (item.id === notification.id ? { ...item, read: true } : item))
        );
      } catch (err) {
        console.error("Failed to mark notification as read:", err);
      }
    }

    if (notification.type === "message" && notification.relatedId) {
      router.push(`/messages/${notification.relatedId}` as any);
      return;
    }
    if (notification.type === "verification") {
      if (role === "SuperAdmin" && notification.relatedId) {
        router.push(`/superadmin/verification/${notification.relatedId}` as any);
      } else if (role === "Doctor" || role === "Hospital") {
        router.push("/provider-verification" as any);
      }
      return;
    }
    if (notification.type === "connection") {
      router.push((role === "Doctor" ? "/doctor/connections" : "/connections") as any);
      return;
    }
    if (notification.type === "privacy_access" && role === "Patient") {
      router.push("/privacy" as any);
      return;
    }
    if (notification.type === "consultation" && notification.relatedId) {
      if (role === "Patient") router.push(`/visit-summary/${notification.relatedId}` as any);
      else if (role === "Doctor") router.push(`/doctor/consultation/${notification.relatedId}` as any);
      return;
    }
    if (notification.type === "vision_prescription" && role === "Patient") {
      router.push((notification.relatedId ? `/vision-vault/${notification.relatedId}` : "/vision-vault") as any);
      return;
    }
    if (notification.type === "equipment" && role === "Hospital") {
      router.push((notification.relatedId ? `/hospital/equipment/${notification.relatedId}` : "/hospital/equipment") as any);
      return;
    }
    if (notification.type === "privilege") {
      if (role === "Doctor") router.push("/doctor/privileges" as any);
      else if (role === "Hospital") router.push("/hospital/doctors" as any);
    }
  };

  const handleMarkAll = async () => {
    if (markingAll || !notifications.some((item) => !item.read)) return;
    try {
      setMarkingAll(true);
      await markAllNotificationsAsRead();
      setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    } catch (err: any) {
      Alert.alert(
        isUrdu ? "اپ ڈیٹ نہیں ہو سکی" : "Unable to Update",
        err?.message || (isUrdu ? "اطلاعات کو پڑھا ہوا نشان زد نہیں کیا جا سکا۔" : "Could not mark notifications as read.")
      );
    } finally {
      setMarkingAll(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return isUrdu ? "حال ہی میں" : "Recently";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString(isUrdu ? "ur-PK" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const unreadCount = notifications.filter((item) => !item.read).length;

  if (loading) {
    return (
      <AppShell role={role} title={t("notifications") || "Notifications"} showAssistant={false}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.teal800} />
          <Text style={styles.loadingText}>
            {isUrdu ? "اطلاعات لوڈ ہو رہی ہیں..." : "Loading notifications..."}
          </Text>
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell role={role} title={t("notifications") || "Notifications"} showBack onBackPress={() => router.back()} showAssistant={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.teal800} />}
      >
        <View style={styles.headerGroup}>
          <Text style={styles.eyebrow}>ALERTS & MESSAGES</Text>
          <Text style={styles.title}>{t("notifications") || "Notifications"}</Text>
          <Text style={styles.subtitle}>{t("stayUpdated") || "Stay updated with your screening results and appointment alerts."}</Text>
        </View>

        {/* Summary Card */}
        <Card variant="elevated" style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryMain}>
              <Text style={styles.summaryTitle}>
                {unreadCount > 0 ? `${unreadCount} ${t("unread") || "Unread Notifications"}` : t("allCaughtUp") || "All Caught Up!"}
              </Text>
              <Text style={styles.summarySub}>{t("caughtUpMessage") || "You have reviewed all latest medical alerts."}</Text>
            </View>

            {unreadCount > 0 && (
              <Button
                title={t("markAllRead") || "Mark All Read"}
                variant="ghost"
                size="sm"
                onPress={handleMarkAll}
                loading={markingAll}
              />
            )}
          </View>
        </Card>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={20} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {notifications.length === 0 ? (
          <Card style={styles.emptyCard}>
            <IconContainer name="notifications-outline" size={32} color={colors.textMuted} backgroundColor={colors.teal50} />
            <Text style={styles.emptyTitle}>{t("noNotifications") || "No Notifications"}</Text>
            <Text style={styles.emptySub}>{t("caughtUpMessage") || "You have no new notifications at this time."}</Text>
          </Card>
        ) : (
          <View style={styles.list}>
            {notifications.map((item) => {
              const icon = getNotificationIcon(item.type);
              const iconColor = getNotificationColor(item.type);

              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.8}
                  onPress={() => handleNotificationPress(item)}
                >
                  <Card style={[styles.notificationCard, !item.read && styles.unreadNotificationCard]}>
                    <View style={styles.notificationRow}>
                      <IconContainer name={icon} size={22} color={iconColor} backgroundColor={`${iconColor}18`} />
                      <View style={styles.notificationMain}>
                        <View style={styles.notificationTitleRow}>
                          <Text style={[styles.notificationTitle, !item.read && styles.unreadTitle]}>{item.title}</Text>
                          {!item.read && <View style={styles.unreadDot} />}
                        </View>
                        <Text style={styles.notificationMessage}>{item.message}</Text>
                        <Text style={styles.notificationDate}>{formatDate(item.createdAt)}</Text>
                      </View>
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  loadingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
    fontSize: typography.sizes.body,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl + 40,
  },
  headerGroup: {
    marginBottom: spacing.lg,
  },
  eyebrow: {
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
    color: colors.teal800,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  title: {
    fontSize: typography.sizes.h1,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    marginTop: 4,
  },
  summaryCard: {
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryMain: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  summaryTitle: {
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  summarySub: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.errorBg,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.sizes.small,
  },
  list: {
    gap: spacing.sm,
  },
  notificationCard: {
    backgroundColor: colors.surface,
  },
  unreadNotificationCard: {
    borderColor: colors.teal500,
    backgroundColor: colors.teal50,
  },
  notificationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  notificationMain: {
    flex: 1,
    marginLeft: spacing.md,
  },
  notificationTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  notificationTitle: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    flex: 1,
  },
  unreadTitle: {
    color: colors.teal900,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.teal800,
    marginLeft: spacing.xs,
  },
  notificationMessage: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  notificationDate: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: spacing.xs + 2,
  },
  emptyCard: {
    padding: spacing.xxl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  emptyTitle: {
    fontSize: typography.sizes.h3,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  emptySub: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
  },
});
