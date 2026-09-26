from datetime import datetime
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from access_control import require_verified_provider
from connection_service import require_accepted_connection
from database import get_db
from dependencies import RoleChecker, VerifiedProviderChecker, get_current_user
from models import CreateAppointment, UpdateAppointmentStatus

router = APIRouter(prefix="/api/appointments", tags=["Appointments"])


def _object_id(value: str, label: str = "appointment") -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=400, detail=f"Invalid {label} ID format")
    return ObjectId(value)


def _doctor_name(db: Any, doctor_id: str) -> str:
    if ObjectId.is_valid(doctor_id):
        user = db["users"].find_one({"_id": ObjectId(doctor_id), "role": "Doctor"}, {"name": 1})
        if user:
            return user.get("name") or "Doctor"
    return "Doctor"


def _patient_name(db: Any, patient_id: str) -> str:
    if ObjectId.is_valid(patient_id):
        user = db["users"].find_one({"_id": ObjectId(patient_id), "role": "Patient"}, {"name": 1})
        if user:
            return user.get("name") or "Patient"
    return "Patient"


def _require_bookable_doctor(db: Any, doctor_id: str) -> dict:
    if not ObjectId.is_valid(str(doctor_id)):
        raise HTTPException(status_code=400, detail="Invalid doctor ID format")
    doctor = db["users"].find_one(
        {"_id": ObjectId(str(doctor_id)), "role": "Doctor"},
        {"name": 1, "role": 1, "verificationStatus": 1, "accountStatus": 1},
    )
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    provider_user = {**doctor, "_id": str(doctor["_id"])}
    try:
        require_verified_provider(provider_user, db)
    except HTTPException as exc:
        raise HTTPException(
            status_code=403,
            detail="This doctor is not available for booking until provider verification is approved.",
        ) from exc
    return provider_user


def _encounter_for_appointment(db: Any, appointment_id: str) -> dict | None:
    return db["clinical_encounters"].find_one(
        {"appointmentId": str(appointment_id)},
        {"status": 1, "startedAt": 1, "completedAt": 1, "updatedAt": 1},
    )


def _serialize_appointment(db: Any, doc: dict) -> dict:
    created_at = doc.get("createdAt", datetime.utcnow())
    updated_at = doc.get("updatedAt", created_at)
    appointment_id = str(doc["_id"])
    encounter = _encounter_for_appointment(db, appointment_id)
    return {
        "id": appointment_id,
        "appointmentId": appointment_id,
        "patientId": doc.get("patientId", ""),
        "patientName": doc.get("patientName") or _patient_name(db, doc.get("patientId", "")),
        "doctorId": doc.get("doctorId", ""),
        "doctorName": doc.get("doctorName") or _doctor_name(db, doc.get("doctorId", "")),
        "date": doc.get("date", ""),
        "time": doc.get("time", ""),
        "reason": doc.get("reason", ""),
        "status": doc.get("status", "Pending"),
        "createdAt": created_at.isoformat() if isinstance(created_at, datetime) else str(created_at),
        "updatedAt": updated_at.isoformat() if isinstance(updated_at, datetime) else str(updated_at),
        "encounterId": str(encounter.get("_id")) if encounter else None,
        "encounterStatus": str(encounter.get("status") or "") if encounter else None,
        "encounterStartedAt": (
            encounter.get("startedAt").isoformat()
            if encounter and isinstance(encounter.get("startedAt"), datetime)
            else str(encounter.get("startedAt")) if encounter and encounter.get("startedAt") else None
        ),
        "encounterCompletedAt": (
            encounter.get("completedAt").isoformat()
            if encounter and isinstance(encounter.get("completedAt"), datetime)
            else str(encounter.get("completedAt")) if encounter and encounter.get("completedAt") else None
        ),
    }


@router.get("/patient", dependencies=[Depends(RoleChecker(["Patient"]))])
def get_patient_appointments(current_user: dict = Depends(get_current_user)):
    db = get_db()
    docs = db["appointments"].find({"patientId": current_user["_id"]}).sort([("date", 1), ("time", 1)])
    return {"appointments": [_serialize_appointment(db, doc) for doc in docs]}


@router.get("/doctor", dependencies=[Depends(RoleChecker(["Doctor"])), Depends(VerifiedProviderChecker())])
def get_doctor_appointments(current_user: dict = Depends(get_current_user)):
    db = get_db()
    require_verified_provider(current_user, db)
    docs = db["appointments"].find({"doctorId": current_user["_id"]}).sort([("date", 1), ("time", 1)])
    return {"appointments": [_serialize_appointment(db, doc) for doc in docs]}


@router.post("", dependencies=[Depends(RoleChecker(["Patient"]))], status_code=201)
def create_appointment(data: CreateAppointment, current_user: dict = Depends(get_current_user)):
    db = get_db()
    _require_bookable_doctor(db, data.doctorId)
    # Phase 10D: booking is an authenticated care-team action, not a way to
    # bypass patient approval. Manual API calls are protected too.
    require_accepted_connection(db, current_user["_id"], data.doctorId)
    now = datetime.utcnow()
    doc = {
        "patientId": current_user["_id"],
        "patientName": current_user.get("name", "Patient"),
        "doctorId": data.doctorId,
        "doctorName": _doctor_name(db, data.doctorId),
        "date": data.date,
        "time": data.time,
        "reason": (data.reason or "").strip(),
        "status": "Pending",
        "createdAt": now,
        "updatedAt": now,
    }
    result = db["appointments"].insert_one(doc)
    doc["_id"] = result.inserted_id

    db["notifications"].insert_one({
        "userId": current_user["_id"],
        "title": "Appointment requested",
        "message": f"Your appointment request for {data.date} at {data.time} was submitted.",
        "type": "appointment",
        "read": False,
        "relatedId": str(result.inserted_id),
        "createdAt": now,
    })
    return _serialize_appointment(db, doc)


@router.patch("/{appointment_id}/status")
def update_appointment_status(
    appointment_id: str,
    data: UpdateAppointmentStatus,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    object_id = _object_id(appointment_id)
    appointment = db["appointments"].find_one({"_id": object_id})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    role = current_user.get("role")
    if role == "Doctor":
        require_verified_provider(current_user, db)
    is_patient_owner = role == "Patient" and appointment.get("patientId") == current_user["_id"]
    is_assigned_doctor = role == "Doctor" and appointment.get("doctorId") == current_user["_id"]
    if not (is_patient_owner or is_assigned_doctor):
        raise HTTPException(status_code=403, detail="You are not allowed to update this appointment")

    encounter = _encounter_for_appointment(db, appointment_id)
    new_status = data.status
    if role == "Patient" and encounter and str(encounter.get("status") or "") in {"draft", "in_progress", "completed"}:
        raise HTTPException(status_code=409, detail="A consultation record already exists for this visit and it can no longer be cancelled here")
    if role == "Doctor" and new_status == "Completed":
        if not encounter or str(encounter.get("status") or "") != "completed":
            raise HTTPException(
                status_code=409,
                detail="Complete the Consultation Cockpit before marking this appointment completed",
            )
    if role == "Patient" and new_status != "Cancelled":
        raise HTTPException(status_code=403, detail="Patients may only cancel their appointments")
    if role == "Doctor" and new_status == "Pending":
        raise HTTPException(status_code=400, detail="Doctors cannot set an appointment back to Pending")

    now = datetime.utcnow()
    db["appointments"].update_one({"_id": object_id}, {"$set": {"status": new_status, "updatedAt": now}})
    updated = db["appointments"].find_one({"_id": object_id})

    recipient_id = updated.get("patientId") if role == "Doctor" else updated.get("doctorId")
    if recipient_id:
        db["notifications"].insert_one({
            "userId": recipient_id,
            "title": "Appointment updated",
            "message": f"Appointment status changed to {new_status}.",
            "type": "appointment",
            "read": False,
            "relatedId": appointment_id,
            "createdAt": now,
        })

    return _serialize_appointment(db, updated)
