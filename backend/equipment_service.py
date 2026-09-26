"""Phase 10M hospital eye-equipment lifecycle helpers.

This module intentionally contains no clinical patient data. It owns:
- display-status derivation from explicit lifecycle state + due dates
- serialization helpers shared by hospital equipment endpoints
- idempotent due-date notification generation

The stable MongoDB equipment `_id` is suitable for a future optional
`predictions.equipmentId` reference without changing the current screening
pipeline in Phase 10M.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

from bson import ObjectId
from pymongo.database import Database

EXPLICIT_STATUSES = {
    "Operational",
    "Under Maintenance",
    "Out of Service",
    "Retired",
}

DISPLAY_STATUSES = {
    "Operational",
    "Service Due",
    "Calibration Due",
    "Under Maintenance",
    "Out of Service",
    "Retired",
}

EQUIPMENT_TYPES = {
    "Fundus Camera",
    "OCT Scanner",
    "Slit Lamp",
    "Retinal Laser",
    "Visual Field Analyzer",
    "Tonometer",
    "Other",
}

EVENT_TYPES = {
    "SERVICE",
    "CALIBRATION",
    "DOWNTIME_START",
    "DOWNTIME_END",
    "REPAIR",
    "STATUS_CHANGE",
    "RETIREMENT",
}


def parse_iso_date(value: Optional[str]) -> Optional[date]:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        return date.fromisoformat(raw)
    except ValueError:
        return None


def iso_datetime(value: Any) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value or "")


def days_until(value: Optional[str], *, today: Optional[date] = None) -> Optional[int]:
    parsed = parse_iso_date(value)
    if not parsed:
        return None
    return (parsed - (today or datetime.utcnow().date())).days


def derive_display_status(doc: dict, *, today: Optional[date] = None) -> str:
    """Return the operational status a hospital should see right now.

    Explicit non-operational states always win. Service/calibration due states
    are derived from dates so they cannot become stale after the calendar moves.
    If both are overdue, service takes precedence on the compact status badge;
    both remain visible in due metadata and dashboard counters.
    """

    explicit = str(doc.get("status") or "Operational").strip()
    if explicit in {"Retired", "Out of Service", "Under Maintenance"}:
        return explicit

    today_value = today or datetime.utcnow().date()
    service_days = days_until(doc.get("nextService"), today=today_value)
    calibration_days = days_until(doc.get("nextCalibration"), today=today_value)

    if service_days is not None and service_days <= 0:
        return "Service Due"
    if calibration_days is not None and calibration_days <= 0:
        return "Calibration Due"
    return "Operational"


def _due_state(value: Optional[str], *, today: Optional[date] = None) -> dict:
    days = days_until(value, today=today)
    if days is None:
        return {"date": str(value or ""), "days": None, "state": "not_set"}
    if days < 0:
        state = "overdue"
    elif days == 0:
        state = "due_today"
    elif days <= 7:
        state = "due_soon"
    elif days <= 30:
        state = "upcoming"
    else:
        state = "scheduled"
    return {"date": str(value or ""), "days": days, "state": state}


def serialize_equipment(doc: dict, *, today: Optional[date] = None) -> dict:
    today_value = today or datetime.utcnow().date()
    display_status = derive_display_status(doc, today=today_value)
    return {
        "id": str(doc.get("_id") or ""),
        "assetId": doc.get("assetId", ""),
        "deviceName": doc.get("deviceName", ""),
        "type": doc.get("type", "Other"),
        "manufacturer": doc.get("manufacturer", ""),
        "model": doc.get("model", ""),
        "serialNumber": doc.get("serialNumber", ""),
        "department": doc.get("department", ""),
        "location": doc.get("location", ""),
        "purchaseDate": doc.get("purchaseDate", ""),
        "status": display_status,
        "storedStatus": doc.get("status", "Operational"),
        "lastService": doc.get("lastService", ""),
        "nextService": doc.get("nextService", ""),
        "lastCalibration": doc.get("lastCalibration", ""),
        "nextCalibration": doc.get("nextCalibration", ""),
        "notes": doc.get("notes", ""),
        "serviceDue": _due_state(doc.get("nextService"), today=today_value),
        "calibrationDue": _due_state(doc.get("nextCalibration"), today=today_value),
        "downtimeStartedAt": iso_datetime(doc.get("downtimeStartedAt")),
        "retiredAt": iso_datetime(doc.get("retiredAt")),
        "createdAt": iso_datetime(doc.get("createdAt")),
        "updatedAt": iso_datetime(doc.get("updatedAt")),
    }


def serialize_event(doc: dict) -> dict:
    return {
        "id": str(doc.get("_id") or ""),
        "equipmentId": str(doc.get("equipmentId") or ""),
        "eventType": doc.get("eventType", "STATUS_CHANGE"),
        "eventDate": doc.get("eventDate", ""),
        "nextDueDate": doc.get("nextDueDate", ""),
        "targetStatus": doc.get("targetStatus", ""),
        "performedBy": doc.get("performedBy", ""),
        "reference": doc.get("reference", ""),
        "cost": doc.get("cost"),
        "notes": doc.get("notes", ""),
        "createdByUserId": str(doc.get("createdByUserId") or ""),
        "createdAt": iso_datetime(doc.get("createdAt")),
    }


def _reminder_bucket(days: int) -> Optional[str]:
    if days < 0:
        return "overdue"
    if days == 0:
        return "today"
    if days <= 7:
        return "within7"
    if days <= 30:
        return "within30"
    return None


def _reminder_message(asset_id: str, label: str, days: int) -> str:
    if days < 0:
        unit = "day" if abs(days) == 1 else "days"
        return f"{asset_id} {label} is overdue by {abs(days)} {unit}."
    if days == 0:
        return f"{asset_id} {label} is due today."
    unit = "day" if days == 1 else "days"
    return f"{asset_id} {label} is due in {days} {unit}."


def refresh_equipment_due_notifications(db: Database, current_user: dict) -> int:
    """Create due reminders for one Hospital account without duplicates.

    Reminders are generated in escalating windows (30d, 7d, today, overdue).
    The key contains the due date and bucket, so changing a service/calibration
    date naturally creates the correct future reminder while old history stays
    immutable in the Notifications screen.
    """

    if str(current_user.get("role") or "") != "Hospital":
        return 0
    if str(current_user.get("verificationStatus") or "pending").lower() != "verified":
        return 0
    if str(current_user.get("accountStatus") or "active").lower() != "active":
        return 0

    hospital_id = str(current_user.get("_id") or "")
    if not hospital_id:
        return 0

    today = datetime.utcnow().date()
    created = 0
    cursor = db["eye_equipment"].find(
        {
            "hospitalId": hospital_id,
            "status": {"$ne": "Retired"},
        },
        {
            "assetId": 1,
            "deviceName": 1,
            "nextService": 1,
            "nextCalibration": 1,
        },
    )

    for equipment in cursor:
        equipment_id = str(equipment["_id"])
        asset_id = str(equipment.get("assetId") or equipment.get("deviceName") or "Equipment")
        for kind, field, label in (
            ("service", "nextService", "service"),
            ("calibration", "nextCalibration", "calibration"),
        ):
            due_value = str(equipment.get(field) or "").strip()
            days = days_until(due_value, today=today)
            if days is None:
                continue
            bucket = _reminder_bucket(days)
            if bucket is None:
                continue

            key = f"{equipment_id}:{kind}:{due_value}:{bucket}"
            title = f"{label.capitalize()} {'overdue' if days < 0 else 'due'}"
            result = db["notifications"].update_one(
                {
                    "userId": hospital_id,
                    "type": "equipment",
                    "equipmentReminderKey": key,
                },
                {
                    "$setOnInsert": {
                        "userId": hospital_id,
                        "title": title,
                        "message": _reminder_message(asset_id, label, days),
                        "type": "equipment",
                        "relatedId": equipment_id,
                        "read": False,
                        "equipmentReminderKey": key,
                        "createdAt": datetime.utcnow(),
                    }
                },
                upsert=True,
            )
            if result.upserted_id is not None:
                created += 1

    return created


def equipment_summary(db: Database, hospital_id: str) -> dict:
    today = datetime.utcnow().date()
    docs = list(db["eye_equipment"].find({"hospitalId": hospital_id}))
    counts = {
        "totalDevices": len(docs),
        "activeDevices": 0,
        "operational": 0,
        "serviceDue": 0,
        "calibrationDue": 0,
        "underMaintenance": 0,
        "outOfService": 0,
        "retired": 0,
        "dueWithin7Days": 0,
    }

    upcoming = []
    for doc in docs:
        status = derive_display_status(doc, today=today)
        explicit = str(doc.get("status") or "Operational")
        retired = explicit == "Retired"

        if explicit == "Retired":
            counts["retired"] += 1
        elif explicit == "Out of Service":
            counts["outOfService"] += 1
        elif explicit == "Under Maintenance":
            counts["underMaintenance"] += 1
        else:
            # Service/Calibration due assets are still counted as active unless
            # the hospital has explicitly taken them out of service.
            counts["activeDevices"] += 1
            if status == "Operational":
                counts["operational"] += 1

        if retired:
            continue

        service_days = days_until(doc.get("nextService"), today=today)
        calibration_days = days_until(doc.get("nextCalibration"), today=today)
        if service_days is not None and service_days <= 0:
            counts["serviceDue"] += 1
        if calibration_days is not None and calibration_days <= 0:
            counts["calibrationDue"] += 1

        due_within_7_for_device = False
        for kind, field in (("service", "nextService"), ("calibration", "nextCalibration")):
            raw = str(doc.get(field) or "").strip()
            days = days_until(raw, today=today)
            if days is None:
                continue
            if 0 <= days <= 7:
                due_within_7_for_device = True
            if days <= 30:
                upcoming.append(
                    {
                        "equipmentId": str(doc["_id"]),
                        "assetId": doc.get("assetId", ""),
                        "deviceName": doc.get("deviceName", ""),
                        "kind": kind,
                        "dueDate": raw,
                        "days": days,
                    }
                )
        if due_within_7_for_device:
            counts["dueWithin7Days"] += 1

    upcoming.sort(key=lambda item: (item["days"], item["assetId"]))
    return {**counts, "upcomingDue": upcoming[:8]}
