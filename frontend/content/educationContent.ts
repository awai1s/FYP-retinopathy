import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

export type EducationLanguage = "en" | "ur";
export type EducationCategoryKey =
  | "dr"
  | "diabetes"
  | "screening"
  | "safety"
  | "medication"
  | "lifestyle"
  | "warning";

export type EducationImageKey =
  | "retina"
  | "screening"
  | "glucose"
  | "safety"
  | "medicine"
  | "lifestyle"
  | "warning"
  | "treatment";

export interface LocalizedText {
  en: string;
  ur?: string;
}

export interface EducationSection {
  heading: LocalizedText;
  body: LocalizedText;
  bullets?: Array<LocalizedText>;
}

export interface EducationSource {
  title: string;
  url: string;
}

export interface EducationArticle {
  id: string;
  title: LocalizedText;
  shortDescription: LocalizedText;
  category: EducationCategoryKey;
  readingMinutes: number;
  image: EducationImageKey;
  content: EducationSection[];
  languages: EducationLanguage[];
  source: EducationSource;
  featured?: boolean;
  updatedAt: string;
}

export interface EducationCategory {
  key: EducationCategoryKey;
  label: LocalizedText;
  shortLabel: LocalizedText;
  icon: ComponentProps<typeof Ionicons>["name"];
}

export interface EducationVideo {
  id: string;
  title: LocalizedText;
  thumbnail: EducationImageKey;
  trustedUrl: string;
  duration: string;
  description: LocalizedText;
  source: string;
}

export const educationCategories: EducationCategory[] = [
  { key: "dr", label: { en: "Diabetic Retinopathy", ur: "ذیابیطس ریٹینوپیتھی" }, shortLabel: { en: "DR Basics", ur: "DR کی بنیادی باتیں" }, icon: "eye-outline" },
  { key: "diabetes", label: { en: "Diabetes & Eye Health", ur: "ذیابیطس اور آنکھوں کی صحت" }, shortLabel: { en: "Diabetes", ur: "ذیابیطس" }, icon: "water-outline" },
  { key: "screening", label: { en: "Eye Screening", ur: "آنکھوں کی اسکریننگ" }, shortLabel: { en: "Screening", ur: "اسکریننگ" }, icon: "scan-outline" },
  { key: "safety", label: { en: "Eye Safety", ur: "آنکھوں کی حفاظت" }, shortLabel: { en: "Eye Safety", ur: "آنکھوں کی حفاظت" }, icon: "shield-checkmark-outline" },
  { key: "medication", label: { en: "Medication", ur: "ادویات" }, shortLabel: { en: "Medication", ur: "ادویات" }, icon: "medkit-outline" },
  { key: "lifestyle", label: { en: "Lifestyle", ur: "طرزِ زندگی" }, shortLabel: { en: "Lifestyle", ur: "طرزِ زندگی" }, icon: "walk-outline" },
  { key: "warning", label: { en: "Warning Signs", ur: "انتباہی علامات" }, shortLabel: { en: "Warning Signs", ur: "انتباہی علامات" }, icon: "warning-outline" },
];

export const educationArticles: EducationArticle[] = [
  {
    id: "understanding_dr",
    title: { en: "Understanding Diabetic Retinopathy", ur: "ذیابیطس ریٹینوپیتھی کو سمجھیں" },
    shortDescription: { en: "What DR is, why it can develop quietly, and why screening matters.", ur: "DR کیا ہے، یہ خاموشی سے کیوں بڑھ سکتی ہے، اور اسکریننگ کیوں اہم ہے۔" },
    category: "dr",
    readingMinutes: 5,
    image: "retina",
    featured: true,
    languages: ["en", "ur"],
    updatedAt: "2026-09-24",
    source: { title: "National Eye Institute — Diabetic Retinopathy", url: "https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/diabetic-retinopathy" },
    content: [
      {
        heading: { en: "What happens in DR?", ur: "DR میں کیا ہوتا ہے؟" },
        body: { en: "Diabetic retinopathy is an eye condition related to diabetes. Over time, high blood glucose can damage small blood vessels in the retina, the light-sensitive tissue at the back of the eye.", ur: "ذیابیطس ریٹینوپیتھی ذیابیطس سے متعلق آنکھ کی بیماری ہے۔ وقت کے ساتھ زیادہ خون کی شکر ریٹینا کی باریک خون کی نالیوں کو نقصان پہنچا سکتی ہے۔" },
      },
      {
        heading: { en: "Why regular screening matters", ur: "باقاعدہ اسکریننگ کیوں ضروری ہے" },
        body: { en: "Early diabetic retinopathy may not cause noticeable symptoms. A person can feel that vision is normal while retinal changes are already present, so scheduled eye examinations remain important.", ur: "ابتدائی ذیابیطس ریٹینوپیتھی میں واضح علامات نہ بھی ہوں۔ نظر ٹھیک محسوس ہونے کے باوجود ریٹینا میں تبدیلیاں ہو سکتی ہیں، اس لیے مقررہ آنکھوں کے معائنے اہم ہیں۔" },
      },
      {
        heading: { en: "How EyeCare AI should be used", ur: "EyeCare AI کو کیسے استعمال کریں" },
        body: { en: "EyeCare AI is designed for screening and decision support. A screening result can help organize follow-up, but it does not replace a comprehensive eye examination or a clinician's diagnosis.", ur: "EyeCare AI اسکریننگ اور فیصلہ سازی میں مدد کے لیے بنایا گیا ہے۔ اسکریننگ نتیجہ فالو اَپ ترتیب دینے میں مدد دے سکتا ہے، مگر یہ مکمل آنکھوں کے معائنے یا ڈاکٹر کی تشخیص کا متبادل نہیں۔" },
      },
    ],
  },
  {
    id: "understanding_moderate_dr",
    title: { en: "Understanding Moderate DR", ur: "Moderate DR کو سمجھیں" },
    shortDescription: { en: "What a moderate screening label can mean and why follow-up should not be delayed.", ur: "Moderate اسکریننگ لیبل کا کیا مطلب ہو سکتا ہے اور فالو اَپ میں تاخیر کیوں نہیں ہونی چاہیے۔" },
    category: "dr",
    readingMinutes: 4,
    image: "retina",
    languages: ["en", "ur"],
    updatedAt: "2026-09-23",
    source: { title: "National Eye Institute — Diabetic Retinopathy", url: "https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/diabetic-retinopathy" },
    content: [
      {
        heading: { en: "A screening stage is not a final diagnosis", ur: "اسکریننگ مرحلہ حتمی تشخیص نہیں" },
        body: { en: "A Moderate DR label suggests that retinal changes may be more than very early disease. The exact findings, whether swelling is present, and the correct follow-up interval require assessment by an eye-care professional.", ur: "Moderate DR کا لیبل اس بات کی طرف اشارہ کر سکتا ہے کہ ریٹینا میں تبدیلیاں بہت ابتدائی مرحلے سے زیادہ ہیں۔ درست علامات، سوجن کی موجودگی اور مناسب فالو اَپ کا فیصلہ ماہرِ چشم کرے گا۔" },
      },
      {
        heading: { en: "What to do next", ur: "اگلا قدم کیا ہو" },
        body: { en: "Keep the clinician follow-up recommended for your result, continue diabetes care, and seek earlier review if vision changes suddenly or new concerning symptoms appear.", ur: "اپنے نتیجے کے مطابق تجویز کردہ ڈاکٹر فالو اَپ پر عمل کریں، ذیابیطس کی دیکھ بھال جاری رکھیں، اور اگر نظر اچانک بدلے یا نئی تشویش ناک علامات ہوں تو جلد معائنہ کرائیں۔" },
      },
    ],
  },
  {
    id: "diabetes_eye_health",
    title: { en: "Diabetes and Eye Health", ur: "ذیابیطس اور آنکھوں کی صحت" },
    shortDescription: { en: "How long-term glucose, blood pressure and cholesterol control support eye health.", ur: "طویل مدتی شوگر، بلڈ پریشر اور کولیسٹرول کا کنٹرول آنکھوں کی صحت میں کیسے مدد دیتا ہے۔" },
    category: "diabetes",
    readingMinutes: 5,
    image: "glucose",
    languages: ["en", "ur"],
    updatedAt: "2026-09-22",
    source: { title: "CDC — Vision Loss and Diabetes", url: "https://www.cdc.gov/diabetes/diabetes-complications/diabetes-and-vision-loss.html" },
    content: [
      {
        heading: { en: "Think long term", ur: "طویل مدتی سوچیں" },
        body: { en: "Diabetes-related eye risk is influenced by long-term health, not a single reading. Following the treatment plan created with your clinician can reduce risk or slow progression of eye complications.", ur: "ذیابیطس سے متعلق آنکھوں کا خطرہ صرف ایک ریڈنگ سے نہیں بلکہ طویل مدتی صحت سے متاثر ہوتا ہے۔ ڈاکٹر کے ساتھ طے کردہ علاج کے منصوبے پر عمل خطرہ کم کرنے یا پیچیدگیوں کی رفتار سست کرنے میں مدد دے سکتا ہے۔" },
        bullets: [
          { en: "Keep scheduled diabetes and eye-care appointments.", ur: "ذیابیطس اور آنکھوں کے مقررہ معائنے جاری رکھیں۔" },
          { en: "Manage blood glucose, blood pressure and cholesterol with your care team.", ur: "اپنی نگہداشت ٹیم کے ساتھ بلڈ شوگر، بلڈ پریشر اور کولیسٹرول کو منظم کریں۔" },
          { en: "Avoid smoking and stay active as medically appropriate.", ur: "تمباکو سے پرہیز کریں اور ڈاکٹر کی ہدایت کے مطابق جسمانی سرگرمی رکھیں۔" },
        ],
      },
    ],
  },
  {
    id: "screening_followup",
    title: { en: "Eye Screening and Follow-up", ur: "آنکھوں کی اسکریننگ اور فالو اَپ" },
    shortDescription: { en: "Why a normal-feeling eye can still need a scheduled retinal examination.", ur: "نظر ٹھیک محسوس ہونے کے باوجود مقررہ ریٹینل معائنہ کیوں ضروری ہو سکتا ہے۔" },
    category: "screening",
    readingMinutes: 4,
    image: "screening",
    languages: ["en", "ur"],
    updatedAt: "2026-09-21",
    source: { title: "National Eye Institute — Diabetic Retinopathy", url: "https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/diabetic-retinopathy" },
    content: [
      {
        heading: { en: "Screen before symptoms", ur: "علامات سے پہلے اسکریننگ" },
        body: { en: "Diabetic retinopathy can develop before a person notices vision problems. Regular comprehensive eye examinations can detect changes earlier and help determine the correct follow-up schedule.", ur: "ذیابیطس ریٹینوپیتھی نظر کی شکایت محسوس ہونے سے پہلے شروع ہو سکتی ہے۔ باقاعدہ مکمل آنکھوں کے معائنے تبدیلیاں جلد پکڑنے اور مناسب فالو اَپ طے کرنے میں مدد دیتے ہیں۔" },
      },
      {
        heading: { en: "Bring useful information", ur: "ضروری معلومات ساتھ لائیں" },
        body: { en: "Bring recent diabetes information, your medication list, previous eye reports and any new symptoms to an eye appointment. EyeCare AI can help keep these records organized, but your clinician decides the examination and care plan.", ur: "آنکھوں کے معائنے پر حالیہ ذیابیطس معلومات، ادویات کی فہرست، پچھلی رپورٹس اور نئی علامات ساتھ رکھیں۔ EyeCare AI ریکارڈ منظم رکھنے میں مدد دے سکتا ہے، لیکن معائنہ اور علاج کا فیصلہ ڈاکٹر کرتا ہے۔" },
      },
    ],
  },
  {
    id: "warning_signs",
    title: { en: "Eye Warning Signs That Need Attention", ur: "آنکھوں کی وہ علامات جن پر توجہ ضروری ہے" },
    shortDescription: { en: "Recognize symptoms that should prompt timely or urgent professional eye care.", ur: "ان علامات کو پہچانیں جن میں جلد یا فوری ماہرِ چشم سے رابطہ ضروری ہو سکتا ہے۔" },
    category: "warning",
    readingMinutes: 4,
    image: "warning",
    languages: ["en", "ur"],
    updatedAt: "2026-09-20",
    source: { title: "CDC — Taking Care of Your Eyes", url: "https://www.cdc.gov/vision-health/prevention/taking-care-of-your-eyes.html" },
    content: [
      {
        heading: { en: "Do not wait on sudden changes", ur: "اچانک تبدیلیوں میں انتظار نہ کریں" },
        body: { en: "Sudden or major vision loss, severe eye pain, new flashes, many new floaters, a curtain-like shadow, double vision, or rapidly worsening symptoms need prompt professional assessment.", ur: "اچانک یا شدید نظر کی کمی، شدید آنکھ درد، نئی چمک، بہت زیادہ نئے فلوٹرز، پردہ سا آنا، دوہرا نظر آنا یا تیزی سے بگڑتی علامات میں فوری طبی معائنہ ضروری ہے۔" },
      },
      {
        heading: { en: "Use the app without delaying care", ur: "ایپ استعمال کریں مگر علاج میں تاخیر نہ کریں" },
        body: { en: "An app can help organize information, but urgent symptoms should not wait for a screening result, chatbot answer or routine appointment.", ur: "ایپ معلومات منظم کرنے میں مدد دے سکتی ہے، مگر فوری علامات میں اسکریننگ نتیجے، چیٹ بوٹ جواب یا معمول کے اپائنٹمنٹ کا انتظار نہیں کرنا چاہیے۔" },
      },
    ],
  },
  {
    id: "medication_eye_health",
    title: { en: "Medication: Keep an Accurate List", ur: "ادویات: درست فہرست برقرار رکھیں" },
    shortDescription: { en: "Why dose history, doctor prescriptions and self-added medicines should stay clearly separated.", ur: "خوراک کی تاریخ، ڈاکٹر کی نسخہ شدہ ادویات اور خود شامل ادویات کو واضح طور پر الگ رکھنا کیوں ضروری ہے۔" },
    category: "medication",
    readingMinutes: 4,
    image: "medicine",
    languages: ["en", "ur"],
    updatedAt: "2026-09-19",
    source: { title: "EyeCare AI — Medication Tracker", url: "" },
    content: [
      {
        heading: { en: "Track what was actually taken", ur: "جو خوراک واقعی لی گئی اسے ریکارڈ کریں" },
        body: { en: "Dose-level tracking helps distinguish what was scheduled from what was actually taken, missed or skipped. This history can make medication review during a consultation clearer.", ur: "خوراک کی سطح پر ریکارڈ رکھنے سے مقررہ اور حقیقت میں لی گئی، چھوٹی یا چھوڑ دی گئی خوراک میں فرق واضح رہتا ہے۔ یہ تاریخ ڈاکٹر سے ادویات کے جائزے میں مدد دے سکتی ہے۔" },
      },
      {
        heading: { en: "Do not change prescribed treatment on your own", ur: "نسخہ شدہ علاج خود سے تبدیل نہ کریں" },
        body: { en: "Do not stop, double or change a prescribed dose only because of an app reminder or missed dose. Follow the instructions from the clinician who manages the medicine.", ur: "صرف ایپ کی یاد دہانی یا چھوٹی ہوئی خوراک کی وجہ سے نسخہ شدہ دوا بند، دوگنی یا تبدیل نہ کریں۔ متعلقہ ڈاکٹر کی ہدایات پر عمل کریں۔" },
      },
    ],
  },
  {
    id: "eye_safety",
    title: { en: "Everyday Eye Safety", ur: "روزمرہ آنکھوں کی حفاظت" },
    shortDescription: { en: "Simple habits that reduce avoidable eye injury and protect vision.", ur: "سادہ عادات جو قابلِ بچاؤ آنکھوں کی چوٹ کم کرنے اور نظر کی حفاظت میں مدد دیتی ہیں۔" },
    category: "safety",
    readingMinutes: 4,
    image: "safety",
    languages: ["en", "ur"],
    updatedAt: "2026-09-18",
    source: { title: "CDC — Taking Care of Your Eyes", url: "https://www.cdc.gov/vision-health/prevention/taking-care-of-your-eyes.html" },
    content: [
      {
        heading: { en: "Protect your eyes from injury", ur: "آنکھوں کو چوٹ سے بچائیں" },
        body: { en: "Use appropriate protective eyewear for work, sports or tasks that can send particles, chemicals or debris toward the eyes. Follow product and workplace safety instructions.", ur: "کام، کھیل یا ایسے کاموں میں مناسب حفاظتی چشمہ استعمال کریں جن میں ذرات، کیمیکل یا ملبہ آنکھ میں جا سکتا ہو۔ پروڈکٹ اور کام کی حفاظتی ہدایات پر عمل کریں۔" },
      },
      {
        heading: { en: "Healthy screen habits", ur: "اسکرین کے بہتر استعمال کی عادات" },
        body: { en: "Long screen sessions can cause discomfort or dryness in some people. Regular breaks, blinking and an appropriate viewing setup may help comfort, but persistent symptoms still deserve professional review.", ur: "طویل اسکرین استعمال سے بعض افراد میں خشکی یا بے آرامی ہو سکتی ہے۔ وقفے، پلک جھپکنا اور مناسب اسکرین سیٹ اپ مدد دے سکتے ہیں، لیکن مسلسل علامات کا معائنہ ضروری ہے۔" },
      },
    ],
  },
  {
    id: "healthy_lifestyle",
    title: { en: "Lifestyle Habits for Diabetes and Eye Health", ur: "ذیابیطس اور آنکھوں کی صحت کے لیے طرزِ زندگی" },
    shortDescription: { en: "Daily habits that support the wider diabetes plan linked to long-term eye health.", ur: "روزمرہ عادات جو ذیابیطس کے مجموعی منصوبے اور طویل مدتی آنکھوں کی صحت میں مدد دیتی ہیں۔" },
    category: "lifestyle",
    readingMinutes: 5,
    image: "lifestyle",
    languages: ["en", "ur"],
    updatedAt: "2026-09-17",
    source: { title: "CDC — Vision Loss and Diabetes", url: "https://www.cdc.gov/diabetes/diabetes-complications/diabetes-and-vision-loss.html" },
    content: [
      {
        heading: { en: "Support the whole health plan", ur: "مجموعی صحت کے منصوبے کو سپورٹ کریں" },
        body: { en: "Eye health is connected to overall diabetes care. Follow the nutrition, activity, medication and monitoring plan agreed with your clinical team rather than relying on one single habit or supplement.", ur: "آنکھوں کی صحت مجموعی ذیابیطس دیکھ بھال سے جڑی ہے۔ کسی ایک عادت یا سپلیمنٹ پر انحصار کرنے کے بجائے اپنی کلینیکل ٹیم کے ساتھ طے شدہ غذا، سرگرمی، دوا اور مانیٹرنگ کے منصوبے پر عمل کریں۔" },
        bullets: [
          { en: "Keep regular medical and eye appointments.", ur: "باقاعدہ طبی اور آنکھوں کے اپائنٹمنٹ رکھیں۔" },
          { en: "Stay physically active as appropriate for your health.", ur: "اپنی صحت کے مطابق جسمانی سرگرمی رکھیں۔" },
          { en: "Avoid smoking and discuss support if you need help quitting.", ur: "تمباکو سے پرہیز کریں اور چھوڑنے میں مدد چاہیے تو ڈاکٹر سے بات کریں۔" },
        ],
      },
    ],
  },
  {
    id: "dr_treatment",
    title: { en: "How Diabetic Retinopathy Is Treated", ur: "ذیابیطس ریٹینوپیتھی کا علاج کیسے ہوتا ہے" },
    shortDescription: { en: "An overview of treatments an eye specialist may consider after examination.", ur: "معائنے کے بعد ماہرِ چشم جن علاجوں پر غور کر سکتا ہے ان کا خلاصہ۔" },
    category: "dr",
    readingMinutes: 5,
    image: "treatment",
    languages: ["en", "ur"],
    updatedAt: "2026-09-16",
    source: { title: "National Eye Institute — Diabetic Retinopathy", url: "https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/diabetic-retinopathy" },
    content: [
      {
        heading: { en: "Treatment depends on the eye findings", ur: "علاج آنکھ کی علامات پر منحصر ہے" },
        body: { en: "Depending on severity and specific findings, an eye specialist may consider injections, laser treatment or surgery. Not every person needs the same treatment, and some stages may be monitored rather than treated immediately.", ur: "شدت اور مخصوص علامات کے مطابق ماہرِ چشم انجیکشن، لیزر یا سرجری پر غور کر سکتا ہے۔ ہر مریض کا علاج ایک جیسا نہیں ہوتا اور بعض مراحل میں فوری علاج کے بجائے نگرانی کی جاتی ہے۔" },
      },
      {
        heading: { en: "Screening does not choose treatment", ur: "اسکریننگ علاج منتخب نہیں کرتی" },
        body: { en: "A screening label or risk score cannot determine which treatment is right. Treatment decisions require a clinical examination and discussion of benefits, risks and alternatives.", ur: "اسکریننگ لیبل یا رسک اسکور یہ طے نہیں کر سکتا کہ کون سا علاج درست ہے۔ علاج کا فیصلہ کلینیکل معائنے اور فوائد، خطرات اور متبادل پر گفتگو کے بعد ہوتا ہے۔" },
      },
    ],
  },
  {
    id: "prepare_eye_exam",
    title: { en: "Prepare for an Eye Appointment", ur: "آنکھوں کے اپائنٹمنٹ کی تیاری" },
    shortDescription: { en: "A practical checklist for making a consultation more useful.", ur: "اپنی آنکھوں کی مشاورت کو زیادہ مفید بنانے کے لیے ایک عملی چیک لسٹ۔" },
    category: "screening",
    readingMinutes: 3,
    image: "screening",
    languages: ["en", "ur"],
    updatedAt: "2026-09-15",
    source: { title: "National Eye Institute — Diabetic Retinopathy", url: "https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/diabetic-retinopathy" },
    content: [
      {
        heading: { en: "Bring the information your clinician may need", ur: "وہ معلومات ساتھ لائیں جو ڈاکٹر کو درکار ہو سکتی ہیں" },
        body: { en: "A short, accurate history is more useful than trying to remember everything during the visit.", ur: "مختصر اور درست تاریخ اپائنٹمنٹ کے دوران سب کچھ یاد کرنے کی کوشش سے زیادہ مفید ہوتی ہے۔" },
        bullets: [
          { en: "Your current medication list and recent changes.", ur: "اپنی موجودہ ادویات کی فہرست اور حالیہ تبدیلیاں۔" },
          { en: "Recent HbA1c or diabetes information if available.", ur: "اگر دستیاب ہو تو حالیہ HbA1c یا ذیابیطس معلومات۔" },
          { en: "Previous retinal reports or screening summaries.", ur: "پچھلی ریٹینل رپورٹس یا اسکریننگ خلاصے۔" },
          { en: "A list of new symptoms and when they started.", ur: "نئی علامات اور ان کے شروع ہونے کا وقت۔" },
        ],
      },
    ],
  },
];

export const educationVideos: EducationVideo[] = [
  {
    id: "nei-dr-animation",
    title: { en: "Animation: Diabetic Retinopathy", ur: "اینیمیشن: ذیابیطس ریٹینوپیتھی" },
    thumbnail: "retina",
    trustedUrl: "https://www.youtube.com/watch?v=m4h43UIKqs4",
    duration: "Short animation",
    description: { en: "An official National Eye Institute animation showing how diabetic eye disease can affect the retina.", ur: "نیشنل آئی انسٹی ٹیوٹ کی سرکاری اینیمیشن جو دکھاتی ہے کہ ذیابیطس آنکھ کے ریٹینا کو کیسے متاثر کر سکتی ہے۔" },
    source: "National Eye Institute, NIH",
  },
  {
    id: "nei-see-what-i-see-dr",
    title: { en: "See What I See: Diabetic Retinopathy", ur: "See What I See: ذیابیطس ریٹینوپیتھی" },
    thumbnail: "warning",
    trustedUrl: "https://www.youtube.com/watch?v=CXJ7mL_q990",
    duration: "Short experience",
    description: { en: "An official NEI visual experience illustrating how vision loss related to diabetic retinopathy may affect everyday scenes.", ur: "NEI کا سرکاری بصری تجربہ جو دکھاتا ہے کہ ذیابیطس ریٹینوپیتھی سے متعلق نظر کی کمی روزمرہ مناظر کو کیسے متاثر کر سکتی ہے۔" },
    source: "National Eye Institute, NIH",
  },
];

export const localized = (value: LocalizedText, language: EducationLanguage): string =>
  language === "ur" && value.ur ? value.ur : value.en;

export const getEducationArticle = (id: string | undefined | null): EducationArticle | undefined =>
  educationArticles.find((article) => article.id === String(id || ""));

export const getEducationCategory = (key: EducationCategoryKey): EducationCategory =>
  educationCategories.find((category) => category.key === key) || educationCategories[0];
