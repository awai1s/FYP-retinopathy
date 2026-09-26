from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from connection_service import relation_status, require_accepted_connection
from database import get_db
from dependencies import RoleChecker, VerifiedProviderChecker, get_current_user


router = APIRouter(
    prefix="/api/doctor/watchlist",
    tags=["Doctor Watchlist"],
    dependencies=[Depends(RoleChecker(["Doctor"])), Depends(VerifiedProviderChecker())],
)


Priority = Literal["normal", "important"]


class WatchlistCreate(BaseModel):
    patientId: str
    reason: str = Field(min_length=3, max_length=500)
    priority: Priority = "normal"
    reviewDate: str

    @field_validator("patientId", "reason", "reviewDate", mode="before")
    @classmethod
    def _strip_text(cls, value: Any):
        return str(value or "").strip()

    @field_validator("reviewDate")
    @classmethod
    def _valid_review_date(cls, value: str):
        try:
            datetime.strptime(value, "%Y-%m-%d")
        except ValueError as exc:
            raise ValueError("Review date must use YYYY-MM-DD") from exc
        return value


class WatchlistUpdate(BaseModel):
    reason: str = Field(min_length=3, max_length=500)
    priority: Priority = "normal"
    reviewDate: str

    @field_validator("reason", "reviewDate", mode="before")
    @classmethod
    def _strip_text(cls, value: Any):
        return str(value or "").strip()

    @field_validator("reviewDate")
    @classmethod
    def _valid_review_date(cls, value: str):
        try:
            datetime.strptime(value, "%Y-%m-%d")
        except ValueError as exc:
            raise ValueError("Review date must use YYYY-MM-DD") from exc
        return value


def _doctor_id(current_user: dict[str, Any]) -> str:
    return str(current_user.get("_id") or "")


def _object_id(value: str, label: str) -> ObjectId:
    if not ObjectId.is_valid(str(value)):
        raise HTTPException(status_code=400, detail=f"Invalid {label} ID format")
    return ObjectId(str(value))


def _patient_user(db, patient_id: str) -> dict[str, Any]:
    patient_oid = _object_id(patient_id, "patient")
    patient = db["users"].find_one(
        {"_id": patient_oid, "role": "Patient"},
        {"name": 1, "firstName": 1, "lastName": 1, "username": 1, "role": 1},
    )
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


def _patient_name(patient: dict[str, Any]) -> str:
    name = str(patient.get("name") or "").strip()
    if name:
        return name
    full = " ".join(
        part for part in [str(patient.get("firstName") or "").strip(), str(patient.get("lastName") or "").strip()] if part
    )
    return full or str(patient.get("username") or "Patient")


def _serialize(db, doc: dict[str, Any], doctor_id: str) -> dict[str, Any]:
    patient_id = str(doc.get("patientId") or "")
    status = relation_status(db, patient_id, doctor_id)
    access_available = status == "accepted"

    # Do not let a retained bookmark become a back door to fresh patient data.
    # Once access is revoked, render only the identity snapshot captured while
    # the relationship was active.
    patient: dict[str, Any] = {}
    if access_available and ObjectId.is_valid(patient_id):
        patient = db["users"].find_one(
            {"_id": ObjectId(patient_id), "role": "Patient"},
            {"name": 1, "firstName": 1, "lastName": 1, "username": 1},
        ) or {}
    snapshot_name = str(doc.get("patientName") or "").strip()
    snapshot_username = doc.get("patientUsername")

    def iso(value: Any):
        return value.isoformat() if isinstance(value, datetime) else str(value) if value else None

    return {
        "id": str(doc.get("_id") or ""),
        "doctorId": doctor_id,
        "patientId": patient_id,
        "patientName": _patient_name(patient) if patient else (snapshot_name or "Patient"),
        "username": patient.get("username") if patient else snapshot_username,
        "reason": str(doc.get("reason") or ""),
        "priority": str(doc.get("priority") or "normal").lower(),
        "reviewDate": str(doc.get("reviewDate") or ""),
        "createdAt": iso(doc.get("createdAt")),
        "updatedAt": iso(doc.get("updatedAt")),
        "accessAvailable": access_available,
        "connectionStatus": status,
    }


@router.get("")
def list_watchlist(
    limit: int = Query(default=50, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    """List only the authenticated doctor's private watchlist.

    A retained bookmark never grants clinical access. ``accessAvailable`` is
    calculated from the live Phase 10D care connection every time.
    """
    db = get_db()
    doctor_id = _doctor_id(current_user)
    docs = list(
        db["doctor_watchlist"]
        .find({"doctorId": doctor_id})
        .sort([("priority", 1), ("reviewDate", 1), ("updatedAt", -1)])
        .limit(limit)
    )
    return {"watchlist": [_serialize(db, doc, doctor_id) for doc in docs]}


@router.get("/patient/{patient_id}")
def watchlist_for_patient(patient_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    doctor_id = _doctor_id(current_user)
    doc = db["doctor_watchlist"].find_one({"doctorId": doctor_id, "patientId": str(patient_id)})

    # For a brand-new bookmark, the doctor must still have live access. For an
    # existing bookmark we return only the private identity snapshot if the
    # patient later revoked access; opening the clinical chart remains denied.
    status = relation_status(db, patient_id, doctor_id)
    if not doc and status != "accepted":
        raise HTTPException(status_code=403, detail="Accepted patient care connection required")

    patient = _patient_user(db, patient_id) if status == "accepted" else {}
    patient_name = _patient_name(patient) if patient else str((doc or {}).get("patientName") or "Patient")
    patient_username = patient.get("username") if patient else (doc or {}).get("patientUsername")

    return {
        "patient": {
            "id": str(patient_id),
            "name": patient_name,
            "username": patient_username,
        },
        "entry": _serialize(db, doc, doctor_id) if doc else None,
        "accessAvailable": status == "accepted",
        "connectionStatus": status,
    }


@router.post("", status_code=201)
def create_watchlist_entry(data: WatchlistCreate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    doctor_id = _doctor_id(current_user)
    patient = _patient_user(db, data.patientId)

    # A bookmark is not an authorization mechanism. Only a currently connected
    # patient can be added in the first place.
    require_accepted_connection(db, data.patientId, doctor_id)

    existing = db["doctor_watchlist"].find_one({"doctorId": doctor_id, "patientId": data.patientId})
    if existing:
        raise HTTPException(status_code=409, detail="Patient is already on your watchlist")

    now = datetime.utcnow()
    doc = {
        "doctorId": doctor_id,
        "patientId": data.patientId,
        "patientName": _patient_name(patient),
        "patientUsername": patient.get("username"),
        "reason": data.reason,
        "priority": data.priority,
        "reviewDate": data.reviewDate,
        "createdAt": now,
        "updatedAt": now,
    }
    result = db["doctor_watchlist"].insert_one(doc)
    doc["_id"] = result.inserted_id

    # Deliberately no patient notification and no patient-facing privacy event:
    # this is the doctor's private case-management metadata.
    return _serialize(db, doc, doctor_id)


@router.patch("/{watchlist_id}")
def update_watchlist_entry(
    watchlist_id: str,
    data: WatchlistUpdate,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    doctor_id = _doctor_id(current_user)
    object_id = _object_id(watchlist_id, "watchlist")
    doc = db["doctor_watchlist"].find_one({"_id": object_id, "doctorId": doctor_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Watchlist entry not found")

    db["doctor_watchlist"].update_one(
        {"_id": object_id, "doctorId": doctor_id},
        {
            "$set": {
                "reason": data.reason,
                "priority": data.priority,
                "reviewDate": data.reviewDate,
                "updatedAt": datetime.utcnow(),
            }
        },
    )
    updated = db["doctor_watchlist"].find_one({"_id": object_id, "doctorId": doctor_id})
    return _serialize(db, updated, doctor_id)


@router.delete("/{watchlist_id}")
def delete_watchlist_entry(watchlist_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    doctor_id = _doctor_id(current_user)
    object_id = _object_id(watchlist_id, "watchlist")
    result = db["doctor_watchlist"].delete_one({"_id": object_id, "doctorId": doctor_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Watchlist entry not found")
    return {"message": "Removed from watchlist"}
