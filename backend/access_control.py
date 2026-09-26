"""Central clinical authorization layer for EyeCare AI Phase 10A.

All provider-to-patient clinical access should pass through this module instead
of relying on role checks in individual routes.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Iterable, Optional

from bson import ObjectId
from fastapi import HTTPException

import config
from access_log_service import record_clinical_access as _record_clinical_access
from database import get_db

logger = logging.getLogger(__name__)

PROVIDER_ROLES = {"Doctor", "Hospital"}
ACCEPTED_CONNECTION_STATUSES = {"accepted", "active"}
ACTIVE_AFFILIATION_STATUSES = {"accepted", "active", "verified"}


def _resolve_db(db=None):
    """Return the supplied PyMongo Database or open the configured database.

    PyMongo Database objects intentionally do not implement truth-value testing,
    so expressions such as ``db or get_db()`` raise ``NotImplementedError``.
    Always compare with ``None`` explicitly.
    """
    return get_db() if db is None else db

# These are internal backend permissions. They are intentionally not exposed as
# patient-facing labels.
KNOWN_SCOPES = {
    "profile.basic.read",
    "profile.clinical.read",
    "screening.read",
    "screening.image.read",
    "reports.read",
    "reports.download",
    "reports.write",
    "medications.read",
    "medications.write",
    "consultation.read",
    "consultation.write",
    "prescription.write",
    "health_metrics.read",
    "appointments.read",
    "ai.patient_context.read",
}

ROLE_SCOPE_MATRIX = {
    "Doctor": {
        "profile.basic.read",
        "profile.clinical.read",
        "screening.read",
        "screening.image.read",
        "reports.read",
        "reports.download",
        "medications.read",
        "medications.write",
        "consultation.read",
        "consultation.write",
        "prescription.write",
        "health_metrics.read",
        "appointments.read",
        "ai.patient_context.read",
    },
    "Hospital": {
        "profile.basic.read",
        "profile.clinical.read",
        "screening.read",
        "screening.image.read",
        "reports.read",
        "reports.download",
        "reports.write",
        "health_metrics.read",
        "appointments.read",
        "ai.patient_context.read",
    },
}


@dataclass(frozen=True)
class PatientAccessDecision:
    allowed: bool
    patient_id: str
    actor_id: str
    actor_role: str
    scope: str
    access_channel: str
    reason: str


def _id_variants(value: Any) -> list[Any]:
    text = str(value or "").strip()
    values: list[Any] = []
    if text:
        values.append(text)
        if ObjectId.is_valid(text):
            values.append(ObjectId(text))
    return values


def _status(value: Any) -> str:
    return str(value or "").strip().lower()


def _is_expired(value: Any) -> bool:
    if value in (None, ""):
        return False
    now = datetime.utcnow()
    if isinstance(value, datetime):
        return value < now
    text = str(value).strip()
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        # Existing project data is mostly naive UTC. Normalize timezone-aware
        # input to a comparable naive UTC timestamp.
        if parsed.tzinfo is not None:
            parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
        return parsed < now
    except Exception:
        # An unreadable expiry should not silently revoke access. Future phases
        # can normalize dates when they own the corresponding schema.
        return False


def _provider_verification_doc(db, user_id: Any) -> Optional[dict[str, Any]]:
    variants = _id_variants(user_id)
    if not variants:
        return None
    return db["provider_verifications"].find_one(
        {"userId": {"$in": variants}},
        sort=[("updatedAt", -1), ("submittedAt", -1), ("createdAt", -1)],
    )


def provider_verification_status(current_user: dict[str, Any], db=None) -> str:
    """Return the best available verification state for a Doctor/Hospital."""
    db = _resolve_db(db)
    direct = current_user.get("verificationStatus") or current_user.get("verification_status")
    if direct:
        return _status(direct)
    doc = _provider_verification_doc(db, current_user.get("_id"))
    if doc and doc.get("status"):
        return _status(doc.get("status"))
    return "pending"


def require_verified_provider(current_user: dict[str, Any], db=None) -> dict[str, Any]:
    """Require an active provider account and, when enabled, verification.

    Phase 10C owns provider verification records. Verification enforcement is
    enabled by default. Providers must be both verified and active for protected
    clinical APIs. Explicitly suspended/disabled/rejected accounts are denied.
    ``ENFORCE_PROVIDER_VERIFICATION=false`` is retained only as an emergency
    rollback switch and should not be used in normal operation.
    """
    db = _resolve_db(db)
    role = str(current_user.get("role") or "")
    if role not in PROVIDER_ROLES:
        raise HTTPException(status_code=403, detail="Verified provider access required")

    verification = _provider_verification_doc(db, current_user.get("_id")) or {}
    account_status = _status(
        current_user.get("accountStatus")
        or current_user.get("account_status")
        or verification.get("accountStatus")
        or "active"
    )
    if account_status in {"suspended", "disabled", "blocked"}:
        raise HTTPException(status_code=403, detail="Provider account is not active")

    verification_status = provider_verification_status(current_user, db)
    if verification_status == "rejected":
        raise HTTPException(status_code=403, detail="Provider verification is not approved")

    if config.ENFORCE_PROVIDER_VERIFICATION and verification_status != "verified":
        raise HTTPException(status_code=403, detail="Provider verification required")

    return current_user


def _connection_query(provider_id: Any, patient_id: Any, role: str) -> dict[str, Any]:
    provider_values = _id_variants(provider_id)
    patient_values = _id_variants(patient_id)
    provider_clauses: list[dict[str, Any]] = [
        {"providerId": {"$in": provider_values}},
    ]
    if role == "Doctor":
        provider_clauses.append({"doctorId": {"$in": provider_values}})
    if role == "Hospital":
        provider_clauses.append({"hospitalId": {"$in": provider_values}})

    return {
        "patientId": {"$in": patient_values},
        "$or": provider_clauses,
        "status": {"$in": ["accepted", "Accepted", "active", "Active"]},
    }


def _find_accepted_connection(db, current_user: dict[str, Any], patient_id: Any) -> Optional[dict[str, Any]]:
    role = str(current_user.get("role") or "")
    query = _connection_query(current_user.get("_id"), patient_id, role)

    # care_connections is the Phase 10 canonical collection. ``connections`` is
    # also checked so the access layer remains compatible with any earlier or
    # transitional implementation of the existing ConnectionScreen backend.
    for collection_name in ("care_connections", "connections"):
        doc = db[collection_name].find_one(query)
        if doc:
            return doc
    return None


def has_patient_connection(current_user: dict[str, Any], patient_id: Any, db=None) -> bool:
    db = _resolve_db(db)
    role = str(current_user.get("role") or "")
    if role == "Patient":
        return str(current_user.get("_id")) == str(patient_id)
    if role not in PROVIDER_ROLES:
        return False
    return _find_accepted_connection(db, current_user, patient_id) is not None


def _has_legacy_relationship(db, current_user: dict[str, Any], patient_id: Any) -> bool:
    """Temporary migration bridge, disabled by default.

    When explicitly enabled, existing appointments/prescriptions/reports can be
    treated as evidence of a historical clinical relationship until Phase 10D
    creates formal accepted care connections. It is intentionally OFF by default.
    """
    if not config.ALLOW_LEGACY_CLINICAL_RELATIONSHIPS:
        return False

    actor_values = _id_variants(current_user.get("_id"))
    patient_values = _id_variants(patient_id)
    role = str(current_user.get("role") or "")

    if role == "Doctor":
        if db["appointments"].find_one(
            {
                "doctorId": {"$in": actor_values},
                "patientId": {"$in": patient_values},
                "status": {"$nin": ["Cancelled", "Rejected", "cancelled", "rejected"]},
            },
            {"_id": 1},
        ):
            return True
        if db["prescriptions"].find_one(
            {"doctorId": {"$in": actor_values}, "patientId": {"$in": patient_values}},
            {"_id": 1},
        ):
            return True

    if role == "Hospital":
        if db["reports"].find_one(
            {
                "patientId": {"$in": patient_values},
                "$or": [
                    {"hospitalId": {"$in": actor_values}},
                    {"uploadedByUserId": {"$in": actor_values}},
                ],
            },
            {"_id": 1},
        ):
            return True

    return False


def require_patient_access(
    current_user: dict[str, Any],
    patient_id: Any,
    scope: str,
    db=None,
) -> PatientAccessDecision:
    """Authorize a user for one patient-scoped clinical permission."""
    db = _resolve_db(db)
    actor_id = str(current_user.get("_id") or "")
    patient_text = str(patient_id or "")
    role = str(current_user.get("role") or "Patient")

    if not patient_text:
        raise HTTPException(status_code=400, detail="Patient ID is required")

    if scope not in KNOWN_SCOPES:
        logger.error("[ACCESS CONTROL] Unknown permission scope requested: %s", scope)
        raise HTTPException(status_code=500, detail="Clinical permission is not configured")

    if role == "Patient":
        if actor_id != patient_text:
            raise HTTPException(status_code=403, detail="Access denied")
        return PatientAccessDecision(
            True, patient_text, actor_id, role, scope, "self", "patient_self_access"
        )

    require_verified_provider(current_user, db)

    if scope not in ROLE_SCOPE_MATRIX.get(role, set()):
        raise HTTPException(status_code=403, detail="This provider role is not permitted for this action")

    if not config.REQUIRE_PATIENT_CONNECTION:
        return PatientAccessDecision(
            True,
            patient_text,
            actor_id,
            role,
            scope,
            "connection_check_disabled",
            "temporary_configuration_override",
        )

    connection = _find_accepted_connection(db, current_user, patient_text)
    if connection:
        channel = str(connection.get("accessChannel") or "care_connection")
        return PatientAccessDecision(
            True,
            patient_text,
            actor_id,
            role,
            scope,
            channel,
            "accepted_care_connection",
        )

    if _has_legacy_relationship(db, current_user, patient_text):
        return PatientAccessDecision(
            True,
            patient_text,
            actor_id,
            role,
            scope,
            "legacy_clinical_relationship",
            "temporary_phase10_migration_bridge",
        )

    raise HTTPException(status_code=403, detail="Accepted patient care connection required")


def list_authorized_patient_ids(current_user: dict[str, Any], db=None) -> set[str]:
    """Return patient IDs the current account may use for clinical context."""
    db = _resolve_db(db)
    role = str(current_user.get("role") or "Patient")
    actor_id = str(current_user.get("_id") or "")

    if role == "Patient":
        return {actor_id}

    require_verified_provider(current_user, db)
    provider_values = _id_variants(actor_id)
    ids: set[str] = set()

    provider_clauses = [{"providerId": {"$in": provider_values}}]
    if role == "Doctor":
        provider_clauses.append({"doctorId": {"$in": provider_values}})
    elif role == "Hospital":
        provider_clauses.append({"hospitalId": {"$in": provider_values}})

    for collection_name in ("care_connections", "connections"):
        query = {
            "$or": provider_clauses,
            "status": {"$in": ["accepted", "Accepted", "active", "Active"]},
        }
        for doc in db[collection_name].find(query, {"patientId": 1}):
            if doc.get("patientId"):
                ids.add(str(doc["patientId"]))

    if config.ALLOW_LEGACY_CLINICAL_RELATIONSHIPS:
        if role == "Doctor":
            for collection_name, query in (
                ("appointments", {"doctorId": {"$in": provider_values}}),
                ("prescriptions", {"doctorId": {"$in": provider_values}}),
            ):
                for doc in db[collection_name].find(query, {"patientId": 1}):
                    if doc.get("patientId"):
                        ids.add(str(doc["patientId"]))
        elif role == "Hospital":
            for doc in db["reports"].find(
                {
                    "$or": [
                        {"hospitalId": {"$in": provider_values}},
                        {"uploadedByUserId": {"$in": provider_values}},
                    ]
                },
                {"patientId": 1},
            ):
                if doc.get("patientId"):
                    ids.add(str(doc["patientId"]))

    return ids


def require_hospital_doctor_affiliation(hospital_id: Any, doctor_id: Any, db=None) -> dict[str, Any]:
    """Foundation check used by the future credentials/privileges phase."""
    db = _resolve_db(db)
    doc = db["hospital_doctor_affiliations"].find_one(
        {
            "hospitalId": {"$in": _id_variants(hospital_id)},
            "doctorId": {"$in": _id_variants(doctor_id)},
            "status": {"$in": ["accepted", "Accepted", "active", "Active", "verified", "Verified"]},
        }
    )
    if not doc or _is_expired(doc.get("expiresAt") or doc.get("endDate")):
        raise HTTPException(status_code=403, detail="Active hospital-doctor affiliation required")
    return doc


def require_doctor_privilege(
    doctor_id: Any,
    hospital_id: Any,
    privilege: str,
    db=None,
) -> dict[str, Any]:
    """Require valid global credentials + affiliation + one hospital privilege.

    Phase 10N deliberately keeps the trust layers separate:
    SuperAdmin verifies the doctor globally, the hospital maintains the
    affiliation, and the hospital grants institution-specific privileges.
    """
    db = _resolve_db(db)

    # A privilege is meaningless without an active hospital affiliation.
    require_hospital_doctor_affiliation(hospital_id, doctor_id, db)

    doctor = db["users"].find_one(
        {"_id": {"$in": _id_variants(doctor_id)}, "role": "Doctor"},
        {"verificationStatus": 1, "accountStatus": 1},
    )
    if not doctor:
        raise HTTPException(status_code=403, detail="Verified doctor account required")
    verification = _provider_verification_doc(db, doctor_id) or {}
    verification_status = _status(
        verification.get("status") or doctor.get("verificationStatus") or "pending"
    )
    account_status = _status(
        verification.get("accountStatus") or doctor.get("accountStatus") or "active"
    )
    if verification_status != "verified" or account_status != "active":
        raise HTTPException(status_code=403, detail="Verified active doctor credentials are required")

    details = verification.get("details") or {}
    license_expiry = details.get("licenseExpiryDate")
    if license_expiry and _is_expired(license_expiry):
        raise HTTPException(status_code=403, detail="Doctor medical license has expired")

    doc = db["doctor_privileges"].find_one(
        {
            "doctorId": {"$in": _id_variants(doctor_id)},
            "hospitalId": {"$in": _id_variants(hospital_id)},
            "privilege": privilege,
            "status": {"$in": ["active", "Active", "granted", "Granted"]},
        }
    )
    if not doc or _is_expired(doc.get("expiresAt") or doc.get("expiryDate")):
        raise HTTPException(
            status_code=403,
            detail="This procedure is not authorized for your current hospital privileges.",
        )
    return doc


def record_clinical_access(
    *,
    current_user: dict[str, Any],
    patient_id: Any,
    action: str,
    resource_type: str,
    resource_id: Any = None,
    access_channel: str,
    scope: str = "",
    reason: str = "",
    db=None,
) -> Optional[str]:
    """Public wrapper used by routes so all audit events share one format."""
    db = _resolve_db(db)
    return _record_clinical_access(
        db,
        patient_id=patient_id,
        actor_user=current_user,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        access_channel=access_channel,
        scope=scope,
        reason=reason,
    )