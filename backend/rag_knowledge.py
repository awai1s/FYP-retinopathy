"""Small bilingual knowledge base for the EyeCare AI RAG assistant.

The goal is reliability, not a giant scraped corpus. Each chunk is intentionally
short, bilingual, and tied to a public eye-health source. The retriever in
``rag_service.py`` scores both the English and Urdu fields, so an Urdu question
can retrieve the same clinical topic without translating the user's text first.
"""

KNOWLEDGE_BASE = [
    {
        "id": "dr_overview",
        "title_en": "What diabetic retinopathy is",
        "title_ur": "ذیابیطس ریٹینوپیتھی کیا ہے",
        "source_title": "National Eye Institute — Diabetic Retinopathy",
        "url": "https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/diabetic-retinopathy",
        "keywords": [
            "diabetic retinopathy", "dr", "retina", "retinal", "diabetes eye disease",
            "ذیابیطس ریٹینوپیتھی", "ریٹینا", "آنکھ", "شوگر", "ذیابیطس"
        ],
        "answer_en": (
            "Diabetic retinopathy is an eye condition caused by diabetes. Persistently high blood sugar can damage "
            "the small blood vessels in the retina, the light-sensitive tissue at the back of the eye. The condition "
            "can progress without obvious early symptoms, so screening is important even when vision feels normal."
        ),
        "answer_ur": (
            "ذیابیطس ریٹینوپیتھی آنکھ کی ایک بیماری ہے جو ذیابیطس کی وجہ سے ہوتی ہے۔ مسلسل زیادہ خون کی شکر "
            "ریٹینا کی باریک خون کی نالیوں کو نقصان پہنچا سکتی ہے۔ ابتدائی مرحلے میں اکثر واضح علامات نہیں ہوتیں، "
            "اس لیے نظر ٹھیک محسوس ہونے کے باوجود باقاعدہ آنکھوں کی اسکریننگ اہم ہے۔"
        ),
    },
    {
        "id": "dr_stages",
        "title_en": "Stages of diabetic retinopathy",
        "title_ur": "ذیابیطس ریٹینوپیتھی کے مراحل",
        "source_title": "CDC — About Common Eye Disorders and Diseases",
        "url": "https://www.cdc.gov/vision-health/about-eye-disorders/index.html",
        "keywords": [
            "stage", "stages", "mild", "moderate", "severe", "proliferative", "npdr", "pdr",
            "مرحلہ", "مراحل", "ہلکی", "درمیانی", "شدید", "پرولیفریٹو"
        ],
        "answer_en": (
            "Diabetic retinopathy is commonly described from early nonproliferative disease through more severe "
            "nonproliferative disease to proliferative diabetic retinopathy. Your EyeCare AI project uses five labels: "
            "No DR, Mild, Moderate, Severe, and Proliferative DR. A screening label should not be treated as a final "
            "clinical diagnosis; an eye-care professional should confirm important findings."
        ),
        "answer_ur": (
            "ذیابیطس ریٹینوپیتھی کو ابتدائی نان پرولیفریٹو بیماری سے لے کر شدید نان پرولیفریٹو اور پھر پرولیفریٹو "
            "مرحلے تک بیان کیا جاتا ہے۔ EyeCare AI میں پانچ لیبل استعمال ہوتے ہیں: No DR، Mild، Moderate، Severe "
            "اور Proliferative DR۔ اسکریننگ کا نتیجہ حتمی طبی تشخیص نہیں ہے؛ اہم نتائج کی تصدیق ماہرِ امراضِ چشم سے کرائیں۔"
        ),
    },
    {
        "id": "dr_symptoms",
        "title_en": "Symptoms and warning signs",
        "title_ur": "علامات اور انتباہی نشانیاں",
        "source_title": "CDC — Vision Loss and Diabetes",
        "url": "https://www.cdc.gov/diabetes/diabetes-complications/diabetes-and-vision-loss.html",
        "keywords": [
            "symptom", "symptoms", "blur", "blurry", "floaters", "spots", "vision loss", "flashes",
            "علامت", "علامات", "دھندلا", "فلوٹر", "دھبے", "نظر کم", "چمک"
        ],
        "answer_en": (
            "Early diabetic retinopathy may cause no symptoms. Later symptoms can include blurry vision, spots or dark "
            "shapes, difficulty seeing colors, dark or empty areas, and vision loss. Sudden new flashes, many floaters, "
            "a curtain-like shadow, sudden major vision loss, or severe eye pain need urgent professional assessment."
        ),
        "answer_ur": (
            "ذیابیطس ریٹینوپیتھی کے ابتدائی مرحلے میں کوئی علامت نہ بھی ہو سکتی ہے۔ بعد میں دھندلا نظر آنا، سیاہ دھبے "
            "یا تیرتے ہوئے نقطے، رنگ پہچاننے میں مشکل، نظر میں خالی حصے یا نظر کم ہونا ہو سکتا ہے۔ اچانک بہت زیادہ فلوٹرز، "
            "روشنی کی چمک، پردہ سا آنا، اچانک شدید نظر کی کمی یا شدید آنکھ کا درد ہو تو فوری طبی معائنہ ضروری ہے۔"
        ),
    },
    {
        "id": "screening_exam",
        "title_en": "Why regular eye screening matters",
        "title_ur": "باقاعدہ آنکھوں کی اسکریننگ کیوں ضروری ہے",
        "source_title": "National Eye Institute — Diabetic Retinopathy",
        "url": "https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/diabetic-retinopathy",
        "keywords": [
            "screening", "eye exam", "dilated exam", "how often", "annual", "yearly",
            "اسکریننگ", "آنکھوں کا معائنہ", "سالانہ", "کتنی بار"
        ],
        "answer_en": (
            "People with diabetes need regular comprehensive eye examinations because diabetic retinopathy can begin "
            "before noticeable symptoms appear. The National Eye Institute advises people with diabetes to have a "
            "comprehensive dilated eye exam at least once a year unless their clinician recommends a different schedule."
        ),
        "answer_ur": (
            "ذیابیطس والے افراد کے لیے باقاعدہ مکمل آنکھوں کا معائنہ اہم ہے کیونکہ ریٹینوپیتھی علامات ظاہر ہونے سے پہلے "
            "شروع ہو سکتی ہے۔ نیشنل آئی انسٹی ٹیوٹ کے مطابق عام طور پر سال میں کم از کم ایک مرتبہ مکمل dilated eye exam "
            "کرانا چاہیے، البتہ آپ کا ڈاکٹر آپ کے حالات کے مطابق مختلف وقفہ تجویز کر سکتا ہے۔"
        ),
    },
    {
        "id": "risk_control",
        "title_en": "Reducing diabetic eye risk",
        "title_ur": "ذیابیطس سے آنکھوں کے خطرے کو کم کرنا",
        "source_title": "CDC — Vision Loss and Diabetes",
        "url": "https://www.cdc.gov/diabetes/diabetes-complications/diabetes-and-vision-loss.html",
        "keywords": [
            "prevent", "prevention", "risk", "blood sugar", "blood pressure", "cholesterol", "smoking",
            "بچاؤ", "خطرہ", "بلڈ شوگر", "بلڈ پریشر", "کولیسٹرول", "تمباکو"
        ],
        "answer_en": (
            "Good diabetes management can reduce the risk or delay progression of diabetes-related eye disease. Important "
            "steps include following your treatment plan, managing blood sugar, blood pressure and cholesterol, avoiding "
            "smoking, staying physically active as medically appropriate, and keeping scheduled eye examinations."
        ),
        "answer_ur": (
            "ذیابیطس کا بہتر کنٹرول آنکھوں کی بیماری کے خطرے کو کم یا اس کی رفتار کو سست کر سکتا ہے۔ اہم اقدامات میں "
            "اپنے علاج کے منصوبے پر عمل، بلڈ شوگر، بلڈ پریشر اور کولیسٹرول کا مناسب کنٹرول، تمباکو سے پرہیز، ڈاکٹر کی "
            "اجازت کے مطابق جسمانی سرگرمی اور مقررہ آنکھوں کے معائنے شامل ہیں۔"
        ),
    },
    {
        "id": "a1c",
        "title_en": "HbA1c and eye health",
        "title_ur": "HbA1c اور آنکھوں کی صحت",
        "source_title": "National Eye Institute — Diabetic Retinopathy",
        "url": "https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/diabetic-retinopathy",
        "keywords": [
            "hba1c", "a1c", "average glucose", "blood sugar", "three months",
            "ایچ بی اے ون سی", "اے ون سی", "اوسط شوگر", "تین ماہ"
        ],
        "answer_en": (
            "HbA1c is a laboratory measure that reflects average blood glucose over roughly the previous three months. "
            "For diabetic retinopathy risk, long-term glucose control matters. Your personal HbA1c target should be set "
            "with your clinician because the appropriate target can differ between people."
        ),
        "answer_ur": (
            "HbA1c ایک لیبارٹری ٹیسٹ ہے جو تقریباً پچھلے تین ماہ کی اوسط خون کی شکر کا اندازہ دیتا ہے۔ ذیابیطس "
            "ریٹینوپیتھی کے خطرے میں طویل مدتی شوگر کنٹرول اہم ہے۔ آپ کا ذاتی HbA1c ہدف آپ کے ڈاکٹر کے ساتھ طے ہونا چاہیے "
            "کیونکہ مناسب ہدف ہر شخص کے لیے مختلف ہو سکتا ہے۔"
        ),
    },
    {
        "id": "pregnancy",
        "title_en": "Diabetes, pregnancy and eye checks",
        "title_ur": "ذیابیطس، حمل اور آنکھوں کا معائنہ",
        "source_title": "National Eye Institute — Diabetic Retinopathy",
        "url": "https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/diabetic-retinopathy",
        "keywords": [
            "pregnant", "pregnancy", "gestational diabetes", "pregnancy eye exam",
            "حمل", "حاملہ", "حمل کی ذیابیطس", "آنکھوں کا معائنہ"
        ],
        "answer_en": (
            "Pregnancy can increase concern for diabetic retinopathy in people who already have diabetes. If you have "
            "diabetes and are pregnant, arrange a comprehensive dilated eye examination promptly and ask your clinician "
            "whether extra eye examinations are needed during pregnancy."
        ),
        "answer_ur": (
            "اگر پہلے سے ذیابیطس ہو تو حمل کے دوران ذیابیطس ریٹینوپیتھی کا خطرہ یا اس میں تبدیلی اہم ہو سکتی ہے۔ اگر آپ "
            "ذیابیطس کے ساتھ حاملہ ہیں تو جلد مکمل dilated eye exam کرائیں اور اپنے ڈاکٹر سے پوچھیں کہ حمل کے دوران مزید "
            "معائنے کتنی بار ضروری ہیں۔"
        ),
    },
    {
        "id": "treatment",
        "title_en": "Treatment of diabetic retinopathy",
        "title_ur": "ذیابیطس ریٹینوپیتھی کا علاج",
        "source_title": "National Eye Institute — Diabetic Retinopathy",
        "url": "https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/diabetic-retinopathy",
        "keywords": [
            "treatment", "anti vegf", "injection", "laser", "surgery", "vitrectomy",
            "علاج", "انجیکشن", "لیزر", "سرجری", "وٹریکٹومی"
        ],
        "answer_en": (
            "Treatment depends on the type and severity of diabetic retinopathy. Eye specialists may use anti-VEGF "
            "injections, laser treatment, corticosteroid treatment in selected cases, or eye surgery such as vitrectomy. "
            "The correct treatment must be chosen after an eye examination; an app screening result cannot select treatment."
        ),
        "answer_ur": (
            "ذیابیطس ریٹینوپیتھی کا علاج اس کی قسم اور شدت پر منحصر ہوتا ہے۔ ماہرِ امراضِ چشم بعض مریضوں میں anti-VEGF "
            "انجیکشن، لیزر، مخصوص صورتوں میں corticosteroid علاج یا vitrectomy جیسی سرجری استعمال کر سکتے ہیں۔ درست علاج "
            "آنکھ کے معائنے کے بعد ڈاکٹر طے کرتا ہے؛ ایپ کی اسکریننگ خود علاج منتخب نہیں کرتی۔"
        ),
    },
    {
        "id": "medication_adherence",
        "title_en": "Medication adherence in EyeCare AI",
        "title_ur": "EyeCare AI میں ادویات کی پابندی",
        "source_title": "EyeCare AI — Medication Tracker",
        "url": "",
        "keywords": [
            "medication", "medicine", "dose", "adherence", "taken", "missed", "skipped", "reminder",
            "دوا", "ادویات", "خوراک", "پابندی", "لی", "چھوٹ گئی", "یاد دہانی"
        ],
        "answer_en": (
            "The Medication Tracker records scheduled doses separately, such as Morning, Noon, Evening and Night. A dose "
            "can be marked Taken, Missed, Skipped or left Pending. These stored dose records are used to build adherence "
            "history and progress trends. Do not change a prescribed dose or stop a medicine only because of an app reminder."
        ),
        "answer_ur": (
            "Medication Tracker میں صبح، دوپہر، شام اور رات کی خوراکیں الگ ریکارڈ ہوتی ہیں۔ ہر خوراک کو Taken، Missed، "
            "Skipped یا Pending رکھا جا سکتا ہے۔ یہی محفوظ ریکارڈ adherence history اور progress trends بنانے کے لیے استعمال "
            "ہوتے ہیں۔ صرف ایپ کی یاد دہانی کی بنیاد پر ڈاکٹر کی تجویز کردہ خوراک تبدیل یا دوا بند نہ کریں۔"
        ),
    },
    {
        "id": "screening_limitations",
        "title_en": "What the retinal screening result means",
        "title_ur": "ریٹینل اسکریننگ کے نتیجے کا مطلب",
        "source_title": "EyeCare AI — Screening Workflow",
        "url": "",
        "keywords": [
            "screening result", "ai result", "confidence", "risk score", "gradcam", "diagnosis",
            "اسکریننگ نتیجہ", "اے آئی نتیجہ", "اعتماد", "رسک اسکور", "گریڈ کیم", "تشخیص"
        ],
        "answer_en": (
            "EyeCare AI is designed as a screening and decision-support system. A DR stage, confidence value, risk score, "
            "findings and Grad-CAM visualization can help organize the screening result, but they do not replace a complete "
            "eye examination or a clinician's diagnosis. Concerning results should be reviewed by an eye-care professional."
        ),
        "answer_ur": (
            "EyeCare AI ایک screening اور decision-support نظام ہے۔ DR stage، confidence، risk score، findings اور Grad-CAM "
            "اسکریننگ کے نتیجے کو سمجھنے میں مدد دیتے ہیں، مگر یہ مکمل آنکھوں کے معائنے یا ڈاکٹر کی حتمی تشخیص کا متبادل نہیں۔ "
            "تشویش ناک نتیجہ ماہرِ امراضِ چشم کو ضرور دکھائیں۔"
        ),
    },
    {
        "id": "emergency",
        "title_en": "When to seek urgent eye care",
        "title_ur": "فوری آنکھوں کی طبی مدد کب لینی چاہیے",
        "source_title": "CDC — Taking Care of Your Eyes",
        "url": "https://www.cdc.gov/vision-health/prevention/taking-care-of-your-eyes.html",
        "keywords": [
            "emergency", "urgent", "sudden vision loss", "eye pain", "flashes", "floaters", "red eye",
            "ایمرجنسی", "فوری", "اچانک نظر", "آنکھ درد", "چمک", "فلوٹر", "لال آنکھ"
        ],
        "answer_en": (
            "Seek prompt professional eye care for sudden or major vision changes, severe eye pain, new flashes or many "
            "floaters, a new dark curtain or blind area, double vision, significant redness with pain, or other rapidly "
            "worsening eye symptoms. The assistant should not delay emergency evaluation."
        ),
        "answer_ur": (
            "اچانک یا شدید نظر کی تبدیلی، شدید آنکھ درد، نئی روشنی کی چمک یا بہت زیادہ فلوٹرز، نظر کے سامنے نیا سیاہ پردہ "
            "یا خالی حصہ، دوہرا نظر آنا، درد کے ساتھ شدید لالی یا تیزی سے بگڑتی علامات میں فوری ماہرِ چشم سے رابطہ کریں۔ "
            "ایسی صورت میں اس اسسٹنٹ کی وجہ سے طبی مدد لینے میں تاخیر نہ کریں۔"
        ),
    },
]
