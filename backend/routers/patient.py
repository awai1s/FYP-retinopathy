from datetime import date, datetime, timedelta
import math
import re
from typing import Literal, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from pydantic import BaseModel, Field

from database import get_db
from dependencies import RoleChecker, get_current_user
from models import PatientProfileUpdate
from storage import upload_file_to_gridfs

router = APIRouter(
    prefix="/api/patient",
    tags=["Patient"],
    dependencies=[Depends(RoleChecker(["Patient"]))]
)


# ─── Phase 2 request models and medication helpers ────────────────────────────
MEDICATION_TIME_LABELS = {
    "Morning": "8:00 AM",
    "Noon": "12:00 PM",
    "Evening": "6:00 PM",
    "Night": "9:00 PM",
    "Daily": "Any time today",
}


class PatientPrescriptionCreate(BaseModel):
    medicationDetails: str = Field(min_length=1, max_length=500)
    dosage: Optional[str] = Field(default=None, max_length=100)
    times: list[str] = Field(default_factory=list)
    intakeInstruction: Optional[str] = Field(default=None, max_length=100)
    notes: Optional[str] = Field(default=None, max_length=2000)
    duration: Optional[str] = Field(default=None, max_length=100)
    durationWeeks: Optional[int] = Field(default=None, ge=1, le=520)
    startDate: Optional[str] = None
    endDate: Optional[str] = None


class PatientPrescriptionUpdate(BaseModel):
    medicationDetails: Optional[str] = Field(default=None, min_length=1, max_length=500)
    dosage: Optional[str] = Field(default=None, max_length=100)
    times: Optional[list[str]] = None
    intakeInstruction: Optional[str] = Field(default=None, max_length=100)
    notes: Optional[str] = Field(default=None, max_length=2000)
    duration: Optional[str] = Field(default=None, max_length=100)
    durationWeeks: Optional[int] = Field(default=None, ge=1, le=520)
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    active: Optional[bool] = None


class MedicationAdherenceCreate(BaseModel):
    # "taken" is retained for backward compatibility with the Phase 1 frontend.
    taken: Optional[bool] = None
    status: Optional[Literal["Pending", "Taken", "Missed", "Skipped"]] = None
    scheduledDate: Optional[str] = None
    doseKey: Optional[str] = Field(default=None, max_length=64)
    scheduledTime: Optional[str] = Field(default=None, max_length=64)
    snoozedUntil: Optional[datetime] = None
    clientOperationId: Optional[str] = Field(default=None, min_length=8, max_length=128)


class HealthMetricCreate(BaseModel):
    hba1c: Optional[float] = Field(default=None, ge=0, le=30)
    bloodGlucose: Optional[float] = Field(default=None, ge=0, le=2000)
    recordedAt: Optional[datetime] = None


class ConsentUpdate(BaseModel):
    scope: str = Field(default="screening", min_length=1, max_length=64)
    granted: bool


class CareNavigationCreate(BaseModel):
    """Small Phase 8 event used to connect Clinic Locator to patient history."""

    clinicId: Optional[str] = Field(default=None, max_length=240)
    clinicName: str = Field(min_length=1, max_length=240)
    address: Optional[str] = Field(default=None, max_length=500)
    action: Literal["Viewed", "Directions"] = "Directions"
    searchMode: Optional[Literal["nearby", "city"]] = None
    city: Optional[str] = Field(default=None, max_length=160)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)


def _as_iso(value) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if value is None:
        return ""
    return str(value)


def _parse_iso_date(value: Optional[str], field_name: str) -> Optional[date]:
    if value in (None, ""):
        return None
    try:
        return date.fromisoformat(str(value)).isoformat() and date.fromisoformat(str(value))
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} must use YYYY-MM-DD format",
        ) from exc


def _parse_scheduled_date(value: Optional[str]) -> str:
    parsed = _parse_iso_date(value, "scheduledDate")
    return (parsed or datetime.utcnow().date()).isoformat()


def _normalize_times(values: list[str] | None) -> list[str]:
    if not values:
        return []

    canonical = {
        "morning": "Morning",
        "noon": "Noon",
        "evening": "Evening",
        "night": "Night",
        "daily": "Daily",
    }
    result: list[str] = []
    for raw in values:
        value = str(raw).strip()
        if not value:
            continue
        normalized = canonical.get(value.lower(), value)
        if normalized not in result:
            result.append(normalized)
    return result[:8]


def _duration_weeks_from_text(value: Optional[str]) -> Optional[int]:
    if not value:
        return None

    match = re.search(r"(\d+)", str(value))
    if not match:
        return None

    amount = max(1, int(match.group(1)))
    lower = str(value).lower()
    if "day" in lower:
        return max(1, math.ceil(amount / 7))
    if "month" in lower:
        return max(1, amount * 4)
    return amount


def _schedule_fields(
    *,
    start_value: Optional[str],
    end_value: Optional[str],
    duration_weeks: Optional[int],
    duration_text: Optional[str],
) -> dict:
    start_day = _parse_iso_date(start_value, "startDate") or datetime.utcnow().date()
    weeks = duration_weeks or _duration_weeks_from_text(duration_text) or 1

    end_day = _parse_iso_date(end_value, "endDate")
    if end_day is None:
        end_day = start_day + timedelta(days=(weeks * 7) - 1)

    if end_day < start_day:
        raise HTTPException(
            status_code=400,
            detail="endDate cannot be earlier than startDate",
        )

    duration_days = (end_day - start_day).days + 1
    normalized_weeks = max(1, math.ceil(duration_days / 7))
    label = (duration_text or "").strip() or (
        f"{normalized_weeks} Week" + ("s" if normalized_weeks != 1 else "")
    )

    return {
        "startDate": start_day.isoformat(),
        "endDate": end_day.isoformat(),
        "durationWeeks": normalized_weeks,
        "duration": label,
    }


def _doc_date(value) -> Optional[date]:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if not value:
        return None

    text = str(value).strip()
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def _prescription_dose_keys(doc: dict) -> list[str]:
    times = _normalize_times(doc.get("times") or [])
    return times or ["Daily"]


def _is_prescription_active_on(doc: dict, day_value: date) -> bool:
    start_day = _doc_date(doc.get("startDate") or doc.get("date"))
    end_day = _doc_date(doc.get("endDate"))
    stopped_day = _doc_date(doc.get("stoppedAt"))

    if start_day and day_value < start_day:
        return False
    if end_day and day_value > end_day:
        return False
    if stopped_day and day_value >= stopped_day:
        return False

    # Legacy inactive records with no stop date are treated as inactive.
    if doc.get("active") is False and stopped_day is None:
        return False

    return True


def _prescription_lifecycle(doc: dict) -> tuple[str, Optional[int]]:
    today = datetime.utcnow().date()
    end_day = _doc_date(doc.get("endDate"))
    stopped_day = _doc_date(doc.get("stoppedAt"))

    if doc.get("active") is False or stopped_day or (end_day and end_day < today):
        return "Completed", 0

    if end_day:
        return "Active", max(0, (end_day - today).days + 1)

    return "Active", None


def _serialize_prescription(doc: dict) -> dict:
    item = dict(doc)
    item["id"] = str(item.pop("_id"))
    item["source"] = item.get("source") or (
        "Doctor" if item.get("doctorId") else "Patient"
    )
    lifecycle, remaining_days = _prescription_lifecycle(item)
    item["lifecycleStatus"] = lifecycle
    item["remainingDays"] = remaining_days
    item["times"] = _normalize_times(item.get("times") or [])
    if item.get("reconciliationStatus") == "changed" or item.get("replacedByPrescriptionId"):
        item["completionReason"] = "Changed"
    elif item.get("stoppedAt") or item.get("reconciliationStatus") == "stopped":
        item["completionReason"] = "Stopped"
    elif lifecycle == "Completed":
        item["completionReason"] = "Completed"
    else:
        item["completionReason"] = None

    for field in (
        "created_at",
        "updated_at",
        "createdAt",
        "updatedAt",
        "stoppedAt",
    ):
        if field in item and item[field] is not None:
            item[field] = _as_iso(item[field])

    return item


def _serialize_adherence(doc: dict) -> dict:
    item = dict(doc)
    item["id"] = str(item.pop("_id"))
    item["doseKey"] = str(item.get("doseKey") or "Daily")
    item["scheduledTime"] = (
        item.get("scheduledTime")
        or MEDICATION_TIME_LABELS.get(item["doseKey"], item["doseKey"])
    )
    for field in ("createdAt", "updatedAt", "takenAt", "snoozedUntil"):
        if item.get(field) is not None:
            item[field] = _as_iso(item[field])
    return item


def _serialize_health_metric(doc: dict) -> dict:
    item = dict(doc)
    item["id"] = str(item.pop("_id"))
    item["recordedAt"] = _as_iso(item.get("recordedAt"))
    item["createdAt"] = _as_iso(item.get("createdAt"))
    return item


def _safe_float(value):
    if value is None or isinstance(value, bool):
        return None

    if isinstance(value, (int, float)):
        return float(value)

    try:
        return float(str(value).strip().rstrip("%"))
    except (TypeError, ValueError):
        return None


def _prediction_date(doc: dict) -> str:
    for key in ("date", "createdAt", "created_at", "updatedAt", "updated_at"):
        value = doc.get(key)
        if value:
            if isinstance(value, datetime):
                return value.date().isoformat()
            return str(value)
    return ""


def _prediction_risk(doc: dict):
    for key in ("riskScore", "risk_score", "risk"):
        value = doc.get(key)
        if isinstance(value, dict):
            value = value.get("score")
        numeric = _safe_float(value)
        if numeric is not None:
            return numeric
    return None


def _prediction_stage(doc: dict) -> Optional[str]:
    """Return the most likely DR/classification label from legacy and future records."""
    for key in (
        "stage",
        "diagnosis",
        "disease",
        "classification",
        "drStage",
        "dr_stage",
        "severityLabel",
    ):
        value = doc.get(key)
        if value not in (None, ""):
            return str(value)
    return None


def _prediction_sort_key(doc: dict) -> date:
    parsed = _doc_date(_prediction_date(doc))
    return parsed or date.min


def _dr_severity_value(stage: Optional[str]) -> Optional[int]:
    if not stage:
        return None

    label = str(stage).strip().lower()
    aliases = {
        "no dr": 0,
        "no diabetic retinopathy": 0,
        "normal": 0,
        "mild": 1,
        "mild dr": 1,
        "moderate": 2,
        "moderate dr": 2,
        "severe": 3,
        "severe dr": 3,
        "proliferative": 4,
        "proliferative dr": 4,
        "pdr": 4,
    }
    if label in aliases:
        return aliases[label]

    match = re.search(r"(?:^|\b)([0-4])(?:\b|$)", label)
    if match:
        return int(match.group(1))
    return None


def _window_adherence_percent(days: list[dict]) -> Optional[float]:
    expected = sum(int(day.get("expected", 0) or 0) for day in days)
    completed = sum(int(day.get("completed", 0) or 0) for day in days)
    if expected <= 0:
        return None
    return round((completed / expected) * 100, 1)


def _delta(current: Optional[float], previous: Optional[float]) -> Optional[float]:
    if current is None or previous is None:
        return None
    return round(float(current) - float(previous), 1)


def _build_medication_adherence(db, patient_id: str, days: int) -> dict:
    today = datetime.utcnow().date()
    start_date = today - timedelta(days=days - 1)
    start_key = start_date.isoformat()
    end_key = today.isoformat()

    prescriptions = list(
        db["prescriptions"].find(
            {"patientId": patient_id},
            sort=[("created_at", 1), ("date", 1)],
        )
    )
    prescription_map = {str(item["_id"]): item for item in prescriptions}

    records = list(
        db["medication_adherence"].find(
            {
                "patientId": patient_id,
                "scheduledDate": {"$gte": start_key, "$lte": end_key},
            },
            sort=[("scheduledDate", -1), ("updatedAt", -1)],
        )
    )

    # The latest record for a dose wins. Old Phase 1 records without doseKey
    # are treated as the first dose of that medication for compatibility.
    exact_records: dict[tuple[str, str, str], dict] = {}
    legacy_records: dict[tuple[str, str], dict] = {}
    for record in records:
        day_key = str(record.get("scheduledDate", ""))
        prescription_id = str(record.get("prescriptionId", ""))
        dose_key = str(record.get("doseKey") or "Daily")
        exact_records.setdefault((day_key, prescription_id, dose_key), record)
        if dose_key == "Daily":
            legacy_records.setdefault((day_key, prescription_id), record)

    day_summaries = []
    today_doses = []
    missed_history = []

    for offset in range(days):
        current_day = start_date + timedelta(days=offset)
        day_key = current_day.isoformat()

        expected = 0
        taken = 0
        missed = 0
        skipped = 0
        pending = 0

        for prescription in prescriptions:
            if not _is_prescription_active_on(prescription, current_day):
                continue

            prescription_id = str(prescription["_id"])
            dose_keys = _prescription_dose_keys(prescription)

            for dose_index, dose_key in enumerate(dose_keys):
                expected += 1
                record = exact_records.get((day_key, prescription_id, dose_key))

                # Backward compatibility: before Phase 2 only one record existed
                # per prescription/day. Apply it to the first scheduled dose.
                if (
                    record is None
                    and dose_index == 0
                    and dose_key != "Daily"
                ):
                    record = legacy_records.get((day_key, prescription_id))

                derived = False
                if record:
                    status = str(record.get("status") or "Pending")
                elif current_day < today:
                    status = "Missed"
                    derived = True
                else:
                    status = "Pending"
                    derived = True

                if status == "Taken":
                    taken += 1
                elif status == "Missed":
                    missed += 1
                elif status == "Skipped":
                    skipped += 1
                else:
                    pending += 1

                scheduled_time = (
                    (record or {}).get("scheduledTime")
                    or MEDICATION_TIME_LABELS.get(dose_key, dose_key)
                )

                if status == "Missed":
                    missed_history.append(
                        {
                            "id": (
                                str(record.get("_id"))
                                if record and record.get("_id") is not None
                                else f"derived:{day_key}:{prescription_id}:{dose_key}"
                            ),
                            "prescriptionId": prescription_id,
                            "medicationDetails": prescription.get(
                                "medicationDetails", "Medication"
                            ),
                            "dosage": prescription.get("dosage", ""),
                            "date": day_key,
                            "doseKey": dose_key,
                            "scheduledTime": scheduled_time,
                            "status": "Missed",
                            "derived": derived,
                        }
                    )

                if current_day == today:
                    lifecycle, remaining_days = _prescription_lifecycle(prescription)
                    today_doses.append(
                        {
                            "prescriptionId": prescription_id,
                            "medicationDetails": prescription.get(
                                "medicationDetails", "Medication"
                            ),
                            "dosage": prescription.get("dosage", ""),
                            "intakeInstruction": prescription.get(
                                "intakeInstruction", ""
                            ),
                            "source": prescription.get("source")
                            or (
                                "Doctor"
                                if prescription.get("doctorId")
                                else "Patient"
                            ),
                            "doseKey": dose_key,
                            "scheduledTime": scheduled_time,
                            "status": status,
                            "takenAt": (
                                _as_iso(record.get("takenAt"))
                                if record and record.get("takenAt")
                                else None
                            ),
                            "snoozedUntil": (
                                _as_iso(record.get("snoozedUntil"))
                                if record and record.get("snoozedUntil")
                                else None
                            ),
                            "remainingDays": remaining_days,
                            "lifecycleStatus": lifecycle,
                        }
                    )

        percent = round((taken / expected) * 100, 1) if expected else 0
        day_summaries.append(
            {
                "date": day_key,
                "percent": percent,
                "completed": taken,
                "expected": expected,
                "taken": taken,
                "missed": missed,
                "skipped": skipped,
                "pending": pending,
            }
        )

    total_expected = sum(day["expected"] for day in day_summaries)
    total_completed = sum(day["completed"] for day in day_summaries)
    overall_percent = (
        round((total_completed / total_expected) * 100, 1)
        if total_expected
        else 0
    )

    today_summary = day_summaries[-1] if day_summaries else {
        "date": end_key,
        "percent": 0,
        "completed": 0,
        "expected": 0,
        "taken": 0,
        "missed": 0,
        "skipped": 0,
        "pending": 0,
    }

    missed_history.sort(
        key=lambda item: (item["date"], item["scheduledTime"]),
        reverse=True,
    )

    return {
        "days": day_summaries,
        "adherence": day_summaries,
        "expectedPerDay": today_summary["expected"],
        "expected_per_day": today_summary["expected"],
        "overallPercent": overall_percent,
        "windowDays": days,
        "today": today_summary,
        "todayDoses": today_doses,
        "records": [_serialize_adherence(record) for record in records],
        "missedHistory": missed_history,
    }


# â”€â”€â”€ Patient Profile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@router.get("/profile")
def get_patient_profile(current_user: dict = Depends(get_current_user)):
    db = get_db()
    profile = db["patient_profiles"].find_one({"userId": current_user["_id"]}) or {}
    profile_id = profile.pop("_id", None)
    if profile_id:
        profile["id"] = str(profile_id)

    first_name = current_user.get("first_name", "")
    last_name = current_user.get("last_name", "")
    return {
        **profile,
        "userId": current_user["_id"],
        "name": current_user.get("name", ""),
        "firstName": first_name,
        "lastName": last_name,
        "first_name": first_name,
        "last_name": last_name,
        "username": profile.get("username") or current_user.get("username", ""),
        "email": profile.get("email") or current_user.get("email", ""),
        "mobile": current_user.get("mobile", ""),
        "gender": profile.get("gender") or current_user.get("gender", ""),
        "dob": profile.get("dob") or current_user.get("dob", ""),
        "age": profile.get("age", current_user.get("age", "")),
        "bloodGroup": profile.get("bloodGroup", ""),
        "address": profile.get("address", ""),
        "emergencyContact": profile.get("emergencyContact", ""),
        "allergies": profile.get("allergies", ""),
        "profileImage": profile.get("profileImage"),
    }


@router.put("/profile")
async def update_patient_profile(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        data = PatientProfileUpdate.model_validate(await request.json())
        values = data.model_dump(exclude_unset=True)
    else:
        form = await request.form()
        values = {key: value for key, value in form.items() if value is not None}

    db = get_db()
    first_name = values.get("firstName", values.get("first_name"))
    last_name = values.get("lastName", values.get("last_name"))
    username = values.get("username")
    email = values.get("email")

    if email and email != current_user.get("email"):
        duplicate = db["users"].find_one({"email": email, "_id": {"$ne": ObjectId(current_user["_id"])}})
        if duplicate:
            raise HTTPException(status_code=409, detail="Email already exists")

    user_updates = {}
    if first_name is not None:
        user_updates["first_name"] = first_name
    if last_name is not None:
        user_updates["last_name"] = last_name
    if first_name is not None or last_name is not None:
        current_first = first_name if first_name is not None else current_user.get("first_name", "")
        current_last = last_name if last_name is not None else current_user.get("last_name", "")
        user_updates["name"] = " ".join(part for part in [current_first, current_last] if part).strip()
    for field in ("username", "mobile", "email", "gender", "dob", "age"):
        if field in values:
            user_updates[field] = values[field]
    if user_updates:
        db["users"].update_one({"_id": ObjectId(current_user["_id"])}, {"$set": user_updates})

    profile_updates = {}
    field_map = {
        "bloodGroup": "bloodGroup",
        "address": "address",
        "emergencyContact": "emergencyContact",
        "allergies": "allergies",
        "gender": "gender",
        "dob": "dob",
        "age": "age",
    }
    for source, target in field_map.items():
        if source in values:
            profile_updates[target] = values[source]
    profile_updates["updatedAt"] = datetime.utcnow()

    db["patient_profiles"].update_one(
        {"userId": current_user["_id"]},
        {"$set": profile_updates, "$setOnInsert": {
            "userId": current_user["_id"],
            "email": email or current_user.get("email", ""),
            "username": username or current_user.get("username", ""),
            "createdAt": datetime.utcnow(),
        }},
        upsert=True,
    )
    return {"message": "Profile updated successfully"}


# ─── Phase 2: Prescriptions and medication adherence ──────────────────────────
def _get_owned_prescription_or_404(db, patient_id: str, prescription_id: str) -> dict:
    if not ObjectId.is_valid(prescription_id):
        raise HTTPException(status_code=400, detail="Invalid prescription ID format")

    prescription = db["prescriptions"].find_one(
        {
            "_id": ObjectId(prescription_id),
            "patientId": patient_id,
        }
    )
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")
    return prescription


def _ensure_patient_editable(prescription: dict) -> None:
    source = prescription.get("source") or (
        "Doctor" if prescription.get("doctorId") else "Patient"
    )
    if source != "Patient":
        raise HTTPException(
            status_code=403,
            detail="Doctor-issued prescriptions cannot be edited by the patient",
        )


@router.get("/prescriptions")
def get_patient_prescriptions(current_user: dict = Depends(get_current_user)):
    db = get_db()
    patient_id = current_user["_id"]

    prescriptions = list(
        db["prescriptions"].find(
            {"patientId": patient_id},
            sort=[("created_at", -1), ("date", -1)],
        )
    )

    return {
        "prescriptions": [_serialize_prescription(item) for item in prescriptions]
    }


@router.get("/prescriptions/{prescription_id}")
def get_patient_prescription(
    prescription_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    prescription = _get_owned_prescription_or_404(
        db,
        current_user["_id"],
        prescription_id,
    )
    return {"prescription": _serialize_prescription(prescription)}


@router.post("/prescriptions", status_code=201)
def create_patient_prescription(
    data: PatientPrescriptionCreate,
    current_user: dict = Depends(get_current_user),
):
    medication_details = data.medicationDetails.strip()
    if not medication_details:
        raise HTTPException(status_code=400, detail="Medication name is required")

    now = datetime.utcnow()
    patient_id = current_user["_id"]
    db = get_db()
    schedule = _schedule_fields(
        start_value=data.startDate,
        end_value=data.endDate,
        duration_weeks=data.durationWeeks,
        duration_text=data.duration,
    )

    prescription_doc = {
        "patientId": patient_id,
        "source": "Patient",
        "medicationDetails": medication_details,
        "dosage": (data.dosage or "").strip(),
        "times": _normalize_times(data.times),
        "intakeInstruction": (data.intakeInstruction or "").strip(),
        "notes": (data.notes or "").strip(),
        **schedule,
        # Keep "date" for compatibility with existing history/list UI.
        "date": schedule["startDate"],
        "created_at": now,
        "updated_at": now,
        "active": True,
    }

    result = db["prescriptions"].insert_one(prescription_doc)
    prescription_doc["_id"] = result.inserted_id

    db["patient_history"].insert_one(
        {
            "patientId": patient_id,
            "sourceId": str(result.inserted_id),
            "type": "Prescription",
            "title": "Patient Added Prescription",
            "date": schedule["startDate"],
            "status": "Active",
            "created_at": now,
        }
    )

    return {
        "message": "Prescription added successfully",
        "prescriptionId": str(result.inserted_id),
        "prescription": _serialize_prescription(prescription_doc),
    }


@router.patch("/prescriptions/{prescription_id}")
def update_patient_prescription(
    prescription_id: str,
    data: PatientPrescriptionUpdate,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    patient_id = current_user["_id"]
    prescription = _get_owned_prescription_or_404(
        db,
        patient_id,
        prescription_id,
    )
    _ensure_patient_editable(prescription)

    values = data.model_dump(exclude_unset=True)
    updates: dict = {}

    if "medicationDetails" in values:
        medication_details = str(values["medicationDetails"]).strip()
        if not medication_details:
            raise HTTPException(status_code=400, detail="Medication name is required")
        updates["medicationDetails"] = medication_details

    for field in ("dosage", "intakeInstruction", "notes"):
        if field in values:
            updates[field] = (values[field] or "").strip()

    if "times" in values:
        updates["times"] = _normalize_times(values.get("times"))

    schedule_fields = {"startDate", "endDate", "durationWeeks", "duration"}
    if schedule_fields.intersection(values):
        start_value = values.get(
            "startDate",
            prescription.get("startDate") or prescription.get("date"),
        )

        if "endDate" in values:
            end_value = values.get("endDate")
        elif {"startDate", "durationWeeks", "duration"}.intersection(values):
            # Recompute end date whenever the start/duration changes.
            end_value = None
        else:
            end_value = prescription.get("endDate")

        schedule = _schedule_fields(
            start_value=start_value,
            end_value=end_value,
            duration_weeks=values.get(
                "durationWeeks",
                prescription.get("durationWeeks"),
            ),
            duration_text=values.get("duration", prescription.get("duration")),
        )
        updates.update(schedule)
        updates["date"] = schedule["startDate"]

    if "active" in values:
        updates["active"] = bool(values["active"])
        if updates["active"]:
            updates["stoppedAt"] = None
        else:
            updates["stoppedAt"] = datetime.utcnow()

    if not updates:
        return {
            "message": "No prescription changes supplied",
            "prescription": _serialize_prescription(prescription),
        }

    updates["updated_at"] = datetime.utcnow()
    db["prescriptions"].update_one(
        {"_id": prescription["_id"], "patientId": patient_id},
        {"$set": updates},
    )
    saved = db["prescriptions"].find_one({"_id": prescription["_id"]})

    return {
        "message": "Prescription updated successfully",
        "prescriptionId": prescription_id,
        "prescription": _serialize_prescription(saved),
    }


@router.delete("/prescriptions/{prescription_id}")
def stop_patient_prescription(
    prescription_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Archive a self-added medication without erasing its medical history."""
    db = get_db()
    patient_id = current_user["_id"]
    prescription = _get_owned_prescription_or_404(
        db,
        patient_id,
        prescription_id,
    )
    _ensure_patient_editable(prescription)

    now = datetime.utcnow()
    db["prescriptions"].update_one(
        {"_id": prescription["_id"], "patientId": patient_id},
        {
            "$set": {
                "active": False,
                "stoppedAt": now,
                "updated_at": now,
            }
        },
    )

    db["patient_history"].update_one(
        {
            "patientId": patient_id,
            "sourceId": prescription_id,
            "type": "Prescription",
        },
        {
            "$set": {
                "status": "Completed",
                "updated_at": now,
            }
        },
        upsert=False,
    )

    saved = db["prescriptions"].find_one({"_id": prescription["_id"]})
    return {
        "message": "Medication stopped successfully",
        "prescription": _serialize_prescription(saved),
    }


@router.get("/medication-adherence")
def get_medication_adherence(
    days: int = Query(default=7, ge=1, le=365),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    return _build_medication_adherence(db, current_user["_id"], days)


@router.post("/prescriptions/{prescription_id}/adherence")
def record_medication_adherence(
    prescription_id: str,
    data: MedicationAdherenceCreate,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    patient_id = current_user["_id"]
    prescription = _get_owned_prescription_or_404(
        db,
        patient_id,
        prescription_id,
    )

    if data.status is not None:
        status = data.status
    elif data.taken is not None:
        status = "Taken" if data.taken else "Skipped"
    else:
        raise HTTPException(
            status_code=400,
            detail="Provide either status or taken",
        )

    scheduled_date = _parse_scheduled_date(data.scheduledDate)
    scheduled_day = date.fromisoformat(scheduled_date)
    if not _is_prescription_active_on(prescription, scheduled_day):
        raise HTTPException(
            status_code=400,
            detail="This medication is not scheduled for the selected date",
        )

    dose_keys = _prescription_dose_keys(prescription)
    requested_dose = (data.doseKey or "").strip()
    if requested_dose:
        canonical = _normalize_times([requested_dose])
        dose_key = canonical[0] if canonical else requested_dose
        if dose_key not in dose_keys:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid doseKey. Expected one of: {', '.join(dose_keys)}",
            )
    else:
        # Backward compatibility with the old "one mark per prescription" UI.
        dose_key = dose_keys[0]

    scheduled_time = (
        (data.scheduledTime or "").strip()
        or MEDICATION_TIME_LABELS.get(dose_key, dose_key)
    )
    now = datetime.utcnow()

    query = {
        "patientId": patient_id,
        "prescriptionId": prescription_id,
        "scheduledDate": scheduled_date,
        "doseKey": dose_key,
    }

    # Phase 10L replay protection. The natural dose key is already unique, so a
    # repeated queued operation can never create duplicate dose rows. This extra
    # client operation id lets the server recognize an exact offline replay and
    # return the previously saved state without changing timestamps again.
    if data.clientOperationId:
        existing = db["medication_adherence"].find_one(query)
        if existing and (existing.get("lastClientOperationId") == data.clientOperationId or
                         data.clientOperationId in existing.get("appliedClientOperationIds", [])):
            return {
                "message": "Medication adherence already synchronized",
                "adherence": _serialize_adherence(existing),
                "summary": _build_medication_adherence(db, patient_id, 7)["today"],
                "clientOperationId": data.clientOperationId,
                "idempotentReplay": True,
            }

    update = {
        "$set": {
            "status": status,
            "scheduledTime": scheduled_time,
            "updatedAt": now,
            **({"lastClientOperationId": data.clientOperationId} if data.clientOperationId else {}),
        },
        "$setOnInsert": {
            "patientId": patient_id,
            "prescriptionId": prescription_id,
            "scheduledDate": scheduled_date,
            "doseKey": dose_key,
            "createdAt": now,
        },
    }
    if data.clientOperationId:
        update["$addToSet"] = {"appliedClientOperationIds": data.clientOperationId}

    if status == "Taken":
        update["$set"]["takenAt"] = now
        update["$unset"] = {"snoozedUntil": ""}
    else:
        update["$unset"] = {"takenAt": ""}
        if data.snoozedUntil is not None:
            update["$set"]["snoozedUntil"] = data.snoozedUntil
        elif status != "Pending":
            update["$unset"]["snoozedUntil"] = ""

    db["medication_adherence"].update_one(query, update, upsert=True)
    saved = db["medication_adherence"].find_one(query)

    return {
        "message": "Medication adherence updated",
        "adherence": _serialize_adherence(saved),
        "summary": _build_medication_adherence(db, patient_id, 7)["today"],
        "clientOperationId": data.clientOperationId,
    }


# ─── Phase 1: Longitudinal health metrics ─────────────────────────────────────
@router.get("/health-metrics")
def get_health_metrics(current_user: dict = Depends(get_current_user)):
    db = get_db()
    metrics = list(
        db["health_metrics"].find(
            {"patientId": current_user["_id"]},
            sort=[("recordedAt", -1)],
        )
    )
    return {"metrics": [_serialize_health_metric(metric) for metric in metrics]}


@router.post("/health-metrics", status_code=201)
def create_health_metric(
    data: HealthMetricCreate,
    current_user: dict = Depends(get_current_user),
):
    if data.hba1c is None and data.bloodGlucose is None:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one metric: hba1c or bloodGlucose",
        )

    now = datetime.utcnow()
    metric_doc = {
        "patientId": current_user["_id"],
        "hba1c": data.hba1c,
        "bloodGlucose": data.bloodGlucose,
        "recordedAt": data.recordedAt or now,
        "source": "Patient",
        "createdAt": now,
    }

    db = get_db()
    result = db["health_metrics"].insert_one(metric_doc)
    metric_doc["_id"] = result.inserted_id

    return {
        "message": "Health metric recorded successfully",
        "healthMetricId": str(result.inserted_id),
        "metric": _serialize_health_metric(metric_doc),
    }


# ─── Phase 3: Longitudinal patient analytics / progress monitoring ────────────
@router.get("/analytics")
def get_patient_analytics(
    days: int = Query(default=30, ge=7, le=365),
    current_user: dict = Depends(get_current_user),
):
    """Aggregate the patient's longitudinal health data without duplicating it.

    Sources remain authoritative in their existing collections:
      - predictions -> DR stage and risk history
      - health_metrics -> HbA1c / glucose history
      - medication_adherence + prescriptions -> adherence history

    The optional `days` query controls only the trend window used by the detailed
    history screen (30/90/180/365). Summary values always use the latest records
    across the patient's full history so an older baseline is not silently lost.
    """
    db = get_db()
    patient_id = current_user["_id"]
    today = datetime.utcnow().date()
    cutoff = today - timedelta(days=days - 1)

    prediction_docs = list(db["predictions"].find({"patientId": patient_id}))
    prediction_docs.sort(key=_prediction_sort_key)

    report_count = db["reports"].count_documents({"patientId": patient_id})
    appointment_count = db["appointments"].count_documents({"patientId": patient_id})
    vision_test_count = db["patient_history"].count_documents(
        {
            "patientId": patient_id,
            "type": {"$in": ["Vision Test", "VisionTest", "Vision"]},
        }
    )

    latest_prediction = None
    if prediction_docs:
        latest = prediction_docs[-1]
        latest_prediction = {
            "id": str(latest["_id"]),
            "stage": _prediction_stage(latest) or "Analysis",
            "confidence": latest.get("confidence", ""),
            "riskScore": _prediction_risk(latest),
            "date": _prediction_date(latest),
            "status": latest.get("status", "Completed"),
        }

    # HbA1c history comes only from health_metrics. No values are copied into
    # patient profiles, predictions, or history documents.
    metric_docs = list(
        db["health_metrics"].find(
            {"patientId": patient_id},
            sort=[("recordedAt", 1), ("createdAt", 1)],
        )
    )
    hba1c_all = [
        {
            "id": str(metric["_id"]),
            "date": _as_iso(metric.get("recordedAt")),
            "value": float(metric.get("hba1c")),
            "bloodGlucose": metric.get("bloodGlucose"),
            "source": metric.get("source", "Patient"),
        }
        for metric in metric_docs
        if metric.get("hba1c") is not None
    ]
    glucose_all = [
        {
            "id": str(metric["_id"]),
            "date": _as_iso(metric.get("recordedAt")),
            "value": float(metric.get("bloodGlucose")),
            "source": metric.get("source", "Patient"),
        }
        for metric in metric_docs
        if metric.get("bloodGlucose") is not None
    ]

    latest_hba1c = hba1c_all[-1]["value"] if hba1c_all else None
    previous_hba1c = hba1c_all[-2]["value"] if len(hba1c_all) > 1 else None
    baseline_hba1c = hba1c_all[0]["value"] if len(hba1c_all) > 1 else None

    risk_all: list[dict] = []
    dr_all: list[dict] = []
    for prediction in prediction_docs:
        prediction_date = _prediction_date(prediction)
        risk_value = _prediction_risk(prediction)
        stage = _prediction_stage(prediction)

        if risk_value is not None:
            risk_all.append(
                {
                    "id": str(prediction["_id"]),
                    "date": prediction_date,
                    "value": float(risk_value),
                }
            )

        if stage:
            dr_all.append(
                {
                    "id": str(prediction["_id"]),
                    "date": prediction_date,
                    "stage": stage,
                    "severity": _dr_severity_value(stage),
                    "confidence": prediction.get("confidence"),
                    "riskScore": risk_value,
                }
            )

    latest_risk = risk_all[-1]["value"] if risk_all else None
    previous_risk = risk_all[-2]["value"] if len(risk_all) > 1 else None
    baseline_risk = risk_all[0]["value"] if len(risk_all) > 1 else None

    def in_range(item: dict) -> bool:
        item_date = _doc_date(item.get("date"))
        return item_date is not None and cutoff <= item_date <= today

    hba1c_trend = [item for item in hba1c_all if in_range(item)]
    glucose_trend = [item for item in glucose_all if in_range(item)]
    risk_trend = [item for item in risk_all if in_range(item)]
    dr_trend = [item for item in dr_all if in_range(item)]

    # The selected graph window is returned for the history screen, while the
    # overview adherence comparison intentionally uses recent-vs-previous 7 days.
    medication_window = _build_medication_adherence(db, patient_id, days)
    medication_14 = (
        medication_window
        if days == 14
        else _build_medication_adherence(db, patient_id, 14)
    )
    current_seven = medication_14["days"][-7:]
    previous_seven = medication_14["days"][-14:-7]
    current_adherence = _window_adherence_percent(current_seven)
    previous_adherence = _window_adherence_percent(previous_seven)

    return {
        # Existing analytics.tsx counters retained for backward compatibility.
        "screenings": len(prediction_docs),
        "reports": report_count,
        "appointments": appointment_count,
        "visionTests": vision_test_count,
        "latestPrediction": latest_prediction,

        # Phase 3 progress-monitoring contract.
        "rangeDays": days,
        "generatedAt": datetime.utcnow().isoformat(),
        "summary": {
            "latestHbA1c": latest_hba1c,
            "previousHbA1c": previous_hba1c,
            "baselineHbA1c": baseline_hba1c,
            "hba1cDelta": _delta(latest_hba1c, baseline_hba1c),
            "latestRisk": latest_risk,
            "previousRisk": previous_risk,
            "baselineRisk": baseline_risk,
            "riskDelta": _delta(latest_risk, baseline_risk),
            "medicationAdherence": current_adherence,
            "previousMedicationAdherence": previous_adherence,
            "medicationAdherenceDelta": _delta(
                current_adherence,
                previous_adherence,
            ),
        },
        "hba1cTrend": hba1c_trend,
        "bloodGlucoseTrend": glucose_trend,
        "riskTrend": risk_trend,
        "drTrend": dr_trend,
        "medicationTrend": medication_window["days"],
    }


# ─── Phase 1: Consent (reuses patient_profiles; no new collection) ────────────
@router.get("/consent")
def get_patient_consent(current_user: dict = Depends(get_current_user)):
    db = get_db()
    profile = db["patient_profiles"].find_one(
        {"userId": current_user["_id"]},
        {"consents": 1},
    ) or {}

    consents = []
    for item in profile.get("consents", []):
        consent = dict(item)
        if "updatedAt" in consent:
            consent["updatedAt"] = _as_iso(consent["updatedAt"])
        consents.append(consent)

    return {"consents": consents}


@router.post("/consent")
def set_patient_consent(
    data: ConsentUpdate,
    current_user: dict = Depends(get_current_user),
):
    scope = data.scope.strip().lower()
    if not scope:
        raise HTTPException(status_code=400, detail="Consent scope is required")

    db = get_db()
    patient_id = current_user["_id"]
    profile = db["patient_profiles"].find_one({"userId": patient_id}) or {}
    now = datetime.utcnow()

    consents = [
        dict(item)
        for item in profile.get("consents", [])
        if str(item.get("scope", "")).strip().lower() != scope
    ]
    consent_item = {
        "scope": scope,
        "granted": data.granted,
        "updatedAt": now,
    }
    consents.append(consent_item)

    db["patient_profiles"].update_one(
        {"userId": patient_id},
        {
            "$set": {
                "consents": consents,
                "updatedAt": now,
            },
            "$setOnInsert": {
                "userId": patient_id,
                "email": current_user.get("email", ""),
                "username": current_user.get("username", ""),
                "createdAt": now,
            },
        },
        upsert=True,
    )

    return {
        "message": "Consent updated successfully",
        "consent": {
            **consent_item,
            "updatedAt": _as_iso(consent_item["updatedAt"]),
        },
        "consents": [
            {
                **item,
                "updatedAt": _as_iso(item.get("updatedAt")),
            }
            for item in consents
        ],
    }


# ─── Phase 8: Care-navigation integration ─────────────────────────────────────
@router.post("/care-navigation", status_code=201)
def record_care_navigation(
    data: CareNavigationCreate,
    current_user: dict = Depends(get_current_user),
):
    """Record a lightweight care-navigation event in the existing patient history.

    No new collection is introduced. The Clinic Locator remains an external search
    feature; only the patient's explicit action (for example opening directions) is
    retained so the final longitudinal timeline can show that care-navigation step.
    """
    db = get_db()
    patient_id = current_user["_id"]
    now = datetime.utcnow()
    clinic_name = data.clinicName.strip()
    clinic_id = (data.clinicId or clinic_name).strip()
    day_key = now.date().isoformat()
    action_key = data.action.lower()

    # One event per clinic/action/day keeps repeated map taps from flooding history.
    source_id = f"clinic:{clinic_id}:{action_key}:{day_key}"
    event_doc = {
        "patientId": patient_id,
        "sourceId": source_id,
        "type": "Clinic Navigation",
        "title": (
            f"Directions to {clinic_name}"
            if data.action == "Directions"
            else f"Viewed {clinic_name}"
        ),
        "date": day_key,
        "status": "Opened",
        "created_at": now,
        "updated_at": now,
        "metadata": {
            "clinicId": data.clinicId,
            "clinicName": clinic_name,
            "address": (data.address or "").strip(),
            "action": data.action,
            "searchMode": data.searchMode,
            "city": (data.city or "").strip(),
            "latitude": data.latitude,
            "longitude": data.longitude,
        },
    }

    db["patient_history"].update_one(
        {
            "patientId": patient_id,
            "sourceId": source_id,
            "type": "Clinic Navigation",
        },
        {"$setOnInsert": event_doc},
        upsert=True,
    )
    saved = db["patient_history"].find_one(
        {
            "patientId": patient_id,
            "sourceId": source_id,
            "type": "Clinic Navigation",
        }
    ) or event_doc

    return {
        "message": "Care navigation recorded",
        "history": {
            "id": str(saved.get("_id") or source_id),
            "type": "Clinic Navigation",
            "title": saved.get("title", event_doc["title"]),
            "date": saved.get("date", day_key),
            "status": saved.get("status", "Opened"),
        },
    }


# ─── Phase 8: Integrated Patient Dashboard ────────────────────────────────────
@router.get("/dashboard")
def patient_dashboard(current_user: dict = Depends(get_current_user)):
    db = get_db()
    patient_id = current_user["_id"]

    reports_count = db["reports"].count_documents({"patientId": patient_id})
    predictions_count = db["predictions"].count_documents({"patientId": patient_id})

    latest_pred_doc = db["predictions"].find_one(
        {"patientId": patient_id},
        sort=[("created_at", -1), ("createdAt", -1), ("date", -1)],
    )
    latest_prediction = None
    eye_health = "No screening"
    if latest_pred_doc:
        status = str(latest_pred_doc.get("status") or "Completed")
        stage = _prediction_stage(latest_pred_doc)
        latest_prediction = {
            "id": str(latest_pred_doc["_id"]),
            "stage": stage or ("Screening submitted" if status in {"Pending", "Processing"} else "Analysis"),
            "confidence": latest_pred_doc.get("confidence") or "",
            "riskScore": _prediction_risk(latest_pred_doc),
            "date": _prediction_date(latest_pred_doc),
            "status": status,
        }
        if status in {"Pending", "Processing"}:
            eye_health = "Processing"
        elif stage:
            eye_health = stage
        else:
            eye_health = "Screening available"

    recent_reports_docs = list(
        db["reports"].find(
            {"patientId": patient_id},
            sort=[("created_at", -1), ("generatedAt", -1), ("uploadDate", -1)],
            limit=5,
        )
    )
    recent_reports = []
    for report in recent_reports_docs:
        report_date = (
            report.get("uploadDate")
            or _as_iso(report.get("generatedAt"))
            or _as_iso(report.get("created_at"))
        )
        generated = bool(report.get("reportKind") == "AutomatedMedicalPDF")
        recent_reports.append(
            {
                "id": str(report["_id"]),
                "title": (
                    "Automated Medical PDF"
                    if generated
                    else report.get("reportType", "Clinical Report")
                ),
                "date": report_date,
                "status": report.get("status", "Completed"),
            }
        )

    return {
        "stats": {
            "eyeHealth": eye_health,
            "reports": str(reports_count),
            "predictions": str(predictions_count),
            # Keep the original dashboard contract untouched. A future connection
            # counter can replace this when the connection schema is finalized.
            "doctors": "1",
        },
        "latestPrediction": latest_prediction,
        "recentReports": recent_reports,
    }


# ─── Phase 8: Unified longitudinal patient history ─────────────────────────────
@router.get("/history")
def patient_history(current_user: dict = Depends(get_current_user)):
    """Return one read-only timeline assembled from existing authoritative data.

    Phase 8 intentionally does not copy predictions, health metrics, prescriptions,
    or adherence into a new database. It composes them here and also includes
    genuine event records already stored in ``patient_history`` (for example vision
    tests and Clinic Locator directions).
    """
    db = get_db()
    patient_id = current_user["_id"]
    history: list[dict] = []

    def date_value(doc: dict, *fields: str) -> str:
        for field in fields:
            value = doc.get(field)
            if value not in (None, ""):
                return _as_iso(value)
        return ""

    # Screening and uploaded/generated report history.
    reports = list(db["reports"].find({"patientId": patient_id}))
    for report in reports:
        generated = bool(report.get("reportKind") == "AutomatedMedicalPDF")
        report_date = date_value(report, "uploadDate", "generatedAt", "created_at", "createdAt")
        title = (
            "Automated Medical PDF"
            if generated
            else report.get("reportType", "Clinical Report")
        )
        history.append(
            {
                "id": str(report["_id"]),
                "type": "Generated Report" if generated else "Report",
                "title": title,
                "date": report_date,
                "status": report.get("status", "Completed"),
            }
        )

        # Preserve the previous record-keeping behavior without duplicating data.
        db["patient_history"].update_one(
            {"patientId": patient_id, "sourceId": str(report["_id"]), "type": "Report"},
            {
                "$setOnInsert": {
                    "patientId": patient_id,
                    "sourceId": str(report["_id"]),
                    "type": "Report",
                    "title": title,
                    "date": report_date,
                    "status": report.get("status", "Completed"),
                    "created_at": report.get("created_at", datetime.utcnow()),
                }
            },
            upsert=True,
        )

    predictions = list(db["predictions"].find({"patientId": patient_id}))
    for prediction in predictions:
        status = str(prediction.get("status") or "Completed")
        stage = _prediction_stage(prediction)
        if stage:
            title = f"AI Screening – {stage}"
        elif status in {"Pending", "Processing"}:
            title = f"AI Screening – {status}"
        else:
            title = "AI Screening"
        history.append(
            {
                "id": str(prediction["_id"]),
                "type": "Prediction",
                "title": title,
                "date": _prediction_date(prediction),
                "status": status,
                "result": stage or "",
                "confidence": str(prediction.get("confidence") or ""),
            }
        )

    prescriptions = list(db["prescriptions"].find({"patientId": patient_id}))
    prescription_map = {str(item["_id"]): item for item in prescriptions}
    for prescription in prescriptions:
        source = prescription.get("source") or (
            "Doctor" if prescription.get("doctorId") else "Patient"
        )
        lifecycle, _remaining = _prescription_lifecycle(prescription)
        medication_name = prescription.get("medicationDetails") or "Medication"
        history.append(
            {
                "id": str(prescription["_id"]),
                "type": "Prescription",
                "title": f"{medication_name} – {source}",
                "date": date_value(prescription, "date", "startDate", "created_at", "createdAt"),
                "status": lifecycle,
            }
        )

    # Historical HbA1c/glucose measurements are surfaced without duplicating them.
    metrics = list(
        db["health_metrics"].find(
            {"patientId": patient_id},
            sort=[("recordedAt", -1)],
            limit=200,
        )
    )
    for metric in metrics:
        parts = []
        if metric.get("hba1c") is not None:
            parts.append(f"HbA1c {float(metric['hba1c']):g}%")
        if metric.get("bloodGlucose") is not None:
            parts.append(f"Glucose {float(metric['bloodGlucose']):g}")
        history.append(
            {
                "id": str(metric["_id"]),
                "type": "Health Metric",
                "title": " • ".join(parts) or "Health metric recorded",
                "date": date_value(metric, "recordedAt", "createdAt"),
                "status": "Recorded",
            }
        )

    # Only persisted dose actions are added to the timeline; derived missed doses
    # remain in the adherence graphs so the history does not become artificially noisy.
    adherence_records = list(
        db["medication_adherence"].find(
            {"patientId": patient_id},
            sort=[("scheduledDate", -1), ("updatedAt", -1)],
            limit=200,
        )
    )
    for record in adherence_records:
        prescription = prescription_map.get(str(record.get("prescriptionId") or ""), {})
        medication_name = prescription.get("medicationDetails") or "Medication"
        dose_key = str(record.get("doseKey") or "Daily")
        status = str(record.get("status") or "Pending")
        history.append(
            {
                "id": str(record["_id"]),
                "type": "Medication Adherence",
                "title": f"{medication_name} – {dose_key} dose",
                "date": str(record.get("scheduledDate") or date_value(record, "updatedAt", "createdAt")),
                "status": status,
                "result": str(record.get("scheduledTime") or MEDICATION_TIME_LABELS.get(dose_key, dose_key)),
            }
        )

    # Include existing non-duplicated activity events such as vision tests and
    # Phase 8 Clinic Locator directions.
    event_docs = list(
        db["patient_history"].find(
            {"patientId": patient_id},
            sort=[("created_at", -1)],
            limit=300,
        )
    )
    duplicate_types = {"report", "prescription", "prediction"}
    for event in event_docs:
        event_type = str(event.get("type") or "Activity")
        if event_type.strip().lower() in duplicate_types:
            continue
        history.append(
            {
                "id": str(event.get("_id") or event.get("sourceId") or ""),
                "type": event_type,
                "title": event.get("title") or event_type,
                "date": date_value(event, "date", "created_at", "createdAt"),
                "status": event.get("status", "Completed"),
            }
        )

    # Dedupe defensively and keep the newest event first. ISO timestamps and
    # YYYY-MM-DD values sort correctly together for this timeline.
    unique: list[dict] = []
    seen: set[tuple[str, str, str, str]] = set()
    for item in history:
        key = (
            str(item.get("type") or ""),
            str(item.get("id") or ""),
            str(item.get("title") or ""),
            str(item.get("date") or ""),
        )
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)

    unique.sort(key=lambda item: str(item.get("date") or ""), reverse=True)
    return {"history": unique}


# ─── Phase 7: Patient document upload / retinal-screening submission ───────────
@router.post("/upload")
def patient_upload_report(
    reportType: str = Form(...),
    description: str = Form(""),
    uploadType: str = Form(""),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Store ordinary documents as reports and retinal images as predictions.

    Phase 7 deliberately creates only the prediction *contract*. The AI model is
    not invoked here. A retinal image is persisted in GridFS and a Pending
    prediction record is created so a later model worker can update that exact
    document through Pending -> Processing -> Completed.

    `uploadType` is optional for backward compatibility. New clients should send
    either `retinal_image` or `document`. If it is omitted, only an image whose
    report type explicitly looks like a retinal/fundus screening is treated as a
    screening. Other images remain normal documents.
    """
    normalized_upload_type = str(uploadType or "").strip().lower().replace("-", "_")
    content_type = str(file.content_type or "").strip().lower()
    report_type_lower = str(reportType or "").strip().lower()

    retinal_aliases = {"retinal_image", "retinal", "fundus", "screening"}
    document_aliases = {"document", "report", "clinical_document", "file"}

    if normalized_upload_type in retinal_aliases:
        is_retinal_image = True
    elif normalized_upload_type in document_aliases:
        is_retinal_image = False
    elif normalized_upload_type:
        raise HTTPException(
            status_code=400,
            detail="uploadType must be either 'retinal_image' or 'document'",
        )
    else:
        retinal_hint = any(
            token in report_type_lower
            for token in ("retinal", "fundus", "screening")
        )
        is_retinal_image = content_type.startswith("image/") and retinal_hint

    if is_retinal_image and content_type not in {"image/jpeg", "image/jpg", "image/png"}:
        raise HTTPException(
            status_code=400,
            detail="Retinal screening requires a JPEG or PNG fundus image",
        )

    # Existing storage helper keeps the current MIME allow-list and 5 MB limit.
    file_id = upload_file_to_gridfs(file)
    db = get_db()
    now = datetime.utcnow()
    patient_id = current_user["_id"]

    if is_retinal_image:
        prediction_doc = {
            "patientId": patient_id,
            "fileId": file_id,
            "fileName": file.filename or "retinal-fundus-image.jpg",
            "contentType": content_type or "image/jpeg",
            "source": "PatientUpload",
            "status": "Pending",
            # Reserved model-output fields. A future model worker updates these
            # on this same prediction document instead of creating a new record.
            "stage": None,
            "confidence": None,
            "riskScore": None,
            "findings": [],
            "recommendations": [],
            "gradCam": None,
            "date": now.strftime("%Y-%m-%d"),
            "created_at": now,
            "updated_at": now,
        }
        result = db["predictions"].insert_one(prediction_doc)
        prediction_id = str(result.inserted_id)

        return {
            "message": "Retinal screening submitted successfully",
            "predictionId": prediction_id,
            "status": "Pending",
            "type": "retinal_image",
        }

    report_doc = {
        "reportType": reportType,
        "description": description,
        "patientId": patient_id,
        "uploadedByUserId": patient_id,
        "uploaderRole": "Patient",
        "fileName": file.filename,
        "fileId": file_id,
        "uploadDate": now.strftime("%Y-%m-%d"),
        "created_at": now,
        "updated_at": now,
        "status": "Completed",
    }
    result = db["reports"].insert_one(report_doc)
    return {
        "message": "Document uploaded successfully",
        "reportId": str(result.inserted_id),
        "type": "document",
    }


# â”€â”€â”€ Patient Reports â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@router.get("/reports")
def list_patient_reports(current_user: dict = Depends(get_current_user)):
    db = get_db()
    reports = list(db["reports"].find({"patientId": current_user["_id"]}))
    result = []
    for r in reports:
        r["id"] = str(r.pop("_id"))
        result.append(r)
    return {"reports": result}


# â”€â”€â”€ Predictions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@router.get("/predictions/{prediction_id}")
def get_prediction(prediction_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    try:
        object_id = ObjectId(prediction_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid prediction ID format")

    pred = db["predictions"].find_one({"_id": object_id, "patientId": current_user["_id"]})
    if not pred:
        raise HTTPException(status_code=404, detail="Prediction not found")

    pred["id"] = str(pred.pop("_id"))
    pred["predictionId"] = pred["id"]
    pred["status"] = pred.get("status") or "Completed"
    return pred
