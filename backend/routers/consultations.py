from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from access_control import (
    has_patient_connection,
    record_clinical_access,
    require_doctor_privilege,
    require_hospital_doctor_affiliation,
    require_patient_access,
    require_verified_provider,
)
from consultation_service import (
    EDUCATION_LIBRARY,
    object_id,
    patient_summary,
    serialize_encounter,
    validate_education_keys,
)
from credential_privilege_service import PRIVILEGE_CODES, hospital_name
from database import get_db
from dependencies import RoleChecker, VerifiedProviderChecker, get_current_user

router = APIRouter(prefix="/api/consultations", tags=["Consultations"])


class FindingInput(BaseModel):
    finding: str = Field(min_length=1, max_length=300)
    severity: Literal["Not specified", "Mild", "Moderate", "Severe"] = "Not specified"
    eye: Literal["Not specified", "Right", "Left", "Both"] = "Not specified"
    note: str = Field(default="", max_length=1000)


class ObservationInput(BaseModel):
    observation: str = Field(min_length=1, max_length=500)
    clinicalNote: str = Field(default="", max_length=2000)
    recordedAt: Optional[str] = Field(default=None, max_length=64)
    doctorId: Optional[str] = Field(default=None, max_length=128)
    doctorName: Optional[str] = Field(default=None, max_length=160)


class ProcedureInput(BaseModel):
    procedureType: str = Field(min_length=1, max_length=240)
    procedureCode: str = Field(default="", max_length=80)
    outcome: str = Field(default="", max_length=1000)
    notes: str = Field(default="", max_length=2000)


class MedicationReviewInput(BaseModel):
    reviewed: bool = False
    notes: str = Field(default="", max_length=3000)


class NextActionInput(BaseModel):
    type: Literal[
        "",
        "none",
        "follow_up",
        "new_screening",
        "referral",
        "medication_change",
        "further_investigation",
    ] = ""
    details: str = Field(default="", max_length=2000)


class FollowUpInput(BaseModel):
    required: bool = False
    dueDate: str = Field(default="", max_length=32)
    reason: str = Field(default="", max_length=1000)


class EncounterUpdate(BaseModel):
    hospitalId: Optional[str] = Field(default=None, max_length=128)
    findings: Optional[list[FindingInput]] = None
    observations: Optional[list[ObservationInput]] = None
    procedures: Optional[list[ProcedureInput]] = None
    clinicalNotes: Optional[str] = Field(default=None, max_length=10000)
    medicationReview: Optional[MedicationReviewInput] = None
    educationTopicKeys: Optional[list[str]] = None
    nextAction: Optional[NextActionInput] = None
    patientInstructions: Optional[str] = Field(default=None, max_length=6000)
    followUp: Optional[FollowUpInput] = None


class AddendumCreate(BaseModel):
    text: str = Field(min_length=3, max_length=5000)


PROCEDURE_PRIVILEGE_KEYWORDS = (
    ("laser", "laser_procedure"),
    ("surg", "surgical_procedure"),
    ("oct", "oct_review"),
    ("fundus", "fundus_image_review"),
    ("retinal", "retinal_examination"),
)


def _procedure_privilege_code(item: dict) -> str:
    explicit = str(item.get("procedureCode") or "").strip().lower()
    if explicit in PRIVILEGE_CODES:
        return explicit
    name = str(item.get("procedureType") or "").strip().lower()
    for keyword, code in PROCEDURE_PRIVILEGE_KEYWORDS:
        if keyword in name:
            return code
    return ""


def _validate_hospital_procedure_authority(
    db,
    encounter: dict,
    current_user: dict,
    hospital_id: str,
    procedures: list[dict],
) -> None:
    doctor_id = str(current_user.get("_id") or encounter.get("doctorId") or "")
    hospital_id = str(hospital_id or "").strip()
    governed_codes = [code for code in (_procedure_privilege_code(item) for item in procedures) if code]

    if not hospital_id:
        if governed_codes:
            raise HTTPException(
                status_code=422,
                detail="Select an active hospital affiliation before recording a hospital-governed procedure.",
            )
        return

    require_hospital_doctor_affiliation(hospital_id, doctor_id, db)
    # Documenting a consultation under a hospital context itself requires the
    # hospital's General Eye Consultation privilege.
    require_doctor_privilege(doctor_id, hospital_id, "general_eye_consultation", db)
    for code in governed_codes:
        require_doctor_privilege(doctor_id, hospital_id, code, db)


def _appointment_or_404(db, appointment_id: str) -> dict:
    appointment = db["appointments"].find_one({"_id": object_id(appointment_id, "appointment")})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appointment


def _encounter_or_404(db, encounter_id: str) -> dict:
    encounter = db["clinical_encounters"].find_one({"_id": object_id(encounter_id, "encounter")})
    if not encounter:
        raise HTTPException(status_code=404, detail="Consultation not found")
    return encounter


def _doctor_owns(encounter: dict, current_user: dict) -> bool:
    return str(encounter.get("doctorId") or "") == str(current_user.get("_id") or "")


def _patient_owns(encounter: dict, current_user: dict) -> bool:
    return str(encounter.get("patientId") or "") == str(current_user.get("_id") or "")


def _authorize_doctor_encounter(db, encounter: dict, current_user: dict, scope: str):
    require_verified_provider(current_user, db)
    if not _doctor_owns(encounter, current_user):
        raise HTTPException(status_code=403, detail="This consultation belongs to another doctor")
    return require_patient_access(
        current_user=current_user,
        patient_id=str(encounter.get("patientId") or ""),
        scope=scope,
        db=db,
    )


def _historical_doctor_access(db, encounter: dict, current_user: dict) -> tuple[str, str, bool]:
    """Allow the authoring doctor to retain the completed encounter record.

    A revoked care connection must not expose *current* patient data, so live
    context is returned only while an accepted connection still exists.
    """
    require_verified_provider(current_user, db)
    if not _doctor_owns(encounter, current_user):
        raise HTTPException(status_code=403, detail="This consultation belongs to another doctor")
    patient_id = str(encounter.get("patientId") or "")
    connected = has_patient_connection(current_user, patient_id, db)
    if connected:
        return "care_connection", "accepted_care_connection", True
    return "historical_encounter", "authored_completed_encounter", False


def _clinical_snapshot_for_completion(encounter: dict) -> dict:
    """Small immutable encounter-owned snapshot, not a copy of live patient datasets."""
    return {
        "reasonForVisit": encounter.get("reasonForVisit") or "",
        "hospitalId": encounter.get("hospitalId") or "",
        "hospitalName": encounter.get("hospitalName") or "",
        "findings": encounter.get("findings") or [],
        "procedures": encounter.get("procedures") or [],
        "nextAction": encounter.get("nextAction") or {},
        "patientInstructions": encounter.get("patientInstructions") or "",
        "medicationReview": encounter.get("medicationReview") or {},
    }


def _validate_completion(encounter: dict) -> list[str]:
    missing: list[str] = []
    if not str(encounter.get("clinicalNotes") or "").strip():
        missing.append("Clinical notes")
    if not bool((encounter.get("medicationReview") or {}).get("reviewed")):
        missing.append("Medication review")
    if not str(encounter.get("patientInstructions") or "").strip():
        missing.append("Patient instructions")
    action_type = str((encounter.get("nextAction") or {}).get("type") or "").strip()
    if not action_type:
        missing.append("Follow-up / next-action decision")
    follow_up = encounter.get("followUp") or {}
    if action_type == "follow_up" or bool(follow_up.get("required")):
        due_date = str(follow_up.get("dueDate") or "").strip()
        if not due_date:
            missing.append("Follow-up date")
        else:
            try:
                datetime.strptime(due_date, "%Y-%m-%d")
            except ValueError:
                missing.append("Valid follow-up date (YYYY-MM-DD)")
        if not str(follow_up.get("reason") or "").strip():
            missing.append("Follow-up reason")
    return missing


@router.get("/education-options", dependencies=[Depends(RoleChecker(["Doctor"])), Depends(VerifiedProviderChecker())])
def education_options(current_user: dict = Depends(get_current_user)):
    db = get_db()
    require_verified_provider(current_user, db)
    return {"topics": EDUCATION_LIBRARY}


@router.post(
    "/from-appointment/{appointment_id}",
    dependencies=[Depends(RoleChecker(["Doctor"])), Depends(VerifiedProviderChecker())],
)
def start_consultation(appointment_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    require_verified_provider(current_user, db)
    appointment = _appointment_or_404(db, appointment_id)

    if str(appointment.get("doctorId") or "") != str(current_user.get("_id") or ""):
        raise HTTPException(status_code=403, detail="You can only start your own appointments")
    if str(appointment.get("status") or "") != "Confirmed":
        raise HTTPException(status_code=409, detail="Only a confirmed appointment can start a consultation")

    patient_id = str(appointment.get("patientId") or "")
    decision = require_patient_access(
        current_user=current_user,
        patient_id=patient_id,
        scope="consultation.write",
        db=db,
    )

    existing = db["clinical_encounters"].find_one({"appointmentId": appointment_id})
    if existing:
        if str(existing.get("doctorId") or "") != str(current_user.get("_id") or ""):
            raise HTTPException(status_code=403, detail="Consultation ownership mismatch")
        if str(existing.get("status") or "") == "completed":
            return serialize_encounter(db, existing, include_context=True)
        return serialize_encounter(db, existing, include_context=True)

    now = datetime.utcnow()
    doc = {
        "appointmentId": appointment_id,
        "patientId": patient_id,
        "patientName": appointment.get("patientName") or "Patient",
        "doctorId": str(current_user.get("_id") or ""),
        "doctorName": current_user.get("name") or appointment.get("doctorName") or "Doctor",
        "hospitalId": "",
        "hospitalName": "",
        "reasonForVisit": appointment.get("reason") or "",
        "status": "in_progress",
        "startedAt": now,
        "completedAt": None,
        "findings": [],
        "observations": [],
        "procedures": [],
        "clinicalNotes": "",
        "medicationReconciliationId": None,
        "medicationReview": {"reviewed": False, "notes": ""},
        "educationAssignments": [],
        "nextAction": {"type": "", "details": ""},
        "patientInstructions": "",
        "followUp": {"required": False, "dueDate": "", "reason": ""},
        "revision": 0,
        "createdAt": now,
        "updatedAt": now,
    }
    result = db["clinical_encounters"].insert_one(doc)
    doc["_id"] = result.inserted_id

    record_clinical_access(
        current_user=current_user,
        patient_id=patient_id,
        action="START_CONSULTATION",
        resource_type="clinical_encounter",
        resource_id=str(result.inserted_id),
        access_channel=decision.access_channel,
        scope=decision.scope,
        reason=decision.reason,
        db=db,
    )
    return serialize_encounter(db, doc, include_context=True)


@router.get(
    "/doctor",
    dependencies=[Depends(RoleChecker(["Doctor"])), Depends(VerifiedProviderChecker())],
)
def list_doctor_consultations(
    status: Optional[str] = Query(default=None),
    patient_id: Optional[str] = Query(default=None, alias="patientId"),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    require_verified_provider(current_user, db)
    query: dict = {"doctorId": str(current_user.get("_id") or "")}
    if status:
        normalized = str(status).strip().lower()
        if normalized not in {"draft", "in_progress", "completed"}:
            raise HTTPException(status_code=400, detail="Invalid consultation status")
        query["status"] = normalized
    if patient_id:
        query["patientId"] = str(patient_id)
    docs = list(db["clinical_encounters"].find(query).sort("updatedAt", -1).limit(100))
    return {"consultations": [serialize_encounter(db, item, include_context=False) for item in docs]}


@router.get("/patient", dependencies=[Depends(RoleChecker(["Patient"]))])
def list_patient_consultations(current_user: dict = Depends(get_current_user)):
    db = get_db()
    docs = list(
        db["clinical_encounters"].find(
            {"patientId": str(current_user.get("_id") or ""), "status": "completed"}
        ).sort("completedAt", -1).limit(100)
    )
    return {"consultations": [patient_summary(db, item) for item in docs]}


@router.get("/{encounter_id}")
def get_consultation(encounter_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    encounter = _encounter_or_404(db, encounter_id)
    role = str(current_user.get("role") or "")

    if role == "Doctor":
        if str(encounter.get("status") or "") == "completed":
            channel, reason, include_context = _historical_doctor_access(db, encounter, current_user)
            scope = "consultation.read"
        else:
            decision = _authorize_doctor_encounter(db, encounter, current_user, "consultation.read")
            channel, reason, include_context = decision.access_channel, decision.reason, True
            scope = decision.scope
        record_clinical_access(
            current_user=current_user,
            patient_id=str(encounter.get("patientId") or ""),
            action="VIEW_CONSULTATION",
            resource_type="clinical_encounter",
            resource_id=encounter_id,
            access_channel=channel,
            scope=scope,
            reason=reason,
            db=db,
        )
        return serialize_encounter(db, encounter, include_context=include_context)

    if role == "Patient" and _patient_owns(encounter, current_user):
        if str(encounter.get("status") or "") != "completed":
            raise HTTPException(status_code=403, detail="Visit summary is available after the consultation is completed")
        return patient_summary(db, encounter)

    raise HTTPException(status_code=403, detail="You are not allowed to view this consultation")


@router.patch(
    "/{encounter_id}",
    dependencies=[Depends(RoleChecker(["Doctor"])), Depends(VerifiedProviderChecker())],
)
def autosave_consultation(
    encounter_id: str,
    payload: EncounterUpdate,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    encounter = _encounter_or_404(db, encounter_id)
    _authorize_doctor_encounter(db, encounter, current_user, "consultation.write")

    if str(encounter.get("status") or "") == "completed":
        raise HTTPException(status_code=409, detail="Completed consultations are read-only. Add an addendum instead.")

    values = payload.model_dump(exclude_unset=True)
    update: dict = {}

    raw_hospital_id = values.get("hospitalId") if "hospitalId" in values else encounter.get("hospitalId")
    effective_hospital_id = str(raw_hospital_id or "").strip()
    effective_procedures = values.get("procedures") if "procedures" in values else (encounter.get("procedures") or [])
    _validate_hospital_procedure_authority(
        db, encounter, current_user, effective_hospital_id, effective_procedures or []
    )

    if "hospitalId" in values:
        update["hospitalId"] = effective_hospital_id
        update["hospitalName"] = hospital_name(db, effective_hospital_id) if effective_hospital_id else ""

    for key in ("findings", "observations", "procedures", "clinicalNotes", "patientInstructions"):
        if key in values:
            update[key] = values[key]
    if "medicationReview" in values:
        update["medicationReview"] = values["medicationReview"]
    if "nextAction" in values:
        update["nextAction"] = values["nextAction"]
    if "followUp" in values:
        update["followUp"] = values["followUp"]
    if "educationTopicKeys" in values:
        update["educationAssignments"] = validate_education_keys(values["educationTopicKeys"] or [])

    if not update:
        return serialize_encounter(db, encounter, include_context=True)

    update["status"] = "in_progress"
    update["updatedAt"] = datetime.utcnow()
    db["clinical_encounters"].update_one(
        {"_id": encounter["_id"]},
        {"$set": update, "$inc": {"revision": 1}},
    )
    saved = db["clinical_encounters"].find_one({"_id": encounter["_id"]})
    return serialize_encounter(db, saved, include_context=True)


@router.post(
    "/{encounter_id}/complete",
    dependencies=[Depends(RoleChecker(["Doctor"])), Depends(VerifiedProviderChecker())],
)
def complete_consultation(encounter_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    encounter = _encounter_or_404(db, encounter_id)
    decision = _authorize_doctor_encounter(db, encounter, current_user, "consultation.write")

    if str(encounter.get("status") or "") == "completed":
        return serialize_encounter(db, encounter, include_context=True)

    _validate_hospital_procedure_authority(
        db,
        encounter,
        current_user,
        str(encounter.get("hospitalId") or ""),
        encounter.get("procedures") or [],
    )

    missing = _validate_completion(encounter)
    if missing:
        raise HTTPException(
            status_code=422,
            detail="Complete these items before finishing the visit: " + ", ".join(missing),
        )

    now = datetime.utcnow()
    patient_id = str(encounter.get("patientId") or "")
    doctor_id = str(encounter.get("doctorId") or "")
    doctor_name = str(encounter.get("doctorName") or current_user.get("name") or "Doctor")
    appointment_id = str(encounter.get("appointmentId") or "")
    encounter_id_text = str(encounter.get("_id"))

    # Idempotent side effects: retries cannot duplicate history/follow-up/education.
    if appointment_id and ObjectId.is_valid(appointment_id):
        db["appointments"].update_one(
            {"_id": ObjectId(appointment_id), "doctorId": doctor_id, "patientId": patient_id},
            {"$set": {"status": "Completed", "updatedAt": now, "completedByEncounterId": encounter_id_text}},
        )

    db["patient_history"].update_one(
        {"patientId": patient_id, "sourceId": encounter_id_text, "type": "Consultation"},
        {
            "$set": {
                "title": f"Consultation with {doctor_name}",
                "date": now.strftime("%Y-%m-%d"),
                "status": "Completed",
                "result": str((encounter.get("nextAction") or {}).get("type") or "none"),
                "updated_at": now,
            },
            "$setOnInsert": {"patientId": patient_id, "sourceId": encounter_id_text, "type": "Consultation", "created_at": now},
        },
        upsert=True,
    )

    follow_up = encounter.get("followUp") or {}
    if bool(follow_up.get("required")) or str((encounter.get("nextAction") or {}).get("type") or "") == "follow_up":
        db["clinical_follow_ups"].update_one(
            {"encounterId": encounter_id_text},
            {
                "$set": {
                    "patientId": patient_id,
                    "doctorId": doctor_id,
                    "doctorName": doctor_name,
                    "dueDate": str(follow_up.get("dueDate") or ""),
                    "reason": str(follow_up.get("reason") or ""),
                    "status": "Scheduled",
                    "updatedAt": now,
                },
                "$setOnInsert": {"encounterId": encounter_id_text, "createdAt": now},
            },
            upsert=True,
        )

    assignments = encounter.get("educationAssignments") or []
    for assignment in assignments:
        topic_key = str(assignment.get("topicKey") or "")
        if not topic_key:
            continue
        db["education_assignments"].update_one(
            {"encounterId": encounter_id_text, "topicKey": topic_key},
            {
                "$set": {
                    "patientId": patient_id,
                    "doctorId": doctor_id,
                    "doctorName": doctor_name,
                    "title": assignment.get("title") or topic_key,
                    "status": "assigned",
                    "assignedAt": now,
                },
                "$setOnInsert": {"encounterId": encounter_id_text, "topicKey": topic_key},
            },
            upsert=True,
        )

    notification_key = f"consultation_completed:{encounter_id_text}"
    db["notifications"].update_one(
        {"userId": patient_id, "eventKey": notification_key},
        {
            "$set": {
                "title": "Visit summary ready",
                "message": f"Your consultation with {doctor_name} is complete. Your visit summary is ready to review.",
                "type": "consultation",
                "read": False,
                "relatedId": encounter_id_text,
                "createdAt": now,
            },
            "$setOnInsert": {"userId": patient_id, "eventKey": notification_key},
        },
        upsert=True,
    )

    db["clinical_encounters"].update_one(
        {"_id": encounter["_id"], "status": {"$ne": "completed"}},
        {
            "$set": {
                "status": "completed",
                "completedAt": now,
                "updatedAt": now,
                "completionSnapshot": _clinical_snapshot_for_completion(encounter),
            },
            "$inc": {"revision": 1},
        },
    )
    completed = db["clinical_encounters"].find_one({"_id": encounter["_id"]})

    record_clinical_access(
        current_user=current_user,
        patient_id=patient_id,
        action="COMPLETE_CONSULTATION",
        resource_type="clinical_encounter",
        resource_id=encounter_id_text,
        access_channel=decision.access_channel,
        scope=decision.scope,
        reason=decision.reason,
        db=db,
    )
    return serialize_encounter(db, completed, include_context=True)


@router.post(
    "/{encounter_id}/addenda",
    dependencies=[Depends(RoleChecker(["Doctor"])), Depends(VerifiedProviderChecker())],
)
def add_consultation_addendum(
    encounter_id: str,
    payload: AddendumCreate,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    encounter = _encounter_or_404(db, encounter_id)
    if str(encounter.get("status") or "") != "completed":
        raise HTTPException(status_code=409, detail="Addenda are only used after a consultation is completed")
    channel, reason, _ = _historical_doctor_access(db, encounter, current_user)

    now = datetime.utcnow()
    doc = {
        "encounterId": encounter_id,
        "patientId": str(encounter.get("patientId") or ""),
        "doctorId": str(current_user.get("_id") or ""),
        "doctorName": current_user.get("name") or encounter.get("doctorName") or "Doctor",
        "text": payload.text.strip(),
        "createdAt": now,
    }
    result = db["clinical_encounter_addenda"].insert_one(doc)
    doc["_id"] = result.inserted_id

    record_clinical_access(
        current_user=current_user,
        patient_id=str(encounter.get("patientId") or ""),
        action="ADD_CONSULTATION_ADDENDUM",
        resource_type="clinical_encounter",
        resource_id=encounter_id,
        access_channel=channel,
        scope="consultation.write",
        reason=reason,
        db=db,
    )
    return {
        "id": str(result.inserted_id),
        "encounterId": encounter_id,
        "doctorId": doc["doctorId"],
        "doctorName": doc["doctorName"],
        "text": doc["text"],
        "createdAt": now.isoformat(),
    }
