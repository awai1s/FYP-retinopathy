"""Phase 10M - Hospital Eye Equipment Lifecycle Manager."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from pymongo.errors import DuplicateKeyError

from access_control import require_verified_provider
from database import get_db
from dependencies import RoleChecker, VerifiedProviderChecker, get_current_user
from equipment_service import (
    EQUIPMENT_TYPES,
    EVENT_TYPES,
    EXPLICIT_STATUSES,
    equipment_summary,
    parse_iso_date,
    refresh_equipment_due_notifications,
    serialize_equipment,
    serialize_event,
)

router = APIRouter(
    prefix="/api/hospital/equipment",
    tags=["Hospital Equipment"],
    dependencies=[Depends(RoleChecker(["Hospital"])), Depends(VerifiedProviderChecker())],
)

EquipmentType = Literal[
    "Fundus Camera",
    "OCT Scanner",
    "Slit Lamp",
    "Retinal Laser",
    "Visual Field Analyzer",
    "Tonometer",
    "Other",
]

EquipmentStatus = Literal[
    "Operational",
    "Under Maintenance",
    "Out of Service",
    "Retired",
]

EventType = Literal[
    "SERVICE",
    "CALIBRATION",
    "DOWNTIME_START",
    "DOWNTIME_END",
    "REPAIR",
    "STATUS_CHANGE",
    "RETIREMENT",
]


class EquipmentCreate(BaseModel):
    assetId: str = Field(min_length=1, max_length=64)
    deviceName: str = Field(min_length=1, max_length=180)
    type: EquipmentType
    manufacturer: Optional[str] = Field(default="", max_length=180)
    model: Optional[str] = Field(default="", max_length=180)
    serialNumber: Optional[str] = Field(default="", max_length=180)
    department: Optional[str] = Field(default="", max_length=180)
    location: Optional[str] = Field(default="", max_length=240)
    purchaseDate: Optional[str] = ""
    status: EquipmentStatus = "Operational"
    lastService: Optional[str] = ""
    nextService: Optional[str] = ""
    lastCalibration: Optional[str] = ""
    nextCalibration: Optional[str] = ""
    notes: Optional[str] = Field(default="", max_length=4000)

    @field_validator("assetId", "deviceName")
    @classmethod
    def required_trimmed(cls, value: str) -> str:
        clean = str(value or "").strip()
        if not clean:
            raise ValueError("This field is required")
        return clean

    @field_validator("purchaseDate", "lastService", "nextService", "lastCalibration", "nextCalibration")
    @classmethod
    def validate_date_fields(cls, value: Optional[str]) -> str:
        raw = str(value or "").strip()
        if raw and parse_iso_date(raw) is None:
            raise ValueError("Date must use YYYY-MM-DD format")
        return raw


class EquipmentUpdate(BaseModel):
    assetId: Optional[str] = Field(default=None, min_length=1, max_length=64)
    deviceName: Optional[str] = Field(default=None, min_length=1, max_length=180)
    type: Optional[EquipmentType] = None
    manufacturer: Optional[str] = Field(default=None, max_length=180)
    model: Optional[str] = Field(default=None, max_length=180)
    serialNumber: Optional[str] = Field(default=None, max_length=180)
    department: Optional[str] = Field(default=None, max_length=180)
    location: Optional[str] = Field(default=None, max_length=240)
    purchaseDate: Optional[str] = None
    status: Optional[EquipmentStatus] = None
    lastService: Optional[str] = None
    nextService: Optional[str] = None
    lastCalibration: Optional[str] = None
    nextCalibration: Optional[str] = None
    notes: Optional[str] = Field(default=None, max_length=4000)

    @field_validator("assetId", "deviceName")
    @classmethod
    def optional_required_trimmed(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        clean = str(value).strip()
        if not clean:
            raise ValueError("This field cannot be blank")
        return clean

    @field_validator("purchaseDate", "lastService", "nextService", "lastCalibration", "nextCalibration")
    @classmethod
    def validate_optional_date_fields(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        raw = str(value or "").strip()
        if raw and parse_iso_date(raw) is None:
            raise ValueError("Date must use YYYY-MM-DD format")
        return raw


class EquipmentEventCreate(BaseModel):
    eventType: EventType
    eventDate: str
    nextDueDate: Optional[str] = ""
    targetStatus: Optional[EquipmentStatus] = None
    performedBy: Optional[str] = Field(default="", max_length=180)
    reference: Optional[str] = Field(default="", max_length=180)
    cost: Optional[float] = Field(default=None, ge=0, le=1000000000)
    notes: Optional[str] = Field(default="", max_length=4000)

    @field_validator("eventDate")
    @classmethod
    def validate_event_date(cls, value: str) -> str:
        raw = str(value or "").strip()
        if parse_iso_date(raw) is None:
            raise ValueError("eventDate must use YYYY-MM-DD format")
        return raw

    @field_validator("nextDueDate")
    @classmethod
    def validate_next_due(cls, value: Optional[str]) -> str:
        raw = str(value or "").strip()
        if raw and parse_iso_date(raw) is None:
            raise ValueError("nextDueDate must use YYYY-MM-DD format")
        return raw



def _object_id(value: str, label: str = "equipment") -> ObjectId:
    if not ObjectId.is_valid(str(value)):
        raise HTTPException(status_code=400, detail=f"Invalid {label} ID format")
    return ObjectId(str(value))


def _normalize_text(value: Optional[str]) -> str:
    return str(value or "").strip()


def _normalize_asset_id(value: str) -> str:
    return " ".join(str(value or "").strip().upper().split())


def _hospital_id(current_user: dict) -> str:
    return str(current_user.get("_id") or "")


def _validate_schedule(last_value: Optional[str], next_value: Optional[str], label: str) -> None:
    last_date = parse_iso_date(last_value) if last_value else None
    next_date = parse_iso_date(next_value) if next_value else None
    if last_date and next_date and next_date < last_date:
        raise HTTPException(status_code=400, detail=f"Next {label} date cannot be earlier than last {label} date")


def _owned_equipment(db, current_user: dict, equipment_id: str) -> dict:
    doc = db["eye_equipment"].find_one(
        {"_id": _object_id(equipment_id), "hospitalId": _hospital_id(current_user)}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Equipment not found")
    return doc


def _audit(db, current_user: dict, action: str, equipment_id: str) -> None:
    db["audit_logs"].insert_one(
        {
            "userId": _hospital_id(current_user),
            "role": "Hospital",
            "action": action,
            "resource": "eye_equipment",
            "resourceId": equipment_id,
            "createdAt": datetime.utcnow().isoformat(),
        }
    )


@router.get("/summary")
def get_equipment_summary(current_user: dict = Depends(get_current_user)):
    db = get_db()
    require_verified_provider(current_user, db)
    refresh_equipment_due_notifications(db, current_user)
    return equipment_summary(db, _hospital_id(current_user))


@router.get("")
def list_equipment(
    search: str = Query(default="", max_length=120),
    type: str = Query(default="", max_length=80),
    status: str = Query(default="", max_length=80),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    require_verified_provider(current_user, db)
    refresh_equipment_due_notifications(db, current_user)

    query: dict = {"hospitalId": _hospital_id(current_user)}
    requested_type = str(type or "").strip()
    if requested_type:
        if requested_type not in EQUIPMENT_TYPES:
            raise HTTPException(status_code=400, detail="Invalid equipment type")
        query["type"] = requested_type

    term = str(search or "").strip()
    if term:
        query["$or"] = [
            {"assetId": {"$regex": term, "$options": "i"}},
            {"deviceName": {"$regex": term, "$options": "i"}},
            {"manufacturer": {"$regex": term, "$options": "i"}},
            {"model": {"$regex": term, "$options": "i"}},
            {"serialNumber": {"$regex": term, "$options": "i"}},
            {"department": {"$regex": term, "$options": "i"}},
            {"location": {"$regex": term, "$options": "i"}},
        ]

    docs = list(db["eye_equipment"].find(query).sort([("assetId", 1), ("createdAt", -1)]))
    serialized = [serialize_equipment(doc) for doc in docs]

    requested_status = str(status or "").strip()
    if requested_status:
        valid_display = {
            "Operational",
            "Service Due",
            "Calibration Due",
            "Under Maintenance",
            "Out of Service",
            "Retired",
        }
        if requested_status not in valid_display:
            raise HTTPException(status_code=400, detail="Invalid equipment status")
        serialized = [item for item in serialized if item["status"] == requested_status]

    return {"equipment": serialized, "count": len(serialized)}


@router.post("", status_code=201)
def create_equipment(payload: EquipmentCreate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    require_verified_provider(current_user, db)
    hospital_id = _hospital_id(current_user)
    now = datetime.utcnow()
    if payload.status == "Retired":
        raise HTTPException(status_code=400, detail="New equipment cannot start as Retired")
    _validate_schedule(payload.lastService, payload.nextService, "service")
    _validate_schedule(payload.lastCalibration, payload.nextCalibration, "calibration")

    doc = {
        "hospitalId": hospital_id,
        "assetId": _normalize_asset_id(payload.assetId),
        "deviceName": payload.deviceName.strip(),
        "type": payload.type,
        "manufacturer": _normalize_text(payload.manufacturer),
        "model": _normalize_text(payload.model),
        "serialNumber": _normalize_text(payload.serialNumber),
        "department": _normalize_text(payload.department),
        "location": _normalize_text(payload.location),
        "purchaseDate": _normalize_text(payload.purchaseDate),
        "status": payload.status,
        "lastService": _normalize_text(payload.lastService),
        "nextService": _normalize_text(payload.nextService),
        "lastCalibration": _normalize_text(payload.lastCalibration),
        "nextCalibration": _normalize_text(payload.nextCalibration),
        "notes": _normalize_text(payload.notes),
        "createdByUserId": hospital_id,
        "createdAt": now,
        "updatedAt": now,
    }

    try:
        result = db["eye_equipment"].insert_one(doc)
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail="An equipment record with this Asset ID already exists") from exc

    equipment_id = str(result.inserted_id)
    doc["_id"] = result.inserted_id
    _audit(db, current_user, "CREATE_EQUIPMENT", equipment_id)
    return {"message": "Equipment added successfully", "equipment": serialize_equipment(doc)}


@router.get("/{equipment_id}")
def get_equipment(equipment_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    require_verified_provider(current_user, db)
    doc = _owned_equipment(db, current_user, equipment_id)
    return serialize_equipment(doc)


@router.patch("/{equipment_id}")
def update_equipment(
    equipment_id: str,
    payload: EquipmentUpdate,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    require_verified_provider(current_user, db)
    existing = _owned_equipment(db, current_user, equipment_id)

    updates = payload.model_dump(exclude_unset=True)
    if "assetId" in updates:
        updates["assetId"] = _normalize_asset_id(updates["assetId"])
    for key in (
        "deviceName",
        "manufacturer",
        "model",
        "serialNumber",
        "department",
        "location",
        "purchaseDate",
        "lastService",
        "nextService",
        "lastCalibration",
        "nextCalibration",
        "notes",
    ):
        if key in updates:
            updates[key] = _normalize_text(updates[key])

    if existing.get("status") == "Retired" and updates.get("status") not in {None, "Retired"}:
        raise HTTPException(status_code=409, detail="Retired equipment cannot be reactivated. Create a new asset record if needed.")
    if existing.get("status") != "Retired" and updates.get("status") == "Retired":
        raise HTTPException(status_code=400, detail="Use the RETIREMENT lifecycle action to retire equipment")

    merged_last_service = updates.get("lastService", existing.get("lastService", ""))
    merged_next_service = updates.get("nextService", existing.get("nextService", ""))
    merged_last_calibration = updates.get("lastCalibration", existing.get("lastCalibration", ""))
    merged_next_calibration = updates.get("nextCalibration", existing.get("nextCalibration", ""))
    _validate_schedule(merged_last_service, merged_next_service, "service")
    _validate_schedule(merged_last_calibration, merged_next_calibration, "calibration")

    updates["updatedAt"] = datetime.utcnow()
    try:
        db["eye_equipment"].update_one({"_id": existing["_id"]}, {"$set": updates})
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail="An equipment record with this Asset ID already exists") from exc

    _audit(db, current_user, "UPDATE_EQUIPMENT", equipment_id)
    updated = db["eye_equipment"].find_one({"_id": existing["_id"]})
    return {"message": "Equipment updated successfully", "equipment": serialize_equipment(updated)}


@router.get("/{equipment_id}/events")
def list_equipment_events(equipment_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    require_verified_provider(current_user, db)
    _owned_equipment(db, current_user, equipment_id)
    docs = db["equipment_events"].find(
        {"hospitalId": _hospital_id(current_user), "equipmentId": equipment_id}
    ).sort([("eventDate", -1), ("createdAt", -1)])
    return {"events": [serialize_event(doc) for doc in docs]}


@router.post("/{equipment_id}/events", status_code=201)
def create_equipment_event(
    equipment_id: str,
    payload: EquipmentEventCreate,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    require_verified_provider(current_user, db)
    equipment = _owned_equipment(db, current_user, equipment_id)
    hospital_id = _hospital_id(current_user)

    if payload.eventType not in EVENT_TYPES:
        raise HTTPException(status_code=400, detail="Invalid equipment event type")
    current_status = str(equipment.get("status") or "Operational")
    if current_status == "Retired":
        raise HTTPException(status_code=409, detail="Retired equipment is read-only")
    if payload.eventType == "DOWNTIME_START" and current_status == "Out of Service":
        raise HTTPException(status_code=409, detail="Downtime is already active for this equipment")
    if payload.eventType == "DOWNTIME_END" and current_status != "Out of Service":
        raise HTTPException(status_code=409, detail="Downtime can only be ended for equipment that is Out of Service")
    if payload.eventType in {"STATUS_CHANGE", "REPAIR"} and payload.targetStatus == "Retired":
        raise HTTPException(status_code=400, detail="Use the RETIREMENT lifecycle action to retire equipment")

    event_date = payload.eventDate
    next_due = str(payload.nextDueDate or "").strip()
    event_dt = parse_iso_date(event_date)
    next_dt = parse_iso_date(next_due) if next_due else None
    if next_dt and event_dt and next_dt < event_dt:
        raise HTTPException(status_code=400, detail="Next due date cannot be earlier than the event date")

    if payload.eventType == "STATUS_CHANGE" and not payload.targetStatus:
        raise HTTPException(status_code=400, detail="targetStatus is required for STATUS_CHANGE")
    if payload.eventType == "RETIREMENT" and payload.targetStatus not in {None, "Retired"}:
        raise HTTPException(status_code=400, detail="Retirement status must be Retired")

    now = datetime.utcnow()
    event_doc = {
        "hospitalId": hospital_id,
        "equipmentId": equipment_id,
        "assetId": equipment.get("assetId", ""),
        "eventType": payload.eventType,
        "eventDate": event_date,
        "nextDueDate": next_due,
        "targetStatus": payload.targetStatus or "",
        "performedBy": _normalize_text(payload.performedBy),
        "reference": _normalize_text(payload.reference),
        "cost": payload.cost,
        "notes": _normalize_text(payload.notes),
        "createdByUserId": hospital_id,
        "createdAt": now,
    }

    updates: dict = {"updatedAt": now}
    event_type = payload.eventType
    if event_type == "SERVICE":
        updates["lastService"] = event_date
        updates["nextService"] = next_due
        if equipment.get("status") not in {"Out of Service", "Under Maintenance"}:
            updates["status"] = "Operational"
    elif event_type == "CALIBRATION":
        updates["lastCalibration"] = event_date
        updates["nextCalibration"] = next_due
        if equipment.get("status") not in {"Out of Service", "Under Maintenance"}:
            updates["status"] = "Operational"
    elif event_type == "DOWNTIME_START":
        updates["status"] = "Out of Service"
        updates["downtimeStartedAt"] = now
    elif event_type == "DOWNTIME_END":
        updates["status"] = "Operational"
        updates["downtimeEndedAt"] = now
        updates["downtimeStartedAt"] = None
    elif event_type == "REPAIR":
        updates["status"] = payload.targetStatus or "Operational"
        if updates["status"] == "Operational":
            updates["downtimeEndedAt"] = now
            updates["downtimeStartedAt"] = None
    elif event_type == "STATUS_CHANGE":
        updates["status"] = payload.targetStatus
        if payload.targetStatus == "Out of Service":
            updates["downtimeStartedAt"] = equipment.get("downtimeStartedAt") or now
        elif payload.targetStatus == "Operational":
            updates["downtimeEndedAt"] = now
            updates["downtimeStartedAt"] = None
    elif event_type == "RETIREMENT":
        updates["status"] = "Retired"
        updates["retiredAt"] = now

    result = db["equipment_events"].insert_one(event_doc)
    event_doc["_id"] = result.inserted_id
    db["eye_equipment"].update_one({"_id": equipment["_id"]}, {"$set": updates})
    _audit(db, current_user, f"EQUIPMENT_{event_type}", equipment_id)

    updated_equipment = db["eye_equipment"].find_one({"_id": equipment["_id"]})
    refresh_equipment_due_notifications(db, current_user)
    return {
        "message": "Equipment lifecycle event saved",
        "event": serialize_event(event_doc),
        "equipment": serialize_equipment(updated_equipment),
    }
