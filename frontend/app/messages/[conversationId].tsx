
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import AppShell from "../../design/components/AppShell";
import Button from "../../design/components/Button";
import colors from "../../design/tokens/colors";
import spacing from "../../design/tokens/spacing";
import typography from "../../design/tokens/typography";

import { getUserRole } from "../../services/storage";
import { downloadClinicalSummary } from "../../services/clinical";
import {
  getMessages,
  getShareableReferences,
  markConversationRead,
  sendMessage,
  sendReportReference,
  type ChatMessage,
  type ConversationPerson,
  type MessageReference,
} from "../../services/messages";

import { useThemeRefresh } from "../../providers/AppThemeProvider";
export default function ConversationScreen() {
  useThemeRefresh();
  const router = useRouter();

  const { conversationId } = useLocalSearchParams<{
    conversationId?: string;
  }>();

  const [role, setRole] = useState<"Patient" | "Doctor">("Patient");
  const [person, setPerson] = useState<ConversationPerson | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const [pickerOpen, setPickerOpen] = useState(false);
  const [references, setReferences] = useState<MessageReference[]>([]);
  const [referencesLoading, setReferencesLoading] = useState(false);
  const [sendingReference, setSendingReference] = useState("");

  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(
    async (quiet = false) => {
      if (!conversationId) {
        setError("Conversation not found.");
        setLoading(false);
        return;
      }

      try {
        if (!quiet) {
          setError("");
        }

        const result = await getMessages(conversationId);

        setPerson(result.person);
        setMessages(result.messages || []);

        await markConversationRead(conversationId);
      } catch (err: any) {
        setError(
          err?.message || "Unable to load this conversation."
        );
      } finally {
        if (!quiet) {
          setLoading(false);
        }
      }
    },
    [conversationId]
  );

  useEffect(() => {
    let active = true;

    const loadIdentity = async () => {
      try {
        const storedRole = await getUserRole();

        if (!active) {
          return;
        }

        if (
          storedRole !== "Patient" &&
          storedRole !== "Doctor"
        ) {
          router.replace(
            storedRole === "Hospital"
              ? "/hospital/dashboard"
              : "/auth/login"
          );
          return;
        }

        setRole(storedRole);
        await load();
      } catch (err: any) {
        if (active) {
          setError(
            err?.message || "Unable to load your account."
          );
          setLoading(false);
        }
      }
    };

    loadIdentity();

    const timer = setInterval(() => {
      if (active) {
        load(true);
      }
    }, 8000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [load, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({
        animated: true,
      });
    }, 80);

    return () => clearTimeout(timer);
  }, [messages.length]);

  const submit = async () => {
    const text = draft.trim();

    if (!text || sending || !conversationId) {
      return;
    }

    try {
      setSending(true);
      setError("");

      const created = await sendMessage(
        conversationId,
        text
      );

      setMessages((current) => [
        ...current,
        created,
      ]);

      setDraft("");

      await markConversationRead(conversationId);
    } catch (err: any) {
      setError(
        err?.message || "Message could not be sent."
      );
    } finally {
      setSending(false);
    }
  };

  const openReferencePicker = async () => {
    if (!conversationId || referencesLoading) {
      return;
    }

    setPickerOpen(true);
    setReferencesLoading(true);
    setError("");

    try {
      const result =
        await getShareableReferences(conversationId);

      setReferences(result.references || []);
    } catch (err: any) {
      setError(
        err?.message || "Unable to load AI summaries."
      );
    } finally {
      setReferencesLoading(false);
    }
  };

  const chooseReference = async (
    reference: MessageReference
  ) => {
    if (!conversationId || sendingReference) {
      return;
    }

    try {
      setSendingReference(reference.id);
      setError("");

      const created = await sendReportReference(
        conversationId,
        reference
      );

      setMessages((current) => [
        ...current,
        created,
      ]);

      setPickerOpen(false);

      await markConversationRead(conversationId);
    } catch (err: any) {
      setError(
        err?.message ||
          "The PDF summary could not be sent."
      );
    } finally {
      setSendingReference("");
    }
  };

  const openAttachment = async (
    item: ChatMessage
  ) => {
    if (
      !item.attachmentId ||
      item.attachmentType !== "prediction"
    ) {
      return;
    }

    try {
      setError("");
      await downloadClinicalSummary(
        item.attachmentId
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "The PDF summary could not be opened."
      );
    }
  };

  const formatTime = (value: string) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <AppShell
        role={role}
        title="Messages"
        showBack
        onBackPress={() => router.back()}
      >
        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color={colors.teal800}
          />

          <Text style={styles.statusText}>
            Loading conversation...
          </Text>
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell
      role={role}
      title={person?.name || "Messages"}
      subtitle={
        person?.specialization ||
        person?.role ||
        "Secure conversation"
      }
      showBack
      onBackPress={() => router.back()}
      scrollable={false}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        {error ? (
          <View style={styles.errorBar}>
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={colors.error}
            />

            <Text style={styles.errorText}>
              {error}
            </Text>
          </View>
        ) : null}

        <ScrollView
          ref={scrollRef}
          style={styles.history}
          contentContainerStyle={
            styles.historyContent
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!messages.length ? (
            <View style={styles.empty}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={30}
                color={colors.teal800}
              />

              <Text style={styles.emptyTitle}>
                Start a secure conversation
              </Text>

              <Text style={styles.emptyText}>
                Messages are available while this
                connection remains accepted.
              </Text>
            </View>
          ) : null}

          {messages.map((item) => {
            const mine =
              item.senderId !== person?.id;

            const isAttachment =
              item.messageType ===
                "report_reference" &&
              Boolean(item.attachmentId);

            return (
              <View
                key={item.id}
                style={[
                  styles.messageRow,
                  mine
                    ? styles.mineRow
                    : styles.theirRow,
                ]}
              >
                <View
                  style={[
                    styles.bubble,
                    mine
                      ? styles.mineBubble
                      : styles.theirBubble,
                  ]}
                >
                  {isAttachment ? (
                    <TouchableOpacity
                      onPress={() =>
                        openAttachment(item)
                      }
                      activeOpacity={0.8}
                      style={styles.attachment}
                      accessibilityRole="button"
                      accessibilityLabel="Open AI clinical summary PDF"
                    >
                      <Ionicons
                        name="document-text-outline"
                        size={23}
                        color={
                          mine
                            ? colors.white
                            : colors.teal800
                        }
                      />

                      <View
                        style={
                          styles.attachmentText
                        }
                      >
                        <Text
                          style={[
                            styles.attachmentTitle,
                            mine &&
                              styles.mineText,
                          ]}
                        >
                          AI Clinical Summary PDF
                        </Text>

                        <Text
                          style={[
                            styles.attachmentHint,
                            mine &&
                              styles.mineTime,
                          ]}
                        >
                          Tap to open securely
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <Text
                      style={[
                        styles.messageText,
                        mine &&
                          styles.mineText,
                      ]}
                    >
                      {item.message}
                    </Text>
                  )}

                  <Text
                    style={[
                      styles.time,
                      mine &&
                        styles.mineTime,
                    ]}
                  >
                    {formatTime(
                      item.createdAt
                    )}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.composer}>
          <TouchableOpacity
            onPress={openReferencePicker}
            activeOpacity={0.8}
            style={styles.pdfButton}
            accessibilityRole="button"
            accessibilityLabel="Send AI clinical summary PDF"
          >
            <Ionicons
              name="document-attach-outline"
              size={21}
              color={colors.teal800}
            />
          </TouchableOpacity>

          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Write a message..."
            placeholderTextColor={
              colors.textMuted
            }
            multiline
            maxLength={4000}
            editable={!sending}
            style={styles.input}
            accessibilityLabel="Message text"
          />

          <Button
            title="Send"
            icon="send"
            size="sm"
            onPress={submit}
            loading={sending}
            disabled={
              !draft.trim() || sending
            }
          />
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={pickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setPickerOpen(false)
        }
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalTitle}>
                  Send AI Summary PDF
                </Text>

                <Text style={styles.modalSub}>
                  Choose an existing
                  patient-linked screening
                  summary.
                </Text>
              </View>

              <TouchableOpacity
                onPress={() =>
                  setPickerOpen(false)
                }
                accessibilityRole="button"
                accessibilityLabel="Close PDF picker"
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>

            {referencesLoading ? (
              <View style={styles.modalCenter}>
                <ActivityIndicator
                  color={colors.teal800}
                />

                <Text
                  style={styles.modalSub}
                >
                  Loading summaries...
                </Text>
              </View>
            ) : !references.length ? (
              <View style={styles.modalCenter}>
                <Ionicons
                  name="document-outline"
                  size={28}
                  color={colors.textMuted}
                />

                <Text
                  style={styles.emptyTitle}
                >
                  No AI summaries available
                </Text>

                <Text
                  style={styles.modalSub}
                >
                  Complete a screening first,
                  then share its PDF here.
                </Text>
              </View>
            ) : (
              <ScrollView
                contentContainerStyle={
                  styles.referenceList
                }
                showsVerticalScrollIndicator={
                  false
                }
              >
                {references.map(
                  (reference) => (
                    <TouchableOpacity
                      key={reference.id}
                      onPress={() =>
                        chooseReference(
                          reference
                        )
                      }
                      disabled={Boolean(
                        sendingReference
                      )}
                      activeOpacity={0.8}
                      style={
                        styles.referenceRow
                      }
                    >
                      <Ionicons
                        name="document-text-outline"
                        size={22}
                        color={
                          colors.teal800
                        }
                      />

                      <View
                        style={
                          styles.referenceText
                        }
                      >
                        <Text
                          style={
                            styles.referenceTitle
                          }
                        >
                          {reference.title}
                        </Text>

                        <Text
                          style={
                            styles.referenceDescription
                          }
                        >
                          {
                            reference.description
                          }
                        </Text>
                      </View>

                      {sendingReference ===
                      reference.id ? (
                        <ActivityIndicator
                          color={
                            colors.teal800
                          }
                        />
                      ) : (
                        <Ionicons
                          name="send-outline"
                          size={19}
                          color={
                            colors.teal800
                          }
                        />
                      )}
                    </TouchableOpacity>
                  )
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
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

  errorBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.errorBg,
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },

  errorText: {
    flex: 1,
    color: colors.error,
    fontSize: typography.sizes.small,
  },

  history: {
    flex: 1,
  },

  historyContent: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },

  empty: {
    alignItems: "center",
    padding: spacing.xxl,
  },

  emptyTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.bold,
    marginTop: spacing.md,
    textAlign: "center",
  },

  emptyText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.small,
    textAlign: "center",
    marginTop: spacing.xs,
    lineHeight: 18,
  },

  messageRow: {
    width: "100%",
    flexDirection: "row",
  },

  mineRow: {
    justifyContent: "flex-end",
  },

  theirRow: {
    justifyContent: "flex-start",
  },

  bubble: {
    maxWidth: "82%",
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },

  mineBubble: {
    backgroundColor: colors.teal800,
    borderBottomRightRadius: 4,
  },

  theirBubble: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderBottomLeftRadius: 4,
  },

  messageText: {
    color: colors.textPrimary,
    fontSize: typography.sizes.body,
    lineHeight: 20,
  },

  mineText: {
    color: colors.white,
  },

  time: {
    color: colors.textMuted,
    fontSize: typography.sizes.tiny,
    marginTop: 4,
    alignSelf: "flex-end",
  },

  mineTime: {
    color: "rgba(255,255,255,0.75)",
  },

  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },

  input: {
    flex: 1,
    maxHeight: 100,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.body,
  },

  pdfButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.teal50,
    alignItems: "center",
    justifyContent: "center",
  },

  attachment: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },

  attachmentText: {
    flexShrink: 1,
  },

  attachmentTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.bold,
  },

  attachmentHint: {
    color: colors.textMuted,
    fontSize: typography.sizes.tiny,
    marginTop: 2,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },

  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    maxHeight: "76%",
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },

  modalHeaderText: {
    flex: 1,
    paddingRight: spacing.md,
  },

  modalTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.h3,
    fontWeight: typography.weights.bold,
  },

  modalSub: {
    color: colors.textSecondary,
    fontSize: typography.sizes.small,
    marginTop: 4,
    lineHeight: 18,
  },

  modalCenter: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
  },

  referenceList: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },

  referenceRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 14,
    backgroundColor: colors.teal50,
    gap: spacing.sm,
  },

  referenceText: {
    flex: 1,
  },

  referenceTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
  },

  referenceDescription: {
    color: colors.textSecondary,
    fontSize: typography.sizes.small,
    marginTop: 2,
  },
});
