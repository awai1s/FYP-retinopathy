import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import * as Speech from "expo-speech";

import colors from "../design/tokens/colors";
import spacing from "../design/tokens/spacing";
import typography from "../design/tokens/typography";
import radius from "../design/tokens/radius";
import type { UserRole } from "../services/storage";
import { useLanguage } from "../services/i18n";
import { useAppTheme } from "../providers/AppThemeProvider";
import {
  createAssistantSession,
  getAssistantHealth,
  getAssistantMessages,
  getAuthorizedAssistantPatients,
  type AssistantHealth,
  type AssistantLanguage,
  type AssistantMessage,
  type AssistantSession,
  type AuthorizedAssistantPatient,
  sendAssistantMessage,
  transcribeAssistantAudio,
} from "../services/aiAssistant";

interface AIAssistantWidgetProps {
  role: UserRole;
}

const COPY = {
  en: {
    title: "EyeCare Health Assistant",
    basicMode: "General RAG",
    authorizedContext: "Authorized patient context",
    notice:
      "Answers are retrieved from EyeCare AI's trusted eye-health knowledge and, when authorized, your saved health context. English and Urdu only.",
    patientContext: "Patient context",
    optional: "Optional",
    preparing: "Preparing your assistant...",
    placeholder: "Ask about diabetic eye health...",
    empty: "Ask about diabetic retinopathy, screening, HbA1c, medicines, or your saved EyeCare AI record.",
    listen: "Listen",
    stop: "Stop",
    source: "Sources",
    voiceReady: "Tap the microphone and speak in English.",
    listening: "Listening... tap again to finish",
    transcribing: "Converting voice to text...",
    voiceUnsupported:
      "Voice recognition is not supported by this browser. Try Chrome/Edge or use the mobile app.",
    micDenied: "Microphone permission is required for voice questions.",
    sendError: "The assistant could not reply. Please try again.",
    loadError: "Unable to load the health assistant.",
    patientsError: "Unable to load authorized patients.",
    contextError: "Unable to change patient context.",
    speechError: "A matching speech voice is not available on this device.",
    english: "English",
    urdu: "اردو",
  },
  ur: {
    title: "آئی کیئر ہیلتھ اسسٹنٹ",
    basicMode: "عمومی RAG",
    authorizedContext: "مجاز مریض کا ریکارڈ",
    notice:
      "جوابات EyeCare AI کے معتبر آنکھوں کی صحت کے مواد اور، اجازت ہونے پر، محفوظ مریض ریکارڈ سے حاصل کیے جاتے ہیں۔ صرف اردو اور انگریزی۔",
    patientContext: "مریض کا ریکارڈ",
    optional: "اختیاری",
    preparing: "اسسٹنٹ تیار ہو رہا ہے...",
    placeholder: "ذیابیطس اور آنکھوں کی صحت کے بارے میں پوچھیں...",
    empty: "ذیابیطس ریٹینوپیتھی، اسکریننگ، HbA1c، ادویات یا اپنے محفوظ ریکارڈ کے بارے میں سوال کریں۔",
    listen: "سنیں",
    stop: "روکیں",
    source: "ذرائع",
    voiceReady: "مائیک دبائیں اور اردو میں بولیں۔",
    listening: "سن رہا ہے... ختم کرنے کے لیے دوبارہ دبائیں",
    transcribing: "آواز کو متن میں بدلا جا رہا ہے...",
    voiceUnsupported:
      "یہ براؤزر voice recognition کو سپورٹ نہیں کرتا۔ Chrome/Edge یا موبائل ایپ استعمال کریں۔",
    micDenied: "آواز سے سوال کرنے کے لیے مائیکروفون کی اجازت ضروری ہے۔",
    sendError: "اسسٹنٹ جواب نہیں دے سکا۔ دوبارہ کوشش کریں۔",
    loadError: "ہیلتھ اسسٹنٹ لوڈ نہیں ہو سکا۔",
    patientsError: "مجاز مریضوں کی فہرست لوڈ نہیں ہو سکی۔",
    contextError: "مریض کا ریکارڈ تبدیل نہیں ہو سکا۔",
    speechError: "اس ڈیوائس پر مناسب اردو آواز دستیاب نہیں ہے۔",
    english: "English",
    urdu: "اردو",
  },
} as const;

function welcomeMessage(language: AssistantLanguage, sessionId = ""): AssistantMessage {
  return {
    id: `assistant-welcome-${language}`,
    sessionId,
    role: "assistant",
    language,
    mode: "rag_extract",
    content:
      language === "ur"
        ? "السلام علیکم! میں EyeCare AI ہیلتھ اسسٹنٹ ہوں۔ آپ ذیابیطس ریٹینوپیتھی، آنکھوں کی اسکریننگ، HbA1c، ادویات یا اپنے مجاز ریکارڈ کے بارے میں سوال کر سکتے ہیں۔"
        : "Hi! I am the EyeCare AI Health Assistant. Ask me about diabetic retinopathy, retinal screening, HbA1c, medication adherence, or your authorized EyeCare AI record.",
    createdAt: new Date(0).toISOString(),
    sources: [],
  };
}

const isUrduMessage = (message: AssistantMessage) =>
  message.language === "ur" || /[\u0600-\u06FF]/.test(message.content || "");

export default function AIAssistantWidget({ role }: AIAssistantWidgetProps) {
  const { language: appLanguage } = useLanguage();
  const { reduceMotion } = useAppTheme();
  const [answerLanguage, setAnswerLanguage] = useState<AssistantLanguage>(
    appLanguage === "ur" ? "ur" : "en"
  );
  const copy = COPY[answerLanguage];
  const isRTL = answerLanguage === "ur";

  const [visible, setVisible] = useState(false);
  const [session, setSession] = useState<AssistantSession | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [authorizedPatients, setAuthorizedPatients] = useState<AuthorizedAssistantPatient[]>([]);
  const [assistantHealth, setAssistantHealth] = useState<AssistantHealth | null>(null);
  const [voiceState, setVoiceState] = useState<"idle" | "listening" | "transcribing">("idle");
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  const slide = useRef(new Animated.Value(420)).current;
  const listRef = useRef<FlatList<AssistantMessage>>(null);
  const webRecognitionRef = useRef<any>(null);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 200);

  useEffect(() => {
    setAnswerLanguage(appLanguage === "ur" ? "ur" : "en");
  }, [appLanguage]);

  useEffect(() => {
    return () => {
      void Speech.stop();
      try {
        webRecognitionRef.current?.stop?.();
      } catch {
        // Browser recognizer may already be stopped.
      }
    };
  }, []);

  const animateOpen = useCallback(() => {
    if (reduceMotion) { slide.setValue(0); return; }
    slide.setValue(420);
    Animated.timing(slide, {
      toValue: 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [reduceMotion, slide]);

  const animateClose = useCallback(() => {
    void Speech.stop();
    setSpeakingMessageId(null);
    try {
      webRecognitionRef.current?.stop?.();
    } catch {
      // Browser recognizer may already be stopped.
    }
    webRecognitionRef.current = null;
    if (recorderState.isRecording) {
      void audioRecorder.stop().finally(() => {
        void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      });
    }
    setVoiceState("idle");
    if (reduceMotion) {
      slide.setValue(420);
      setVisible(false);
      return;
    }
    Animated.timing(slide, {
      toValue: 420,
      duration: 210,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setVisible(false);
    });
  }, [audioRecorder, recorderState.isRecording, reduceMotion, slide]);

  const loadAuthorizedPatients = useCallback(async () => {
    if (role === "Patient") return;
    try {
      const result = await getAuthorizedAssistantPatients();
      setAuthorizedPatients(result.patients || []);
    } catch (err: any) {
      setError(err?.message || COPY.en.patientsError);
    }
  }, [role]);

  const ensureSession = useCallback(async () => {
    if (session) return session;
    const created = await createAssistantSession();
    setSession(created);
    return created;
  }, [session]);

  const selectContext = useCallback(
    async (patientId?: string) => {
      setLoading(true);
      setError("");
      try {
        const selectedSession = await createAssistantSession(patientId);
        setSession(selectedSession);
        const result = await getAssistantMessages(selectedSession.id);
        setMessages(
          result.messages.length
            ? result.messages
            : [welcomeMessage(answerLanguage, selectedSession.id)]
        );
      } catch (err: any) {
        setError(err?.message || copy.contextError);
      } finally {
        setLoading(false);
      }
    },
    [answerLanguage, copy.contextError]
  );

  const loadAssistant = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [activeSession, health] = await Promise.all([
        ensureSession(),
        getAssistantHealth().catch(() => null),
      ]);
      if (health) setAssistantHealth(health);
      const result = await getAssistantMessages(activeSession.id);
      setMessages(
        result.messages.length
          ? result.messages
          : [welcomeMessage(answerLanguage, activeSession.id)]
      );
    } catch (err: any) {
      setError(err?.message || copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [answerLanguage, copy.loadError, ensureSession]);

  const openAssistant = () => {
    setVisible(true);
    animateOpen();
    void loadAssistant();
    void loadAuthorizedPatients();
  };

  const speakMessage = useCallback(async (message: AssistantMessage) => {
    if (message.role !== "assistant" || !message.content.trim()) return;

    if (speakingMessageId === message.id) {
      await Speech.stop();
      setSpeakingMessageId(null);
      return;
    }

    await Speech.stop();
    const language: AssistantLanguage = isUrduMessage(message) ? "ur" : "en";
    const locale = language === "ur" ? "ur-PK" : "en-US";
    let voice: string | undefined;

    try {
      const voices = await Speech.getAvailableVoicesAsync();
      const exact = voices.find((item) => item.language?.toLowerCase() === locale.toLowerCase());
      const sameLanguage = voices.find((item) => item.language?.toLowerCase().startsWith(language));
      voice = (exact || sameLanguage)?.identifier;
    } catch {
      // `language` alone is still valid when voice enumeration is unavailable.
    }

    setSpeakingMessageId(message.id);
    Speech.speak(message.content, {
      language: locale,
      voice,
      rate: language === "ur" ? 0.86 : 0.94,
      pitch: 1.0,
      onDone: () => setSpeakingMessageId(null),
      onStopped: () => setSpeakingMessageId(null),
      onError: () => {
        setSpeakingMessageId(null);
        setError(language === "ur" ? COPY.ur.speechError : COPY.en.speechError);
      },
    });
  }, [speakingMessageId]);

  const sendContent = useCallback(
    async (rawContent: string, autoSpeak = false) => {
      const content = rawContent.trim();
      if (!content || sending) return;

      setSending(true);
      setError("");
      try {
        const activeSession = await ensureSession();
        const result = await sendAssistantMessage(
          activeSession.id,
          content,
          answerLanguage
        );
        setMessages((current) => {
          const withoutWelcome = current.filter(
            (item) => !item.id.startsWith("assistant-welcome-")
          );
          return [...withoutWelcome, result.userMessage, result.assistantMessage];
        });
        setDraft("");
        requestAnimationFrame(() =>
          listRef.current?.scrollToEnd({ animated: true })
        );
        if (autoSpeak) {
          setTimeout(() => void speakMessage(result.assistantMessage), 140);
        }
      } catch (err: any) {
        setError(err?.message || copy.sendError);
      } finally {
        setSending(false);
      }
    },
    [answerLanguage, copy.sendError, ensureSession, sending, speakMessage]
  );

  const send = useCallback(() => {
    void sendContent(draft, false);
  }, [draft, sendContent]);

  const startWebVoice = useCallback(() => {
    const globalAny = globalThis as any;
    const Recognition =
      globalAny.SpeechRecognition || globalAny.webkitSpeechRecognition;

    if (!Recognition) {
      setError(copy.voiceUnsupported);
      return;
    }

    try {
      const recognition = new Recognition();
      recognition.lang = answerLanguage === "ur" ? "ur-PK" : "en-US";
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;
      webRecognitionRef.current = recognition;

      recognition.onstart = () => {
        setError("");
        setVoiceState("listening");
      };
      recognition.onresult = (event: any) => {
        const transcript = String(
          event?.results?.[0]?.[0]?.transcript || ""
        ).trim();
        setVoiceState("idle");
        webRecognitionRef.current = null;
        if (transcript) {
          setDraft(transcript);
          void sendContent(transcript, true);
        }
      };
      recognition.onerror = (event: any) => {
        setVoiceState("idle");
        webRecognitionRef.current = null;
        const message = String(event?.error || "");
        setError(
          message === "not-allowed" || message === "service-not-allowed"
            ? copy.micDenied
            : `${copy.voiceUnsupported}${message ? ` (${message})` : ""}`
        );
      };
      recognition.onend = () => {
        setVoiceState((current) => current === "listening" ? "idle" : current);
        webRecognitionRef.current = null;
      };
      recognition.start();
    } catch (err: any) {
      setVoiceState("idle");
      setError(err?.message || copy.voiceUnsupported);
    }
  }, [answerLanguage, copy.micDenied, copy.voiceUnsupported, sendContent]);

  const stopWebVoice = useCallback(() => {
    try {
      webRecognitionRef.current?.stop?.();
    } finally {
      setVoiceState("idle");
      webRecognitionRef.current = null;
    }
  }, []);

  const startNativeVoice = useCallback(async () => {
    try {
      setError("");
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError(copy.micDenied);
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setVoiceState("listening");
    } catch (err: any) {
      setVoiceState("idle");
      setError(err?.message || copy.micDenied);
    }
  }, [audioRecorder, copy.micDenied]);

  const stopNativeVoice = useCallback(async () => {
    try {
      setVoiceState("transcribing");
      await audioRecorder.stop();
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
      const uri = audioRecorder.uri;
      if (!uri) throw new Error("No voice recording was created.");
      const result = await transcribeAssistantAudio(uri, answerLanguage);
      const transcript = result.text.trim();
      if (!transcript) throw new Error("No speech was detected.");
      setDraft(transcript);
      setVoiceState("idle");
      await sendContent(transcript, true);
    } catch (err: any) {
      void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      setVoiceState("idle");
      setError(err?.message || "Voice transcription failed.");
    }
  }, [answerLanguage, audioRecorder, sendContent]);

  const toggleVoice = useCallback(() => {
    if (sending || voiceState === "transcribing") return;
    if (Platform.OS === "web") {
      if (voiceState === "listening") stopWebVoice();
      else startWebVoice();
      return;
    }
    if (recorderState.isRecording || voiceState === "listening") {
      void stopNativeVoice();
    } else {
      void startNativeVoice();
    }
  }, [
    recorderState.isRecording,
    sending,
    startNativeVoice,
    startWebVoice,
    stopNativeVoice,
    stopWebVoice,
    voiceState,
  ]);

  useEffect(() => {
    if (messages.length) {
      const timer = setTimeout(
        () => listRef.current?.scrollToEnd({ animated: false }),
        40
      );
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [messages.length]);

  const modeLabel = useMemo(() => {
    if (!assistantHealth) return "RAG";
    return assistantHealth.answerMode === "rag_llm" ? "RAG + LLM" : "Local RAG";
  }, [assistantHealth]);

  return (
    <>
      <Pressable
        onPress={openAssistant}
        accessibilityRole="button"
        accessibilityLabel="Open EyeCare Health Assistant"
        style={({ pressed }) => [
          styles.launcher,
          pressed && styles.launcherPressed,
        ]}
      >
        <Image
          source={require("../assets/images/ai-assistant-robot.png")}
          style={styles.launcherImage}
        />
        <View style={styles.launcherDot} />
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={animateClose}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.backdrop}
            onPress={animateClose}
            accessibilityLabel="Close Assistant"
          />
          <KeyboardAvoidingView
            style={styles.keyboardLayer}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            pointerEvents="box-none"
          >
            <Animated.View
              style={[styles.panel, { transform: [{ translateY: slide }] }]}
            >
              <View style={styles.panelHeader}>
                <View style={styles.headerIdentity}>
                  <View style={styles.avatar}>
                    <Image
                      source={require("../assets/images/ai-assistant-robot.png")}
                      style={styles.avatarImage}
                    />
                  </View>
                  <View style={styles.headerTextWrap}>
                    <Text style={[styles.panelTitle, isRTL && styles.rtlText]}>
                      {copy.title}
                    </Text>
                    <Text style={[styles.panelSubtitle, isRTL && styles.rtlText]}>
                      {role} · {modeLabel} · {session?.patientId ? copy.authorizedContext : copy.basicMode}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={animateClose}
                  style={({ pressed }) => [
                    styles.closeButton,
                    pressed && styles.pressed,
                  ]}
                  accessibilityLabel="Close EyeCare Health Assistant"
                >
                  <Ionicons name="close" size={22} color={colors.white} />
                </Pressable>
              </View>

              <View style={[styles.languageRow, isRTL && styles.rowReverse]}>
                <Text style={[styles.languageLabel, isRTL && styles.rtlText]}>
                  {answerLanguage === "ur" ? "جواب کی زبان" : "Answer language"}
                </Text>
                <View style={styles.languageToggle}>
                  <Pressable
                    onPress={() => setAnswerLanguage("en")}
                    style={[styles.languageButton, answerLanguage === "en" && styles.languageButtonActive]}
                  >
                    <Text style={[styles.languageButtonText, answerLanguage === "en" && styles.languageButtonTextActive]}>
                      {copy.english}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setAnswerLanguage("ur")}
                    style={[styles.languageButton, answerLanguage === "ur" && styles.languageButtonActive]}
                  >
                    <Text style={[styles.languageButtonText, answerLanguage === "ur" && styles.languageButtonTextActive]}>
                      {copy.urdu}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={[styles.notice, isRTL && styles.rowReverse]}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={16}
                  color={colors.teal800}
                />
                <Text style={[styles.noticeText, isRTL && styles.rtlText]}>
                  {copy.notice}
                </Text>
              </View>

              {role !== "Patient" ? (
                <View style={styles.contextPicker}>
                  <View style={[styles.contextPickerHeader, isRTL && styles.rowReverse]}>
                    <Text style={[styles.contextPickerTitle, isRTL && styles.rtlText]}>
                      {copy.patientContext}
                    </Text>
                    <Text style={styles.contextPickerHint}>{copy.optional}</Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.contextChoices}
                  >
                    <Pressable
                      onPress={() => void selectContext()}
                      style={[
                        styles.contextChoice,
                        !session?.patientId && styles.contextChoiceActive,
                      ]}
                      accessibilityRole="button"
                    >
                      <Ionicons
                        name="sparkles-outline"
                        size={15}
                        color={!session?.patientId ? colors.white : colors.teal800}
                      />
                      <Text
                        style={[
                          styles.contextChoiceText,
                          !session?.patientId && styles.contextChoiceTextActive,
                        ]}
                      >
                        {copy.basicMode}
                      </Text>
                    </Pressable>
                    {authorizedPatients.map((patient) => {
                      const active = session?.patientId === patient.id;
                      return (
                        <Pressable
                          key={patient.id}
                          onPress={() => void selectContext(patient.id)}
                          style={[
                            styles.contextChoice,
                            active && styles.contextChoiceActive,
                          ]}
                          accessibilityRole="button"
                        >
                          <Ionicons
                            name="person-outline"
                            size={15}
                            color={active ? colors.white : colors.teal800}
                          />
                          <Text
                            style={[
                              styles.contextChoiceText,
                              active && styles.contextChoiceTextActive,
                            ]}
                            numberOfLines={1}
                          >
                            {patient.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={[styles.errorText, isRTL && styles.rtlText]}>
                    {error}
                  </Text>
                </View>
              ) : null}

              {loading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color={colors.teal800} />
                  <Text style={[styles.loadingText, isRTL && styles.rtlText]}>
                    {copy.preparing}
                  </Text>
                </View>
              ) : (
                <FlatList
                  ref={listRef}
                  data={messages}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.messageList}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => {
                    const messageUrdu = isUrduMessage(item);
                    const speaking = speakingMessageId === item.id;
                    return (
                      <View
                        style={[
                          styles.messageRow,
                          item.role === "user" ? styles.userRow : styles.assistantRow,
                        ]}
                      >
                        <View
                          style={[
                            styles.messageBubble,
                            item.role === "user" ? styles.userBubble : styles.assistantBubble,
                          ]}
                        >
                          <Text
                            style={[
                              styles.messageText,
                              item.role === "user"
                                ? styles.userMessageText
                                : styles.assistantMessageText,
                              messageUrdu && styles.rtlText,
                            ]}
                          >
                            {item.content}
                          </Text>

                          {item.role === "assistant" ? (
                            <View style={[styles.messageTools, messageUrdu && styles.rowReverse]}>
                              <Pressable
                                onPress={() => void speakMessage(item)}
                                style={({ pressed }) => [styles.toolButton, pressed && styles.pressed]}
                                accessibilityRole="button"
                              >
                                <Ionicons
                                  name={speaking ? "stop-circle-outline" : "volume-high-outline"}
                                  size={16}
                                  color={colors.teal800}
                                />
                                <Text style={styles.toolButtonText}>
                                  {speaking
                                    ? messageUrdu ? COPY.ur.stop : COPY.en.stop
                                    : messageUrdu ? COPY.ur.listen : COPY.en.listen}
                                </Text>
                              </Pressable>
                              {item.mode ? (
                                <View style={styles.modeChip}>
                                  <Text style={styles.modeChipText}>
                                    {item.mode === "rag_llm" ? "RAG + LLM" : "RAG"}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          ) : null}

                          {item.role === "assistant" && item.sources?.length ? (
                            <View style={styles.sourcesBox}>
                              <Text style={[styles.sourcesTitle, messageUrdu && styles.rtlText]}>
                                {messageUrdu ? COPY.ur.source : COPY.en.source}
                              </Text>
                              {item.sources.map((source, index) => (
                                <Pressable
                                  key={`${source.id}-${index}`}
                                  disabled={!source.url}
                                  onPress={() => {
                                    if (source.url) void Linking.openURL(source.url);
                                  }}
                                  style={({ pressed }) => [styles.sourceRow, pressed && styles.pressed]}
                                >
                                  <Ionicons
                                    name={source.kind === "patient_context" ? "person-circle-outline" : "link-outline"}
                                    size={13}
                                    color={colors.teal800}
                                  />
                                  <Text
                                    numberOfLines={2}
                                    style={[styles.sourceText, messageUrdu && styles.rtlText]}
                                  >
                                    {source.title}
                                  </Text>
                                </Pressable>
                              ))}
                            </View>
                          ) : null}
                        </View>
                      </View>
                    );
                  }}
                  ListEmptyComponent={
                    <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
                      {copy.empty}
                    </Text>
                  }
                />
              )}

              <View style={styles.voiceHintRow}>
                <Ionicons
                  name={voiceState === "listening" ? "mic" : "mic-outline"}
                  size={14}
                  color={voiceState === "listening" ? colors.error : colors.teal800}
                />
                <Text style={[styles.voiceHint, isRTL && styles.rtlText]}>
                  {voiceState === "listening"
                    ? copy.listening
                    : voiceState === "transcribing"
                    ? copy.transcribing
                    : copy.voiceReady}
                </Text>
              </View>

              <View style={[styles.composerRow, isRTL && styles.rowReverse]}>
                <Pressable
                  onPress={toggleVoice}
                  disabled={sending || voiceState === "transcribing"}
                  accessibilityRole="button"
                  accessibilityLabel="Ask by voice"
                  style={({ pressed }) => [
                    styles.micButton,
                    voiceState === "listening" && styles.micButtonActive,
                    (sending || voiceState === "transcribing") && styles.sendDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  {voiceState === "transcribing" ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Ionicons
                      name={voiceState === "listening" ? "stop" : "mic"}
                      size={20}
                      color={colors.white}
                    />
                  )}
                </Pressable>

                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={copy.placeholder}
                  placeholderTextColor={colors.textMuted}
                  multiline
                  maxLength={4000}
                  editable={!sending && voiceState !== "transcribing"}
                  onSubmitEditing={send}
                  textAlign={isRTL ? "right" : "left"}
                  style={[styles.input, isRTL && styles.rtlText]}
                  accessibilityLabel="Health assistant question"
                />

                <Pressable
                  onPress={send}
                  disabled={!draft.trim() || sending || loading}
                  accessibilityRole="button"
                  accessibilityLabel="Send question"
                  style={({ pressed }) => [
                    styles.sendButton,
                    (!draft.trim() || sending || loading) && styles.sendDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Ionicons name="arrow-up" size={20} color={colors.white} />
                  )}
                </Pressable>
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  launcher: {
    position: "absolute",
    right: spacing.lg,
    top: 76,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.teal800,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.teal900,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    zIndex: 20,
  },
  launcherPressed: { opacity: 0.84, transform: [{ scale: 0.96 }] },
  launcherImage: { width: 44, height: 34, borderRadius: 10 },
  launcherDot: {
    position: "absolute",
    top: 11,
    right: 11,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.warning,
    borderWidth: 1,
    borderColor: colors.teal800,
  },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(5, 36, 34, 0.34)" },
  keyboardLayer: { flex: 1, justifyContent: "flex-end" },
  panel: {
    width: "100%",
    maxHeight: "88%",
    minHeight: 480,
    backgroundColor: colors.pageBackground,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: "hidden",
    shadowColor: colors.teal900,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -5 },
    elevation: 14,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.teal800,
  },
  headerIdentity: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  headerTextWrap: { flex: 1 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.teal50,
    overflow: "hidden",
  },
  avatarImage: { width: 38, height: 30, borderRadius: 9 },
  panelTitle: {
    color: colors.white,
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.bold,
  },
  panelSubtitle: { color: colors.textLight, fontSize: typography.sizes.xs, marginTop: 2 },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  languageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  languageLabel: { color: colors.textSecondary, fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold },
  languageToggle: {
    flexDirection: "row",
    padding: 3,
    borderRadius: radius.lg,
    backgroundColor: colors.teal50,
    borderWidth: 1,
    borderColor: colors.border,
  },
  languageButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.md },
  languageButtonActive: { backgroundColor: colors.teal800 },
  languageButtonText: { color: colors.teal800, fontSize: typography.sizes.xs, fontWeight: typography.weights.bold },
  languageButtonTextActive: { color: colors.white },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    margin: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.teal50,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noticeText: { flex: 1, color: colors.textSecondary, fontSize: typography.sizes.xs, lineHeight: 17 },
  contextPicker: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  contextPickerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
  contextPickerTitle: { color: colors.textPrimary, fontSize: typography.sizes.small, fontWeight: typography.weights.bold },
  contextPickerHint: { color: colors.textMuted, fontSize: typography.sizes.xs },
  contextChoices: { gap: spacing.xs, paddingRight: spacing.xs },
  contextChoice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: 180,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radius.lg,
    backgroundColor: colors.teal50,
    borderWidth: 1,
    borderColor: colors.border,
  },
  contextChoiceActive: { backgroundColor: colors.teal800, borderColor: colors.teal800 },
  contextChoiceText: { color: colors.teal800, fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, flexShrink: 1 },
  contextChoiceTextActive: { color: colors.white },
  errorBox: { marginHorizontal: spacing.md, marginBottom: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.errorBg },
  errorText: { color: colors.error, fontSize: typography.sizes.small, lineHeight: 18 },
  loadingBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  loadingText: { color: colors.textSecondary, fontSize: typography.sizes.body, marginTop: spacing.sm },
  messageList: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },
  messageRow: { width: "100%", flexDirection: "row" },
  userRow: { justifyContent: "flex-end" },
  assistantRow: { justifyContent: "flex-start" },
  messageBubble: { maxWidth: "88%", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg },
  userBubble: { backgroundColor: colors.teal800, borderBottomRightRadius: radius.sm },
  assistantBubble: { backgroundColor: colors.surface, borderBottomLeftRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  messageText: { fontSize: typography.sizes.body, lineHeight: 22 },
  userMessageText: { color: colors.white },
  assistantMessageText: { color: colors.textPrimary },
  messageTools: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  toolButton: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4, paddingHorizontal: 7, borderRadius: radius.md, backgroundColor: colors.teal50 },
  toolButtonText: { color: colors.teal800, fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold },
  modeChip: { paddingVertical: 4, paddingHorizontal: 7, borderRadius: radius.md, backgroundColor: colors.pageBackground },
  modeChipText: { color: colors.textMuted, fontSize: 10, fontWeight: typography.weights.bold },
  sourcesBox: { marginTop: 8, paddingTop: 7, borderTopWidth: 1, borderTopColor: colors.border },
  sourcesTitle: { color: colors.textMuted, fontSize: 10, fontWeight: typography.weights.bold, marginBottom: 4, textTransform: "uppercase" },
  sourceRow: { flexDirection: "row", alignItems: "flex-start", gap: 5, paddingVertical: 3 },
  sourceText: { flex: 1, color: colors.teal800, fontSize: typography.sizes.xs, lineHeight: 16 },
  emptyText: { textAlign: "center", color: colors.textSecondary, fontSize: typography.sizes.body, padding: spacing.xl },
  voiceHintRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: spacing.md, paddingBottom: 6 },
  voiceHint: { color: colors.textMuted, fontSize: typography.sizes.xs },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.pageBackground,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: typography.sizes.body,
  },
  micButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.teal700 },
  micButtonActive: { backgroundColor: colors.error },
  sendButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.teal800 },
  sendDisabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
  rtlText: { textAlign: "right", writingDirection: "rtl" },
  rowReverse: { flexDirection: "row-reverse" },
});