from __future__ import annotations

import base64
import hashlib
import io
import os
import re
import secrets
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Optional
from xml.sax.saxutils import escape as xml_escape

from bson import ObjectId
from gridfs import GridFS, NoFile
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors as rl_colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

try:
    import arabic_reshaper
except Exception:  # pragma: no cover - optional until Urdu is used
    arabic_reshaper = None

try:
    from bidi.algorithm import get_display as bidi_get_display
except Exception:  # pragma: no cover - optional until Urdu is used
    bidi_get_display = None


PDF_REPORT_KIND = "AutomatedMedicalPDF"
PDF_REPORT_TYPE = "Automated DR Medical Report"
REPORT_DISCLAIMER_EN = (
    "This automated report is intended for diabetic-retinopathy screening and clinical decision support only. "
    "It is not a definitive diagnosis and does not replace a comprehensive examination by a qualified ophthalmologist. "
    "Seek urgent medical care for sudden vision loss, severe eye pain, flashes/floaters, or other acute symptoms."
)
REPORT_DISCLAIMER_UR = (
    "یہ خودکار رپورٹ ذیابیطس ریٹینوپیتھی کی اسکریننگ اور طبی معاونت کے لیے ہے۔ "
    "یہ حتمی تشخیص نہیں ہے اور ماہرِ امراضِ چشم کے مکمل معائنے کا متبادل نہیں۔ "
    "اچانک نظر کم ہونے، شدید آنکھ کے درد، روشنی کی چمک یا نئے فلوٹرز کی صورت میں فوری طبی مدد حاصل کریں۔"
)

DRH_NAVY = rl_colors.HexColor("#082A31")
DRH_DARK = rl_colors.HexColor("#061B24")
DRH_TEAL = rl_colors.HexColor("#0DB7A7")
DRH_AQUA = rl_colors.HexColor("#27E5C6")
DRH_BLUE = rl_colors.HexColor("#4CC9F0")
DRH_TEXT = rl_colors.HexColor("#102A2F")
DRH_MUTED = rl_colors.HexColor("#5E777B")
DRH_LIGHT = rl_colors.HexColor("#F0FBF9")
DRH_BORDER = rl_colors.HexColor("#D7E7E5")
DRH_WARNING_BG = rl_colors.HexColor("#FFF4D6")
DRH_WARNING_TEXT = rl_colors.HexColor("#9A5B00")


@dataclass
class ReportContext:
    patient_id: str
    patient_name: str
    patient_email: str
    patient_mobile: str
    patient_age: str
    patient_gender: str
    screening_date: str
    classification: str
    confidence: str
    risk_score: str
    hba1c: str
    diabetes_duration: str
    findings: list[str]
    recommendations: list[str]
    interpretation: str
    adherence_percent: Optional[float]
    adherence_taken: int
    adherence_expected: int
    adherence_missed: int
    adherence_skipped: int
    gradcam_bytes: Optional[bytes]


def _safe_text(value: Any, fallback: str = "Not recorded") -> str:
    if value is None:
        return fallback
    text = str(value).strip()
    return text if text else fallback


def _safe_float(value: Any) -> Optional[float]:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, dict):
        for key in ("score", "value", "percent"):
            if key in value:
                return _safe_float(value[key])
        return None
    try:
        return float(str(value).strip().rstrip("%"))
    except (TypeError, ValueError):
        return None


def _format_percent(value: Any) -> str:
    numeric = _safe_float(value)
    if numeric is None:
        return "Not available"
    if 0 <= numeric <= 1:
        numeric *= 100
    return f"{numeric:.1f}%".replace(".0%", "%")


def _format_risk(value: Any) -> str:
    numeric = _safe_float(value)
    if numeric is None:
        return "Not available"
    return f"{numeric:.1f}/100".replace(".0/100", "/100")


def _prediction_stage(prediction: dict) -> str:
    for key in (
        "stage",
        "diagnosis",
        "disease",
        "classification",
        "drStage",
        "dr_stage",
        "severityLabel",
    ):
        if prediction.get(key) not in (None, ""):
            return str(prediction[key])
    return "Analysis unavailable"


def _prediction_risk(prediction: dict) -> Any:
    for key in ("riskScore", "risk_score", "risk"):
        if prediction.get(key) not in (None, ""):
            return prediction[key]
    return None


def _prediction_date(prediction: dict) -> str:
    for key in ("screeningDate", "date", "createdAt", "created_at", "updatedAt", "updated_at"):
        value = prediction.get(key)
        if isinstance(value, datetime):
            return value.strftime("%Y-%m-%d %H:%M")
        if value:
            return str(value)
    return "Not available"


def _as_object_id(value: str) -> Optional[ObjectId]:
    try:
        return ObjectId(value)
    except Exception:
        return None


def patient_id_variants(patient_id: str) -> list[Any]:
    values: list[Any] = [str(patient_id)]
    oid = _as_object_id(str(patient_id))
    if oid is not None:
        values.append(oid)
    return values


def find_prediction(db, prediction_id: str) -> Optional[dict]:
    oid = _as_object_id(prediction_id)
    if oid is None:
        return None
    return db["predictions"].find_one({"_id": oid})


def prediction_belongs_to_patient(prediction: dict, patient_id: str) -> bool:
    return str(prediction.get("patientId", "")) == str(patient_id)


def _load_user(db, patient_id: str) -> dict:
    oid = _as_object_id(patient_id)
    if oid is not None:
        user = db["users"].find_one({"_id": oid})
        if user:
            return user
    return db["users"].find_one({"_id": patient_id}) or {}


def _load_patient_profile(db, patient_id: str) -> dict:
    variants = patient_id_variants(patient_id)
    return db["patient_profiles"].find_one({"userId": {"$in": variants}}) or {}


def _latest_health_metric(db, patient_id: str) -> dict:
    variants = patient_id_variants(patient_id)
    return db["health_metrics"].find_one(
        {"patientId": {"$in": variants}},
        sort=[("recordedAt", -1), ("createdAt", -1)],
    ) or {}


def _parse_date(value: Any) -> Optional[date]:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if value in (None, ""):
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _prescription_active_on(doc: dict, target: date) -> bool:
    start_day = _parse_date(doc.get("startDate") or doc.get("date"))
    end_day = _parse_date(doc.get("endDate"))
    stopped_day = _parse_date(doc.get("stoppedAt"))
    if start_day and target < start_day:
        return False
    if end_day and target > end_day:
        return False
    if stopped_day and target >= stopped_day:
        return False
    if doc.get("active") is False and not stopped_day:
        return False
    return True


def _dose_keys(doc: dict) -> list[str]:
    raw = doc.get("times") or []
    if not isinstance(raw, list):
        raw = [raw]
    result: list[str] = []
    for value in raw:
        text = str(value).strip()
        if text and text not in result:
            result.append(text)
    return result or ["Daily"]


def medication_adherence_summary(db, patient_id: str, days: int = 30) -> dict:
    today = datetime.utcnow().date()
    start = today - timedelta(days=max(1, days) - 1)
    variants = patient_id_variants(patient_id)
    prescriptions = list(db["prescriptions"].find({"patientId": {"$in": variants}}))
    records = list(
        db["medication_adherence"].find(
            {
                "patientId": {"$in": variants},
                "scheduledDate": {"$gte": start.isoformat(), "$lte": today.isoformat()},
            }
        )
    )

    exact: dict[tuple[str, str, str], dict] = {}
    legacy: dict[tuple[str, str], dict] = {}
    for record in records:
        day_key = str(record.get("scheduledDate") or "")
        prescription_id = str(record.get("prescriptionId") or "")
        dose_key = str(record.get("doseKey") or "Daily")
        exact[(day_key, prescription_id, dose_key)] = record
        if dose_key == "Daily":
            legacy[(day_key, prescription_id)] = record

    expected = taken = missed = skipped = 0
    for offset in range((today - start).days + 1):
        current = start + timedelta(days=offset)
        day_key = current.isoformat()
        for prescription in prescriptions:
            if not _prescription_active_on(prescription, current):
                continue
            prescription_id = str(prescription.get("_id"))
            dose_keys = _dose_keys(prescription)
            for index, dose_key in enumerate(dose_keys):
                expected += 1
                record = exact.get((day_key, prescription_id, dose_key))
                if record is None and index == 0 and dose_key != "Daily":
                    record = legacy.get((day_key, prescription_id))
                status = str((record or {}).get("status") or ("Missed" if current < today else "Pending"))
                if status == "Taken":
                    taken += 1
                elif status == "Missed":
                    missed += 1
                elif status == "Skipped":
                    skipped += 1

    percent = round((taken / expected) * 100, 1) if expected else None
    return {
        "days": days,
        "percent": percent,
        "taken": taken,
        "expected": expected,
        "missed": missed,
        "skipped": skipped,
    }


def _diabetes_duration(profile: dict, user: dict, prediction: dict) -> str:
    for source in (profile, user, prediction):
        for key in (
            "diabetesDuration",
            "diabetes_duration",
            "diabetesDurationYears",
            "durationOfDiabetes",
        ):
            value = source.get(key)
            if value not in (None, ""):
                text = str(value).strip()
                if re.fullmatch(r"\d+(?:\.\d+)?", text):
                    return f"{text} years"
                return text
        since = source.get("diabetesSince") or source.get("diabetes_since")
        parsed = _parse_date(since)
        if parsed:
            years = max(0.0, (datetime.utcnow().date() - parsed).days / 365.25)
            return f"{years:.1f} years"
    return "Not recorded"


def _normalize_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        parts = [part.strip(" -•\t") for part in re.split(r"[\n;]+", value)]
        return [part for part in parts if part]
    return [str(value).strip()]


def _fallback_recommendations(stage: str) -> list[str]:
    label = stage.lower()
    if any(term in label for term in ("proliferative", "severe", "pdr")):
        return [
            "Arrange prompt ophthalmology review.",
            "Maintain strict diabetes, blood-pressure, and lipid control with your treating clinician.",
            "Seek urgent assessment if there is sudden vision change, flashes, floaters, or eye pain.",
        ]
    if "moderate" in label:
        return [
            "Schedule ophthalmology/retina follow-up according to the clinician's recommended interval.",
            "Optimize glucose and blood-pressure control and continue prescribed medicines.",
            "Repeat retinal screening as advised by your eye-care professional.",
        ]
    if "mild" in label:
        return [
            "Continue regular diabetic eye examinations.",
            "Maintain glucose, blood-pressure, and lipid control.",
            "Return earlier if vision changes occur.",
        ]
    return [
        "Continue routine diabetic retinal screening at the interval recommended by your clinician.",
        "Maintain good glucose, blood-pressure, and medication control.",
    ]


def _clinical_interpretation(prediction: dict, stage: str, confidence: str, risk_score: str) -> str:
    for key in ("clinicalInterpretation", "interpretation", "summary", "assessment"):
        value = prediction.get(key)
        if value not in (None, ""):
            return str(value).strip()
    return (
        f"The automated retinal screening classified this image as {stage}. "
        f"Model confidence is {confidence} and the recorded risk score is {risk_score}. "
        "This result should be interpreted together with the patient's clinical history and confirmed by an eye-care professional."
    )


def _decode_possible_image(value: Any, db) -> Optional[bytes]:
    if value is None:
        return None
    if isinstance(value, (bytes, bytearray)):
        return bytes(value)
    if isinstance(value, dict):
        for key in ("fileId", "file_id", "id", "data", "base64", "image"):
            if key in value:
                decoded = _decode_possible_image(value[key], db)
                if decoded:
                    return decoded
        return None
    if not isinstance(value, str):
        return None

    text = value.strip()
    if not text:
        return None
    if text.startswith("data:image") and "," in text:
        try:
            return base64.b64decode(text.split(",", 1)[1])
        except Exception:
            return None
    if ObjectId.is_valid(text):
        try:
            grid_out = GridFS(db).get(ObjectId(text))
            return grid_out.read()
        except (NoFile, Exception):
            return None
    try:
        if len(text) > 128 and re.fullmatch(r"[A-Za-z0-9+/=\s]+", text):
            return base64.b64decode(text)
    except Exception:
        pass
    return None


def extract_gradcam_bytes(db, prediction: dict) -> Optional[bytes]:
    containers = [prediction]
    for nested_key in ("explainability", "gradcam", "gradCam", "analysis", "prediction"):
        nested = prediction.get(nested_key)
        if isinstance(nested, dict):
            containers.append(nested)

    keys = (
        "gradCamFileId",
        "gradcamFileId",
        "grad_cam_file_id",
        "heatmapFileId",
        "gradCamImage",
        "gradcamImage",
        "gradCAM",
        "gradCam",
        "gradcam",
        "heatmap",
    )
    for container in containers:
        for key in keys:
            if key in container:
                decoded = _decode_possible_image(container.get(key), db)
                if decoded:
                    return decoded
    return None


def build_report_context(db, prediction: dict) -> ReportContext:
    patient_id = str(prediction.get("patientId") or "")
    user = _load_user(db, patient_id)
    profile = _load_patient_profile(db, patient_id)
    health = _latest_health_metric(db, patient_id)
    adherence = medication_adherence_summary(db, patient_id, days=30)

    patient_name = (
        profile.get("name")
        or user.get("name")
        or " ".join(
            value
            for value in (
                user.get("first_name") or profile.get("firstName"),
                user.get("last_name") or profile.get("lastName"),
            )
            if value
        )
        or "Patient"
    )
    stage = _prediction_stage(prediction)
    confidence = _format_percent(prediction.get("confidence"))
    risk_score = _format_risk(_prediction_risk(prediction))
    findings = _normalize_list(prediction.get("findings") or prediction.get("clinicalFindings"))
    recommendations = _normalize_list(prediction.get("recommendations")) or _fallback_recommendations(stage)

    hba1c_value = health.get("hba1c")
    hba1c = f"{float(hba1c_value):.1f}%" if hba1c_value is not None else "Not recorded"

    return ReportContext(
        patient_id=patient_id,
        patient_name=_safe_text(patient_name, "Patient"),
        patient_email=_safe_text(profile.get("email") or user.get("email")),
        patient_mobile=_safe_text(profile.get("mobile") or user.get("mobile")),
        patient_age=_safe_text(profile.get("age") if profile.get("age") not in (None, "") else user.get("age")),
        patient_gender=_safe_text(profile.get("gender") or user.get("gender")),
        screening_date=_prediction_date(prediction),
        classification=stage,
        confidence=confidence,
        risk_score=risk_score,
        hba1c=hba1c,
        diabetes_duration=_diabetes_duration(profile, user, prediction),
        findings=findings,
        recommendations=recommendations,
        interpretation=_clinical_interpretation(prediction, stage, confidence, risk_score),
        adherence_percent=adherence["percent"],
        adherence_taken=adherence["taken"],
        adherence_expected=adherence["expected"],
        adherence_missed=adherence["missed"],
        adherence_skipped=adherence["skipped"],
        gradcam_bytes=extract_gradcam_bytes(db, prediction),
    )


def build_clinical_summary(db, prediction: dict) -> dict:
    context = build_report_context(db, prediction)
    findings = "; ".join(context.findings) if context.findings else "No specific structured findings were saved with this screening."
    adherence = (
        f"Medication adherence over the last 30 days: {context.adherence_percent:.1f}% "
        f"({context.adherence_taken}/{context.adherence_expected} scheduled doses taken)."
        if context.adherence_percent is not None
        else "Medication adherence: no active scheduled-dose history is available."
    )
    overview = (
        f"{context.patient_name}; age {context.patient_age}; screening date {context.screening_date}. "
        f"Latest HbA1c: {context.hba1c}. Diabetes duration: {context.diabetes_duration}. {adherence}"
    )
    assessment = (
        f"DR classification: {context.classification}. Confidence: {context.confidence}. "
        f"Risk score: {context.risk_score}. {context.interpretation}"
    )
    return {
        "predictionId": str(prediction.get("_id")),
        "overview": overview,
        "findings": findings,
        "assessment": assessment,
        "recommendations": "\n".join(f"• {item}" for item in context.recommendations),
        "source": "Stored screening, health metrics, and medication-adherence records",
        "isAiGenerated": True,
    }


def _find_urdu_font() -> Optional[str]:
    configured = os.getenv("PDF_URDU_FONT_PATH", "").strip()
    candidates = [
        configured,
        r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\tahoma.ttf",
        r"C:\Windows\Fonts\NotoNaskhArabic-Regular.ttf",
        "/usr/share/fonts/opentype/noto/NotoNaskhArabic-Regular.ttf",
        "/usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return candidate
    return None


def _prepare_urdu_font() -> str:
    path = _find_urdu_font()
    if not path:
        raise RuntimeError(
            "No Urdu-capable system font was found. Set PDF_URDU_FONT_PATH to an installed Unicode font path."
        )
    font_name = "DRHUrdu"
    if font_name not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont(font_name, path))
    return font_name


def _rtl(text: str) -> str:
    if not text:
        return text
    if arabic_reshaper is None or bidi_get_display is None:
        raise RuntimeError(
            "Urdu PDF support requires arabic-reshaper and python-bidi. Install backend requirements first."
        )
    return bidi_get_display(arabic_reshaper.reshape(text))


def _label(language: str, en: str, ur: str) -> str:
    return _rtl(ur) if language == "ur" else en


def _paragraph_text(value: Any, language: str = "en", rtl_static: bool = False) -> str:
    text = _safe_text(value)
    if language == "ur" and rtl_static:
        text = _rtl(text)
    return xml_escape(text).replace("\n", "<br/>")


def _styles(language: str) -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    font = "Helvetica"
    bold = "Helvetica-Bold"
    align = TA_LEFT
    if language == "ur":
        font = _prepare_urdu_font()
        bold = font
        align = TA_RIGHT

    return {
        "title": ParagraphStyle(
            "DRHTitle",
            parent=base["Title"],
            fontName=bold,
            fontSize=21,
            leading=25,
            textColor=rl_colors.white,
            alignment=TA_CENTER,
            spaceAfter=0,
        ),
        "subtitle": ParagraphStyle(
            "DRHSubtitle",
            parent=base["Normal"],
            fontName=font,
            fontSize=8.5,
            leading=11,
            textColor=rl_colors.HexColor("#CBEFEB"),
            alignment=TA_CENTER,
        ),
        "section": ParagraphStyle(
            "DRHSection",
            parent=base["Heading2"],
            fontName=bold,
            fontSize=11.5,
            leading=14,
            textColor=DRH_NAVY,
            alignment=align,
            spaceBefore=2,
            spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "DRHBody",
            parent=base["BodyText"],
            fontName=font,
            fontSize=9.2,
            leading=13.2,
            textColor=DRH_TEXT,
            alignment=align,
        ),
        "small": ParagraphStyle(
            "DRHSmall",
            parent=base["BodyText"],
            fontName=font,
            fontSize=7.6,
            leading=10.2,
            textColor=DRH_MUTED,
            alignment=align,
        ),
        "metricLabel": ParagraphStyle(
            "DRHMetricLabel",
            parent=base["BodyText"],
            fontName=font,
            fontSize=7.5,
            leading=9,
            textColor=DRH_MUTED,
            alignment=TA_CENTER,
        ),
        "metricValue": ParagraphStyle(
            "DRHMetricValue",
            parent=base["BodyText"],
            fontName=bold,
            fontSize=13,
            leading=16,
            textColor=DRH_NAVY,
            alignment=TA_CENTER,
        ),
        "disclaimer": ParagraphStyle(
            "DRHDisclaimer",
            parent=base["BodyText"],
            fontName=font,
            fontSize=7.8,
            leading=11,
            textColor=DRH_WARNING_TEXT,
            alignment=align,
        ),
    }


def _section_title(text: str, styles: dict[str, ParagraphStyle]) -> Table:
    table = Table([[Paragraph(xml_escape(text), styles["section"])]], colWidths=[174 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), DRH_LIGHT),
                ("BOX", (0, 0), (-1, -1), 0.6, DRH_BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    return table


def _key_value_table(rows: list[tuple[str, str]], styles: dict[str, ParagraphStyle], rtl: bool = False) -> Table:
    prepared = []
    ordered = list(rows)
    for key, value in ordered:
        key_p = Paragraph(xml_escape(key), styles["small"])
        value_p = Paragraph(xml_escape(value), styles["body"])
        prepared.append([value_p, key_p] if rtl else [key_p, value_p])
    widths = [54 * mm, 120 * mm] if not rtl else [120 * mm, 54 * mm]
    table = Table(prepared, colWidths=widths, hAlign="RIGHT" if rtl else "LEFT")
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LINEBELOW", (0, 0), (-1, -2), 0.35, DRH_BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def _metric_card(label: str, value: str, styles: dict[str, ParagraphStyle]) -> Table:
    table = Table(
        [[Paragraph(xml_escape(value), styles["metricValue"])], [Paragraph(xml_escape(label), styles["metricLabel"])]],
        colWidths=[53 * mm],
        rowHeights=[12 * mm, 8 * mm],
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), rl_colors.white),
                ("BOX", (0, 0), (-1, -1), 0.8, DRH_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    return table


def _qr_drawing(url: str, size: float = 31 * mm) -> Drawing:
    qr = QrCodeWidget(url)
    bounds = qr.getBounds()
    width = bounds[2] - bounds[0]
    height = bounds[3] - bounds[1]
    drawing = Drawing(size, size, transform=[size / width, 0, 0, size / height, 0, 0])
    drawing.add(qr)
    return drawing


def build_pdf_bytes(
    context: ReportContext,
    report_number: str,
    report_id: str,
    verification_url: str,
    language: str = "en",
) -> bytes:
    language = "ur" if str(language).lower().startswith("ur") else "en"
    styles = _styles(language)
    rtl = language == "ur"
    buffer = io.BytesIO()

    def page_decor(canvas, doc):
        canvas.saveState()
        width, height = A4
        canvas.setFillColor(DRH_DARK)
        canvas.rect(0, height - 13 * mm, width, 13 * mm, fill=1, stroke=0)
        canvas.setFillColor(DRH_AQUA)
        canvas.rect(0, height - 13.7 * mm, width, 0.7 * mm, fill=1, stroke=0)
        canvas.setFont("Helvetica-Bold", 8)
        canvas.setFillColor(rl_colors.white)
        canvas.drawString(18 * mm, height - 8.5 * mm, "DR HEALTHCARE")
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(rl_colors.HexColor("#CBEFEB"))
        canvas.drawRightString(width - 18 * mm, height - 8.5 * mm, report_number)
        canvas.setStrokeColor(DRH_BORDER)
        canvas.line(18 * mm, 13 * mm, width - 18 * mm, 13 * mm)
        canvas.setFillColor(DRH_MUTED)
        canvas.setFont("Helvetica", 6.8)
        canvas.drawString(18 * mm, 8.5 * mm, "DR Healthcare • Automated retinal screening report")
        canvas.drawRightString(width - 18 * mm, 8.5 * mm, f"Page {doc.page}")
        canvas.restoreState()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=20 * mm,
        bottomMargin=18 * mm,
        title=f"DR Healthcare Medical Report {report_number}",
        author="DR Healthcare",
        subject="Automated diabetic retinopathy screening report",
    )

    story: list[Any] = []

    header_text = _label(language, "Automated Medical Report", "خودکار طبی رپورٹ")
    header_sub = _label(
        language,
        "Diabetic Retinopathy Screening • Clinical Decision Support",
        "ذیابیطس ریٹینوپیتھی اسکریننگ • طبی معاونت",
    )
    header = Table(
        [
            [Paragraph("DR Healthcare", styles["title"])],
            [Paragraph(xml_escape(header_text), styles["title"])],
            [Paragraph(xml_escape(header_sub), styles["subtitle"])],
        ],
        colWidths=[174 * mm],
    )
    header.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), DRH_NAVY),
                ("TOPPADDING", (0, 0), (-1, 0), 10),
                ("BOTTOMPADDING", (0, 2), (-1, 2), 10),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    story.extend([header, Spacer(1, 7 * mm)])

    story.append(_section_title(_label(language, "Patient Information", "مریض کی معلومات"), styles))
    story.append(Spacer(1, 2 * mm))
    patient_rows = [
        (_label(language, "Patient", "مریض"), context.patient_name),
        (_label(language, "Patient ID", "مریض آئی ڈی"), context.patient_id),
        (_label(language, "Age / Gender", "عمر / جنس"), f"{context.patient_age} / {context.patient_gender}"),
        (_label(language, "Email", "ای میل"), context.patient_email),
        (_label(language, "Mobile", "موبائل"), context.patient_mobile),
        (_label(language, "Screening Date", "اسکریننگ کی تاریخ"), context.screening_date),
    ]
    story.append(_key_value_table(patient_rows, styles, rtl=rtl))
    story.append(Spacer(1, 5 * mm))

    story.append(_section_title(_label(language, "Screening Summary", "اسکریننگ خلاصہ"), styles))
    story.append(Spacer(1, 3 * mm))
    metrics = Table(
        [[
            _metric_card(_label(language, "DR Classification", "DR درجہ بندی"), context.classification, styles),
            _metric_card(_label(language, "Confidence", "اعتماد"), context.confidence, styles),
            _metric_card(_label(language, "Risk Score", "رسک اسکور"), context.risk_score, styles),
        ]],
        colWidths=[58 * mm, 58 * mm, 58 * mm],
    )
    metrics.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 2), ("RIGHTPADDING", (0, 0), (-1, -1), 2)]))
    story.extend([metrics, Spacer(1, 5 * mm)])

    story.append(_section_title(_label(language, "Grad-CAM Explainability", "Grad-CAM وضاحتی نقشہ"), styles))
    story.append(Spacer(1, 3 * mm))
    if context.gradcam_bytes:
        try:
            image = Image(io.BytesIO(context.gradcam_bytes), width=96 * mm, height=72 * mm, kind="proportional")
            image.hAlign = "CENTER"
            story.append(image)
            story.append(Spacer(1, 2 * mm))
            story.append(
                Paragraph(
                    xml_escape(_label(language, "Highlighted regions show areas that most influenced the model output.", "نمایاں حصے وہ علاقے دکھاتے ہیں جنہوں نے ماڈل کے نتیجے پر زیادہ اثر ڈالا۔")),
                    styles["small"],
                )
            )
        except Exception:
            context.gradcam_bytes = None
    if not context.gradcam_bytes:
        placeholder = Table(
            [[Paragraph(xml_escape(_label(language, "Grad-CAM image is not available for this screening record.", "اس اسکریننگ کے لیے Grad-CAM تصویر دستیاب نہیں ہے۔")), styles["body"])]],
            colWidths=[174 * mm],
            rowHeights=[28 * mm],
        )
        placeholder.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), DRH_LIGHT), ("BOX", (0, 0), (-1, -1), 0.7, DRH_BORDER), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("ALIGN", (0, 0), (-1, -1), "CENTER")]))
        story.append(placeholder)
    story.append(Spacer(1, 5 * mm))

    story.append(_section_title(_label(language, "Diabetes & Medication Context", "ذیابیطس اور ادویات کا خلاصہ"), styles))
    story.append(Spacer(1, 2 * mm))
    adherence_text = (
        f"{context.adherence_percent:.1f}% — {context.adherence_taken}/{context.adherence_expected} doses taken; "
        f"{context.adherence_missed} missed; {context.adherence_skipped} skipped"
        if context.adherence_percent is not None
        else "No active medication adherence history available"
    )
    diabetes_rows = [
        (_label(language, "Latest HbA1c", "تازہ HbA1c"), context.hba1c),
        (_label(language, "Diabetes Duration", "ذیابیطس کا دورانیہ"), context.diabetes_duration),
        (_label(language, "30-day Medication Adherence", "30 روزہ ادویات کی پابندی"), adherence_text),
    ]
    story.append(_key_value_table(diabetes_rows, styles, rtl=rtl))
    story.append(Spacer(1, 5 * mm))

    story.append(_section_title(_label(language, "Clinical Interpretation", "طبی تشریح"), styles))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(_paragraph_text(context.interpretation), styles["body"]))
    story.append(Spacer(1, 4 * mm))

    findings_title = _section_title(_label(language, "Clinical Findings", "طبی مشاہدات"), styles)
    if context.findings:
        first_finding = Paragraph(f"• {xml_escape(context.findings[0])}", styles["body"])
        story.append(KeepTogether([findings_title, Spacer(1, 2 * mm), first_finding, Spacer(1, 1.2 * mm)]))
        for finding in context.findings[1:]:
            story.append(Paragraph(f"• {xml_escape(finding)}", styles["body"]))
            story.append(Spacer(1, 1.2 * mm))
    else:
        no_findings = Paragraph(xml_escape(_label(language, "No structured lesion findings were stored for this screening.", "اس اسکریننگ کے لیے تفصیلی مشاہدات محفوظ نہیں ہیں۔")), styles["body"])
        story.append(KeepTogether([findings_title, Spacer(1, 2 * mm), no_findings]))
    story.append(Spacer(1, 4 * mm))

    recommendations_title = _section_title(_label(language, "Recommendations", "سفارشات"), styles)
    if context.recommendations:
        first_recommendation = Paragraph(f"• {xml_escape(context.recommendations[0])}", styles["body"])
        story.append(KeepTogether([recommendations_title, Spacer(1, 2 * mm), first_recommendation, Spacer(1, 1.5 * mm)]))
        for recommendation in context.recommendations[1:]:
            story.append(Paragraph(f"• {xml_escape(recommendation)}", styles["body"]))
            story.append(Spacer(1, 1.5 * mm))
    story.append(Spacer(1, 4 * mm))

    qr = _qr_drawing(verification_url)
    verification_text = [
        [Paragraph(xml_escape(_label(language, "Report Verification", "رپورٹ کی تصدیق")), styles["section"]), qr],
        [Paragraph(xml_escape(f"{_label(language, 'Unique Report ID', 'منفرد رپورٹ آئی ڈی')}: {report_number}"), styles["body"]), ""],
        [Paragraph(xml_escape(_label(language, "Scan the QR code to verify that this report was generated by DR Healthcare.", "QR کوڈ اسکین کر کے رپورٹ کی تصدیق کریں۔")), styles["small"]), ""],
    ]
    verification = Table(verification_text, colWidths=[137 * mm, 37 * mm])
    verification.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), DRH_LIGHT), ("BOX", (0, 0), (-1, -1), 0.7, DRH_BORDER), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("SPAN", (0, 1), (0, 1)), ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
    story.extend([verification, Spacer(1, 5 * mm)])

    disclaimer = REPORT_DISCLAIMER_UR if language == "ur" else REPORT_DISCLAIMER_EN
    if language == "ur":
        disclaimer = _rtl(disclaimer)
    disclaimer_box = Table([[Paragraph(xml_escape(disclaimer), styles["disclaimer"])]], colWidths=[174 * mm])
    disclaimer_box.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), DRH_WARNING_BG), ("BOX", (0, 0), (-1, -1), 0.7, rl_colors.HexColor("#F2DCA2")), ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7)]))
    story.append(disclaimer_box)

    doc.build(story, onFirstPage=page_decor, onLaterPages=page_decor)
    return buffer.getvalue()


def _hash_verification_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def verify_report_code(report: dict, code: str) -> bool:
    stored = str(report.get("verificationCodeHash") or "")
    supplied = _hash_verification_code(code or "")
    return bool(stored) and secrets.compare_digest(stored, supplied)


def report_number_for(report_id: str, created_at: datetime) -> str:
    return f"DRH-{created_at.strftime('%Y%m%d')}-{report_id[-8:].upper()}"


def _report_metadata(report: dict, reused: bool = False) -> dict:
    created = report.get("generatedAt") or report.get("created_at")
    if isinstance(created, datetime):
        created = created.isoformat()
    return {
        "reportId": str(report.get("_id")),
        "reportNumber": report.get("reportNumber"),
        "predictionId": str(report.get("predictionId") or ""),
        "language": report.get("language", "en"),
        "fileName": report.get("fileName", "medical-report.pdf"),
        "status": report.get("status", "Completed"),
        "generatedAt": created,
        "downloadUrl": f"/api/patient/reports/{report.get('_id')}/download",
        "reused": reused,
    }


def list_prediction_reports(db, patient_id: str, prediction_id: str) -> list[dict]:
    docs = list(
        db["reports"].find(
            {
                "patientId": {"$in": patient_id_variants(patient_id)},
                "predictionId": str(prediction_id),
                "reportKind": PDF_REPORT_KIND,
                "status": "Completed",
                "fileId": {"$nin": [None, ""]},
            }
        ).sort("created_at", -1)
    )
    return [_report_metadata(doc) for doc in docs]


def generate_or_get_report(
    db,
    prediction: dict,
    language: str,
    public_base_url: str,
    generated_by_user_id: str,
    generated_by_role: str,
    force: bool = False,
) -> dict:
    language = "ur" if str(language).lower().startswith("ur") else "en"
    patient_id = str(prediction.get("patientId") or "")
    prediction_id = str(prediction.get("_id"))

    if not force:
        existing = db["reports"].find_one(
            {
                "patientId": {"$in": patient_id_variants(patient_id)},
                "predictionId": prediction_id,
                "reportKind": PDF_REPORT_KIND,
                "language": language,
                "status": "Completed",
                "fileId": {"$nin": [None, ""]},
            },
            sort=[("created_at", -1)],
        )
        if existing:
            return _report_metadata(existing, reused=True)

    now = datetime.utcnow()
    verification_code = secrets.token_urlsafe(18)
    pending_doc = {
        "reportType": PDF_REPORT_TYPE,
        "reportKind": PDF_REPORT_KIND,
        "patientId": patient_id,
        "predictionId": prediction_id,
        "language": language,
        "generatedByUserId": str(generated_by_user_id),
        "generatedByRole": generated_by_role,
        "uploaderRole": "System",
        "source": "Automated Screening Report",
        "status": "Generating",
        "fileName": "",
        "fileId": "",
        "verificationCodeHash": _hash_verification_code(verification_code),
        "uploadDate": now.strftime("%Y-%m-%d"),
        "generatedAt": now,
        "created_at": now,
        "updated_at": now,
    }
    insert = db["reports"].insert_one(pending_doc)
    report_id = str(insert.inserted_id)
    report_number = report_number_for(report_id, now)
    db["reports"].update_one({"_id": insert.inserted_id}, {"$set": {"reportNumber": report_number}})

    public_base_url = public_base_url.rstrip("/") + "/"
    verification_url = f"{public_base_url}api/reports/verify/{report_id}?code={verification_code}"

    try:
        context = build_report_context(db, prediction)
        pdf_bytes = build_pdf_bytes(
            context=context,
            report_number=report_number,
            report_id=report_id,
            verification_url=verification_url,
            language=language,
        )
        suffix = "ur" if language == "ur" else "en"
        file_name = f"DR-Healthcare-{report_number}-{suffix}.pdf"
        fs = GridFS(db)
        file_id = fs.put(
            pdf_bytes,
            filename=file_name,
            content_type="application/pdf",
            metadata={
                "reportId": report_id,
                "patientId": patient_id,
                "predictionId": prediction_id,
                "language": language,
                "reportKind": PDF_REPORT_KIND,
            },
        )

        completed_at = datetime.utcnow()
        db["reports"].update_one(
            {"_id": insert.inserted_id},
            {
                "$set": {
                    "status": "Completed",
                    "fileName": file_name,
                    "fileId": str(file_id),
                    "fileSize": len(pdf_bytes),
                    "generatedAt": completed_at,
                    "updated_at": completed_at,
                    "screeningDate": context.screening_date,
                    "classification": context.classification,
                }
            },
        )

        db["patient_history"].update_one(
            {
                "patientId": patient_id,
                "sourceId": report_id,
                "type": "Report",
            },
            {
                "$set": {
                    "patientId": patient_id,
                    "sourceId": report_id,
                    "type": "Report",
                    "title": f"Automated DR Medical Report ({language.upper()})",
                    "date": completed_at.strftime("%Y-%m-%d"),
                    "status": "Completed",
                    "created_at": completed_at,
                }
            },
            upsert=True,
        )

        report = db["reports"].find_one({"_id": insert.inserted_id})
        return _report_metadata(report or {**pending_doc, "_id": insert.inserted_id, "reportNumber": report_number, "fileName": file_name, "status": "Completed"})
    except Exception as exc:
        db["reports"].update_one(
            {"_id": insert.inserted_id},
            {"$set": {"status": "Failed", "updated_at": datetime.utcnow(), "generationError": str(exc)[:500]}},
        )
        raise
