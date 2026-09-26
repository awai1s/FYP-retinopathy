import React, { useEffect, useMemo, useState } from "react";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import AppShell from "../../design/components/AppShell";
import Card from "../../design/components/card";
import Button from "../../design/components/Button";
import EducationArtwork from "../../components/education/EducationArtwork";
import { getEducationArticle, getEducationCategory, localized, type EducationLanguage } from "../../content/educationContent";
import { markEducationAssignmentViewed } from "../../services/education";
import { getSavedEducationArticleIds, setEducationArticleSaved } from "../../services/offlineCache";
import { useLanguage } from "../../services/i18n";
import { useThemeRefresh } from "../../providers/AppThemeProvider";
import colors from "../../design/tokens/colors";
import spacing from "../../design/tokens/spacing";
import typography from "../../design/tokens/typography";
import radius from "../../design/tokens/radius";

export default function EducationArticlePage() {
  useThemeRefresh();
  const params = useLocalSearchParams<{ id?: string | string[]; assignmentId?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const assignmentId = Array.isArray(params.assignmentId) ? params.assignmentId[0] : params.assignmentId;
  const article = useMemo(() => getEducationArticle(id), [id]);
  const { language } = useLanguage();
  const preferred: EducationLanguage = language === "ur" ? "ur" : "en";
  const [displayLanguage, setDisplayLanguage] = useState<EducationLanguage>(preferred);
  const [savedOffline, setSavedOffline] = useState(false);

  useEffect(() => {
    if (article && !article.languages.includes(preferred)) setDisplayLanguage("en");
    else setDisplayLanguage(preferred);
  }, [article?.id, preferred]);

  useEffect(() => {
    if (assignmentId) void markEducationAssignmentViewed(assignmentId).catch(() => undefined);
  }, [assignmentId]);

  useEffect(() => {
    if (!article?.id) return;
    void getSavedEducationArticleIds().then((ids) => setSavedOffline(ids.includes(article.id)));
  }, [article?.id]);

  if (!article) {
    return (
      <AppShell role="Patient" title="Eye Health Library" showBack onBackPress={() => router.back()}>
        <Card style={styles.notFound}><Ionicons name="document-text-outline" size={30} color={colors.textMuted} /><Text style={styles.title}>Article not found</Text><Text style={styles.muted}>This education item is not available in the current library.</Text><Button title="Back to library" onPress={() => router.replace("/education" as any)} /></Card>
      </AppShell>
    );
  }

  const isUrdu = displayLanguage === "ur";
  const category = getEducationCategory(article.category);
  const sourceAvailable = Boolean(article.source.url);

  return (
    <AppShell role="Patient" title="Eye Health Library" showBack onBackPress={() => router.back()}>
      <EducationArtwork image={article.image} />

      <View style={[styles.metaTop, isUrdu && styles.rtl]}>
        <View style={styles.categoryBadge}><Ionicons name={category.icon} size={15} color={colors.teal800} /><Text style={styles.categoryBadgeText}>{localized(category.label, displayLanguage)}</Text></View>
        <View style={styles.readingBadge}><Ionicons name="time-outline" size={14} color={colors.textMuted} /><Text style={styles.readingText}>{article.readingMinutes} {isUrdu ? "منٹ مطالعہ" : "min read"}</Text></View>
      </View>

      <Text style={[styles.articleTitle, isUrdu && styles.urduText]}>{localized(article.title, displayLanguage)}</Text>
      <Text style={[styles.lede, isUrdu && styles.urduText]}>{localized(article.shortDescription, displayLanguage)}</Text>

      <TouchableOpacity
        onPress={() => void setEducationArticleSaved(article.id, !savedOffline).then((ids) => setSavedOffline(ids.includes(article.id)))}
        style={styles.offlineSave}
        accessibilityRole="button"
        accessibilityLabel={savedOffline ? "Remove article from offline list" : "Save article offline"}
      >
        <Ionicons name={savedOffline ? "bookmark" : "bookmark-outline"} size={18} color={colors.teal800} />
        <View style={styles.flex}>
          <Text style={styles.offlineSaveTitle}>{savedOffline ? "Saved offline" : "Save offline"}</Text>
          <Text style={styles.offlineSaveText}>This curated article is bundled with EyeCare AI and remains readable without internet.</Text>
        </View>
      </TouchableOpacity>

      {article.languages.includes("ur") ? (
        <View style={styles.languageSwitch}>
          <TouchableOpacity onPress={() => setDisplayLanguage("en")} style={[styles.languageButton, displayLanguage === "en" && styles.languageButtonActive]}><Text style={[styles.languageText, displayLanguage === "en" && styles.languageTextActive]}>English</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setDisplayLanguage("ur")} style={[styles.languageButton, displayLanguage === "ur" && styles.languageButtonActive]}><Text style={[styles.languageText, displayLanguage === "ur" && styles.languageTextActive]}>اردو</Text></TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.sections}>
        {article.content.map((section, index) => (
          <Card key={`${article.id}-${index}`} variant={index === 0 ? "accent" : "default"} style={styles.sectionCard}>
            <Text style={[styles.sectionTitle, isUrdu && styles.urduText]}>{localized(section.heading, displayLanguage)}</Text>
            <Text style={[styles.bodyText, isUrdu && styles.urduText]}>{localized(section.body, displayLanguage)}</Text>
            {section.bullets?.length ? <View style={styles.bullets}>{section.bullets.map((bullet, bulletIndex) => <View key={bulletIndex} style={[styles.bulletRow, isUrdu && styles.rtl]}><View style={styles.bulletDot} /><Text style={[styles.bulletText, isUrdu && styles.urduText]}>{localized(bullet, displayLanguage)}</Text></View>)}</View> : null}
          </Card>
        ))}
      </View>

      <Card variant="bordered" style={styles.sourceCard}>
        <View style={styles.sourceIcon}><Ionicons name="shield-checkmark-outline" size={23} color={colors.teal800} /></View>
        <View style={styles.flex}>
          <Text style={[styles.sourceEyebrow, isUrdu && styles.urduText]}>{isUrdu ? "ماخذ" : "SOURCE"}</Text>
          <Text style={[styles.sourceTitle, isUrdu && styles.urduText]}>{article.source.title}</Text>
          <Text style={[styles.sourceHint, isUrdu && styles.urduText]}>{sourceAvailable ? (isUrdu ? "اصل قابلِ اعتماد ماخذ نئی ونڈو میں کھولیں۔" : "Open the original trusted source in a new window.") : (isUrdu ? "یہ مضمون EyeCare AI کے موجودہ مریض تعلیمی ورک فلو سے متعلق ہے۔" : "This article documents the existing EyeCare AI patient education workflow.")}</Text>
        </View>
        {sourceAvailable ? <TouchableOpacity onPress={() => void Linking.openURL(article.source.url)} accessibilityRole="link" accessibilityLabel="Open source"><Ionicons name="open-outline" size={22} color={colors.teal800} /></TouchableOpacity> : null}
      </Card>

      <Card style={styles.disclaimer}>
        <Ionicons name="information-circle-outline" size={21} color={colors.info} />
        <Text style={[styles.disclaimerText, isUrdu && styles.urduText]}>{isUrdu ? "یہ تعلیمی مواد عمومی معلومات کے لیے ہے۔ اچانک نظر کی شدید تبدیلی، شدید درد یا ہنگامی علامات میں فوری پیشہ ورانہ طبی مدد لیں۔" : "This educational material is general information. Sudden major vision changes, severe pain or other urgent symptoms need prompt professional eye care."}</Text>
      </Card>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  rtl: { flexDirection: "row-reverse" },
  urduText: { textAlign: "right", writingDirection: "rtl" },
  metaTop: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg },
  categoryBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.teal50, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  categoryBadgeText: { color: colors.teal800, fontSize: typography.sizes.xs, fontWeight: typography.weights.bold },
  readingBadge: { flexDirection: "row", alignItems: "center", gap: 5 },
  readingText: { color: colors.textMuted, fontSize: typography.sizes.xs },
  articleTitle: { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.bold, lineHeight: 36, marginTop: spacing.sm },
  lede: { color: colors.textSecondary, fontSize: typography.sizes.body, lineHeight: 24, marginTop: spacing.sm },
  offlineSave: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.teal200, backgroundColor: colors.teal50, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.lg },
  offlineSaveTitle: { color: colors.textPrimary, fontSize: typography.sizes.small, fontWeight: typography.weights.bold },
  offlineSaveText: { color: colors.textSecondary, fontSize: typography.sizes.tiny, lineHeight: 17, marginTop: 2 },
  languageSwitch: { flexDirection: "row", borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, padding: 4, alignSelf: "flex-start", marginTop: spacing.lg, borderWidth: 1, borderColor: colors.border },
  languageButton: { minWidth: 90, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.md, alignItems: "center" },
  languageButtonActive: { backgroundColor: colors.neonAqua },
  languageText: { color: colors.textSecondary, fontSize: typography.sizes.small, fontWeight: typography.weights.semibold },
  languageTextActive: { color: colors.navyInk, fontWeight: typography.weights.bold },
  sections: { gap: spacing.md, marginTop: spacing.xl },
  sectionCard: { padding: spacing.lg },
  sectionTitle: { color: colors.textPrimary, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold, marginBottom: spacing.sm },
  bodyText: { color: colors.textSecondary, fontSize: typography.sizes.body, lineHeight: 25 },
  bullets: { marginTop: spacing.md, gap: spacing.sm },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  bulletDot: { width: 7, height: 7, borderRadius: 5, backgroundColor: colors.teal700, marginTop: 8 },
  bulletText: { flex: 1, color: colors.textSecondary, fontSize: typography.sizes.small, lineHeight: 22 },
  sourceCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.xl },
  sourceIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.teal100, alignItems: "center", justifyContent: "center" },
  sourceEyebrow: { color: colors.teal800, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, letterSpacing: 1 },
  sourceTitle: { color: colors.textPrimary, fontSize: typography.sizes.small, fontWeight: typography.weights.bold, marginTop: 2 },
  sourceHint: { color: colors.textMuted, fontSize: typography.sizes.tiny, lineHeight: 17, marginTop: 3 },
  disclaimer: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.xl },
  disclaimerText: { flex: 1, color: colors.textSecondary, fontSize: typography.sizes.xs, lineHeight: 19 },
  notFound: { gap: spacing.md, alignItems: "flex-start" },
  title: { color: colors.textPrimary, fontSize: typography.sizes.h2, fontWeight: typography.weights.bold },
  muted: { color: colors.textSecondary, fontSize: typography.sizes.small },
});
