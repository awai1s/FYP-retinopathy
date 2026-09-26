"""Phase 10I - Patient Vision & Lens Vault.

The vault preserves glasses/contact-lens prescription history. Creating a new
prescription never deletes or overwrites the previous record; the previous
current record is moved to history. Optional source documents are stored in the
existing GridFS infrastructure and remain attached to the historical record.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal, Optional
from urllib.parse import quote

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from database import get_db
from dependencies import RoleChecker, get_current_user
from storage import get_file_from_gridfs, upload_file_to_gridfs

router = APIRouter(
    prefix="/api/patient/vision-prescriptions",
    tags=["Vision & Lens Vault"],
    dependencies=[Depends(RoleChecker(["Patient"]))],
)

PrescriptionType = Literal["glasses", "contact_lens"]


class VisionPrescriptionCreate(BaseModel):
    type: PrescriptionType
    issuedDate: str
    expiryDate: Optional[str] = None

    doctorOptometrist: Optional[str] = Field(default=None, max_length=180)
    clinic: Optional[str] = Field(default=None, max_length=240)
    notes: Optional[str] = Field(default=None, max_length=3000)

    # Glasses prescription values.
    rightSph: Optional[float] = Field(default=None, ge=-40, le=40)
    rightCyl: Optional[float] = Field(default=None, ge=-20, le=20)
    rightAxis: Optional[int] = Field(default=None, ge=0, le=180)
    leftSph: Optional[float] = Field(default=None, ge=-40, le=40)
    leftCyl: Optional[float] = Field(default=None, ge=-20, le=20)
    leftAxis: Optional[int] = Field(default=None, ge=0, le=180)
    add: Optional[float] = Field(default=None, ge=0, le=10)
    pd: Optional[float] = Field(default=None, ge=20, le=90)

    # Contact-lens values.
    rightPower: Optional[float] = Field(default=None, ge=-40, le=40)
    leftPower: Optional[float] = Field(default=None, ge=-40, le=40)
    baseCurve: Optional[float] = Field(default=None, ge=5, le=12)
    diameter: Optional[float] = Field(default=None, ge=8, le=20)
    brand: Optional[str] = Field(default=None, max_length=160)
    lensType: Optional[str] = Field(default=None, max_length=160)
    replacementSchedule: Optional[str] = Field(default=None, max_length=160)


def _clean_text(value: Optional[str]) -> str:
    return str(value or "").strip()


def _parse_date(value: Optional[str], field_name: str, *, required: bool = False) -> Optional[date]:
    raw = str(value or "").strip()
    if not raw:
        if required:
            raise HTTPException(status_code=400, detail=f"{field_name} is required")
        return None
    try:
        return date.fromisoformat(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"{field_name} must use YYYY-MM-DD format") from exc


def _object_id(value: str, label: str = "vision prescription") -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=400, detail=f"Invalid {label} ID format")
    return ObjectId(value)


def _days_until(value: Optional[str]) -> Optional[int]:
    expiry = _parse_date(value, "expiryDate") if value else None
    if not expiry:
        return None
    return (expiry - datetime.utcnow().date()).days


def _serialize(doc: dict) -> dict:
    created_at = doc.get("createdAt")
    updated_at = doc.get("updatedAt")
    superseded_at = doc.get("supersededAt")
    expiry = doc.get("expiryDate") or ""
    days = _days_until(expiry) if expiry else None
    attachment = doc.get("attachment") or None
    return {
        "id": str(doc["_id"]),
        "type": doc.get("type", "glasses"),
        "isCurrent": bool(doc.get("isCurrent", False)),
        "lifecycleStatus": doc.get("lifecycleStatus", "current" if doc.get("isCurrent") else "history"),
        "issuedDate": doc.get("issuedDate", ""),
        "expiryDate": expiry,
        "daysUntilExpiry": days,
        "expiryState": (
            "none" if days is None else "expired" if days < 0 else "expiring" if days <= 30 else "valid"
        ),
        "doctorOptometrist": doc.get("doctorOptometrist", ""),
        "clinic": doc.get("clinic", ""),
        "notes": doc.get("notes", ""),
        "glasses": doc.get("glasses") or {},
        "contactLens": doc.get("contactLens") or {},
        "attachment": ({
            "fileId": attachment.get("fileId", ""),
            "filename": attachment.get("filename", "vision-prescription"),
            "contentType": attachment.get("contentType", "application/octet-stream"),
            "uploadedAt": attachment.get("uploadedAt").isoformat() if isinstance(attachment.get("uploadedAt"), datetime) else str(attachment.get("uploadedAt") or ""),
        } if attachment else None),
        "createdAt": created_at.isoformat() if isinstance(created_at, datetime) else str(created_at or ""),
        "updatedAt": updated_at.isoformat() if isinstance(updated_at, datetime) else str(updated_at or ""),
        "supersededAt": superseded_at.isoformat() if isinstance(superseded_at, datetime) else str(superseded_at or ""),
    }


def _sync_expiry_reminders(db, patient_id: str) -> None:
    """Create one useful in-app reminder when a threshold is crossed.

    Native devices also schedule local 30/7/1-day reminders from the frontend.
    This server-side reminder keeps the feature useful on web and in the normal
    Notifications screen without needing a background scheduler.
    """
    now = datetime.utcnow()
    today = now.date()
    current = list(db["vision_prescriptions"].find({"patientId": patient_id, "isCurrent": True}))
    for doc in current:
        expiry_raw = str(doc.get("expiryDate") or "").strip()
        if not expiry_raw:
            continue
        try:
            expiry = date.fromisoformat(expiry_raw)
        except ValueError:
            continue
        days = (expiry - today).days
        threshold: str | None = None
        if days < 0:
            threshold = "expired"
        elif days <= 1:
            threshold = "1"
        elif days <= 7:
            threshold = "7"
        elif days <= 30:
            threshold = "30"
        if threshold is None:
            continue

        sent = [str(item) for item in (doc.get("expiryReminderThresholdsSent") or [])]
        if threshold in sent:
            continue

        kind = "glasses" if doc.get("type") == "glasses" else "contact lens"
        if threshold == "expired":
            title = "Vision prescription expired"
            message = f"Your current {kind} prescription has expired. Consider arranging an eye examination."
        else:
            count = int(threshold)
            unit = "day" if count == 1 else "days"
            title = "Vision prescription expiring soon"
            message = f"Your current {kind} prescription will expire in {count} {unit}. Consider scheduling an eye examination."

        db["notifications"].insert_one({
            "userId": patient_id,
            "title": title,
            "message": message,
            "type": "vision_prescription",
            "read": False,
            "relatedId": str(doc["_id"]),
            "createdAt": now,
        })
        db["vision_prescriptions"].update_one(
            {"_id": doc["_id"]},
            {"$addToSet": {"expiryReminderThresholdsSent": threshold}, "$set": {"updatedAt": now}},
        )


@router.get("")
def list_vision_prescriptions(current_user: dict = Depends(get_current_user)):
    db = get_db()
    patient_id = current_user["_id"]
    _sync_expiry_reminders(db, patient_id)

    docs = list(
        db["vision_prescriptions"].find({"patientId": patient_id}).sort(
            [("isCurrent", -1), ("issuedDate", -1), ("createdAt", -1)]
        )
    )
    records = [_serialize(doc) for doc in docs]
    current_glasses = next((item for item in records if item["type"] == "glasses" and item["isCurrent"]), None)
    current_contacts = next((item for item in records if item["type"] == "contact_lens" and item["isCurrent"]), None)
    history = [item for item in records if not item["isCurrent"]]
    expiring = [
        item for item in records
        if item["isCurrent"] and item["daysUntilExpiry"] is not None and item["daysUntilExpiry"] <= 30
    ]
    return {
        "currentGlasses": current_glasses,
        "currentContactLens": current_contacts,
        "history": history,
        "expiringSoon": expiring,
        "records": records,
    }


@router.get("/{prescription_id}")
def get_vision_prescription(prescription_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    doc = db["vision_prescriptions"].find_one({
        "_id": _object_id(prescription_id),
        "patientId": current_user["_id"],
    })
    if not doc:
        raise HTTPException(status_code=404, detail="Vision prescription not found")
    return _serialize(doc)


@router.post("", status_code=201)
def create_vision_prescription(payload: VisionPrescriptionCreate, current_user: dict = Depends(get_current_user)):
    issued = _parse_date(payload.issuedDate, "issuedDate", required=True)
    expiry = _parse_date(payload.expiryDate, "expiryDate")
    if expiry and issued and expiry < issued:
        raise HTTPException(status_code=400, detail="expiryDate cannot be earlier than issuedDate")

    now = datetime.utcnow()
    db = get_db()
    patient_id = current_user["_id"]

    # Preserve history: the previous current record of the same type becomes history.
    db["vision_prescriptions"].update_many(
        {"patientId": patient_id, "type": payload.type, "isCurrent": True},
        {"$set": {
            "isCurrent": False,
            "lifecycleStatus": "history",
            "supersededAt": now,
            "updatedAt": now,
        }},
    )

    doc = {
        "patientId": patient_id,
        "type": payload.type,
        "isCurrent": True,
        "lifecycleStatus": "current",
        "issuedDate": issued.isoformat() if issued else payload.issuedDate,
        "expiryDate": expiry.isoformat() if expiry else "",
        "doctorOptometrist": _clean_text(payload.doctorOptometrist),
        "clinic": _clean_text(payload.clinic),
        "notes": _clean_text(payload.notes),
        "glasses": {
            "right": {"sph": payload.rightSph, "cyl": payload.rightCyl, "axis": payload.rightAxis},
            "left": {"sph": payload.leftSph, "cyl": payload.leftCyl, "axis": payload.leftAxis},
            "add": payload.add,
            "pd": payload.pd,
        } if payload.type == "glasses" else {},
        "contactLens": {
            "rightPower": payload.rightPower,
            "leftPower": payload.leftPower,
            "baseCurve": payload.baseCurve,
            "diameter": payload.diameter,
            "brand": _clean_text(payload.brand),
            "lensType": _clean_text(payload.lensType),
            "replacementSchedule": _clean_text(payload.replacementSchedule),
        } if payload.type == "contact_lens" else {},
        "attachment": None,
        "expiryReminderThresholdsSent": [],
        "createdAt": now,
        "updatedAt": now,
    }
    try:
        result = db["vision_prescriptions"].insert_one(doc)
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=409,
            detail="Another current prescription was saved at the same time. Refresh the vault and try again.",
        ) from exc
    doc["_id"] = result.inserted_id

    db["patient_history"].insert_one({
        "patientId": patient_id,
        "type": "VisionPrescription",
        "title": "Glasses prescription added" if payload.type == "glasses" else "Contact lens prescription added",
        "description": f"Issued {doc['issuedDate']}" + (f" · Expires {doc['expiryDate']}" if doc["expiryDate"] else ""),
        "referenceId": str(result.inserted_id),
        "createdAt": now,
    })

    _sync_expiry_reminders(db, patient_id)
    return _serialize(doc)


@router.post("/{prescription_id}/attachment")
def upload_vision_prescription_attachment(
    prescription_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    object_id = _object_id(prescription_id)
    doc = db["vision_prescriptions"].find_one({"_id": object_id, "patientId": current_user["_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Vision prescription not found")
    if doc.get("attachment"):
        raise HTTPException(
            status_code=409,
            detail="This prescription already has an attachment. Add a new prescription instead of replacing historical evidence.",
        )

    filename = str(file.filename or "vision-prescription").strip()
    content_type = str(file.content_type or "application/octet-stream").strip().lower()
    file_id = upload_file_to_gridfs(file)
    now = datetime.utcnow()
    attachment = {
        "fileId": file_id,
        "filename": filename,
        "contentType": content_type,
        "uploadedAt": now,
    }
    db["vision_prescriptions"].update_one(
        {"_id": object_id},
        {"$set": {"attachment": attachment, "updatedAt": now}},
    )
    updated = db["vision_prescriptions"].find_one({"_id": object_id})
    return _serialize(updated)


@router.get("/{prescription_id}/attachment/download")
def download_vision_prescription_attachment(
    prescription_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    object_id = _object_id(prescription_id)
    doc = db["vision_prescriptions"].find_one({"_id": object_id, "patientId": current_user["_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Vision prescription not found")
    attachment = doc.get("attachment") or {}
    file_id = str(attachment.get("fileId") or "")
    if not file_id:
        raise HTTPException(status_code=404, detail="No attachment is stored for this prescription")

    stream, filename, content_type = get_file_from_gridfs(file_id)
    safe_name = str(attachment.get("filename") or filename or "vision-prescription")
    return StreamingResponse(
        stream,
        media_type=str(attachment.get("contentType") or content_type or "application/octet-stream"),
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(safe_name)}"},
    )
