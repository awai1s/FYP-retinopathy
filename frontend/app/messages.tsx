
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import AppShell from "../design/components/AppShell";
import Card from "../design/components/card";
import IconContainer from "../design/components/IconContainer";
import colors from "../design/tokens/colors";
import spacing from "../design/tokens/spacing";
import typography from "../design/tokens/typography";
import { getUserRole } from "../services/storage";
import {
  getConversations,
  type Conversation,
} from "../services/messages";
import { useLanguage } from "../services/i18n";

import { useThemeRefresh } from "../providers/AppThemeProvider";
type UserRole = "Patient" | "Doctor";

export default function MessagesScreen() {
  useThemeRefresh();
  const router = useRouter();
  const { t } = useLanguage();

  const [role, setRole] = useState<UserRole>("Patient");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");

      const currentRole = await getUserRole();

      if (currentRole !== "Patient" && currentRole !== "Doctor") {
        if (currentRole === "Hospital") {
          router.replace("/hospital/dashboard");
        } else {
          router.replace("/auth/login");
        }

        return;
      }

      setRole(currentRole);

      const result = await getConversations();

      setConversations(result?.conversations ?? []);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : t("unableToLoadMessages");

      setError(message || t("unableToLoadMessages"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const formatDate = (value?: string | null): string => {
    if (!value) {
      return t("noMessagesYet");
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <AppShell
        role={role}
        title={t("messages")}
      >
        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color={colors.teal800}
          />

          <Text style={styles.statusText}>
            {t("loadingMessages")}
          </Text>
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell
      role={role}
      title={t("messages")}
      subtitle={t("messagesDescription")}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.teal800}
          />
        }
      >
        <View style={styles.headerGroup}>
          <Text style={styles.eyebrow}>
            {t("secureCareChat")}
          </Text>

          <Text style={styles.title}>
            {t("messages")}
          </Text>

          <Text style={styles.subtitle}>
            {t("acceptedConnectionsOnly")}
          </Text>
        </View>

        {error ? (
          <Card style={styles.errorCard}>
            <Text style={styles.errorText}>
              {error}
            </Text>
          </Card>
        ) : null}

        {conversations.length === 0 ? (
          <Card style={styles.emptyCard}>
            <IconContainer
              name="chatbubbles-outline"
              size={34}
              color={colors.teal800}
              backgroundColor={colors.teal50}
            />

            <Text style={styles.emptyTitle}>
              {t("noConversationsYet")}
            </Text>

            <Text style={styles.emptyText}>
              {t("acceptConnectionToStartConversation")}
            </Text>
          </Card>
        ) : (
          <View style={styles.list}>
            {conversations.map((item) => {
              const isDoctor =
                item.person.role === "Doctor";

              return (
                <Card
                  key={item.conversationId}
                  onPress={() =>
                    router.push(
                      `/messages/${item.conversationId}` as any
                    )
                  }
                  accessibilityLabel={`${t("openConversationWith")} ${item.person.name}`}
                  style={styles.conversationCard}
                >
                  <View style={styles.row}>
                    <IconContainer
                      name={
                        isDoctor
                          ? "medical-outline"
                          : "person-outline"
                      }
                      size={24}
                      color={colors.teal800}
                      backgroundColor={colors.teal100}
                    />

                    <View style={styles.main}>
                      <View style={styles.titleRow}>
                        <Text
                          style={styles.personName}
                          numberOfLines={1}
                        >
                          {item.person.name}
                        </Text>

                        {item.unreadCount > 0 ? (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>
                              {item.unreadCount}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      <Text style={styles.personRole}>
                        {item.person.specialization ||
                          item.person.role}
                      </Text>

                      <Text
                        style={styles.lastMessage}
                        numberOfLines={1}
                      >
                        {item.lastMessage ||
                          t("startSecureConversation")}
                      </Text>

                      <Text style={styles.date}>
                        {formatDate(item.lastMessageAt)}
                      </Text>
                    </View>

                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.textMuted}
                    />
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xxxl + 40,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },

  statusText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
    fontSize: typography.sizes.body,
  },

  headerGroup: {
    marginBottom: spacing.lg,
  },

  eyebrow: {
    color: colors.teal800,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
    letterSpacing: 1.2,
    marginBottom: 2,
  },

  title: {
    color: colors.textPrimary,
    fontSize: typography.sizes.h1,
    fontWeight: typography.weights.bold,
  },

  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.sizes.body,
    marginTop: 4,
  },

  errorCard: {
    backgroundColor: colors.errorBg,
    marginBottom: spacing.md,
  },

  errorText: {
    color: colors.error,
    fontSize: typography.sizes.small,
  },

  emptyCard: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
    backgroundColor: colors.surface,
  },

  emptyTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.h3,
    fontWeight: typography.weights.bold,
    marginTop: spacing.md,
  },

  emptyText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.body,
    textAlign: "center",
    marginTop: spacing.xs,
    lineHeight: 20,
  },

  list: {
    gap: spacing.sm,
  },

  conversationCard: {
    backgroundColor: colors.surface,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
  },

  main: {
    flex: 1,
    minWidth: 0,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  personName: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
  },

  personRole: {
    color: colors.teal800,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },

  lastMessage: {
    color: colors.textSecondary,
    fontSize: typography.sizes.small,
    marginTop: spacing.xs,
  },

  date: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    marginTop: spacing.xs,
  },

  badge: {
    minWidth: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.xs,
    paddingHorizontal: 5,
  },

  badgeText: {
    color: colors.white,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
});
