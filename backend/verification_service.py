"""Provider-verification helpers for EyeCare AI Phase 10C.

This module owns verification state, provider requirements, notifications and
immutable admin decision audit events.  It intentionally keeps provider
verification separate from future hospital privileges (Phase 10N).
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from bson import ObjectId

logger = logging.getLogger(__name__)

PROVIDER_ROLES = {"Doctor", "Hospital"}
VERIFICATION_STATUSES = {"pending", "under_review", "needs_changes", "verified", "rejected"}
ACCOUNT_STATUSES = {"active", "suspended", "disabled"}

DOCTOR_REQUIRED_FIELDS = (
    "fullName",
    "medicalLicenseNumber",
    "licensingAuthority",
    "specialization",
    "qualification",
    "yearsOfExperience",
    "licenseIssueDate",
    "licenseExpiryDate",
    "phone",
    "address",
)
DOCTOR_REQUIRED_DOCUMENTS = ("medical_license", "identity_proof", "qualification")

HOSPITAL_REQUIRED_FIELDS = (
    "hospitalName",
    "registrationNumber",
    "facilityType",
    "address",
    "city",
    "officialEmail",
    "phone",
    "responsibleContactPerson",
    "registrationAuthority",
)
HOSPITAL_REQUIRED_DOCUMENTS = ("hospital_registration", "facility_license")

ALLOWED_DOCUMENT_TYPES = {
    "Doctor": {
        "medical_license",
        "identity_proof",
        "qualification",
        "supporting_document",
    },
    "Hospital": {
        "hospital_registration",
        "facility_license",
        "supporting_document",
    },
}


def now_utc() -> datetime:
    return datetime.utcnow()


def id_variants(value: Any) -> list[Any]:
    text = str(value or "").strip()
    if not text:
        return []
    result: list[Any] = [text]
    if ObjectId.is_valid(text):
        result.append(ObjectId(text))
    return result


def normalize_status(value: Any, default: str = "pending") -> str:
    status = str(value or default).strip().lower()
    return status if status in VERIFICATION_STATUSES else default


def normalize_account_status(value: Any, default: str = "active") -> str:
    status = str(value or default).strip().lower()
    return status if status in ACCOUNT_STATUSES else default


def ensure_provider_verification(db, user: dict[str, Any]) -> dict[str, Any]:
    role = str(user.get("role") or "")
    if role not in PROVIDER_ROLES:
        raise ValueError("Provider verification is available only to Doctor or Hospital accounts")

    user_id = str(user.get("_id") or user.get("userId") or "").strip()
    if not user_id:
        raise ValueError("Provider user ID is missing")

    existing = db["provider_verifications"].find_one(
        {"userId": {"$in": id_variants(user_id)}},
        sort=[("updatedAt", -1), ("createdAt", -1)],
    )
    if existing:
        return existing

    now = now_utc()
    status = normalize_status(user.get("verificationStatus"), "pending")
    account_status = normalize_account_status(user.get("accountStatus"), "active")
    doc = {
        "userId": user_id,
        "role": role,
        "status": status,
        "accountStatus": account_status,
        "details": {},
        "documents": [],
        "submittedAt": None,
        "reviewedBy": None,
        "reviewedAt": None,
        "decisionReason": "",
        "createdAt": now,
        "updatedAt": now,
    }
    inserted = db["provider_verifications"].insert_one(doc)
    doc["_id"] = inserted.inserted_id
    return doc


def provider_requirements(role: str) -> dict[str, list[str]]:
    if role == "Doctor":
        return {
            "requiredFields": list(DOCTOR_REQUIRED_FIELDS),
            "requiredDocuments": list(DOCTOR_REQUIRED_DOCUMENTS),
        }
    if role == "Hospital":
        return {
            "requiredFields": list(HOSPITAL_REQUIRED_FIELDS),
            "requiredDocuments": list(HOSPITAL_REQUIRED_DOCUMENTS),
        }
    return {"requiredFields": [], "requiredDocuments": []}


def missing_requirements(verification: dict[str, Any]) -> dict[str, list[str]]:
    role = str(verification.get("role") or "")
    requirements = provider_requirements(role)
    details = verification.get("details") or {}
    documents = verification.get("documents") or []
    document_types = {
        str(item.get("type") or "")
        for item in documents
        if item.get("fileId") and not item.get("removedAt")
    }

    missing_fields = [
        field
        for field in requirements["requiredFields"]
        if str(details.get(field) or "").strip() == ""
    ]
    missing_documents = [
        doc_type
        for doc_type in requirements["requiredDocuments"]
        if doc_type not in document_types
    ]
    return {"fields": missing_fields, "documents": missing_documents}


def serialize_datetime(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def serialize_verification(doc: dict[str, Any], user: dict[str, Any] | None = None) -> dict[str, Any]:
    role = str(doc.get("role") or (user or {}).get("role") or "")
    missing = missing_requirements(doc)
    documents = []
    for item in doc.get("documents") or []:
        if item.get("removedAt"):
            continue
        documents.append(
            {
                "type": item.get("type", "supporting_document"),
                "fileId": str(item.get("fileId") or ""),
                "filename": item.get("filename", "document"),
                "contentType": item.get("contentType", "application/octet-stream"),
                "uploadedAt": serialize_datetime(item.get("uploadedAt")),
            }
        )

    payload = {
        "id": str(doc.get("_id") or ""),
        "userId": str(doc.get("userId") or ""),
        "role": role,
        "status": normalize_status(doc.get("status")),
        "accountStatus": normalize_account_status(doc.get("accountStatus")),
        "details": doc.get("details") or {},
        "documents": documents,
        "submittedAt": serialize_datetime(doc.get("submittedAt")),
        "reviewedBy": str(doc.get("reviewedBy") or "") or None,
        "reviewedAt": serialize_datetime(doc.get("reviewedAt")),
        "decisionReason": doc.get("decisionReason") or "",
        "createdAt": serialize_datetime(doc.get("createdAt")),
        "updatedAt": serialize_datetime(doc.get("updatedAt")),
        "missingFields": missing["fields"],
        "missingDocuments": missing["documents"],
        "readyToSubmit": not missing["fields"] and not missing["documents"],
    }
    if user:
        payload["provider"] = {
            "id": str(user.get("_id") or ""),
            "name": user.get("name") or "",
            "email": user.get("email") or "",
            "username": user.get("username") or "",
            "mobile": user.get("mobile") or "",
            "role": user.get("role") or role,
        }
    return payload


def create_notification(
    db,
    *,
    user_id: Any,
    title: str,
    message: str,
    notification_type: str = "verification",
    related_id: str | None = None,
) -> None:
    if not user_id:
        return
    db["notifications"].insert_one(
        {
            "userId": str(user_id),
            "title": title,
            "message": message,
            "type": notification_type,
            "read": False,
            "relatedId": related_id,
            "createdAt": now_utc(),
        }
    )


def notify_superadmins(db, *, title: str, message: str, related_id: str | None = None) -> int:
    admins = list(db["users"].find({"role": "SuperAdmin", "accountStatus": {"$ne": "disabled"}}, {"_id": 1}))
    for admin in admins:
        create_notification(
            db,
            user_id=str(admin["_id"]),
            title=title,
            message=message,
            notification_type="verification",
            related_id=related_id,
        )
    return len(admins)


def record_verification_audit(
    db,
    *,
    verification: dict[str, Any],
    action: str,
    reviewer_id: Any,
    reason: str,
    previous_status: str | None,
    new_status: str | None,
    previous_account_status: str | None,
    new_account_status: str | None,
) -> str:
    event = {
        "verificationId": str(verification.get("_id") or ""),
        "userId": str(verification.get("userId") or ""),
        "role": verification.get("role") or "",
        "decision": action,
        "reviewerId": str(reviewer_id or ""),
        "reason": str(reason or "").strip(),
        "previousStatus": previous_status,
        "newStatus": new_status,
        "previousAccountStatus": previous_account_status,
        "newAccountStatus": new_account_status,
        "timestamp": now_utc(),
    }
    result = db["provider_verification_audit"].insert_one(event)
    return str(result.inserted_id)
