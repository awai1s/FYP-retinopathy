from __future__ import annotations

from datetime import datetime, date
from typing import Literal, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from access_control import record_clinical_access, require_patient_access, require_verified_provider
from database import get_db
from dependencies import RoleChecker, VerifiedProviderChecker, get_current_user

router = APIRouter(
    prefix="/api/medication-reconciliations",
    tags=["Medication Reconciliation"],
    dependencies=[Depends(RoleChecker(["Doctor"])), Depends(VerifiedProviderChecker())],
)

_ALLOWED_TIMES = {"Morning", "Noon", "Evening", "Night", "Daily"}


class MedicationPlanInput(BaseModel):
    medicationDetails: str = Field(min_length=1, max_length=500)
    dosage: str = Field(default="", max_length=240)
    times: list[str] = Field(default_factory=list, max_length=8)
    intakeInstruction: str = Field(default="", max_length=500)
    instructions: str = Field(default="", max_length=2000)
    notes: str = Field(default="", max_length=2000)


class ReconciliationActionInput(BaseModel):
    actionId: str = Field(min_length=8, max_length=120)
    action: Literal["confirmed", "changed", "stopped", "started"]
    prescriptionId: Optional[str] = Field(default=None, max_length=64)
    reason: str = Field(default="", max_length=1000)
    medication: Optional[MedicationPlanInput] = None


class ReconciliationCompleteInput(BaseModel):
    notes: str = Field(default="", max_length=3000)


def _oid(value: str, label: str) -> ObjectId:
    if not ObjectId.is_valid(str(value)):
        raise HTTPException(status_code=400, detail=f"Invalid {label} ID format")
    return ObjectId(str(value))


def _encounter_or_404(db, encounter_id: str) -> dict:
    encounter = db["clinical_encounters"].find_one({"_id": _oid(encounter_id, "encounter")})
    if not encounter:
        raise HTTPException(status_code=404, detail="Consultation not found")
    return encounter


def _authorize(db, encounter: dict, current_user: dict):
    require_verified_provider(current_user, db)
    if str(encounter.get("doctorId") or "") != str(current_user.get("_id") or ""):
        raise HTTPException(status_code=403, detail="This consultation belongs to another doctor")
    if str(encounter.get("status") or "") == "completed":
        raise HTTPException(status_code=409, detail="Completed consultations are read-only")
    return require_patient_access(
        current_user=current_user,
        patient_id=str(encounter.get("patientId") or ""),
        scope="medications.write",
        db=db,
    )


def _normalize_times(values: list[str] | None) -> list[str]:
    result: list[str] = []
    for value in values or []:
        item = str(value or "").strip().title()
        if item in _ALLOWED_TIMES and item not in result:
            result.append(item)
    return result


def _is_active(doc: dict) -> bool:
    if doc.get("active") is False or doc.get("stoppedAt"):
        return False
    end = str(doc.get("endDate") or "").strip()
    if end:
        try:
            return date.fromisoformat(end[:10]) >= datetime.utcnow().date()
        except ValueError:
            pass
    return True


def _serialize_prescription(doc: dict) -> dict:
    source = doc.get("source") or ("Doctor" if doc.get("doctorId") else "Patient")
    return {
        "id": str(doc.get("_id") or ""),
        "patientId": str(doc.get("patientId") or ""),
        "doctorId": str(doc.get("doctorId") or ""),
        "doctorName": doc.get("doctorName") or "",
        "source": source,
        "medicationDetails": doc.get("medicationDetails") or "Medication",
        "dosage": doc.get("dosage") or "",
        "times": _normalize_times(doc.get("times") or []),
        "intakeInstruction": doc.get("intakeInstruction") or "",
        "instructions": doc.get("instructions") or "",
        "notes": doc.get("notes") or "",
        "active": _is_active(doc),
        "startedAt": doc.get("startDate") or doc.get("date") or "",
        "stoppedAt": doc.get("stoppedAt").isoformat() if isinstance(doc.get("stoppedAt"), datetime) else doc.get("stoppedAt"),
        "reconciliationStatus": doc.get("reconciliationStatus") or "",
        "previousPrescriptionId": doc.get("previousPrescriptionId"),
    }


def _serialize_action(item: dict) -> dict:
    result = dict(item)
    for key in ("performedAt",):
        if isinstance(result.get(key), datetime):
            result[key] = result[key].isoformat()
    return result


def _ensure_reconciliation(db, encounter: dict, current_user: dict) -> dict:
    encounter_id = str(encounter["_id"])
    existing = db["medication_reconciliations"].find_one({"encounterId": encounter_id})
    if existing:
        return existing
    now = datetime.utcnow()
    doc = {
        "encounterId": encounter_id,
        "patientId": str(encounter.get("patientId") or ""),
        "doctorId": str(current_user.get("_id") or ""),
        "doctorName": current_user.get("name") or encounter.get("doctorName") or "Doctor",
        "status": "in_progress",
        "actions": [],
        "notes": "",
        "startedAt": now,
        "performedAt": None,
        "createdAt": now,
        "updatedAt": now,
    }
    result = db["medication_reconciliations"].insert_one(doc)
    doc["_id"] = result.inserted_id
    db["clinical_encounters"].update_one(
        {"_id": encounter["_id"]},
        {"$set": {"medicationReconciliationId": str(result.inserted_id), "updatedAt": now}},
    )
    return doc


def _active_medications(db, patient_id: str) -> list[dict]:
    docs = list(db["prescriptions"].find({"patientId": patient_id}).sort([("created_at", -1), ("date", -1)]))
    return [_serialize_prescription(doc) for doc in docs if _is_active(doc)]


def _serialize_reconciliation(db, reconciliation: dict, patient_id: str) -> dict:
    return {
        "id": str(reconciliation.get("_id") or ""),
        "encounterId": reconciliation.get("encounterId") or "",
        "patientId": patient_id,
        "doctorId": reconciliation.get("doctorId") or "",
        "doctorName": reconciliation.get("doctorName") or "Doctor",
        "status": reconciliation.get("status") or "in_progress",
        "actions": [_serialize_action(item) for item in reconciliation.get("actions") or []],
        "notes": reconciliation.get("notes") or "",
        "startedAt": reconciliation.get("startedAt").isoformat() if isinstance(reconciliation.get("startedAt"), datetime) else reconciliation.get("startedAt"),
        "performedAt": reconciliation.get("performedAt").isoformat() if isinstance(reconciliation.get("performedAt"), datetime) else reconciliation.get("performedAt"),
        "medications": _active_medications(db, patient_id),
    }


def _prescription_or_404(db, patient_id: str, prescription_id: str) -> dict:
    doc = db["prescriptions"].find_one({"_id": _oid(prescription_id, "prescription"), "patientId": patient_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Medication not found")
    return doc


def _new_medication_doc(patient_id: str, current_user: dict, medication: MedicationPlanInput, now: datetime, *, previous_id: str | None = None) -> dict:
    name = medication.medicationDetails.strip()
    return {
        "patientId": patient_id,
        "doctorId": str(current_user.get("_id") or ""),
        "doctorName": current_user.get("name") or "Doctor",
        "source": "Doctor",
        "medicationDetails": name,
        "dosage": medication.dosage.strip(),
        "times": _normalize_times(medication.times),
        "intakeInstruction": medication.intakeInstruction.strip(),
        "instructions": medication.instructions.strip(),
        "notes": medication.notes.strip(),
        "date": now.strftime("%Y-%m-%d"),
        "startDate": now.strftime("%Y-%m-%d"),
        "active": True,
        "previousPrescriptionId": previous_id,
        "created_at": now,
        "updated_at": now,
    }


def _history_event(db, patient_id: str, prescription_id: str, title: str, status: str, now: datetime):
    db["patient_history"].insert_one({
        "patientId": patient_id,
        "sourceId": prescription_id,
        "type": "Prescription",
        "title": title,
        "date": now.strftime("%Y-%m-%d"),
        "status": status,
        "created_at": now,
    })


@router.get("/encounter/{encounter_id}")
def get_reconciliation(encounter_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    encounter = _encounter_or_404(db, encounter_id)
    _authorize(db, encounter, current_user)
    reconciliation = _ensure_reconciliation(db, encounter, current_user)
    return _serialize_reconciliation(db, reconciliation, str(encounter.get("patientId") or ""))


@router.post("/encounter/{encounter_id}/actions")
def apply_reconciliation_action(
    encounter_id: str,
    payload: ReconciliationActionInput,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    encounter = _encounter_or_404(db, encounter_id)
    decision = _authorize(db, encounter, current_user)
    patient_id = str(encounter.get("patientId") or "")
    reconciliation = _ensure_reconciliation(db, encounter, current_user)

    # Idempotency: a retried mobile/web request must not duplicate Changed/Started meds.
    for action in reconciliation.get("actions") or []:
        if action.get("actionId") == payload.actionId:
            return _serialize_reconciliation(db, reconciliation, patient_id)

    now = datetime.utcnow()
    action_doc: dict = {
        "actionId": payload.actionId,
        "action": payload.action,
        "prescriptionId": payload.prescriptionId,
        "reason": payload.reason.strip(),
        "performedAt": now,
    }

    if payload.action in {"confirmed", "stopped", "changed"}:
        if not payload.prescriptionId:
            raise HTTPException(status_code=400, detail="Medication selection is required")
        old = _prescription_or_404(db, patient_id, payload.prescriptionId)
        if not _is_active(old) and payload.action != "confirmed":
            raise HTTPException(status_code=409, detail="This medication is no longer active")

        if payload.action == "confirmed":
            action_doc["medicationDetails"] = old.get("medicationDetails") or "Medication"

        elif payload.action == "stopped":
            db["prescriptions"].update_one(
                {"_id": old["_id"], "patientId": patient_id},
                {"$set": {
                    "active": False,
                    "stoppedAt": now,
                    "stoppedReason": payload.reason.strip(),
                    "reconciliationStatus": "stopped",
                    "updated_at": now,
                }},
            )
            action_doc["medicationDetails"] = old.get("medicationDetails") or "Medication"
            _history_event(db, patient_id, payload.prescriptionId, "Medication Stopped During Consultation", "Stopped", now)

        elif payload.action == "changed":
            if payload.medication is None:
                raise HTTPException(status_code=400, detail="Updated medication details are required")
            new_doc = _new_medication_doc(patient_id, current_user, payload.medication, now, previous_id=payload.prescriptionId)
            new_result = db["prescriptions"].insert_one(new_doc)
            new_id = str(new_result.inserted_id)
            db["prescriptions"].update_one(
                {"_id": old["_id"], "patientId": patient_id},
                {"$set": {
                    "active": False,
                    "stoppedAt": now,
                    "stoppedReason": payload.reason.strip() or "Changed during medication reconciliation",
                    "reconciliationStatus": "changed",
                    "replacedByPrescriptionId": new_id,
                    "updated_at": now,
                }},
            )
            action_doc.update({
                "medicationDetails": old.get("medicationDetails") or "Medication",
                "newPrescriptionId": new_id,
                "newMedicationDetails": new_doc["medicationDetails"],
            })
            _history_event(db, patient_id, payload.prescriptionId, "Medication Changed During Consultation", "Changed", now)
            _history_event(db, patient_id, new_id, "Updated Doctor Prescription", "Active", now)

    elif payload.action == "started":
        if payload.medication is None:
            raise HTTPException(status_code=400, detail="New medication details are required")
        new_doc = _new_medication_doc(patient_id, current_user, payload.medication, now)
        new_result = db["prescriptions"].insert_one(new_doc)
        new_id = str(new_result.inserted_id)
        action_doc.update({
            "prescriptionId": new_id,
            "medicationDetails": new_doc["medicationDetails"],
        })
        _history_event(db, patient_id, new_id, "Medication Started During Consultation", "Active", now)

    db["medication_reconciliations"].update_one(
        {"_id": reconciliation["_id"]},
        {"$push": {"actions": action_doc}, "$set": {"updatedAt": now, "status": "in_progress"}},
    )
    reconciliation = db["medication_reconciliations"].find_one({"_id": reconciliation["_id"]})

    record_clinical_access(
        current_user=current_user,
        patient_id=patient_id,
        action="RECONCILE_MEDICATION",
        resource_type="medication_reconciliation",
        resource_id=str(reconciliation["_id"]),
        access_channel=decision.access_channel,
        scope=decision.scope,
        reason=decision.reason,
        db=db,
    )
    return _serialize_reconciliation(db, reconciliation, patient_id)


@router.post("/encounter/{encounter_id}/complete")
def complete_reconciliation(
    encounter_id: str,
    payload: ReconciliationCompleteInput,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    encounter = _encounter_or_404(db, encounter_id)
    decision = _authorize(db, encounter, current_user)
    patient_id = str(encounter.get("patientId") or "")
    reconciliation = _ensure_reconciliation(db, encounter, current_user)
    now = datetime.utcnow()

    db["medication_reconciliations"].update_one(
        {"_id": reconciliation["_id"]},
        {"$set": {"status": "completed", "notes": payload.notes.strip(), "performedAt": now, "updatedAt": now}},
    )
    db["clinical_encounters"].update_one(
        {"_id": encounter["_id"], "status": {"$ne": "completed"}},
        {"$set": {
            "medicationReconciliationId": str(reconciliation["_id"]),
            "medicationReview": {"reviewed": True, "notes": payload.notes.strip()},
            "updatedAt": now,
        }, "$inc": {"revision": 1}},
    )

    action_count = len(reconciliation.get("actions") or [])
    db["notifications"].insert_one({
        "userId": patient_id,
        "title": "Medication review completed",
        "message": (
            f"{current_user.get('name') or 'Your doctor'} reviewed your medication plan"
            + (f" and recorded {action_count} reconciliation action{'s' if action_count != 1 else ''}." if action_count else ".")
        ),
        "type": "medication",
        "relatedId": str(reconciliation["_id"]),
        "read": False,
        "createdAt": now,
    })

    record_clinical_access(
        current_user=current_user,
        patient_id=patient_id,
        action="COMPLETE_MEDICATION_RECONCILIATION",
        resource_type="medication_reconciliation",
        resource_id=str(reconciliation["_id"]),
        access_channel=decision.access_channel,
        scope=decision.scope,
        reason=decision.reason,
        db=db,
    )
    saved = db["medication_reconciliations"].find_one({"_id": reconciliation["_id"]})
    return _serialize_reconciliation(db, saved, patient_id)
