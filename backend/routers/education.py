"""Patient education assignment bridge for Phase 10J.

Curated article content deliberately lives in the frontend as versioned TypeScript.
This router only exposes consultation-created assignment metadata so the patient
can see "Recommended by Dr. ..." without duplicating article content in MongoDB.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from database import get_db
from dependencies import RoleChecker, get_current_user

router = APIRouter(
    prefix="/api/patient/education",
    tags=["Patient Education"],
    dependencies=[Depends(RoleChecker(["Patient"]))],
)


def _id_variants(value: Any) -> list[Any]:
    text = str(value or "").strip()
    if not text:
        return []
    values: list[Any] = [text]
    if ObjectId.is_valid(text):
        values.append(ObjectId(text))
    return values


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _serialize(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(doc.get("_id") or ""),
        "encounterId": str(doc.get("encounterId") or ""),
        "topicKey": str(doc.get("topicKey") or ""),
        "title": str(doc.get("title") or doc.get("topicKey") or "Education"),
        "doctorId": str(doc.get("doctorId") or ""),
        "doctorName": str(doc.get("doctorName") or "Doctor"),
        "status": str(doc.get("status") or "assigned"),
        "assignedAt": _iso(doc.get("assignedAt")),
        "viewedAt": _iso(doc.get("viewedAt")),
    }


@router.get("/assignments")
def list_assignments(current_user: dict = Depends(get_current_user)):
    db = get_db()
    patient_values = _id_variants(current_user.get("_id"))
    docs = list(
        db["education_assignments"]
        .find({"patientId": {"$in": patient_values}})
        .sort("assignedAt", -1)
    )
    return {"assignments": [_serialize(doc) for doc in docs]}


@router.patch("/assignments/{assignment_id}/viewed")
def mark_assignment_viewed(assignment_id: str, current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(assignment_id):
        raise HTTPException(status_code=400, detail="Invalid education assignment ID")

    db = get_db()
    patient_values = _id_variants(current_user.get("_id"))
    object_id = ObjectId(assignment_id)
    doc = db["education_assignments"].find_one({"_id": object_id, "patientId": {"$in": patient_values}})
    if not doc:
        raise HTTPException(status_code=404, detail="Education assignment not found")

    now = datetime.utcnow()
    db["education_assignments"].update_one(
        {"_id": object_id},
        {"$set": {"status": "viewed", "viewedAt": now}},
    )
    updated = db["education_assignments"].find_one({"_id": object_id}) or doc
    return _serialize(updated)
