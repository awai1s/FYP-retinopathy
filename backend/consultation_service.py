"""Shared clinical-encounter helpers for EyeCare AI Phase 10F.

The encounter document stores what happened in a consultation, while live patient
context continues to come from the existing authoritative collections:
`predictions`, `health_metrics`, `prescriptions`, and `reports`.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

from bson import ObjectId
from fastapi import HTTPException


EDUCATION_LIBRARY = [
    {
        "key": "understanding_dr",
        "title": "Understanding Diabetic Retinopathy",
        "description": "A patient-friendly overview of diabetic retinopathy and why screening matters.",
    },
    {
        "key": "understanding_moderate_dr",
        "title": "Understanding Moderate DR",
        "description": "What a moderate diabetic-retinopathy screening result can mean and why follow-up matters.",
    },
    {
        "key": "diabetes_eye_health",
        "title": "Diabetes and Eye Health",
        "description": "How long-term glucose, blood pressure and cholesterol control support eye health.",
    },
    {
        "key": "screening_followup",
        "title": "Eye Screening and Follow-up",
        "description": "Why regular retinal examinations and clinician-directed follow-up are important.",
    },
    {
        "key": "warning_signs",
        "title": "Eye Warning Signs That Need Attention",
        "description": "Symptoms that should prompt timely or urgent professional eye care.",
    },
    {
        "key": "medication_eye_health",
        "title": "Medication: Keep an Accurate List",
        "description": "How dose history and an accurate medication list support safer clinical review.",
    },
    {
        "key": "eye_safety",
        "title": "Everyday Eye Safety",
        "description": "Simple habits that reduce avoidable eye injury and improve everyday eye comfort.",
    },
    {
        "key": "healthy_lifestyle",
        "title": "Lifestyle Habits for Diabetes and Eye Health",
        "description": "Daily habits that support the wider diabetes plan linked to long-term eye health.",
    },
    {
        "key": "dr_treatment",
        "title": "How Diabetic Retinopathy Is Treated",
        "description": "An overview of treatments an eye specialist may consider after examination.",
    },
    {
        "key": "prepare_eye_exam",
        "title": "Prepare for an Eye Appointment",
        "description": "A practical checklist for making an eye-care consultation more useful.",
    },
]
EDUCATION_BY_KEY = {item["key"]: item for item in EDUCATION_LIBRARY}


def id_variants(value: Any) -> list[Any]:
    text = str(value or "").strip()
    if not text:
        return []
    values: list[Any] = [text]
    if ObjectId.is_valid(text):
        values.append(ObjectId(text))
    return values


def object_id(value: Any, label: str) -> ObjectId:
    text = str(value or "").strip()
    if not ObjectId.is_valid(text):
        raise HTTPException(status_code=400, detail=f"Invalid {label} ID format")
    return ObjectId(text)


def as_iso(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def user_name(db, user_id: Any, fallback: str) -> str:
    variants = id_variants(user_id)
    if not variants:
        return fallback
    doc = db["users"].find_one({"_id": {"$in": variants}}, {"name": 1})
    return str((doc or {}).get("name") or fallback)


def normalize_encounter_status(value: Any) -> str:
    status = str(value or "draft").strip().lower().replace(" ", "_")
    return status if status in {"draft", "in_progress", "completed"} else "draft"


def _prediction_stage(doc: dict[str, Any]) -> str:
    return str(
        doc.get("stage")
        or doc.get("diagnosis")
        or doc.get("disease")
        or doc.get("result")
        or "Completed screening"
    )


def _active_prescription(doc: dict[str, Any], today: date) -> bool:
    if doc.get("active") is False:
        return False
    status = str(doc.get("status") or "Active").strip().lower()
    if status in {"stopped", "completed", "inactive", "cancelled", "canceled"}:
        return False
    end_date = str(doc.get("endDate") or doc.get("end_date") or "").strip()
    if end_date:
        try:
            if datetime.fromisoformat(end_date[:10]).date() < today:
                return False
        except Exception:
            pass
    start_date = str(doc.get("startDate") or doc.get("start_date") or "").strip()
    if start_date:
        try:
            if datetime.fromisoformat(start_date[:10]).date() > today:
                return False
        except Exception:
            pass
    return True


def patient_context(db, patient_id: str, current_encounter_id: str | None = None) -> dict[str, Any]:
    """Return live consultation context without copying it into the encounter."""
    patient_values = id_variants(patient_id)
    if not patient_values:
        return {
            "latestScreening": None,
            "latestHbA1c": None,
            "activeMedications": [],
            "recentReports": [],
            "lastConsultation": None,
        }

    prediction = db["predictions"].find_one(
        {"patientId": {"$in": patient_values}, "status": {"$in": ["Completed", "completed"]}},
        sort=[("created_at", -1), ("createdAt", -1)],
    )
    screening = None
    if prediction:
        screening = {
            "id": str(prediction.get("_id")),
            "stage": _prediction_stage(prediction),
            "confidence": prediction.get("confidence"),
            "riskScore": prediction.get("riskScore", prediction.get("risk_score")),
            "date": as_iso(prediction.get("created_at") or prediction.get("createdAt")),
        }

    metric = db["health_metrics"].find_one(
        {"patientId": {"$in": patient_values}, "hba1c": {"$ne": None}},
        sort=[("recordedAt", -1), ("createdAt", -1)],
    )
    latest_hba1c = None
    if metric:
        latest_hba1c = {
            "value": metric.get("hba1c"),
            "date": as_iso(metric.get("recordedAt") or metric.get("createdAt")),
        }

    today = datetime.utcnow().date()
    medication_docs = list(
        db["prescriptions"].find({"patientId": {"$in": patient_values}}).sort("created_at", -1)
    )
    active_medications = []
    for medication in medication_docs:
        if not _active_prescription(medication, today):
            continue
        active_medications.append(
            {
                "id": str(medication.get("_id")),
                "medicationDetails": medication.get("medicationDetails") or "Medication",
                "dosage": medication.get("dosage") or "",
                "instructions": medication.get("instructions") or medication.get("intakeInstruction") or "",
                "source": medication.get("source") or ("Doctor" if medication.get("doctorId") else "Patient"),
                "doctorName": medication.get("doctorName") or "",
            }
        )

    report_docs = list(
        db["reports"].find({"patientId": {"$in": patient_values}}).sort(
            [("created_at", -1), ("createdAt", -1)]
        ).limit(5)
    )
    reports = [
        {
            "id": str(report.get("_id")),
            "title": report.get("title") or report.get("fileName") or report.get("reportKind") or "Clinical Report",
            "date": as_iso(report.get("created_at") or report.get("createdAt")),
            "kind": report.get("reportKind") or report.get("type") or "report",
        }
        for report in report_docs
    ]

    encounter_query: dict[str, Any] = {
        "patientId": {"$in": patient_values},
        "status": "completed",
    }
    if current_encounter_id and ObjectId.is_valid(current_encounter_id):
        encounter_query["_id"] = {"$ne": ObjectId(current_encounter_id)}
    previous = db["clinical_encounters"].find_one(
        encounter_query,
        sort=[("completedAt", -1)],
    )
    last_consultation = None
    if previous:
        last_consultation = {
            "id": str(previous.get("_id")),
            "doctorName": previous.get("doctorName") or user_name(db, previous.get("doctorId"), "Doctor"),
            "reason": previous.get("reasonForVisit") or "Consultation",
            "date": as_iso(previous.get("completedAt") or previous.get("updatedAt")),
        }

    return {
        "latestScreening": screening,
        "latestHbA1c": latest_hba1c,
        "activeMedicationCount": len(active_medications),
        "activeMedications": active_medications,
        "recentReportCount": db["reports"].count_documents({"patientId": {"$in": patient_values}}),
        "recentReports": reports,
        "lastConsultation": last_consultation,
    }


def _serialize_addendum(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(doc.get("_id")),
        "encounterId": str(doc.get("encounterId") or ""),
        "doctorId": str(doc.get("doctorId") or ""),
        "doctorName": str(doc.get("doctorName") or "Doctor"),
        "text": str(doc.get("text") or ""),
        "createdAt": as_iso(doc.get("createdAt")),
    }


def _medication_reconciliation_summary(db, encounter_id: str) -> dict[str, Any] | None:
    doc = db["medication_reconciliations"].find_one({"encounterId": encounter_id})
    if not doc:
        return None
    actions = []
    for item in doc.get("actions") or []:
        actions.append({
            "action": str(item.get("action") or ""),
            "medicationDetails": str(item.get("medicationDetails") or ""),
            "newMedicationDetails": str(item.get("newMedicationDetails") or ""),
            "reason": str(item.get("reason") or ""),
            "performedAt": as_iso(item.get("performedAt")),
        })
    return {
        "id": str(doc.get("_id") or ""),
        "status": str(doc.get("status") or ""),
        "notes": str(doc.get("notes") or ""),
        "performedAt": as_iso(doc.get("performedAt")),
        "actions": actions,
    }


def serialize_encounter(
    db,
    doc: dict[str, Any],
    *,
    include_context: bool = False,
    include_addenda: bool = True,
) -> dict[str, Any]:
    encounter_id = str(doc.get("_id"))
    patient_id = str(doc.get("patientId") or "")
    doctor_id = str(doc.get("doctorId") or "")
    result: dict[str, Any] = {
        "id": encounter_id,
        "appointmentId": str(doc.get("appointmentId") or ""),
        "patientId": patient_id,
        "patientName": doc.get("patientName") or user_name(db, patient_id, "Patient"),
        "doctorId": doctor_id,
        "doctorName": doc.get("doctorName") or user_name(db, doctor_id, "Doctor"),
        "hospitalId": str(doc.get("hospitalId") or ""),
        "hospitalName": doc.get("hospitalName") or "",
        "reasonForVisit": doc.get("reasonForVisit") or "",
        "status": normalize_encounter_status(doc.get("status")),
        "startedAt": as_iso(doc.get("startedAt")),
        "completedAt": as_iso(doc.get("completedAt")),
        "findings": doc.get("findings") or [],
        "observations": doc.get("observations") or [],
        "procedures": doc.get("procedures") or [],
        "clinicalNotes": doc.get("clinicalNotes") or "",
        "medicationReconciliationId": doc.get("medicationReconciliationId"),
        "medicationReview": doc.get("medicationReview") or {"reviewed": False, "notes": ""},
        "medicationReconciliation": _medication_reconciliation_summary(db, encounter_id),
        "educationAssignments": doc.get("educationAssignments") or [],
        "nextAction": doc.get("nextAction") or {"type": "", "details": ""},
        "patientInstructions": doc.get("patientInstructions") or "",
        "followUp": doc.get("followUp") or {"required": False, "dueDate": "", "reason": ""},
        "revision": int(doc.get("revision") or 0),
        "createdAt": as_iso(doc.get("createdAt")),
        "updatedAt": as_iso(doc.get("updatedAt")),
    }
    if include_context:
        result["patientContext"] = patient_context(db, patient_id, encounter_id)
    if include_addenda:
        addenda = list(
            db["clinical_encounter_addenda"].find({"encounterId": encounter_id}).sort("createdAt", 1)
        )
        result["addenda"] = [_serialize_addendum(item) for item in addenda]
    return result


def patient_summary(db, doc: dict[str, Any]) -> dict[str, Any]:
    """Return a deliberately simpler completed-visit view for the patient."""
    full = serialize_encounter(db, doc, include_context=False, include_addenda=True)
    return {
        "id": full["id"],
        "appointmentId": full["appointmentId"],
        "doctorId": full["doctorId"],
        "doctorName": full["doctorName"],
        "hospitalId": full.get("hospitalId") or "",
        "hospitalName": full.get("hospitalName") or "",
        "reasonForVisit": full["reasonForVisit"],
        "status": full["status"],
        "completedAt": full["completedAt"],
        "patientInstructions": full["patientInstructions"],
        "nextAction": full["nextAction"],
        "followUp": full["followUp"],
        "educationAssignments": full["educationAssignments"],
        "medicationReview": {
            "reviewed": bool((full.get("medicationReview") or {}).get("reviewed")),
            "notes": str((full.get("medicationReview") or {}).get("notes") or ""),
        },
        "medicationReconciliation": full.get("medicationReconciliation"),
        "procedures": full["procedures"],
        "addenda": full["addenda"],
    }


def validate_education_keys(keys: list[str]) -> list[dict[str, str]]:
    output: list[dict[str, str]] = []
    seen: set[str] = set()
    for key in keys:
        normalized = str(key or "").strip()
        if not normalized or normalized in seen:
            continue
        item = EDUCATION_BY_KEY.get(normalized)
        if not item:
            raise HTTPException(status_code=400, detail=f"Unknown education topic: {normalized}")
        seen.add(normalized)
        output.append({"topicKey": normalized, "title": item["title"]})
    return output
