"""Phase 10N credential, affiliation and hospital-privilege helpers.

Global doctor credentials remain owned by the existing SuperAdmin provider-
verification record. Hospital-specific affiliations and privileges are stored
separately so identity verification is never duplicated or rewritten by a
hospital account.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

from bson import ObjectId

from verification_service import create_notification

PRIVILEGE_CATALOG = [
    {
        "code": "general_eye_consultation",
        "label": "General Eye Consultation",
        "description": "Conduct and document routine ophthalmic consultations within this hospital.",
        "procedure": False,
    },
    {
        "code": "retinal_examination",
        "label": "Retinal Examination",
        "description": "Perform and document retinal examination findings.",
        "procedure": True,
    },
    {
        "code": "fundus_image_review",
        "label": "Fundus Image Review",
        "description": "Review fundus images produced within the hospital workflow.",
        "procedure": True,
    },
    {
        "code": "oct_review",
        "label": "OCT Review",
        "description": "Review and document optical coherence tomography findings.",
        "procedure": True,
    },
    {
        "code": "laser_procedure",
        "label": "Laser Procedure",
        "description": "Hospital authorization for a retinal/ophthalmic laser procedure entry.",
        "procedure": True,
        "highRisk": True,
    },
    {
        "code": "surgical_procedure",
        "label": "Surgical Procedure",
        "description": "Hospital authorization for an ophthalmic surgical procedure entry.",
        "procedure": True,
        "highRisk": True,
    },
]
PRIVILEGE_CODES = {item["code"] for item in PRIVILEGE_CATALOG}
AFFILIATION_STATUSES = {"active", "inactive", "ended"}
PRIVILEGE_STATUSES = {"active", "revoked"}


def now_utc() -> datetime:
    return datetime.utcnow()


def id_variants(value: Any) -> list[Any]:
    text = str(value or "").strip()
    values: list[Any] = []
    if text:
        values.append(text)
        if ObjectId.is_valid(text):
            values.append(ObjectId(text))
    return values


def _date_only(value: Any) -> Optional[date]:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except Exception:
        try:
            return date.fromisoformat(text[:10])
        except Exception:
            return None


def days_until(value: Any) -> Optional[int]:
    parsed = _date_only(value)
    if parsed is None:
        return None
    return (parsed - date.today()).days


def doctor_user(db, doctor_id: Any) -> Optional[dict[str, Any]]:
    variants = id_variants(doctor_id)
    if not variants:
        return None
    return db["users"].find_one(
        {"_id": {"$in": variants}, "role": "Doctor"},
        {"password": 0},
    )


def provider_verification(db, doctor_id: Any) -> Optional[dict[str, Any]]:
    variants = id_variants(doctor_id)
    if not variants:
        return None
    return db["provider_verifications"].find_one(
        {"userId": {"$in": variants}, "role": "Doctor"},
        sort=[("updatedAt", -1), ("submittedAt", -1), ("createdAt", -1)],
    )


def doctor_credential(db, doctor_id: Any) -> Optional[dict[str, Any]]:
    user = doctor_user(db, doctor_id)
    if not user:
        return None
    verification = provider_verification(db, doctor_id) or {}
    details = verification.get("details") or {}
    verification_status = str(
        verification.get("status") or user.get("verificationStatus") or "pending"
    ).lower()
    account_status = str(
        verification.get("accountStatus") or user.get("accountStatus") or "active"
    ).lower()
    expiry = details.get("licenseExpiryDate") or ""
    expiry_days = days_until(expiry)
    if verification_status != "verified":
        credential_state = "unverified"
    elif account_status != "active":
        credential_state = "inactive_account"
    elif expiry_days is not None and expiry_days < 0:
        credential_state = "expired"
    elif expiry_days is not None and expiry_days <= 60:
        credential_state = "expiring"
    else:
        credential_state = "valid"

    return {
        "doctorId": str(user.get("_id") or ""),
        "name": user.get("name") or details.get("fullName") or "Doctor",
        "email": user.get("email") or "",
        "username": user.get("username") or "",
        "verificationStatus": verification_status,
        "accountStatus": account_status,
        "credentialState": credential_state,
        "medicalLicenseNumber": details.get("medicalLicenseNumber") or "",
        "licensingAuthority": details.get("licensingAuthority") or "",
        "specialization": details.get("specialization") or "",
        "qualification": details.get("qualification") or "",
        "licenseIssueDate": details.get("licenseIssueDate") or "",
        "licenseExpiryDate": expiry,
        "licenseDaysRemaining": expiry_days,
        "currentHospitalClinic": details.get("currentHospitalClinic") or "",
        "verifiedAt": (
            verification.get("reviewedAt").isoformat()
            if isinstance(verification.get("reviewedAt"), datetime)
            else verification.get("reviewedAt")
        ),
    }


def is_credential_valid(credential: Optional[dict[str, Any]]) -> bool:
    return bool(
        credential
        and credential.get("verificationStatus") == "verified"
        and credential.get("accountStatus") == "active"
        and credential.get("credentialState") in {"valid", "expiring"}
    )


def hospital_name(db, hospital_id: Any) -> str:
    variants = id_variants(hospital_id)
    if not variants:
        return "Hospital"
    user = db["users"].find_one({"_id": {"$in": variants}}, {"name": 1}) or {}
    profile = db["hospital_profiles"].find_one({"userId": {"$in": variants}}, {"hospitalName": 1}) or {}
    verification = db["provider_verifications"].find_one({"userId": {"$in": variants}}, {"details": 1}) or {}
    details = verification.get("details") or {}
    return profile.get("hospitalName") or details.get("hospitalName") or user.get("name") or "Hospital"


def affiliation_for(db, hospital_id: Any, doctor_id: Any) -> Optional[dict[str, Any]]:
    return db["hospital_doctor_affiliations"].find_one(
        {
            "hospitalId": {"$in": id_variants(hospital_id)},
            "doctorId": {"$in": id_variants(doctor_id)},
        }
    )


def serialize_affiliation(db, doc: dict[str, Any], include_credential: bool = True) -> dict[str, Any]:
    payload = {
        "id": str(doc.get("_id") or ""),
        "hospitalId": str(doc.get("hospitalId") or ""),
        "hospitalName": hospital_name(db, doc.get("hospitalId")),
        "doctorId": str(doc.get("doctorId") or ""),
        "department": doc.get("department") or "Ophthalmology",
        "position": doc.get("position") or "",
        "status": str(doc.get("status") or "inactive").lower(),
        "joinedAt": doc.get("joinedAt") or "",
        "createdAt": doc.get("createdAt").isoformat() if isinstance(doc.get("createdAt"), datetime) else doc.get("createdAt"),
        "updatedAt": doc.get("updatedAt").isoformat() if isinstance(doc.get("updatedAt"), datetime) else doc.get("updatedAt"),
    }
    if include_credential:
        payload["credential"] = doctor_credential(db, doc.get("doctorId"))
    return payload


def serialize_privilege(doc: dict[str, Any]) -> dict[str, Any]:
    expires_at = doc.get("expiresAt") or ""
    remaining = days_until(expires_at)
    stored_status = str(doc.get("status") or "revoked").lower()
    effective = "expired" if stored_status == "active" and remaining is not None and remaining < 0 else stored_status
    return {
        "id": str(doc.get("_id") or ""),
        "hospitalId": str(doc.get("hospitalId") or ""),
        "doctorId": str(doc.get("doctorId") or ""),
        "privilege": doc.get("privilege") or "",
        "status": effective,
        "storedStatus": stored_status,
        "grantedBy": str(doc.get("grantedBy") or "") or None,
        "grantedAt": doc.get("grantedAt").isoformat() if isinstance(doc.get("grantedAt"), datetime) else doc.get("grantedAt"),
        "expiresAt": expires_at,
        "daysRemaining": remaining,
        "revokedBy": str(doc.get("revokedBy") or "") or None,
        "revokedAt": doc.get("revokedAt").isoformat() if isinstance(doc.get("revokedAt"), datetime) else doc.get("revokedAt"),
        "updatedAt": doc.get("updatedAt").isoformat() if isinstance(doc.get("updatedAt"), datetime) else doc.get("updatedAt"),
    }


def doctor_privileges(db, hospital_id: Any, doctor_id: Any) -> list[dict[str, Any]]:
    docs = list(
        db["doctor_privileges"].find(
            {
                "hospitalId": {"$in": id_variants(hospital_id)},
                "doctorId": {"$in": id_variants(doctor_id)},
            }
        ).sort("privilege", 1)
    )
    by_code = {str(doc.get("privilege") or ""): serialize_privilege(doc) for doc in docs}
    result = []
    for definition in PRIVILEGE_CATALOG:
        state = by_code.get(definition["code"])
        result.append(
            {
                **definition,
                **(
                    state
                    if state
                    else {
                        "id": "",
                        "hospitalId": str(hospital_id or ""),
                        "doctorId": str(doctor_id or ""),
                        "privilege": definition["code"],
                        "status": "not_granted",
                        "storedStatus": "not_granted",
                        "grantedBy": None,
                        "grantedAt": None,
                        "expiresAt": "",
                        "daysRemaining": None,
                        "revokedBy": None,
                        "revokedAt": None,
                        "updatedAt": None,
                    }
                ),
            }
        )
    return result


def record_privilege_audit(
    db,
    *,
    hospital_id: Any,
    doctor_id: Any,
    privilege: str,
    action: str,
    actor_id: Any,
    previous: Optional[dict[str, Any]],
    current: Optional[dict[str, Any]],
) -> None:
    db["doctor_privilege_audit"].insert_one(
        {
            "hospitalId": str(hospital_id or ""),
            "doctorId": str(doctor_id or ""),
            "privilege": privilege,
            "action": action,
            "actorUserId": str(actor_id or ""),
            "previous": previous or {},
            "current": current or {},
            "createdAt": now_utc(),
        }
    )


def notify_doctor(db, doctor_id: Any, title: str, message: str, related_id: Optional[str] = None) -> None:
    create_notification(
        db,
        user_id=str(doctor_id or ""),
        title=title,
        message=message,
        notification_type="privilege",
        related_id=related_id,
    )
