from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable

from bson import ObjectId
from fastapi import HTTPException


ACCEPTED_STATUSES = {"accepted", "active"}
FINAL_STATUSES = {"pending", "accepted", "declined", "revoked", "blocked"}


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def normalize_status(value: Any) -> str:
    status = str(value or "").strip().lower()
    if status == "rejected":
        return "declined"
    if status == "active":
        return "accepted"
    return status or "pending"


def id_variants(value: Any) -> list[Any]:
    text = str(value or "").strip()
    values: list[Any] = []
    if text:
        values.append(text)
        if ObjectId.is_valid(text):
            values.append(ObjectId(text))
    return values


def pair_query(patient_id: Any, doctor_id: Any) -> dict[str, Any]:
    return {
        "patientId": {"$in": id_variants(patient_id)},
        "$or": [
            {"doctorId": {"$in": id_variants(doctor_id)}},
            {"providerId": {"$in": id_variants(doctor_id)}},
        ],
    }


def find_pair_connection(db, patient_id: Any, doctor_id: Any) -> tuple[str | None, dict[str, Any] | None]:
    query = pair_query(patient_id, doctor_id)
    for collection_name in ("care_connections", "connections"):
        doc = db[collection_name].find_one(query)
        if doc:
            return collection_name, doc
    return None, None


def find_accepted_connection(db, patient_id: Any, doctor_id: Any) -> dict[str, Any] | None:
    collection_name, doc = find_pair_connection(db, patient_id, doctor_id)
    del collection_name
    if doc and normalize_status(doc.get("status")) == "accepted":
        return doc
    return None


def require_accepted_connection(db, patient_id: Any, doctor_id: Any) -> dict[str, Any]:
    doc = find_accepted_connection(db, patient_id, doctor_id)
    if not doc:
        raise HTTPException(status_code=403, detail="Accepted patient care connection required")
    return doc


def relation_status(db, patient_id: Any, doctor_id: Any) -> str | None:
    _, doc = find_pair_connection(db, patient_id, doctor_id)
    if not doc:
        return None
    return normalize_status(doc.get("status"))


def canonicalize_legacy_connection(db, source_collection: str, doc: dict[str, Any]) -> dict[str, Any]:
    """Copy a legacy `connections` record into the Phase 10D canonical collection.

    The source document is left untouched so old message/history references do not break.
    The canonical copy carries `legacyConnectionId` for traceability.
    """
    if source_collection == "care_connections":
        return doc

    patient_id = str(doc.get("patientId") or "")
    doctor_id = str(doc.get("doctorId") or doc.get("providerId") or "")
    if not patient_id or not doctor_id:
        return doc

    existing = db["care_connections"].find_one(pair_query(patient_id, doctor_id))
    if existing:
        return existing

    copied = {
        key: value
        for key, value in doc.items()
        if key != "_id"
    }
    copied.update(
        {
            "patientId": patient_id,
            "doctorId": doctor_id,
            "providerId": doctor_id,
            "status": normalize_status(doc.get("status")),
            "legacyConnectionId": str(doc.get("_id") or ""),
            "migratedAt": now_utc(),
            "updatedAt": now_utc(),
        }
    )
    inserted = db["care_connections"].insert_one(copied)
    copied["_id"] = inserted.inserted_id
    return copied


def transition_history(doc: dict[str, Any], *, from_status: str, to_status: str, actor_id: Any, reason: str) -> dict[str, Any]:
    return {
        "from": normalize_status(from_status),
        "to": normalize_status(to_status),
        "actorUserId": str(actor_id or ""),
        "reason": str(reason or "").strip(),
        "at": now_utc(),
    }


def all_pair_docs(db, user_id: Any, role: str, statuses: Iterable[str] | None = None) -> list[tuple[str, dict[str, Any]]]:
    user_values = id_variants(user_id)
    if role == "Patient":
        base: dict[str, Any] = {"patientId": {"$in": user_values}}
    elif role == "Doctor":
        base = {
            "$or": [
                {"doctorId": {"$in": user_values}},
                {"providerId": {"$in": user_values}},
            ]
        }
    else:
        return []

    normalized = {normalize_status(item) for item in statuses} if statuses else None
    results: list[tuple[str, dict[str, Any]]] = []
    seen_pairs: set[tuple[str, str]] = set()

    # Canonical collection wins when a pair exists in both collections.
    for collection_name in ("care_connections", "connections"):
        for doc in db[collection_name].find(base).sort("updatedAt", -1):
            patient_id = str(doc.get("patientId") or "")
            doctor_id = str(doc.get("doctorId") or doc.get("providerId") or "")
            pair = (patient_id, doctor_id)
            if not patient_id or not doctor_id or pair in seen_pairs:
                continue
            status = normalize_status(doc.get("status"))
            if normalized is not None and status not in normalized:
                continue
            seen_pairs.add(pair)
            results.append((collection_name, doc))
    return results
