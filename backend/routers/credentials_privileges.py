from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from access_control import require_hospital_doctor_affiliation, require_verified_provider
from credential_privilege_service import (
    AFFILIATION_STATUSES,
    PRIVILEGE_CATALOG,
    PRIVILEGE_CODES,
    affiliation_for,
    doctor_credential,
    doctor_privileges,
    id_variants,
    is_credential_valid,
    notify_doctor,
    record_privilege_audit,
    serialize_affiliation,
    serialize_privilege,
)
from database import get_db
from dependencies import RoleChecker, VerifiedProviderChecker, get_current_user

router = APIRouter(prefix="/api/credentials-privileges", tags=["Credentials & Privileges"])


class AffiliationCreate(BaseModel):
    doctorId: str = Field(min_length=1, max_length=128)
    department: str = Field(default="Ophthalmology", min_length=2, max_length=160)
    position: str = Field(default="Consultant", min_length=2, max_length=160)
    joinedAt: str = Field(default="", max_length=32)


class AffiliationUpdate(BaseModel):
    department: Optional[str] = Field(default=None, min_length=2, max_length=160)
    position: Optional[str] = Field(default=None, min_length=2, max_length=160)
    joinedAt: Optional[str] = Field(default=None, max_length=32)
    status: Optional[Literal["active", "inactive", "ended"]] = None


class PrivilegeItemUpdate(BaseModel):
    code: str = Field(min_length=2, max_length=80)
    enabled: bool
    expiresAt: str = Field(default="", max_length=32)


class PrivilegeUpdate(BaseModel):
    privileges: list[PrivilegeItemUpdate]


def _hospital_id(current_user: dict) -> str:
    return str(current_user.get("_id") or "")


def _doctor_or_404(db, doctor_id: str) -> dict:
    variants = id_variants(doctor_id)
    if not variants:
        raise HTTPException(status_code=400, detail="Invalid doctor ID")
    doctor = db["users"].find_one({"_id": {"$in": variants}, "role": "Doctor"}, {"password": 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return doctor


def _affiliation_or_404(db, hospital_id: str, doctor_id: str) -> dict:
    doc = affiliation_for(db, hospital_id, doctor_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Hospital-doctor affiliation not found")
    return doc


@router.get("/catalog")
def privilege_catalog(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in {"Doctor", "Hospital", "SuperAdmin"}:
        raise HTTPException(status_code=403, detail="Provider access required")
    return {"privileges": PRIVILEGE_CATALOG}


@router.get(
    "/hospital/dashboard",
    dependencies=[Depends(RoleChecker(["Hospital"])), Depends(VerifiedProviderChecker())],
)
def hospital_privilege_dashboard(current_user: dict = Depends(get_current_user)):
    db = get_db()
    hospital_id = _hospital_id(current_user)
    affiliations = list(db["hospital_doctor_affiliations"].find({"hospitalId": {"$in": id_variants(hospital_id)}}))

    active = [doc for doc in affiliations if str(doc.get("status") or "").lower() == "active"]
    expiring_licenses = 0
    expired_licenses = 0
    for doc in active:
        credential = doctor_credential(db, doc.get("doctorId"))
        if not credential:
            continue
        if credential.get("credentialState") == "expired":
            expired_licenses += 1
        elif credential.get("credentialState") == "expiring":
            expiring_licenses += 1

    privilege_docs = list(db["doctor_privileges"].find({"hospitalId": {"$in": id_variants(hospital_id)}, "status": "active"}))
    expiring_privileges = 0
    expired_privileges = 0
    for doc in privilege_docs:
        serialized = serialize_privilege(doc)
        if serialized["status"] == "expired":
            expired_privileges += 1
        elif serialized.get("daysRemaining") is not None and 0 <= serialized["daysRemaining"] <= 30:
            expiring_privileges += 1

    return {
        "affiliatedDoctors": len(affiliations),
        "activeDoctors": len(active),
        "licenseExpiring60": expiring_licenses,
        "licenseExpired": expired_licenses,
        "privilegeExpiring30": expiring_privileges,
        "privilegeExpired": expired_privileges,
    }


@router.get(
    "/hospital/doctor-directory",
    dependencies=[Depends(RoleChecker(["Hospital"])), Depends(VerifiedProviderChecker())],
)
def verified_doctor_directory(
    query: str = Query("", max_length=120),
    limit: int = Query(40, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    hospital_id = _hospital_id(current_user)
    q = query.strip().lower()
    users = list(
        db["users"].find(
            {"role": "Doctor", "verificationStatus": "verified", "accountStatus": "active"},
            {"password": 0},
        ).sort("name", 1).limit(150)
    )
    results = []
    for user in users:
        credential = doctor_credential(db, user.get("_id"))
        if not credential or not is_credential_valid(credential):
            continue
        haystack = " ".join(
            [
                str(credential.get("name") or ""),
                str(credential.get("specialization") or ""),
                str(credential.get("medicalLicenseNumber") or ""),
            ]
        ).lower()
        if q and q not in haystack:
            continue
        affiliation = affiliation_for(db, hospital_id, user.get("_id"))
        results.append(
            {
                **credential,
                "affiliationStatus": str((affiliation or {}).get("status") or "none").lower(),
            }
        )
        if len(results) >= limit:
            break
    return {"doctors": results}


@router.get(
    "/hospital/doctors",
    dependencies=[Depends(RoleChecker(["Hospital"])), Depends(VerifiedProviderChecker())],
)
def list_hospital_doctors(current_user: dict = Depends(get_current_user)):
    db = get_db()
    hospital_id = _hospital_id(current_user)
    docs = list(
        db["hospital_doctor_affiliations"].find({"hospitalId": {"$in": id_variants(hospital_id)}}).sort("updatedAt", -1)
    )
    items = []
    for doc in docs:
        serialized = serialize_affiliation(db, doc, include_credential=True)
        privileges = doctor_privileges(db, hospital_id, doc.get("doctorId"))
        serialized["activePrivilegeCount"] = sum(1 for item in privileges if item.get("status") == "active")
        serialized["privilegeCount"] = len(privileges)
        items.append(serialized)
    return {"doctors": items}


@router.post(
    "/hospital/affiliations",
    dependencies=[Depends(RoleChecker(["Hospital"])), Depends(VerifiedProviderChecker())],
    status_code=201,
)
def create_affiliation(payload: AffiliationCreate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    hospital_id = _hospital_id(current_user)
    doctor = _doctor_or_404(db, payload.doctorId)
    credential = doctor_credential(db, doctor.get("_id"))
    if not is_credential_valid(credential):
        raise HTTPException(status_code=409, detail="Only verified doctors with a current professional license can be affiliated")

    existing = affiliation_for(db, hospital_id, doctor.get("_id"))
    now = datetime.utcnow()
    values = {
        "hospitalId": hospital_id,
        "doctorId": str(doctor.get("_id")),
        "department": payload.department.strip(),
        "position": payload.position.strip(),
        "status": "active",
        "joinedAt": payload.joinedAt.strip() or now.date().isoformat(),
        "updatedAt": now,
    }
    if existing:
        db["hospital_doctor_affiliations"].update_one({"_id": existing["_id"]}, {"$set": values})
        doc = db["hospital_doctor_affiliations"].find_one({"_id": existing["_id"]})
    else:
        values["createdAt"] = now
        result = db["hospital_doctor_affiliations"].insert_one(values)
        doc = db["hospital_doctor_affiliations"].find_one({"_id": result.inserted_id})

    notify_doctor(
        db,
        doctor.get("_id"),
        "Hospital affiliation active",
        f"You are now affiliated with {serialize_affiliation(db, doc, False)['hospitalName']} as {payload.position.strip()}.",
        related_id=str(doc.get("_id")),
    )
    return serialize_affiliation(db, doc, include_credential=True)


@router.patch(
    "/hospital/affiliations/{doctor_id}",
    dependencies=[Depends(RoleChecker(["Hospital"])), Depends(VerifiedProviderChecker())],
)
def update_affiliation(
    doctor_id: str,
    payload: AffiliationUpdate,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    hospital_id = _hospital_id(current_user)
    doc = _affiliation_or_404(db, hospital_id, doctor_id)
    values = payload.model_dump(exclude_none=True)
    update: dict = {"updatedAt": datetime.utcnow()}
    for key in ("department", "position", "joinedAt", "status"):
        if key in values:
            value = values[key]
            update[key] = value.strip() if isinstance(value, str) else value
    if "status" in update and update["status"] not in AFFILIATION_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid affiliation status")
    if update.get("status") == "active":
        credential = doctor_credential(db, doctor_id)
        if not is_credential_valid(credential):
            raise HTTPException(
                status_code=409,
                detail="Doctor credentials are not currently valid; affiliation cannot be activated",
            )

    db["hospital_doctor_affiliations"].update_one({"_id": doc["_id"]}, {"$set": update})

    # Ending/inactivating an affiliation must immediately remove hospital-specific authority.
    if update.get("status") in {"inactive", "ended"}:
        now = datetime.utcnow()
        active_privileges = list(
            db["doctor_privileges"].find(
                {
                    "hospitalId": {"$in": id_variants(hospital_id)},
                    "doctorId": {"$in": id_variants(doctor_id)},
                    "status": "active",
                }
            )
        )
        for privilege in active_privileges:
            previous = serialize_privilege(privilege)
            db["doctor_privileges"].update_one(
                {"_id": privilege["_id"]},
                {"$set": {"status": "revoked", "revokedBy": hospital_id, "revokedAt": now, "updatedAt": now}},
            )
            current = serialize_privilege(db["doctor_privileges"].find_one({"_id": privilege["_id"]}))
            record_privilege_audit(
                db,
                hospital_id=hospital_id,
                doctor_id=doctor_id,
                privilege=privilege.get("privilege") or "",
                action="auto_revoke_affiliation_closed",
                actor_id=hospital_id,
                previous=previous,
                current=current,
            )

    updated = db["hospital_doctor_affiliations"].find_one({"_id": doc["_id"]})
    notify_doctor(
        db,
        doctor_id,
        "Hospital affiliation updated",
        f"Your affiliation with {serialize_affiliation(db, updated, False)['hospitalName']} is now {updated.get('status', 'updated')}.",
        related_id=str(updated.get("_id")),
    )
    return serialize_affiliation(db, updated, include_credential=True)


@router.get(
    "/hospital/doctors/{doctor_id}",
    dependencies=[Depends(RoleChecker(["Hospital"])), Depends(VerifiedProviderChecker())],
)
def hospital_doctor_detail(doctor_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    hospital_id = _hospital_id(current_user)
    doc = _affiliation_or_404(db, hospital_id, doctor_id)
    return {
        "affiliation": serialize_affiliation(db, doc, include_credential=True),
        "privileges": doctor_privileges(db, hospital_id, doctor_id),
    }


@router.put(
    "/hospital/doctors/{doctor_id}/privileges",
    dependencies=[Depends(RoleChecker(["Hospital"])), Depends(VerifiedProviderChecker())],
)
def update_doctor_privileges(
    doctor_id: str,
    payload: PrivilegeUpdate,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    hospital_id = _hospital_id(current_user)
    affiliation = require_hospital_doctor_affiliation(hospital_id, doctor_id, db)
    credential = doctor_credential(db, doctor_id)
    if not is_credential_valid(credential):
        raise HTTPException(status_code=409, detail="Doctor credentials are not currently valid; hospital privileges cannot be granted")

    now = datetime.utcnow()
    changed: list[str] = []
    for item in payload.privileges:
        code = item.code.strip().lower()
        if code not in PRIVILEGE_CODES:
            raise HTTPException(status_code=400, detail=f"Unknown privilege: {item.code}")
        expires_at = item.expiresAt.strip()
        if expires_at:
            try:
                parsed_expiry = datetime.strptime(expires_at, "%Y-%m-%d")
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Privilege expiry for {code} must use YYYY-MM-DD")
            if parsed_expiry.date() < datetime.utcnow().date():
                raise HTTPException(status_code=400, detail=f"Privilege expiry for {code} cannot be in the past")
        existing = db["doctor_privileges"].find_one(
            {
                "hospitalId": {"$in": id_variants(hospital_id)},
                "doctorId": {"$in": id_variants(doctor_id)},
                "privilege": code,
            }
        )
        previous = serialize_privilege(existing) if existing else None
        if item.enabled:
            update = {
                "hospitalId": hospital_id,
                "doctorId": str(doctor_id),
                "privilege": code,
                "status": "active",
                "expiresAt": expires_at,
                "grantedBy": hospital_id,
                "grantedAt": (existing or {}).get("grantedAt") or now,
                "revokedBy": None,
                "revokedAt": None,
                "updatedAt": now,
            }
            if existing:
                db["doctor_privileges"].update_one({"_id": existing["_id"]}, {"$set": update})
                doc = db["doctor_privileges"].find_one({"_id": existing["_id"]})
            else:
                update["createdAt"] = now
                result = db["doctor_privileges"].insert_one(update)
                doc = db["doctor_privileges"].find_one({"_id": result.inserted_id})
            action = "grant" if not previous or previous.get("storedStatus") != "active" else "update"
        else:
            if not existing:
                continue
            db["doctor_privileges"].update_one(
                {"_id": existing["_id"]},
                {"$set": {"status": "revoked", "revokedBy": hospital_id, "revokedAt": now, "updatedAt": now}},
            )
            doc = db["doctor_privileges"].find_one({"_id": existing["_id"]})
            action = "revoke"
        current = serialize_privilege(doc)
        if previous != current:
            record_privilege_audit(
                db,
                hospital_id=hospital_id,
                doctor_id=doctor_id,
                privilege=code,
                action=action,
                actor_id=hospital_id,
                previous=previous,
                current=current,
            )
            changed.append(code)

    if changed:
        notify_doctor(
            db,
            doctor_id,
            "Hospital privileges updated",
            f"{serialize_affiliation(db, affiliation, False)['hospitalName']} updated your clinical privileges.",
            related_id=str(affiliation.get("_id")),
        )
    return {
        "affiliation": serialize_affiliation(db, affiliation, include_credential=True),
        "privileges": doctor_privileges(db, hospital_id, doctor_id),
    }


@router.get(
    "/doctor/affiliations",
    dependencies=[Depends(RoleChecker(["Doctor"])), Depends(VerifiedProviderChecker())],
)
def doctor_affiliations(current_user: dict = Depends(get_current_user)):
    db = get_db()
    require_verified_provider(current_user, db)
    doctor_id = str(current_user.get("_id") or "")
    docs = list(db["hospital_doctor_affiliations"].find({"doctorId": {"$in": id_variants(doctor_id)}}).sort("updatedAt", -1))
    results = []
    for doc in docs:
        item = serialize_affiliation(db, doc, include_credential=False)
        item["credential"] = doctor_credential(db, doctor_id)
        item["privileges"] = doctor_privileges(db, doc.get("hospitalId"), doctor_id)
        results.append(item)
    return {"affiliations": results}


@router.get(
    "/doctor/affiliations/{hospital_id}",
    dependencies=[Depends(RoleChecker(["Doctor"])), Depends(VerifiedProviderChecker())],
)
def doctor_affiliation_detail(hospital_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    doctor_id = str(current_user.get("_id") or "")
    doc = _affiliation_or_404(db, hospital_id, doctor_id)
    return {
        "affiliation": serialize_affiliation(db, doc, include_credential=False),
        "credential": doctor_credential(db, doctor_id),
        "privileges": doctor_privileges(db, hospital_id, doctor_id),
    }
