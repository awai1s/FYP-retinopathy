from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from pymongo.errors import DuplicateKeyError

from access_control import provider_verification_status, require_verified_provider
from connection_service import (
    all_pair_docs,
    canonicalize_legacy_connection,
    find_pair_connection,
    id_variants,
    normalize_status,
    now_utc,
    pair_query,
    transition_history,
)
from database import get_db
from dependencies import RoleChecker, get_current_user

router = APIRouter(
    prefix="/api/connections",
    tags=["Care Connections"],
    dependencies=[Depends(RoleChecker(["Patient", "Doctor"]))],
)


class ConnectionRequestBody(BaseModel):
    targetId: str


class ConnectionActionBody(BaseModel):
    reason: str | None = None


def _active_account(user: dict[str, Any]) -> bool:
    return str(user.get("accountStatus") or "active").strip().lower() == "active"


def _load_user(db, user_id: Any, role: str | None = None) -> dict[str, Any] | None:
    values = id_variants(user_id)
    query: dict[str, Any] = {"_id": {"$in": values}}
    if role:
        query["role"] = role
    return db["users"].find_one(query, {"password": 0})


def _require_verified_doctor_record(db, doctor: dict[str, Any]) -> dict[str, Any]:
    if not doctor or doctor.get("role") != "Doctor":
        raise HTTPException(status_code=404, detail="Doctor not found")
    provider_user = {**doctor, "_id": str(doctor.get("_id") or "")}
    # This checks both accountStatus and the provider verification record.
    require_verified_provider(provider_user, db)
    status = provider_verification_status(provider_user, db)
    if status != "verified":
        raise HTTPException(status_code=403, detail="Only verified doctors can participate in care connections")
    return doctor


def _ensure_actor(current_user: dict[str, Any], db) -> None:
    if current_user.get("role") == "Doctor":
        require_verified_provider(current_user, db)
        if provider_verification_status(current_user, db) != "verified":
            raise HTTPException(status_code=403, detail="Provider verification required")


def _provider_public_details(db, doctor: dict[str, Any]) -> dict[str, Any]:
    doctor_id = str(doctor.get("_id") or "")
    profile = db["doctor_profiles"].find_one(
        {"$or": [{"userId": doctor_id}, {"userId": doctor.get("_id")}]},
        {"_id": 0},
    ) or {}
    verification = db["provider_verifications"].find_one(
        {"userId": {"$in": id_variants(doctor_id)}},
        {"details": 1, "status": 1},
    ) or {}
    details = verification.get("details") or {}

    years = (
        details.get("yearsOfExperience")
        or profile.get("yearsOfExperience")
        or profile.get("experience")
        or doctor.get("yearsOfExperience")
    )
    hospital = (
        details.get("currentHospitalClinic")
        or details.get("currentHospital")
        or profile.get("hospital")
        or profile.get("clinic")
        or doctor.get("hospital")
        or ""
    )
    specialization = (
        details.get("specialization")
        or profile.get("specialization")
        or doctor.get("specialization")
        or "Ophthalmologist"
    )
    qualification = details.get("qualification") or profile.get("qualification") or ""
    license_number = details.get("medicalLicenseNumber") or profile.get("licenseNumber") or ""
    experience = f"{years} years" if isinstance(years, (int, float)) else str(years or "")
    return {
        "specialization": specialization,
        "hospital": hospital,
        "experience": experience,
        "yearsOfExperience": years,
        "qualification": qualification,
        "licenseNumber": license_number,
        "verified": True,
    }


def _basic_patient_details(db, patient: dict[str, Any]) -> dict[str, Any]:
    patient_id = str(patient.get("_id") or "")
    profile = db["patient_profiles"].find_one(
        {"$or": [{"userId": patient_id}, {"userId": patient.get("_id")}]},
        {"city": 1},
    ) or {}
    return {
        "age": patient.get("age"),
        "city": profile.get("city") or patient.get("city") or "",
    }


def _person_payload(db, user: dict[str, Any], connection: dict[str, Any] | None = None) -> dict[str, Any]:
    name = str(user.get("name") or "").strip()
    parts = name.split()
    payload = {
        "id": str(user.get("_id") or ""),
        "name": name,
        "firstName": parts[0] if parts else "",
        "lastName": " ".join(parts[1:]) if len(parts) > 1 else "",
        "username": user.get("username") or "",
        "role": user.get("role") or "",
    }
    if user.get("role") == "Doctor":
        payload.update(_provider_public_details(db, user))
    else:
        payload.update(_basic_patient_details(db, user))
    if connection:
        payload["connectionStatus"] = normalize_status(connection.get("status"))
        payload["connectionId"] = str(connection.get("_id") or "")
    return payload


def _appointment_context(db, patient_id: str, doctor_id: str) -> dict[str, Any]:
    today = datetime.now(timezone.utc).date().isoformat()
    base = {
        "patientId": {"$in": id_variants(patient_id)},
        "doctorId": {"$in": id_variants(doctor_id)},
        "status": {"$nin": ["Cancelled", "Rejected", "cancelled", "rejected"]},
    }
    last_doc = db["appointments"].find_one(
        {**base, "date": {"$lte": today}},
        {"date": 1, "status": 1},
        sort=[("date", -1), ("time", -1)],
    )
    next_doc = db["appointments"].find_one(
        {**base, "date": {"$gte": today}},
        {"date": 1, "time": 1, "status": 1},
        sort=[("date", 1), ("time", 1)],
    )
    return {
        "lastVisit": (last_doc or {}).get("date"),
        "nextAppointment": (next_doc or {}).get("date"),
        "nextAppointmentTime": (next_doc or {}).get("time"),
    }


def _serialize_connection(db, doc: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    patient_id = str(doc.get("patientId") or "")
    doctor_id = str(doc.get("doctorId") or doc.get("providerId") or "")
    current_role = str(current_user.get("role") or "")
    other_role = "Doctor" if current_role == "Patient" else "Patient"
    other_id = doctor_id if current_role == "Patient" else patient_id
    other = _load_user(db, other_id, other_role) or {"_id": other_id, "role": other_role, "name": other_role}
    status = normalize_status(doc.get("status"))
    payload = {
        "id": str(doc.get("_id") or ""),
        "status": status,
        "requestedBy": doc.get("requestedBy"),
        "requestedByUserId": str(doc.get("requestedByUserId") or ""),
        "createdAt": _iso(doc.get("createdAt")),
        "updatedAt": _iso(doc.get("updatedAt")),
        "acceptedAt": _iso(doc.get("acceptedAt")),
        "declinedAt": _iso(doc.get("declinedAt")),
        "revokedAt": _iso(doc.get("revokedAt")),
        "blockedAt": _iso(doc.get("blockedAt")),
        "blockedBy": str(doc.get("blockedBy") or ""),
        "connectedSince": _iso(doc.get("acceptedAt") or doc.get("updatedAt") or doc.get("createdAt")),
        "person": _person_payload(db, other, doc),
        "doctorId": doctor_id,
        "patientId": patient_id,
        "canAccessClinical": status == "accepted",
    }
    if current_role == "Doctor" and status == "accepted":
        payload.update(_appointment_context(db, patient_id, doctor_id))
    return payload


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _notify(db, user_id: Any, *, title: str, message: str, connection_id: str) -> None:
    if not user_id:
        return
    db["notifications"].insert_one(
        {
            "userId": str(user_id),
            "title": title,
            "message": message,
            "type": "connection",
            "read": False,
            "relatedId": connection_id,
            "createdAt": now_utc(),
        }
    )


def _notify_both(db, doc: dict[str, Any], *, title: str, patient_message: str, doctor_message: str) -> None:
    connection_id = str(doc.get("_id") or "")
    _notify(db, doc.get("patientId"), title=title, message=patient_message, connection_id=connection_id)
    _notify(db, doc.get("doctorId") or doc.get("providerId"), title=title, message=doctor_message, connection_id=connection_id)


def _participant_check(doc: dict[str, Any], current_user: dict[str, Any]) -> tuple[str, str, str]:
    actor_id = str(current_user.get("_id") or "")
    patient_id = str(doc.get("patientId") or "")
    doctor_id = str(doc.get("doctorId") or doc.get("providerId") or "")
    if actor_id not in {patient_id, doctor_id}:
        raise HTTPException(status_code=403, detail="You are not part of this care connection")
    return actor_id, patient_id, doctor_id


def _load_connection_for_action(db, connection_id: str) -> tuple[str, dict[str, Any]]:
    if not ObjectId.is_valid(connection_id):
        raise HTTPException(status_code=400, detail="Invalid connection ID")
    object_id = ObjectId(connection_id)
    for collection_name in ("care_connections", "connections"):
        doc = db[collection_name].find_one({"_id": object_id})
        if doc:
            if collection_name != "care_connections":
                doc = canonicalize_legacy_connection(db, collection_name, doc)
                collection_name = "care_connections"
            return collection_name, doc
    raise HTTPException(status_code=404, detail="Care connection not found")


def _target_is_recipient(doc: dict[str, Any], current_user: dict[str, Any]) -> bool:
    actor_id = str(current_user.get("_id") or "")
    requested_by = str(doc.get("requestedBy") or "").strip().lower()
    if requested_by == "patient":
        return actor_id == str(doc.get("doctorId") or doc.get("providerId") or "")
    if requested_by == "doctor":
        return actor_id == str(doc.get("patientId") or "")
    requested_by_id = str(doc.get("requestedByUserId") or "")
    return bool(requested_by_id and requested_by_id != actor_id)


def _requester_is_actor(doc: dict[str, Any], current_user: dict[str, Any]) -> bool:
    actor_id = str(current_user.get("_id") or "")
    requested_by_id = str(doc.get("requestedByUserId") or "")
    if requested_by_id:
        return actor_id == requested_by_id
    requested_by = str(doc.get("requestedBy") or "").strip().lower()
    return (requested_by == "patient" and current_user.get("role") == "Patient") or (
        requested_by == "doctor" and current_user.get("role") == "Doctor"
    )


def _set_status(db, doc: dict[str, Any], *, to_status: str, current_user: dict[str, Any], reason: str) -> dict[str, Any]:
    previous = normalize_status(doc.get("status"))
    now = now_utc()
    fields: dict[str, Any] = {
        "status": to_status,
        "updatedAt": now,
    }
    timestamp_field = {
        "accepted": "acceptedAt",
        "declined": "declinedAt",
        "revoked": "revokedAt",
        "blocked": "blockedAt",
    }.get(to_status)
    if timestamp_field:
        fields[timestamp_field] = now
    if to_status == "blocked":
        fields["blockedBy"] = str(current_user.get("_id") or "")
    elif previous == "blocked":
        fields["blockedBy"] = None

    db["care_connections"].update_one(
        {"_id": doc["_id"]},
        {
            "$set": fields,
            "$push": {
                "history": transition_history(
                    doc,
                    from_status=previous,
                    to_status=to_status,
                    actor_id=current_user.get("_id"),
                    reason=reason,
                )
            },
        },
    )
    return db["care_connections"].find_one({"_id": doc["_id"]})


@router.get("")
def list_connections(current_user: dict = Depends(get_current_user)):
    db = get_db()
    _ensure_actor(current_user, db)
    docs = all_pair_docs(db, current_user.get("_id"), current_user.get("role"), {"accepted"})
    return {"connections": [_serialize_connection(db, doc, current_user) for _, doc in docs]}


@router.get("/requests")
def list_requests(current_user: dict = Depends(get_current_user)):
    db = get_db()
    _ensure_actor(current_user, db)
    pending = all_pair_docs(db, current_user.get("_id"), current_user.get("role"), {"pending"})
    blocked = all_pair_docs(db, current_user.get("_id"), current_user.get("role"), {"blocked"})
    incoming: list[dict[str, Any]] = []
    outgoing: list[dict[str, Any]] = []
    for _, doc in pending:
        serialized = _serialize_connection(db, doc, current_user)
        if _target_is_recipient(doc, current_user):
            incoming.append(serialized)
        else:
            outgoing.append(serialized)
    return {
        "incoming": incoming,
        "outgoing": outgoing,
        "blocked": [_serialize_connection(db, doc, current_user) for _, doc in blocked],
    }


@router.get("/directory")
def search_directory(
    q: str = Query(default="", max_length=100),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    _ensure_actor(current_user, db)
    cleaned = str(q or "").strip()
    target_role = "Doctor" if current_user.get("role") == "Patient" else "Patient"
    query: dict[str, Any] = {"role": target_role}
    if cleaned and target_role == "Patient":
        query["$or"] = [
            {"name": {"$regex": cleaned, "$options": "i"}},
            {"username": {"$regex": cleaned, "$options": "i"}},
        ]

    # Doctor specialization/hospital live mainly in the verified provider record,
    # not always in users. Fetch a bounded doctor directory and filter the safe
    # public payload below so specialty searches work correctly.
    users = list(db["users"].find(query, {"password": 0}).limit(100 if target_role == "Doctor" else 50))
    people: list[dict[str, Any]] = []
    actor_id = str(current_user.get("_id") or "")
    for user in users:
        target_id = str(user.get("_id") or "")
        if target_id == actor_id:
            continue
        if target_role == "Doctor":
            try:
                _require_verified_doctor_record(db, user)
            except HTTPException:
                continue
            patient_id, doctor_id = actor_id, target_id
        else:
            patient_id, doctor_id = target_id, actor_id

        _, existing = find_pair_connection(db, patient_id, doctor_id)
        # A blocked relationship is intentionally hidden from directory search.
        if existing and normalize_status(existing.get("status")) == "blocked":
            continue
        person = _person_payload(db, user, existing)
        if cleaned and target_role == "Doctor":
            haystack = " ".join(
                str(person.get(key) or "")
                for key in ("name", "username", "specialization", "hospital", "qualification")
            ).lower()
            if cleaned.lower() not in haystack:
                continue
        people.append(person)
    return {"people": people, "targetRole": target_role}


@router.get("/directory/{target_id}")
def directory_person(target_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    _ensure_actor(current_user, db)
    target_role = "Doctor" if current_user.get("role") == "Patient" else "Patient"
    user = _load_user(db, target_id, target_role)
    if not user:
        raise HTTPException(status_code=404, detail=f"{target_role} not found")
    if target_role == "Doctor":
        _require_verified_doctor_record(db, user)
        patient_id, doctor_id = current_user.get("_id"), target_id
    else:
        patient_id, doctor_id = target_id, current_user.get("_id")
    _, existing = find_pair_connection(db, patient_id, doctor_id)
    if existing and normalize_status(existing.get("status")) == "blocked":
        raise HTTPException(status_code=404, detail=f"{target_role} not available")
    return _person_payload(db, user, existing)


@router.post("/request", status_code=201)
def request_connection(data: ConnectionRequestBody, current_user: dict = Depends(get_current_user)):
    db = get_db()
    _ensure_actor(current_user, db)
    actor_id = str(current_user.get("_id") or "")
    target_id = str(data.targetId or "").strip()
    if not target_id or target_id == actor_id:
        raise HTTPException(status_code=400, detail="A valid connection target is required")

    if current_user.get("role") == "Patient":
        patient_id, doctor_id = actor_id, target_id
        doctor = _load_user(db, doctor_id, "Doctor")
        _require_verified_doctor_record(db, doctor)
        target = doctor
        requested_by = "Patient"
    else:
        patient_id, doctor_id = target_id, actor_id
        target = _load_user(db, patient_id, "Patient")
        if not target:
            raise HTTPException(status_code=404, detail="Patient not found")
        requested_by = "Doctor"

    source_collection, existing = find_pair_connection(db, patient_id, doctor_id)
    now = now_utc()
    if existing:
        existing = canonicalize_legacy_connection(db, source_collection or "care_connections", existing)
        status = normalize_status(existing.get("status"))
        if status == "accepted":
            raise HTTPException(status_code=409, detail="Already connected")
        if status == "pending":
            raise HTTPException(status_code=409, detail="A care connection request is already pending")
        if status == "blocked":
            raise HTTPException(status_code=403, detail="This care connection is blocked")

        db["care_connections"].update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "status": "pending",
                    "requestedBy": requested_by,
                    "requestedByUserId": actor_id,
                    "requestedAt": now,
                    "updatedAt": now,
                    "acceptedAt": None,
                    "declinedAt": None,
                    "revokedAt": None,
                    "blockedAt": None,
                    "blockedBy": None,
                },
                "$push": {
                    "history": transition_history(
                        existing,
                        from_status=status,
                        to_status="pending",
                        actor_id=actor_id,
                        reason="new_care_request",
                    )
                },
            },
        )
        doc = db["care_connections"].find_one({"_id": existing["_id"]})
    else:
        doc = {
            "patientId": patient_id,
            "doctorId": doctor_id,
            "providerId": doctor_id,
            "status": "pending",
            "requestedBy": requested_by,
            "requestedByUserId": actor_id,
            "requestedAt": now,
            "createdAt": now,
            "updatedAt": now,
            "history": [
                {
                    "from": None,
                    "to": "pending",
                    "actorUserId": actor_id,
                    "reason": "new_care_request",
                    "at": now,
                }
            ],
        }
        try:
            result = db["care_connections"].insert_one(doc)
            doc["_id"] = result.inserted_id
        except DuplicateKeyError:
            raise HTTPException(status_code=409, detail="A care relationship already exists")

    connection_id = str(doc.get("_id") or "")
    target_name = str(target.get("name") or target.get("role") or "User")
    sender_name = str(current_user.get("name") or current_user.get("role") or "User")
    _notify(db, target_id, title="New care request", message=f"{sender_name} sent you a care connection request.", connection_id=connection_id)
    _notify(db, actor_id, title="Care request sent", message=f"Your care request to {target_name} is pending approval.", connection_id=connection_id)
    return _serialize_connection(db, doc, current_user)


@router.patch("/{connection_id}/accept")
def accept_connection(connection_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    _ensure_actor(current_user, db)
    _, doc = _load_connection_for_action(db, connection_id)
    _participant_check(doc, current_user)
    if normalize_status(doc.get("status")) != "pending":
        raise HTTPException(status_code=409, detail="Only pending requests can be accepted")
    if not _target_is_recipient(doc, current_user):
        raise HTTPException(status_code=403, detail="Only the request recipient can accept this request")
    doctor = _load_user(db, doc.get("doctorId") or doc.get("providerId"), "Doctor")
    _require_verified_doctor_record(db, doctor)
    updated = _set_status(db, doc, to_status="accepted", current_user=current_user, reason="care_request_accepted")
    _notify_both(
        db,
        updated,
        title="Care connection active",
        patient_message=f"You are now connected with {doctor.get('name') or 'your doctor'}.",
        doctor_message="The patient accepted the care connection. Authorized clinical access is now active.",
    )
    return _serialize_connection(db, updated, current_user)


@router.patch("/{connection_id}/decline")
def decline_connection(connection_id: str, data: ConnectionActionBody | None = None, current_user: dict = Depends(get_current_user)):
    db = get_db()
    _ensure_actor(current_user, db)
    _, doc = _load_connection_for_action(db, connection_id)
    _participant_check(doc, current_user)
    if normalize_status(doc.get("status")) != "pending":
        raise HTTPException(status_code=409, detail="Only pending requests can be declined")
    if not _target_is_recipient(doc, current_user):
        raise HTTPException(status_code=403, detail="Only the request recipient can decline this request")
    updated = _set_status(db, doc, to_status="declined", current_user=current_user, reason=(data.reason if data else None) or "care_request_declined")
    _notify_both(db, updated, title="Care request declined", patient_message="The care connection request was declined.", doctor_message="The care connection request was declined.")
    return _serialize_connection(db, updated, current_user)


@router.patch("/{connection_id}/reject", include_in_schema=False)
def reject_connection_compat(connection_id: str, current_user: dict = Depends(get_current_user)):
    return decline_connection(connection_id, ConnectionActionBody(reason="care_request_declined"), current_user)


@router.patch("/{connection_id}/cancel")
def cancel_connection_request(connection_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    _ensure_actor(current_user, db)
    _, doc = _load_connection_for_action(db, connection_id)
    _participant_check(doc, current_user)
    if normalize_status(doc.get("status")) != "pending":
        raise HTTPException(status_code=409, detail="Only pending requests can be cancelled")
    if not _requester_is_actor(doc, current_user):
        raise HTTPException(status_code=403, detail="Only the requester can cancel this request")
    updated = _set_status(db, doc, to_status="revoked", current_user=current_user, reason="pending_request_cancelled")
    _notify_both(db, updated, title="Care request cancelled", patient_message="The pending care request was cancelled.", doctor_message="The pending care request was cancelled.")
    return _serialize_connection(db, updated, current_user)


@router.patch("/{connection_id}/revoke")
def revoke_connection(connection_id: str, data: ConnectionActionBody | None = None, current_user: dict = Depends(get_current_user)):
    db = get_db()
    _ensure_actor(current_user, db)
    _, doc = _load_connection_for_action(db, connection_id)
    _participant_check(doc, current_user)
    if normalize_status(doc.get("status")) != "accepted":
        raise HTTPException(status_code=409, detail="Only accepted connections can be removed")
    updated = _set_status(db, doc, to_status="revoked", current_user=current_user, reason=(data.reason if data else None) or "care_connection_revoked")
    _notify_both(
        db,
        updated,
        title="Care connection removed",
        patient_message="This care connection is no longer active. Historical medical records were preserved.",
        doctor_message="This care connection is no longer active. General ongoing patient access has ended.",
    )
    return _serialize_connection(db, updated, current_user)


@router.delete("/{connection_id}", include_in_schema=False)
def remove_connection_compat(connection_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    _ensure_actor(current_user, db)
    _, doc = _load_connection_for_action(db, connection_id)
    status = normalize_status(doc.get("status"))
    if status == "pending":
        return cancel_connection_request(connection_id, current_user)
    return revoke_connection(connection_id, ConnectionActionBody(reason="care_connection_removed"), current_user)


@router.patch("/{connection_id}/block")
def block_connection(connection_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    _ensure_actor(current_user, db)
    _, doc = _load_connection_for_action(db, connection_id)
    _participant_check(doc, current_user)
    if normalize_status(doc.get("status")) == "blocked":
        raise HTTPException(status_code=409, detail="Care connection is already blocked")
    updated = _set_status(db, doc, to_status="blocked", current_user=current_user, reason="care_connection_blocked")
    _notify_both(db, updated, title="Care connection updated", patient_message="A care connection was blocked.", doctor_message="A care connection is no longer available.")
    return _serialize_connection(db, updated, current_user)


@router.patch("/{connection_id}/unblock")
def unblock_connection(connection_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    _ensure_actor(current_user, db)
    _, doc = _load_connection_for_action(db, connection_id)
    actor_id, _, _ = _participant_check(doc, current_user)
    if normalize_status(doc.get("status")) != "blocked":
        raise HTTPException(status_code=409, detail="Care connection is not blocked")
    if str(doc.get("blockedBy") or "") != actor_id:
        raise HTTPException(status_code=403, detail="Only the account that blocked this relationship can unblock it")
    updated = _set_status(db, doc, to_status="revoked", current_user=current_user, reason="care_connection_unblocked")
    return _serialize_connection(db, updated, current_user)
