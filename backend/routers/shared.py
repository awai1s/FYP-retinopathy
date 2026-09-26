from __future__ import annotations

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from access_control import (
    record_clinical_access,
    require_patient_access,
    require_verified_provider,
)
from database import get_db
from dependencies import RoleChecker, get_current_user

router = APIRouter(
    prefix="/api/patients",
    tags=["Shared"],
    dependencies=[Depends(RoleChecker(["Hospital", "Doctor"]))],
)


def _safe_directory_person(user: dict) -> dict:
    """Return intentionally minimal identity for provider directory search."""
    name = str(user.get("name") or "").strip()
    name_parts = name.split()
    return {
        "id": str(user.get("_id") or ""),
        "name": name,
        "firstName": name_parts[0] if name_parts else "",
        "lastName": " ".join(name_parts[1:]) if len(name_parts) > 1 else "",
        "username": user.get("username", ""),
        "role": "Patient",
        "age": user.get("age"),
    }


def _safe_patient_profile(user: dict) -> dict:
    """Preserve the current profile contract without leaking auth internals."""
    name = str(user.get("name") or "").strip()
    name_parts = name.split()
    return {
        "id": str(user.get("_id") or ""),
        "name": name,
        "firstName": user.get("first_name") or (name_parts[0] if name_parts else ""),
        "lastName": user.get("last_name") or (" ".join(name_parts[1:]) if len(name_parts) > 1 else ""),
        "username": user.get("username", ""),
        "email": user.get("email", ""),
        "mobile": user.get("mobile", ""),
        "gender": user.get("gender", ""),
        "dob": user.get("dob", ""),
        "age": user.get("age"),
        "role": "Patient",
    }


@router.get("/search")
def search_patients(query: str = "", current_user: dict = Depends(get_current_user)):
    """Provider directory search: basic identity only, never clinical fields."""
    db = get_db()
    require_verified_provider(current_user, db)

    cleaned = str(query or "").strip()
    mongo_query: dict = {"role": "Patient"}
    if cleaned:
        mongo_query["$or"] = [
            {"name": {"$regex": cleaned, "$options": "i"}},
            {"username": {"$regex": cleaned, "$options": "i"}},
            {"mobile": {"$regex": cleaned, "$options": "i"}},
        ]

    users = list(
        db["users"].find(
            mongo_query,
            {
                "name": 1,
                "first_name": 1,
                "last_name": 1,
                "username": 1,
                "role": 1,
                "age": 1,
            },
        ).limit(50)
    )
    return {"patients": [_safe_directory_person(user) for user in users]}


@router.get("/{patient_id}")
def get_patient_profile(patient_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()

    try:
        if ObjectId.is_valid(patient_id):
            user = db["users"].find_one(
                {"_id": ObjectId(patient_id), "role": "Patient"},
                {"password": 0},
            )
        else:
            user = db["users"].find_one(
                {"username": patient_id, "role": "Patient"},
                {"password": 0},
            )
    except Exception:
        user = None

    if not user:
        raise HTTPException(status_code=404, detail="Patient not found")

    resolved_patient_id = str(user["_id"])
    decision = require_patient_access(
        current_user=current_user,
        patient_id=resolved_patient_id,
        scope="profile.clinical.read",
        db=db,
    )

    record_clinical_access(
        current_user=current_user,
        patient_id=resolved_patient_id,
        action="VIEW_PROFILE",
        resource_type="patient_profile",
        resource_id=resolved_patient_id,
        access_channel=decision.access_channel,
        scope=decision.scope,
        reason=decision.reason,
        db=db,
    )

    return _safe_patient_profile(user)
