from __future__ import annotations

import io
import logging
from datetime import datetime
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from database import get_db
from credential_privilege_service import doctor_credential, id_variants
from dependencies import RoleChecker, get_current_user
from email_service import send_account_notification_email
from models import VerificationDecisionRequest
from storage import get_file_from_gridfs
from verification_service import (
    ACCOUNT_STATUSES,
    VERIFICATION_STATUSES,
    create_notification,
    ensure_provider_verification,
    normalize_account_status,
    normalize_status,
    missing_requirements,
    record_verification_audit,
    serialize_verification,
)

logger = logging.getLogger(__name__)


class DoctorCredentialMaintenanceRequest(BaseModel):
    medicalLicenseNumber: str = Field(min_length=2, max_length=120)
    licensingAuthority: str = Field(min_length=2, max_length=180)
    specialization: str = Field(min_length=2, max_length=180)
    licenseIssueDate: str = Field(min_length=8, max_length=32)
    licenseExpiryDate: str = Field(min_length=8, max_length=32)
    qualification: Optional[str] = Field(default=None, max_length=240)
    reason: str = Field(min_length=3, max_length=1200)


router = APIRouter(
    prefix="/api/superadmin",
    tags=["SuperAdmin"],
    dependencies=[Depends(RoleChecker(["SuperAdmin"]))],
)


def _verification_by_id(db, verification_id: str) -> dict:
    if not ObjectId.is_valid(verification_id):
        raise HTTPException(status_code=400, detail="Invalid verification ID")
    doc = db["provider_verifications"].find_one({"_id": ObjectId(verification_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Verification record not found")
    return doc


def _provider_user(db, user_id: str) -> Optional[dict]:
    if ObjectId.is_valid(user_id):
        user = db["users"].find_one({"_id": ObjectId(user_id)}, {"password": 0})
        if user:
            return user
    return db["users"].find_one({"_id": user_id}, {"password": 0})


@router.get("/dashboard")
def admin_dashboard(current_user: dict = Depends(get_current_user)):
    del current_user
    db = get_db()
    collection = db["provider_verifications"]
    return {
        "counts": {
            "pending": collection.count_documents({"status": "pending"}),
            "underReview": collection.count_documents({"status": "under_review"}),
            "needsChanges": collection.count_documents({"status": "needs_changes"}),
            "verified": collection.count_documents({"status": "verified"}),
            "suspended": collection.count_documents({"accountStatus": "suspended"}),
            "doctors": collection.count_documents({"role": "Doctor"}),
            "hospitals": collection.count_documents({"role": "Hospital"}),
        }
    }


@router.get("/verifications")
def list_verifications(
    status: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    account_status: Optional[str] = Query(None, alias="accountStatus"),
    query: str = Query("", max_length=120),
    limit: int = Query(100, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
):
    del current_user
    db = get_db()
    mongo: dict = {}

    if status:
        statuses = [item.strip().lower() for item in status.split(",") if item.strip()]
        statuses = [item for item in statuses if item in VERIFICATION_STATUSES]
        if statuses:
            mongo["status"] = {"$in": statuses}
    if role in {"Doctor", "Hospital"}:
        mongo["role"] = role
    if account_status:
        normalized = account_status.strip().lower()
        if normalized in ACCOUNT_STATUSES:
            mongo["accountStatus"] = normalized

    docs = list(db["provider_verifications"].find(mongo).sort("updatedAt", -1).limit(limit))
    results = []
    q = query.strip().lower()
    for doc in docs:
        user = _provider_user(db, str(doc.get("userId") or ""))
        if q:
            haystack = " ".join(
                [
                    str((user or {}).get("name") or ""),
                    str((user or {}).get("email") or ""),
                    str((doc.get("details") or {}).get("medicalLicenseNumber") or ""),
                    str((doc.get("details") or {}).get("registrationNumber") or ""),
                ]
            ).lower()
            if q not in haystack:
                continue
        results.append(serialize_verification(doc, user))
    return {"verifications": results}


@router.get("/verifications/{verification_id}")
def get_verification(verification_id: str, current_user: dict = Depends(get_current_user)):
    del current_user
    db = get_db()
    doc = _verification_by_id(db, verification_id)
    user = _provider_user(db, str(doc.get("userId") or ""))
    return serialize_verification(doc, user)


@router.get("/verifications/{verification_id}/documents/{file_id}/download")
def download_verification_document(
    verification_id: str,
    file_id: str,
    current_user: dict = Depends(get_current_user),
):
    del current_user
    db = get_db()
    doc = _verification_by_id(db, verification_id)
    if not any(str(item.get("fileId") or "") == file_id for item in doc.get("documents") or []):
        raise HTTPException(status_code=404, detail="Verification document not found")

    grid_out, filename, content_type = get_file_from_gridfs(file_id)
    return StreamingResponse(
        io.BytesIO(grid_out.read()),
        media_type=content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "private, max-age=0, must-revalidate",
        },
    )


@router.post("/verifications/{verification_id}/decision")
def decide_verification(
    verification_id: str,
    payload: VerificationDecisionRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    verification = _verification_by_id(db, verification_id)
    provider = _provider_user(db, str(verification.get("userId") or ""))
    if not provider:
        raise HTTPException(status_code=404, detail="Provider account not found")

    action = payload.decision
    reason = payload.reason.strip()
    previous_status = normalize_status(verification.get("status"))
    previous_account = normalize_account_status(verification.get("accountStatus"))
    new_status = previous_status
    new_account = previous_account

    if action == "verify":
        if previous_status != "under_review":
            raise HTTPException(status_code=409, detail="Provider must submit a complete verification before approval")
        missing = missing_requirements(verification)
        if missing["fields"] or missing["documents"]:
            raise HTTPException(status_code=400, detail="Required verification information or documents are missing")
        new_status = "verified"
    elif action == "request_changes":
        new_status = "needs_changes"
    elif action == "reject":
        new_status = "rejected"
    elif action == "suspend":
        new_account = "suspended"
    elif action == "reactivate":
        new_account = "active"
    elif action == "disable":
        new_account = "disabled"
    else:
        raise HTTPException(status_code=400, detail="Unsupported verification decision")

    now = datetime.utcnow()
    update = {
        "status": new_status,
        "accountStatus": new_account,
        "reviewedBy": current_user["_id"],
        "reviewedAt": now,
        "decisionReason": reason,
        "updatedAt": now,
    }
    db["provider_verifications"].update_one({"_id": verification["_id"]}, {"$set": update})

    provider_id_query = ObjectId(str(provider["_id"])) if ObjectId.is_valid(str(provider["_id"])) else provider["_id"]
    db["users"].update_one(
        {"_id": provider_id_query},
        {"$set": {"verificationStatus": new_status, "accountStatus": new_account}},
    )

    updated = db["provider_verifications"].find_one({"_id": verification["_id"]})
    record_verification_audit(
        db,
        verification=updated,
        action=action,
        reviewer_id=current_user["_id"],
        reason=reason,
        previous_status=previous_status,
        new_status=new_status,
        previous_account_status=previous_account,
        new_account_status=new_account,
    )

    messages = {
        "verify": ("Verification approved", "Your EyeCare AI provider verification was approved."),
        "request_changes": ("Verification changes required", f"Changes are required before your account can be verified. {reason}"),
        "reject": ("Verification rejected", f"Your provider verification was not approved. {reason}"),
        "suspend": ("Provider account suspended", f"Your provider account has been suspended. {reason}"),
        "reactivate": ("Provider account reactivated", "Your provider account is active again."),
        "disable": ("Provider account disabled", f"Your provider account has been disabled. {reason}"),
    }
    title, message = messages[action]
    create_notification(
        db,
        user_id=str(provider["_id"]),
        title=title,
        message=message,
        related_id=verification_id,
    )

    # Email is best-effort.  A temporary email-provider outage must never roll
    # back a completed admin decision.
    try:
        if provider.get("email"):
            send_account_notification_email(str(provider["email"]), title, message)
    except Exception as exc:
        logger.warning("[VERIFICATION] Email notification failed for %s: %s", provider.get("email"), exc)

    return serialize_verification(updated, provider)


@router.get("/doctors/{doctor_id}/credentials")
def get_doctor_credentials(doctor_id: str, current_user: dict = Depends(get_current_user)):
    del current_user
    db = get_db()
    credential = doctor_credential(db, doctor_id)
    if not credential:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return credential


@router.patch("/doctors/{doctor_id}/credentials")
def update_doctor_credentials(
    doctor_id: str,
    payload: DoctorCredentialMaintenanceRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    credential = doctor_credential(db, doctor_id)
    if not credential:
        raise HTTPException(status_code=404, detail="Doctor not found")
    if credential.get("verificationStatus") != "verified":
        raise HTTPException(status_code=409, detail="Credential maintenance is available after provider verification is approved")

    verification = db["provider_verifications"].find_one(
        {"userId": {"$in": id_variants(doctor_id)}, "role": "Doctor"},
        sort=[("updatedAt", -1)],
    )
    if not verification:
        raise HTTPException(status_code=404, detail="Doctor verification record not found")

    try:
        issue_date = datetime.strptime(payload.licenseIssueDate.strip(), "%Y-%m-%d").date()
        expiry_date = datetime.strptime(payload.licenseExpiryDate.strip(), "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="License dates must use YYYY-MM-DD")
    if expiry_date <= issue_date:
        raise HTTPException(status_code=400, detail="License expiry date must be after the issue date")

    fields = {
        "medicalLicenseNumber": payload.medicalLicenseNumber.strip(),
        "licensingAuthority": payload.licensingAuthority.strip(),
        "specialization": payload.specialization.strip(),
        "licenseIssueDate": payload.licenseIssueDate.strip(),
        "licenseExpiryDate": payload.licenseExpiryDate.strip(),
    }
    if payload.qualification is not None:
        fields["qualification"] = payload.qualification.strip()

    previous = {key: (verification.get("details") or {}).get(key) for key in fields}
    now = datetime.utcnow()
    db["provider_verifications"].update_one(
        {"_id": verification["_id"]},
        {"$set": {**{f"details.{key}": value for key, value in fields.items()}, "updatedAt": now}},
    )
    db["doctor_credential_audit"].insert_one(
        {
            "doctorId": str(doctor_id),
            "verificationId": str(verification.get("_id") or ""),
            "reviewerId": str(current_user.get("_id") or ""),
            "reason": payload.reason.strip(),
            "previous": previous,
            "current": fields,
            "createdAt": now,
        }
    )
    create_notification(
        db,
        user_id=doctor_id,
        title="Professional credentials updated",
        message="A SuperAdmin updated your verified professional credential record. Review the new license details in your provider profile.",
        notification_type="verification",
        related_id=str(verification.get("_id") or ""),
    )
    return doctor_credential(db, doctor_id)


@router.get("/audit")
def verification_audit(
    limit: int = Query(100, ge=1, le=250),
    current_user: dict = Depends(get_current_user),
):
    del current_user
    db = get_db()
    docs = list(db["provider_verification_audit"].find({}).sort("timestamp", -1).limit(limit))
    events = []
    for doc in docs:
        reviewer = _provider_user(db, str(doc.get("reviewerId") or ""))
        provider = _provider_user(db, str(doc.get("userId") or ""))
        events.append(
            {
                "id": str(doc.get("_id") or ""),
                "verificationId": doc.get("verificationId") or "",
                "userId": doc.get("userId") or "",
                "providerName": (provider or {}).get("name") or "Provider",
                "role": doc.get("role") or "",
                "decision": doc.get("decision") or "",
                "reviewerId": doc.get("reviewerId") or "",
                "reviewerName": (reviewer or {}).get("name") or "SuperAdmin",
                "reason": doc.get("reason") or "",
                "previousStatus": doc.get("previousStatus"),
                "newStatus": doc.get("newStatus"),
                "previousAccountStatus": doc.get("previousAccountStatus"),
                "newAccountStatus": doc.get("newAccountStatus"),
                "timestamp": doc.get("timestamp").isoformat() if isinstance(doc.get("timestamp"), datetime) else str(doc.get("timestamp") or ""),
            }
        )
    return {"events": events}
