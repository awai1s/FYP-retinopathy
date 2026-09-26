from __future__ import annotations

import io
from datetime import datetime, timedelta
from typing import Literal, Optional
from urllib.parse import quote

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

import config
from access_log_service import record_clinical_access as record_access_event
from database import get_db
from dependencies import RoleChecker, get_current_user
from privacy_service import (
    ALLOWED_TEMPORARY_SCOPES,
    DEFAULT_HEALTH_CARD_FIELDS,
    active_emergency_share,
    TEMPORARY_DURATIONS_MINUTES,
    build_qr_svg,
    build_share_token,
    build_shared_payload,
    create_share,
    emergency_scopes_from_settings,
    get_or_create_emergency_share,
    get_or_create_health_card_settings,
    get_or_create_eye_care_id,
    serialize_share,
    share_state,
    token_hash,
    update_health_card_settings,
    validate_share_token,
)
from storage import get_file_from_gridfs

patient_privacy_router = APIRouter(
    prefix="/api/patient/privacy",
    tags=["Patient Privacy"],
    dependencies=[Depends(RoleChecker(["Patient"]))],
)
public_health_card_router = APIRouter(prefix="/api/public/health-card", tags=["Public Health Card"])


class HealthCardFieldsUpdate(BaseModel):
    basicIdentity: Optional[bool] = None
    emergencyContact: Optional[bool] = None
    bloodGroup: Optional[bool] = None
    allergies: Optional[bool] = None
    activeMedication: Optional[bool] = None
    latestDrResult: Optional[bool] = None
    latestHba1c: Optional[bool] = None


class EmergencyShareRequest(BaseModel):
    rotate: bool = False


class TemporaryShareRequest(BaseModel):
    scopes: list[str] = Field(min_length=1, max_length=8)
    durationMinutes: int = Field(ge=15, le=1440)
    maxUses: Optional[int] = Field(default=None, ge=1, le=100)


class RevokeShareRequest(BaseModel):
    reason: Optional[str] = Field(default="patient_revoked", max_length=120)


def _iso(value):
    if isinstance(value, datetime):
        return value.isoformat()
    if value is None:
        return None
    return str(value)


def _frontend_base_url(request: Request) -> str:
    configured = str(getattr(config, "HEALTH_CARD_PUBLIC_BASE_URL", "") or "").strip().rstrip("/")
    if configured:
        return configured

    # Production can reuse the first explicit CORS frontend origin when a
    # dedicated public base URL was not configured.
    if config.IS_RAILWAY and config.CORS_ORIGINS:
        first = next((item.strip().rstrip("/") for item in config.CORS_ORIGINS.split(",") if item.strip()), "")
        if first:
            return first

    # Local Expo Web: preserve the backend request hostname so LAN testing works,
    # but point to the frontend's existing port 8081.
    host = request.url.hostname or "localhost"
    scheme = request.url.scheme or "http"
    safe_host = f"[{host}]" if ":" in host and not host.startswith("[") else host
    return f"{scheme}://{safe_host}:8081"


def _share_url(request: Request, doc: dict) -> str:
    raw = build_share_token(str(doc.get("publicId") or ""))
    return f"{_frontend_base_url(request)}/health-card/q/{quote(raw, safe='')}"


def _serialize_access_log(doc: dict) -> dict:
    action = str(doc.get("action") or "ACCESS")
    labels = {
        "VIEW_PROFILE": "Viewed your profile",
        "VIEW_SCREENING": "Viewed your retinal screening",
        "VIEW_RETINAL_IMAGE": "Viewed a retinal image",
        "VIEW_REPORT": "Viewed a medical report",
        "DOWNLOAD_REPORT": "Downloaded a medical report",
        "VIEW_MEDICATION": "Viewed medication information",
        "CREATE_PRESCRIPTION": "Created a prescription",
        "START_CONSULTATION": "Started a consultation",
        "VIEW_CONSULTATION": "Viewed a consultation",
        "COMPLETE_CONSULTATION": "Completed a consultation",
        "ADD_CONSULTATION_ADDENDUM": "Added a consultation addendum",
        "QR_SCAN": "Viewed your shared Health Card",
    }
    return {
        "id": str(doc.get("_id") or ""),
        "actorUserId": str(doc.get("actorUserId") or ""),
        "actorName": doc.get("actorName") or "Unknown",
        "actorRole": doc.get("actorRole") or "Unknown",
        "action": action,
        "actionLabel": labels.get(action, action.replace("_", " ").title()),
        "resourceType": doc.get("resourceType") or "",
        "resourceId": doc.get("resourceId") or "",
        "accessChannel": doc.get("accessChannel") or "",
        "scope": doc.get("scope") or "",
        "createdAt": _iso(doc.get("createdAt")),
    }


def _serialize_connection(db, doc: dict) -> dict:
    doctor_id = str(doc.get("doctorId") or doc.get("providerId") or "")
    doctor = None
    if ObjectId.is_valid(doctor_id):
        doctor = db["users"].find_one({"_id": ObjectId(doctor_id)}, {"password": 0})
    doctor = doctor or {}
    verification = db["provider_verifications"].find_one(
        {"userId": {"$in": [doctor_id, ObjectId(doctor_id)] if ObjectId.is_valid(doctor_id) else [doctor_id]}},
        sort=[("updatedAt", -1)],
    ) or {}
    details = verification.get("details") or {}
    return {
        "connectionId": str(doc.get("_id") or ""),
        "doctorId": doctor_id,
        "name": doctor.get("name") or "Doctor",
        "specialization": details.get("specialization") or doctor.get("specialization") or "Doctor",
        "hospital": details.get("currentHospitalClinic") or doctor.get("hospital") or "",
        "verified": str(doctor.get("verificationStatus") or verification.get("status") or "").lower() == "verified",
        "connectedSince": _iso(doc.get("acceptedAt") or doc.get("updatedAt") or doc.get("createdAt")),
    }


def _patient_card_data(db, current_user: dict) -> dict:
    patient_id = current_user["_id"]
    profile = db["patient_profiles"].find_one({"userId": patient_id}) or {}
    name = str(current_user.get("name") or "Patient").strip() or "Patient"
    return {
        "patientId": patient_id,
        "name": name,
        "eyeCareId": get_or_create_eye_care_id(db, patient_id),
        "bloodGroup": profile.get("bloodGroup") or "",
        "emergencyContact": profile.get("emergencyContact") or "",
        "allergies": profile.get("allergies") or "",
        "avatarInitial": name[:1].upper() if name else "P",
    }




def _qr_sharing_allowed(db, patient_id: str) -> bool:
    profile = db["patient_profiles"].find_one({"userId": patient_id}, {"consents": 1}) or {}
    for item in profile.get("consents", []):
        if str(item.get("scope") or "").strip().lower() == "qr_sharing":
            return bool(item.get("granted"))
    # Creating a QR is itself an explicit patient action, so absent legacy consent
    # records remain allowed. An explicit OFF state is enforced.
    return True


def _patient_consents(db, patient_id: str) -> list[dict]:
    profile = db["patient_profiles"].find_one({"userId": patient_id}, {"consents": 1}) or {}
    result = []
    for item in profile.get("consents", []):
        result.append(
            {
                "scope": item.get("scope") or "",
                "granted": bool(item.get("granted")),
                "updatedAt": _iso(item.get("updatedAt")),
            }
        )
    return result


@patient_privacy_router.get("/summary")
def privacy_summary(
    request: Request,
    recent_limit: int = Query(3, ge=1, le=10),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    patient_id = current_user["_id"]
    logs = list(
        db["clinical_access_logs"].find({"patientId": patient_id}).sort("createdAt", -1).limit(recent_limit)
    )
    connections = list(
        db["care_connections"].find({"patientId": patient_id, "status": "accepted"}).sort("acceptedAt", -1)
    )
    shares = list(db["qr_share_tokens"].find({"patientId": patient_id}).sort("createdAt", -1).limit(20))
    settings = get_or_create_health_card_settings(db, patient_id)
    return {
        "recentAccess": [_serialize_access_log(doc) for doc in logs],
        "connectedProviders": [_serialize_connection(db, doc) for doc in connections],
        "shares": [serialize_share(doc, share_url=_share_url(request, doc)) for doc in shares],
        "consents": _patient_consents(db, patient_id),
        "healthCardSettings": settings.get("fields") or dict(DEFAULT_HEALTH_CARD_FIELDS),
    }


@patient_privacy_router.get("/access-logs")
def list_access_logs(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0, le=5000),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    patient_id = current_user["_id"]
    query = {"patientId": patient_id}
    total = db["clinical_access_logs"].count_documents(query)
    docs = list(db["clinical_access_logs"].find(query).sort("createdAt", -1).skip(offset).limit(limit))
    return {
        "logs": [_serialize_access_log(doc) for doc in docs],
        "total": total,
        "offset": offset,
        "limit": limit,
    }


@patient_privacy_router.get("/health-card")
def get_health_card(current_user: dict = Depends(get_current_user)):
    db = get_db()
    settings = get_or_create_health_card_settings(db, current_user["_id"])
    return {
        "card": _patient_card_data(db, current_user),
        "settings": settings.get("fields") or dict(DEFAULT_HEALTH_CARD_FIELDS),
    }


@patient_privacy_router.patch("/health-card/settings")
def patch_health_card_settings(
    data: HealthCardFieldsUpdate,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    fields = data.model_dump(exclude_none=True)
    if not fields:
        raise HTTPException(status_code=400, detail="At least one Health Card setting is required")
    settings = update_health_card_settings(db, current_user["_id"], fields)

    # Existing emergency QR permissions must never silently expand or remain
    # stale after the patient changes what may be disclosed. Rotate the emergency
    # token so old screenshots/links stop working immediately. If QR sharing has
    # been explicitly disabled, revoke existing emergency shares without creating
    # a replacement.
    if _qr_sharing_allowed(db, current_user["_id"]):
        # Rotate only when an Emergency QR already exists. Editing privacy
        # preferences must not silently create a new public share.
        if active_emergency_share(db, current_user["_id"]):
            get_or_create_emergency_share(db, current_user["_id"], rotate=True)
    else:
        now = datetime.utcnow()
        db["qr_share_tokens"].update_many(
            {
                "patientId": current_user["_id"],
                "type": "emergency",
                "revoked": {"$ne": True},
            },
            {"$set": {"revoked": True, "revokedAt": now, "revokedReason": "qr_sharing_consent_disabled"}},
        )
    return {
        "message": "Health Card privacy settings updated",
        "settings": settings.get("fields") or dict(DEFAULT_HEALTH_CARD_FIELDS),
    }


@patient_privacy_router.post("/health-card/emergency-qr")
def emergency_qr(
    request: Request,
    data: EmergencyShareRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    if not _qr_sharing_allowed(db, current_user["_id"]):
        raise HTTPException(status_code=403, detail="QR sharing is disabled in Privacy & Access settings")
    share, raw = get_or_create_emergency_share(db, current_user["_id"], rotate=data.rotate)
    share_url = f"{_frontend_base_url(request)}/health-card/q/{quote(raw, safe='')}"
    return {
        "share": serialize_share(share, share_url=share_url),
        "qrSvg": build_qr_svg(share_url),
    }


@patient_privacy_router.post("/health-card/temporary-qr", status_code=201)
def temporary_qr(
    request: Request,
    data: TemporaryShareRequest,
    current_user: dict = Depends(get_current_user),
):
    if data.durationMinutes not in TEMPORARY_DURATIONS_MINUTES:
        raise HTTPException(status_code=400, detail="Temporary share duration must be 15 minutes, 1 hour, or 24 hours")

    scopes: list[str] = []
    for scope in data.scopes:
        value = str(scope or "").strip()
        if value not in ALLOWED_TEMPORARY_SCOPES:
            raise HTTPException(status_code=400, detail=f"Unsupported share scope: {value}")
        if value not in scopes:
            scopes.append(value)

    db = get_db()
    if not _qr_sharing_allowed(db, current_user["_id"]):
        raise HTTPException(status_code=403, detail="QR sharing is disabled in Privacy & Access settings")
    share, raw = create_share(
        db,
        patient_id=current_user["_id"],
        share_type="temporary",
        scopes=scopes,
        expires_at=datetime.utcnow() + timedelta(minutes=data.durationMinutes),
        max_uses=data.maxUses,
    )
    share_url = f"{_frontend_base_url(request)}/health-card/q/{quote(raw, safe='')}"
    return {
        "share": serialize_share(share, share_url=share_url),
        "qrSvg": build_qr_svg(share_url),
    }


@patient_privacy_router.get("/health-card/shares")
def list_health_card_shares(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    docs = list(db["qr_share_tokens"].find({"patientId": current_user["_id"]}).sort("createdAt", -1).limit(100))
    return {"shares": [serialize_share(doc, share_url=_share_url(request, doc)) for doc in docs]}


@patient_privacy_router.patch("/health-card/shares/{share_id}/revoke")
def revoke_health_card_share(
    share_id: str,
    data: RevokeShareRequest,
    current_user: dict = Depends(get_current_user),
):
    if not ObjectId.is_valid(share_id):
        raise HTTPException(status_code=400, detail="Invalid QR share ID")
    db = get_db()
    now = datetime.utcnow()
    result = db["qr_share_tokens"].update_one(
        {"_id": ObjectId(share_id), "patientId": current_user["_id"], "revoked": {"$ne": True}},
        {"$set": {"revoked": True, "revokedAt": now, "revokedReason": (data.reason or "patient_revoked")[:120]}},
    )
    if result.matched_count == 0:
        existing = db["qr_share_tokens"].find_one({"_id": ObjectId(share_id), "patientId": current_user["_id"]})
        if not existing:
            raise HTTPException(status_code=404, detail="QR share not found")
    saved = db["qr_share_tokens"].find_one({"_id": ObjectId(share_id)})
    return {"message": "QR share revoked", "share": serialize_share(saved or {})}


@patient_privacy_router.post("/health-card/shares/revoke-all")
def revoke_all_health_card_shares(current_user: dict = Depends(get_current_user)):
    db = get_db()
    now = datetime.utcnow()
    result = db["qr_share_tokens"].update_many(
        {"patientId": current_user["_id"], "revoked": {"$ne": True}},
        {"$set": {"revoked": True, "revokedAt": now, "revokedReason": "patient_revoked_all"}},
    )
    return {"message": "All active QR shares revoked", "updated": result.modified_count}


def _public_share_or_error(db, token: str, *, increment_use: bool) -> dict:
    try:
        return validate_share_token(db, token, increment_use=increment_use)
    except LookupError:
        raise HTTPException(status_code=404, detail="This Health Card share link is invalid")
    except PermissionError as exc:
        state = str(exc)
        if state == "expired":
            raise HTTPException(status_code=410, detail="This medical share link has expired")
        if state == "revoked":
            raise HTTPException(status_code=410, detail="This Health Card share has been revoked")
        if state == "exhausted":
            raise HTTPException(status_code=410, detail="This Health Card share has reached its usage limit")
        raise HTTPException(status_code=410, detail="This Health Card share is no longer available")


@public_health_card_router.get("/{token}")
def public_health_card(token: str, response: Response):
    # Public share responses contain patient-authorized health information. Never
    # allow browsers/proxies/search engines to cache or index this tokenized view.
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["X-Robots-Tag"] = "noindex, nofollow, noarchive"
    db = get_db()
    share = _public_share_or_error(db, token, increment_use=True)
    payload = build_shared_payload(db, share)
    record_access_event(
        db,
        patient_id=share.get("patientId"),
        actor_user_id="anonymous",
        actor_name="Anonymous QR Scan",
        actor_role="Anonymous",
        action="QR_SCAN",
        resource_type="health_card_share",
        resource_id=str(share.get("_id") or ""),
        access_channel="QR",
        scope=",".join(share.get("scopes") or []),
        reason=str(share.get("type") or "share"),
    )
    return payload


@public_health_card_router.get("/{token}/reports/{report_id}/download")
def public_shared_report_download(token: str, report_id: str):
    db = get_db()
    share = _public_share_or_error(db, token, increment_use=False)
    if "reports.recent" not in set(share.get("scopes") or []):
        raise HTTPException(status_code=403, detail="This share does not permit report downloads")
    if not ObjectId.is_valid(report_id):
        raise HTTPException(status_code=404, detail="Shared report not found")

    patient_id = str(share.get("patientId") or "")
    patient_variants = [patient_id]
    if ObjectId.is_valid(patient_id):
        patient_variants.append(ObjectId(patient_id))
    report = db["reports"].find_one(
        {"_id": ObjectId(report_id), "patientId": {"$in": patient_variants}, "fileId": {"$nin": [None, ""]}}
    )
    if not report:
        raise HTTPException(status_code=404, detail="Shared report not found")

    grid_out, filename, content_type = get_file_from_gridfs(str(report.get("fileId")))
    data = grid_out.read()
    record_access_event(
        db,
        patient_id=patient_id,
        actor_user_id="anonymous",
        actor_name="Anonymous QR Scan",
        actor_role="Anonymous",
        action="DOWNLOAD_REPORT",
        resource_type="report",
        resource_id=report_id,
        access_channel="QR",
        scope="reports.recent",
        reason=str(share.get("type") or "share"),
    )
    return StreamingResponse(
        io.BytesIO(data),
        media_type=content_type or "application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename or "shared-medical-report.pdf"}"',
            "Cache-Control": "no-store",
        },
    )
