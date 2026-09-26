from __future__ import annotations

import io
from datetime import datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from database import get_db
from dependencies import RoleChecker, get_current_user
from models import ProviderVerificationDetailsUpdate
from storage import get_file_from_gridfs, get_fs, upload_file_to_gridfs
from verification_service import (
    ALLOWED_DOCUMENT_TYPES,
    create_notification,
    ensure_provider_verification,
    missing_requirements,
    notify_superadmins,
    serialize_verification,
)

router = APIRouter(
    prefix="/api/provider-verification",
    tags=["Provider Verification"],
    dependencies=[Depends(RoleChecker(["Doctor", "Hospital"]))],
)


def _editable_status(status: str) -> bool:
    return status in {"pending", "needs_changes"}


def _get_current_verification(db, current_user: dict):
    return ensure_provider_verification(db, current_user)


@router.get("/status")
def get_verification_status(current_user: dict = Depends(get_current_user)):
    db = get_db()
    verification = _get_current_verification(db, current_user)
    return serialize_verification(verification, current_user)


@router.put("/details")
def save_verification_details(
    payload: ProviderVerificationDetailsUpdate,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    verification = _get_current_verification(db, current_user)
    status = str(verification.get("status") or "pending").lower()
    if not _editable_status(status):
        raise HTTPException(
            status_code=409,
            detail="Verification details can only be changed while pending or when changes are requested.",
        )

    data = payload.model_dump(exclude_none=True)
    allowed_by_role = {
        "Doctor": {
            "fullName", "identityNumber", "medicalLicenseNumber", "licensingAuthority",
            "specialization", "qualification", "yearsOfExperience", "licenseIssueDate",
            "licenseExpiryDate", "currentHospitalClinic", "phone", "address",
        },
        "Hospital": {
            "hospitalName", "registrationNumber", "facilityType", "address", "city",
            "officialEmail", "phone", "responsibleContactPerson", "registrationAuthority",
            "registrationExpiry",
        },
    }
    role = str(current_user.get("role") or "")
    filtered = {
        key: (value.strip() if isinstance(value, str) else value)
        for key, value in data.items()
        if key in allowed_by_role.get(role, set())
    }

    now = datetime.utcnow()
    db["provider_verifications"].update_one(
        {"_id": verification["_id"]},
        {"$set": {**{f"details.{key}": value for key, value in filtered.items()}, "updatedAt": now}},
    )
    updated = db["provider_verifications"].find_one({"_id": verification["_id"]})
    return serialize_verification(updated, current_user)


@router.post("/documents/{document_type}")
def upload_verification_document(
    document_type: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    verification = _get_current_verification(db, current_user)
    status = str(verification.get("status") or "pending").lower()
    if not _editable_status(status):
        raise HTTPException(
            status_code=409,
            detail="Verification documents can only be changed while pending or when changes are requested.",
        )

    role = str(current_user.get("role") or "")
    document_type = str(document_type or "").strip().lower()
    if document_type not in ALLOWED_DOCUMENT_TYPES.get(role, set()):
        raise HTTPException(status_code=400, detail="This document type is not valid for your provider role")

    new_file_id = upload_file_to_gridfs(file)
    now = datetime.utcnow()
    documents = list(verification.get("documents") or [])

    # Replace the current document of the same required type. Supporting
    # documents are additive, so providers may upload more than one.
    if document_type != "supporting_document":
        retained = []
        for item in documents:
            if item.get("type") == document_type and item.get("fileId"):
                try:
                    if ObjectId.is_valid(str(item["fileId"])):
                        get_fs().delete(ObjectId(str(item["fileId"])))
                except Exception:
                    pass
            else:
                retained.append(item)
        documents = retained

    documents.append(
        {
            "type": document_type,
            "fileId": new_file_id,
            "filename": file.filename or "document",
            "contentType": file.content_type or "application/octet-stream",
            "uploadedAt": now,
        }
    )

    db["provider_verifications"].update_one(
        {"_id": verification["_id"]},
        {"$set": {"documents": documents, "updatedAt": now}},
    )
    updated = db["provider_verifications"].find_one({"_id": verification["_id"]})
    return serialize_verification(updated, current_user)


@router.delete("/documents/{file_id}")
def delete_verification_document(
    file_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    verification = _get_current_verification(db, current_user)
    status = str(verification.get("status") or "pending").lower()
    if not _editable_status(status):
        raise HTTPException(status_code=409, detail="Verification documents are locked while under review")

    documents = list(verification.get("documents") or [])
    match = next((item for item in documents if str(item.get("fileId") or "") == file_id), None)
    if not match:
        raise HTTPException(status_code=404, detail="Verification document not found")

    documents = [item for item in documents if str(item.get("fileId") or "") != file_id]
    db["provider_verifications"].update_one(
        {"_id": verification["_id"]},
        {"$set": {"documents": documents, "updatedAt": datetime.utcnow()}},
    )
    try:
        if ObjectId.is_valid(file_id):
            get_fs().delete(ObjectId(file_id))
    except Exception:
        pass
    return {"message": "Verification document removed"}


@router.get("/documents/{file_id}/download")
def download_own_verification_document(
    file_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    verification = _get_current_verification(db, current_user)
    allowed = any(str(item.get("fileId") or "") == file_id for item in verification.get("documents") or [])
    if not allowed:
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


@router.post("/submit")
def submit_verification(current_user: dict = Depends(get_current_user)):
    db = get_db()
    verification = _get_current_verification(db, current_user)
    status = str(verification.get("status") or "pending").lower()
    if status not in {"pending", "needs_changes"}:
        raise HTTPException(status_code=409, detail="This verification cannot be submitted in its current state")

    missing = missing_requirements(verification)
    if missing["fields"] or missing["documents"]:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Complete all required verification information before submitting.",
                "missingFields": missing["fields"],
                "missingDocuments": missing["documents"],
            },
        )

    now = datetime.utcnow()
    account_status = str(verification.get("accountStatus") or current_user.get("accountStatus") or "active").lower()
    db["provider_verifications"].update_one(
        {"_id": verification["_id"]},
        {
            "$set": {
                "status": "under_review",
                "accountStatus": account_status,
                "submittedAt": now,
                "reviewedBy": None,
                "reviewedAt": None,
                "decisionReason": "",
                "updatedAt": now,
            }
        },
    )
    db["users"].update_one(
        {"_id": ObjectId(current_user["_id"]) if ObjectId.is_valid(str(current_user["_id"])) else current_user["_id"]},
        {"$set": {"verificationStatus": "under_review", "accountStatus": account_status}},
    )

    provider_name = current_user.get("name") or current_user.get("email") or "Provider"
    role = current_user.get("role") or "Provider"
    notify_superadmins(
        db,
        title=f"New {role} Verification Request",
        message=f"{provider_name} submitted professional credentials for review.",
        related_id=str(verification["_id"]),
    )
    create_notification(
        db,
        user_id=current_user["_id"],
        title="Verification submitted",
        message="Your professional verification has been submitted and is now under review.",
        related_id=str(verification["_id"]),
    )

    updated = db["provider_verifications"].find_one({"_id": verification["_id"]})
    return serialize_verification(updated, current_user)
