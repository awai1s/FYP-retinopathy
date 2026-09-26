"""Privacy Center and secure Health Card sharing helpers for EyeCare AI Phase 10E.

The service keeps QR tokens opaque, stores only a SHA-256 hash of the usable token,
and reconstructs the token from a random public id plus an HMAC signature derived
from the server secret.  Clinical payloads are always assembled at request time
from the existing authoritative collections; they are never copied into the token.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import io
import secrets
from datetime import date, datetime, timedelta, timezone
from typing import Any, Iterable, Optional

from bson import ObjectId
from pymongo import ReturnDocument
from reportlab.graphics import renderSVG
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing

import config

DEFAULT_HEALTH_CARD_FIELDS = {
    "basicIdentity": True,
    "emergencyContact": True,
    "bloodGroup": True,
    "allergies": True,
    "activeMedication": False,
    "latestDrResult": False,
    "latestHba1c": False,
}

ALLOWED_TEMPORARY_SCOPES = {
    "profile.basic",
    "profile.emergency_contact",
    "profile.blood_group",
    "profile.allergies",
    "screening.latest",
    "medications.active",
    "health_metrics.latest",
    "reports.recent",
}

EMERGENCY_SHARE_DAYS = 365
TEMPORARY_DURATIONS_MINUTES = {15, 60, 1440}


def _id_variants(value: Any) -> list[Any]:
    text = str(value or "").strip()
    values: list[Any] = []
    if text:
        values.append(text)
        if ObjectId.is_valid(text):
            values.append(ObjectId(text))
    return values


def _utcnow() -> datetime:
    return datetime.utcnow()


def _as_iso(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return str(value)


def _secret() -> bytes:
    value = str(getattr(config, "SECRET_KEY", "") or "").strip()
    if not value:
        raise RuntimeError("SECRET_KEY is required for secure health-card sharing")
    return value.encode("utf-8")


def _signature(public_id: str) -> str:
    digest = hmac.new(_secret(), public_id.encode("utf-8"), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")


def build_share_token(public_id: str) -> str:
    return f"{public_id}.{_signature(public_id)}"


def token_hash(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _token_parts(raw_token: str) -> tuple[str, str]:
    token = str(raw_token or "").strip()
    if "." not in token or len(token) > 512:
        raise ValueError("invalid token")
    public_id, signature = token.split(".", 1)
    if not public_id or not signature:
        raise ValueError("invalid token")
    return public_id, signature


def get_or_create_eye_care_id(db, patient_id: Any) -> str:
    """Return a stable public EyeCare ID without exposing the Mongo user id."""
    patient_text = str(patient_id)
    profile = db["patient_profiles"].find_one({"userId": patient_text}, {"eyeCareId": 1}) or {}
    existing = str(profile.get("eyeCareId") or "").strip().upper()
    if existing:
        return existing

    for _ in range(12):
        candidate = f"EC-{secrets.token_hex(5).upper()}"
        if not db["patient_profiles"].find_one({"eyeCareId": candidate}, {"_id": 1}):
            now = _utcnow()
            db["patient_profiles"].update_one(
                {"userId": patient_text},
                {
                    "$set": {"eyeCareId": candidate, "updatedAt": now},
                    "$setOnInsert": {"userId": patient_text, "createdAt": now},
                },
                upsert=True,
            )
            return candidate
    raise RuntimeError("Unable to allocate a unique EyeCare ID")


def get_or_create_health_card_settings(db, patient_id: Any) -> dict[str, Any]:
    patient_text = str(patient_id)
    existing = db["health_card_settings"].find_one({"patientId": patient_text})
    now = _utcnow()
    if existing:
        current = dict(DEFAULT_HEALTH_CARD_FIELDS)
        current.update(existing.get("fields") or {})
        if current != (existing.get("fields") or {}):
            db["health_card_settings"].update_one(
                {"_id": existing["_id"]},
                {"$set": {"fields": current, "updatedAt": now}},
            )
            existing["fields"] = current
        return existing

    doc = {
        "patientId": patient_text,
        "fields": dict(DEFAULT_HEALTH_CARD_FIELDS),
        "createdAt": now,
        "updatedAt": now,
    }
    result = db["health_card_settings"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


def update_health_card_settings(db, patient_id: Any, fields: dict[str, bool]) -> dict[str, Any]:
    patient_text = str(patient_id)
    current = get_or_create_health_card_settings(db, patient_text)
    merged = dict(DEFAULT_HEALTH_CARD_FIELDS)
    merged.update(current.get("fields") or {})
    for key in DEFAULT_HEALTH_CARD_FIELDS:
        if key in fields:
            merged[key] = bool(fields[key])

    now = _utcnow()
    db["health_card_settings"].update_one(
        {"patientId": patient_text},
        {"$set": {"fields": merged, "updatedAt": now}},
        upsert=True,
    )
    return db["health_card_settings"].find_one({"patientId": patient_text}) or {
        "patientId": patient_text,
        "fields": merged,
        "updatedAt": now,
    }


def emergency_scopes_from_settings(settings: dict[str, Any]) -> list[str]:
    fields = dict(DEFAULT_HEALTH_CARD_FIELDS)
    fields.update(settings.get("fields") or {})
    mapping = [
        ("basicIdentity", "profile.basic"),
        ("emergencyContact", "profile.emergency_contact"),
        ("bloodGroup", "profile.blood_group"),
        ("allergies", "profile.allergies"),
        ("activeMedication", "medications.active"),
        ("latestDrResult", "screening.latest"),
        ("latestHba1c", "health_metrics.latest"),
    ]
    # Honor the patient's choices exactly. If Basic Identity is off, the public
    # share does not reveal the patient's name/EyeCare ID. Emergency shares may
    # intentionally contain no clinical fields at all.
    return [scope for key, scope in mapping if fields.get(key)]


def create_share(
    db,
    *,
    patient_id: Any,
    share_type: str,
    scopes: Iterable[str],
    expires_at: datetime,
    max_uses: int | None = None,
    replace_same_type: bool = False,
) -> tuple[dict[str, Any], str]:
    patient_text = str(patient_id)
    normalized_type = str(share_type or "").strip().lower()
    if normalized_type not in {"emergency", "temporary"}:
        raise ValueError("unsupported share type")

    clean_scopes = []
    for scope in scopes:
        scope = str(scope or "").strip()
        if scope in ALLOWED_TEMPORARY_SCOPES and scope not in clean_scopes:
            clean_scopes.append(scope)
    if not clean_scopes and normalized_type != "emergency":
        raise ValueError("at least one permitted share scope is required")

    now = _utcnow()
    if replace_same_type:
        db["qr_share_tokens"].update_many(
            {
                "patientId": patient_text,
                "type": normalized_type,
                "revoked": {"$ne": True},
                "expiresAt": {"$gt": now},
            },
            {"$set": {"revoked": True, "revokedAt": now, "revokedReason": "rotated"}},
        )

    public_id = secrets.token_urlsafe(24)
    raw_token = build_share_token(public_id)
    doc = {
        "patientId": patient_text,
        "publicId": public_id,
        "tokenHash": token_hash(raw_token),
        "type": normalized_type,
        "scopes": clean_scopes,
        "createdAt": now,
        "expiresAt": expires_at,
        "revoked": False,
        "revokedAt": None,
        "revokedReason": "",
        "usedCount": 0,
        "maxUses": int(max_uses) if max_uses else None,
        "lastUsedAt": None,
    }
    result = db["qr_share_tokens"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc, raw_token


def active_emergency_share(db, patient_id: Any) -> Optional[dict[str, Any]]:
    return db["qr_share_tokens"].find_one(
        {
            "patientId": str(patient_id),
            "type": "emergency",
            "revoked": {"$ne": True},
            "expiresAt": {"$gt": _utcnow()},
        },
        sort=[("createdAt", -1)],
    )


def get_or_create_emergency_share(db, patient_id: Any, *, rotate: bool = False) -> tuple[dict[str, Any], str]:
    settings = get_or_create_health_card_settings(db, patient_id)
    scopes = emergency_scopes_from_settings(settings)
    if not rotate:
        existing = active_emergency_share(db, patient_id)
        if existing:
            current_scopes = list(existing.get("scopes") or [])
            if current_scopes == scopes:
                raw = build_share_token(str(existing.get("publicId") or ""))
                if hmac.compare_digest(str(existing.get("tokenHash") or ""), token_hash(raw)):
                    return existing, raw

    return create_share(
        db,
        patient_id=patient_id,
        share_type="emergency",
        scopes=scopes,
        expires_at=_utcnow() + timedelta(days=EMERGENCY_SHARE_DAYS),
        replace_same_type=True,
    )


def share_state(doc: dict[str, Any]) -> str:
    if bool(doc.get("revoked")):
        return "revoked"
    expires_at = doc.get("expiresAt")
    if isinstance(expires_at, datetime) and expires_at <= _utcnow():
        return "expired"
    max_uses = doc.get("maxUses")
    if max_uses and int(doc.get("usedCount") or 0) >= int(max_uses):
        return "exhausted"
    return "active"


def validate_share_token(db, raw_token: str, *, increment_use: bool = False) -> dict[str, Any]:
    try:
        public_id, provided_signature = _token_parts(raw_token)
    except ValueError as exc:
        raise LookupError("invalid") from exc

    expected_signature = _signature(public_id)
    if not hmac.compare_digest(provided_signature, expected_signature):
        raise LookupError("invalid")

    expected_hash = token_hash(raw_token)
    doc = db["qr_share_tokens"].find_one({"publicId": public_id, "tokenHash": expected_hash})
    if not doc:
        raise LookupError("invalid")

    state = share_state(doc)
    if state != "active":
        raise PermissionError(state)

    if increment_use:
        now = _utcnow()
        query: dict[str, Any] = {
            "_id": doc["_id"],
            "revoked": {"$ne": True},
            "expiresAt": {"$gt": now},
        }
        max_uses = doc.get("maxUses")
        if max_uses:
            query["usedCount"] = {"$lt": int(max_uses)}
        updated = db["qr_share_tokens"].find_one_and_update(
            query,
            {"$inc": {"usedCount": 1}, "$set": {"lastUsedAt": now}},
            return_document=ReturnDocument.AFTER,
        )
        if not updated:
            raise PermissionError("exhausted")
        doc = updated

    return doc


def serialize_share(doc: dict[str, Any], *, share_url: str | None = None) -> dict[str, Any]:
    payload = {
        "id": str(doc.get("_id") or ""),
        "type": doc.get("type") or "temporary",
        "scopes": list(doc.get("scopes") or []),
        "createdAt": _as_iso(doc.get("createdAt")),
        "expiresAt": _as_iso(doc.get("expiresAt")),
        "revoked": bool(doc.get("revoked")),
        "revokedAt": _as_iso(doc.get("revokedAt")),
        "revokedReason": doc.get("revokedReason") or "",
        "usedCount": int(doc.get("usedCount") or 0),
        "maxUses": doc.get("maxUses"),
        "lastUsedAt": _as_iso(doc.get("lastUsedAt")),
        "status": share_state(doc),
    }
    if share_url:
        payload["shareUrl"] = share_url
    return payload


def _clean_medication(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(doc.get("_id") or ""),
        "name": doc.get("medicationDetails") or doc.get("medication") or doc.get("name") or "Medication",
        "dosage": doc.get("dosage") or "",
        "times": list(doc.get("times") or []),
        "intakeInstruction": doc.get("intakeInstruction") or doc.get("instructions") or "",
        "source": doc.get("source") or ("Doctor" if doc.get("doctorId") else "Patient"),
    }


def _latest_prediction(db, patient_id: Any) -> Optional[dict[str, Any]]:
    return db["predictions"].find_one(
        {"patientId": {"$in": _id_variants(patient_id)}},
        sort=[("created_at", -1), ("createdAt", -1), ("date", -1)],
    )


def _latest_metric(db, patient_id: Any) -> Optional[dict[str, Any]]:
    return db["health_metrics"].find_one(
        {"patientId": {"$in": _id_variants(patient_id)}},
        sort=[("recordedAt", -1), ("createdAt", -1)],
    )


def _recent_reports(db, patient_id: Any, limit: int = 5) -> list[dict[str, Any]]:
    docs = db["reports"].find(
        {"patientId": {"$in": _id_variants(patient_id)}, "fileId": {"$nin": [None, ""]}},
        {
            "fileId": 1,
            "fileName": 1,
            "filename": 1,
            "reportNumber": 1,
            "reportType": 1,
            "reportKind": 1,
            "language": 1,
            "classification": 1,
            "screeningDate": 1,
            "generatedAt": 1,
            "createdAt": 1,
            "created_at": 1,
            "status": 1,
            "title": 1,
        },
    ).sort([("generatedAt", -1), ("created_at", -1), ("createdAt", -1)]).limit(limit)

    result = []
    for doc in docs:
        result.append(
            {
                "id": str(doc.get("_id") or ""),
                "title": doc.get("title") or doc.get("reportType") or "Medical Report",
                "reportNumber": doc.get("reportNumber") or "",
                "reportType": doc.get("reportType") or doc.get("reportKind") or "Report",
                "language": doc.get("language") or "",
                "classification": doc.get("classification") or "",
                "screeningDate": _as_iso(doc.get("screeningDate")),
                "createdAt": _as_iso(doc.get("generatedAt") or doc.get("created_at") or doc.get("createdAt")),
                "status": doc.get("status") or "Available",
            }
        )
    return result


def build_shared_payload(db, share_doc: dict[str, Any]) -> dict[str, Any]:
    patient_id = str(share_doc.get("patientId") or "")
    scopes = set(share_doc.get("scopes") or [])
    user = None
    if ObjectId.is_valid(patient_id):
        user = db["users"].find_one({"_id": ObjectId(patient_id)}, {"password": 0})
    if not user:
        user = db["users"].find_one({"_id": patient_id}, {"password": 0})
    user = user or {}
    profile = db["patient_profiles"].find_one({"userId": patient_id}) or {}

    data: dict[str, Any] = {}
    if "profile.basic" in scopes:
        name = str(user.get("name") or "").strip() or "EyeCare AI Patient"
        data["profile"] = {
            "name": name,
            "eyeCareId": get_or_create_eye_care_id(db, patient_id),
            "avatarInitial": name[:1].upper() if name else "P",
        }
    if "profile.emergency_contact" in scopes:
        data["emergencyContact"] = str(profile.get("emergencyContact") or "").strip()
    if "profile.blood_group" in scopes:
        data["bloodGroup"] = str(profile.get("bloodGroup") or "").strip()
    if "profile.allergies" in scopes:
        allergies = profile.get("allergies") or ""
        if isinstance(allergies, list):
            allergies = [str(item).strip() for item in allergies if str(item).strip()]
        else:
            allergies = str(allergies).strip()
        data["allergies"] = allergies

    if "medications.active" in scopes:
        docs = list(
            db["prescriptions"].find(
                {
                    "patientId": {"$in": _id_variants(patient_id)},
                    "active": {"$ne": False},
                }
            ).sort([("createdAt", -1), ("date", -1)]).limit(12)
        )
        data["activeMedications"] = [_clean_medication(doc) for doc in docs]

    if "screening.latest" in scopes:
        prediction = _latest_prediction(db, patient_id)
        if prediction:
            data["latestScreening"] = {
                "id": str(prediction.get("_id") or ""),
                "stage": prediction.get("stage") or prediction.get("classification") or prediction.get("result") or "",
                "confidence": prediction.get("confidence"),
                "status": prediction.get("status") or "",
                "date": _as_iso(prediction.get("created_at") or prediction.get("createdAt") or prediction.get("date")),
            }
        else:
            data["latestScreening"] = None

    if "health_metrics.latest" in scopes:
        metric = _latest_metric(db, patient_id)
        data["latestHbA1c"] = (
            {
                "value": metric.get("hba1c"),
                "recordedAt": _as_iso(metric.get("recordedAt") or metric.get("createdAt")),
            }
            if metric and metric.get("hba1c") is not None
            else None
        )

    if "reports.recent" in scopes:
        data["recentReports"] = _recent_reports(db, patient_id)

    return {
        "share": {
            "id": str(share_doc.get("_id") or ""),
            "type": share_doc.get("type") or "temporary",
            "expiresAt": _as_iso(share_doc.get("expiresAt")),
            "scopes": list(share_doc.get("scopes") or []),
        },
        "data": data,
    }


def build_qr_svg(value: str, size: int = 220) -> str:
    widget = qr.QrCodeWidget(str(value))
    x1, y1, x2, y2 = widget.getBounds()
    width = max(x2 - x1, 1)
    height = max(y2 - y1, 1)
    drawing = Drawing(size, size, transform=[size / width, 0, 0, size / height, 0, 0])
    drawing.add(widget)
    svg = renderSVG.drawToString(drawing)
    start = svg.find("<svg")
    end = svg.rfind("</svg>")
    if start >= 0 and end >= 0:
        return svg[start : end + len("</svg>")]
    return svg
