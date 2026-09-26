import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import AppShell from "../../design/components/AppShell";
import Card from "../../design/components/card";
import Button from "../../design/components/Button";
import EducationArtwork from "../../components/education/EducationArtwork";
import {
  educationArticles,
  educationCategories,
  educationVideos,
  getEducationArticle,
  getEducationCategory,
  localized,
  type EducationCategoryKey,
} from "../../content/educationContent";
import { getEducationAssignments, markEducationAssignmentViewed, type PatientEducationAssignment } from "../../services/education";
import { useLanguage } from "../../services/i18n";
import { useThemeRefresh } from "../../providers/AppThemeProvider";
import colors from "../../design/tokens/colors";
import spacing from "../../design/tokens/spacing";
import typography from "../../design/tokens/typography";
import radius from "../../design/tokens/radius";

export default function EducationLibrary() {
  useThemeRefresh();
  const { language, isRTL } = useLanguage();
  const contentLanguage = language === "ur" ? "ur" : "en";
  const [category, setCategory] = useState<EducationCategoryKey | "all">("all");
  const [query, setQuery] = useState("");
  const [assignments, setAssignments] = useState<PatientEducationAssignment[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(true);

  const loadAssignments = useCallback(async () => {
    try {
      setAssignments(await getEducationAssignments());
    } catch {
      setAssignments([]);
    } finally {
      setLoadingRecommendations(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadAssignments(); }, [loadAssignments]));

  const recommended = useMemo(() => {
    const seen = new Set<string>();
    return assignments.filter((item) => {
      if (!getEducationArticle(item.topicKey) || seen.has(item.topicKey)) return false;
      seen.add(item.topicKey);
      return true;
    });
  }, [assignments]);

  const filteredArticles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return educationArticles.filter((article) => {
      if (category !== "all" && article.category !== category) return false;
      if (!q) return true;
      const categoryItem = getEducationCategory(article.category);
      return [article.title.en, article.title.ur, article.shortDescription.en, article.shortDescription.ur, categoryItem.label.en, categoryItem.label.ur]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [category, query]);

  const openRecommended = async (assignment: PatientEducationAssignment) => {
    void markEducationAssignmentViewed(assignment.id).catch(() => undefined);
    router.push({ pathname: "/education/[id]", params: { id: assignment.topicKey, assignmentId: assignment.id } } as any);
  };

  return (
    <AppShell role="Patient" title="Learn & Eye Health" subtitle={contentLanguage === "ur" ? "آنکھوں کی صحت کی لائبریری" : "Eye Health Library"}>
      <View style={[styles.header, isRTL && styles.rtl]}>
        <View style={styles.headerIcon}><Ionicons name="library-outline" size={27} color={colors.teal800} /></View>
        <View style={styles.flex}>
          <Text style={[styles.eyebrow, isRTL && styles.urduText]}>{contentLanguage === "ur" ? "آنکھوں کی صحت کی لائبریری" : "EYE HEALTH LIBRARY"}</Text>
          <Text style={[styles.title, isRTL && styles.urduText]}>{contentLanguage === "ur" ? "قابلِ اعتماد معلومات، آسان زبان میں" : "Trusted eye-health learning in one place"}</Text>
          <Text style={[styles.subtitle, isRTL && styles.urduText]}>{contentLanguage === "ur" ? "ذیابیطس ریٹینوپیتھی، اسکریننگ، حفاظت، ادویات اور روزمرہ آنکھوں کی صحت کے بارے میں مختصر مضامین۔" : "Short, practical articles about diabetic retinopathy, screening, safety, medication and everyday eye health."}</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={19} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={contentLanguage === "ur" ? "مضمون تلاش کریں" : "Search the library"}
          placeholderTextColor={colors.textMuted}
          style={[styles.searchInput, isRTL && styles.urduText]}
          textAlign={isRTL ? "right" : "left"}
        />
        {query ? <TouchableOpacity onPress={() => setQuery("")} accessibilityLabel="Clear search"><Ionicons name="close-circle" size={20} color={colors.textMuted} /></TouchableOpacity> : null}
      </View>

      <SectionHeading title={contentLanguage === "ur" ? "آپ کے لیے تجویز کردہ" : "Recommended for You"} subtitle={contentLanguage === "ur" ? "آپ کے ڈاکٹر کی تفویض کردہ تعلیم یہاں ظاہر ہوتی ہے۔" : "Education assigned during a consultation appears here."} rtl={isRTL} />
      {loadingRecommendations ? (
        <Card style={styles.loadingCard}><ActivityIndicator color={colors.teal800} /><Text style={styles.muted}>Loading recommendations...</Text></Card>
      ) : recommended.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRow}>
          {recommended.map((assignment) => {
            const article = getEducationArticle(assignment.topicKey)!;
            return (
              <Card key={assignment.id} style={styles.recommendedCard} onPress={() => void openRecommended(assignment)}>
                <EducationArtwork image={article.image} compact />
                <View style={styles.recommendedBody}>
                  <View style={[styles.recommendedBadge, isRTL && styles.rtl]}><Ionicons name="medical-outline" size={14} color={colors.teal800} /><Text style={styles.recommendedBadgeText}>{contentLanguage === "ur" ? `ڈاکٹر ${assignment.doctorName} کی تجویز` : `Recommended by ${assignment.doctorName}`}</Text></View>
                  <Text style={[styles.cardTitle, isRTL && styles.urduText]} numberOfLines={2}>{localized(article.title, contentLanguage)}</Text>
                  <Text style={[styles.cardMeta, isRTL && styles.urduText]}>{article.readingMinutes} {contentLanguage === "ur" ? "منٹ مطالعہ" : "min read"} • {localized(getEducationCategory(article.category).shortLabel, contentLanguage)}</Text>
                </View>
              </Card>
            );
          })}
        </ScrollView>
      ) : (
        <Card variant="bordered" style={styles.emptyRecommended} onPress={() => router.push("/education/understanding_dr" as any)}>
          <Ionicons name="sparkles-outline" size={24} color={colors.teal800} />
          <View style={styles.flex}>
            <Text style={[styles.cardTitle, isRTL && styles.urduText]}>{contentLanguage === "ur" ? "ذیابیطس ریٹینوپیتھی کو سمجھیں" : "Understanding Diabetic Retinopathy"}</Text>
            <Text style={[styles.muted, isRTL && styles.urduText]}>{contentLanguage === "ur" ? "بنیادی مضمون سے آغاز کریں۔ ڈاکٹر کی تفویض کردہ تعلیم بھی یہی نظر آئے گی۔" : "Start with the core guide. Doctor-assigned learning will also appear here."}</Text>
          </View>
        </Card>
      )}

      <SectionHeading title={contentLanguage === "ur" ? "انٹرایکٹو لرننگ" : "Interactive Learning"} subtitle={contentLanguage === "ur" ? "بصری اثرات کے ذریعے مناظر کا تعلیمی موازنہ کریں۔" : "Explore how visual effects change familiar scenes."} rtl={isRTL} />
      <Card variant="accent" style={styles.simulatorCard} onPress={() => router.push("/vision-simulator" as any)} accessibilityLabel="Open Vision Experience Simulator">
        <View style={styles.simulatorIcon}><Ionicons name="git-compare-outline" size={26} color={colors.teal800} /></View>
        <View style={styles.articleBody}>
          <Text style={[styles.articleCategory, isRTL && styles.urduText]}>VISION EXPERIENCE LAB</Text>
          <Text style={[styles.cardTitle, isRTL && styles.urduText]}>Vision Experience Simulator</Text>
          <Text style={[styles.articleDescription, isRTL && styles.urduText]}>{contentLanguage === "ur" ? "اصل اور تبدیل شدہ منظر کا موازنہ کرنے کے لیے سلائیڈر کھسکائیں، یا اپنی تصویر منتخب کریں۔" : "Compare the original scene with visual effects, explore each effect, or try your own image."}</Text>
        </View>
        <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={21} color={colors.teal800} />
      </Card>

      <SectionHeading title={contentLanguage === "ur" ? "موضوعات" : "Categories"} subtitle={contentLanguage === "ur" ? "اپنی دلچسپی کے مطابق مواد فلٹر کریں۔" : "Filter the library by topic."} rtl={isRTL} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
        <CategoryChip active={category === "all"} label={contentLanguage === "ur" ? "سب" : "All"} icon="apps-outline" onPress={() => setCategory("all")} />
        {educationCategories.map((item) => <CategoryChip key={item.key} active={category === item.key} label={localized(item.shortLabel, contentLanguage)} icon={item.icon} onPress={() => setCategory(item.key)} />)}
      </ScrollView>

      <SectionHeading title={contentLanguage === "ur" ? "تازہ مضامین" : "Latest Articles"} subtitle={`${filteredArticles.length} ${contentLanguage === "ur" ? "مضامین" : "articles"}`} rtl={isRTL} />
      <View style={styles.articleList}>
        {filteredArticles.map((article) => (
          <Card key={article.id} style={styles.articleCard} onPress={() => router.push(`/education/${article.id}` as any)} accessibilityLabel={localized(article.title, contentLanguage)}>
            <EducationArtwork image={article.image} compact />
            <View style={styles.articleBody}>
              <Text style={[styles.articleCategory, isRTL && styles.urduText]}>{localized(getEducationCategory(article.category).label, contentLanguage)}</Text>
              <Text style={[styles.cardTitle, isRTL && styles.urduText]}>{localized(article.title, contentLanguage)}</Text>
              <Text style={[styles.articleDescription, isRTL && styles.urduText]} numberOfLines={2}>{localized(article.shortDescription, contentLanguage)}</Text>
              <View style={[styles.metaRow, isRTL && styles.rtl]}>
                <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                <Text style={styles.cardMeta}>{article.readingMinutes} {contentLanguage === "ur" ? "منٹ مطالعہ" : "min read"}</Text>
                {article.languages.includes("ur") ? <View style={styles.languageBadge}><Text style={styles.languageBadgeText}>EN / اردو</Text></View> : null}
              </View>
            </View>
            <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color={colors.textMuted} />
          </Card>
        ))}
        {!filteredArticles.length ? <Card><Text style={[styles.muted, isRTL && styles.urduText]}>{contentLanguage === "ur" ? "اس فلٹر میں کوئی مضمون نہیں ملا۔" : "No articles match this filter."}</Text></Card> : null}
      </View>

      <SectionHeading title={contentLanguage === "ur" ? "قابلِ اعتماد ویڈیوز" : "Trusted Videos"} subtitle={contentLanguage === "ur" ? "سرکاری National Eye Institute ویڈیوز نئی ونڈو میں کھلتی ہیں۔" : "Official National Eye Institute videos open externally."} rtl={isRTL} />
      <View style={styles.videoList}>
        {educationVideos.map((video) => (
          <Card key={video.id} style={styles.videoCard} onPress={() => void Linking.openURL(video.trustedUrl)} accessibilityRole="link" accessibilityLabel={localized(video.title, contentLanguage)}>
            <EducationArtwork image={video.thumbnail} compact />
            <View style={styles.articleBody}>
              <View style={[styles.videoSourceRow, isRTL && styles.rtl]}><Ionicons name="shield-checkmark" size={14} color={colors.teal800} /><Text style={styles.videoSource}>{video.source}</Text></View>
              <Text style={[styles.cardTitle, isRTL && styles.urduText]}>{localized(video.title, contentLanguage)}</Text>
              <Text style={[styles.articleDescription, isRTL && styles.urduText]} numberOfLines={2}>{localized(video.description, contentLanguage)}</Text>
              <Text style={styles.cardMeta}>{video.duration}</Text>
            </View>
            <Ionicons name="open-outline" size={20} color={colors.teal800} />
          </Card>
        ))}
      </View>

      <Card variant="bordered" style={styles.disclaimer}>
        <Ionicons name="information-circle-outline" size={22} color={colors.info} />
        <Text style={[styles.disclaimerText, isRTL && styles.urduText]}>{contentLanguage === "ur" ? "یہ لائبریری تعلیمی معلومات فراہم کرتی ہے۔ یہ تشخیص، ہنگامی طبی مدد یا آپ کے ڈاکٹر کے ذاتی علاج کے مشورے کا متبادل نہیں۔" : "This library provides educational information. It does not replace diagnosis, urgent eye care or individualized advice from your clinician."}</Text>
      </Card>
    </AppShell>
  );
}

function SectionHeading({ title, subtitle, rtl }: { title: string; subtitle: string; rtl: boolean }) {
  return <View style={[styles.sectionHeading, rtl && styles.rtl]}><View><Text style={[styles.sectionTitle, rtl && styles.urduText]}>{title}</Text><Text style={[styles.sectionSubtitle, rtl && styles.urduText]}>{subtitle}</Text></View></View>;
}

function CategoryChip({ active, label, icon, onPress }: { active: boolean; label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return <TouchableOpacity onPress={onPress} style={[styles.categoryChip, active && styles.categoryChipActive]} accessibilityRole="button" accessibilityState={{ selected: active }}><Ionicons name={icon} size={17} color={active ? colors.navyInk : colors.teal800} /><Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{label}</Text></TouchableOpacity>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  rtl: { flexDirection: "row-reverse" },
  urduText: { textAlign: "right", writingDirection: "rtl" },
  header: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start", marginBottom: spacing.lg },
  headerIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: colors.teal100, alignItems: "center", justifyContent: "center" },
  eyebrow: { color: colors.teal800, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, letterSpacing: 1.3, marginBottom: 4 },
  title: { color: colors.textPrimary, fontSize: typography.sizes.h2, fontWeight: typography.weights.bold },
  subtitle: { color: colors.textSecondary, fontSize: typography.sizes.small, lineHeight: 21, marginTop: 5 },
  searchWrap: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, gap: spacing.sm },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: typography.sizes.body, minHeight: 46 },
  sectionHeading: { marginTop: spacing.xl, marginBottom: spacing.sm },
  sectionTitle: { color: colors.textPrimary, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold },
  sectionSubtitle: { color: colors.textMuted, fontSize: typography.sizes.xs, marginTop: 3 },
  horizontalRow: { gap: spacing.sm, paddingRight: spacing.md },
  recommendedCard: { width: 330, flexDirection: "row", gap: spacing.md, padding: spacing.md },
  recommendedBody: { flex: 1, justifyContent: "center", minWidth: 0 },
  recommendedBadge: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 5 },
  recommendedBadgeText: { color: colors.teal800, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, flexShrink: 1 },
  loadingCard: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  emptyRecommended: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  categoryRow: { gap: spacing.sm, paddingRight: spacing.md },
  categoryChip: { minHeight: 42, paddingHorizontal: spacing.md, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 7 },
  categoryChipActive: { backgroundColor: colors.neonAqua, borderColor: colors.neonAqua },
  categoryChipText: { color: colors.textSecondary, fontSize: typography.sizes.small, fontWeight: typography.weights.semibold },
  categoryChipTextActive: { color: colors.navyInk },
  articleList: { gap: spacing.sm },
  articleCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  articleBody: { flex: 1, minWidth: 0 },
  articleCategory: { color: colors.teal800, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold, letterSpacing: 0.5, marginBottom: 3 },
  cardTitle: { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.bold, lineHeight: 21 },
  articleDescription: { color: colors.textSecondary, fontSize: typography.sizes.xs, lineHeight: 18, marginTop: 4 },
  cardMeta: { color: colors.textMuted, fontSize: typography.sizes.tiny },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 7, flexWrap: "wrap" },
  languageBadge: { backgroundColor: colors.teal50, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 4 },
  languageBadgeText: { color: colors.teal800, fontSize: 10, fontWeight: typography.weights.bold },
  simulatorCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  simulatorIcon: { width: 52, height: 52, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: colors.teal100, borderWidth: 1, borderColor: colors.teal200 },
  videoList: { gap: spacing.sm },
  videoCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  videoSourceRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 },
  videoSource: { color: colors.teal800, fontSize: typography.sizes.tiny, fontWeight: typography.weights.bold },
  disclaimer: { marginTop: spacing.xl, flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  disclaimerText: { flex: 1, color: colors.textSecondary, fontSize: typography.sizes.xs, lineHeight: 19 },
  muted: { color: colors.textSecondary, fontSize: typography.sizes.small, lineHeight: 20 },
});
