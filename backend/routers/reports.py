from __future__ import annotations

import io
import logging
import os
from datetime import datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from access_control import record_clinical_access, require_patient_access
from database import get_db
from dependencies import RoleChecker, get_current_user
from report_service import (
    PDF_REPORT_KIND,
    build_clinical_summary,
    find_prediction,
    generate_or_get_report,
    list_prediction_reports,
    patient_id_variants,
    prediction_belongs_to_patient,
    verify_report_code,
)
from storage import get_file_from_gridfs

logger = logging.getLogger(__name__)

patient_report_router = APIRouter(
    prefix="/api/patient/reports",
    tags=["Patient Reports"],
    dependencies=[Depends(RoleChecker(["Patient"]))],
)

clinical_router = APIRouter(prefix="/api/clinical", tags=["Clinical Summary"])
report_verification_router = APIRouter(prefix="/api/reports", tags=["Report Verification"])


def _public_base_url(request: Request) -> str:
    configured = (os.getenv("PUBLIC_BACKEND_URL") or os.getenv("BACKEND_PUBLIC_URL") or "").strip()
    return configured or str(request.base_url)


def _patient_report_or_404(db, report_id: str, patient_id: str) -> dict:
    if not ObjectId.is_valid(report_id):
        raise HTTPException(status_code=400, detail="Invalid report ID format")
    report = db["reports"].find_one(
        {
            "_id": ObjectId(report_id),
            "patientId": {"$in": patient_id_variants(patient_id)},
            "reportKind": PDF_REPORT_KIND,
        }
    )
    if not report:
        raise HTTPException(status_code=404, detail="Generated medical report not found")
    return report


def _stream_report(report: dict):
    file_id = report.get("fileId")
    if not file_id:
        raise HTTPException(status_code=404, detail="Generated PDF file is not available")
    grid_out, filename, content_type = get_file_from_gridfs(str(file_id))
    data = grid_out.read()
    safe_filename = filename or report.get("fileName") or "DR-Healthcare-Medical-Report.pdf"
    return StreamingResponse(
        io.BytesIO(data),
        media_type=content_type or "application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_filename}"',
            "X-Report-ID": str(report.get("_id")),
            "Cache-Control": "private, max-age=0, must-revalidate",
        },
    )


def _authorize_prediction(
    db,
    current_user: dict,
    prediction: dict,
    *,
    scope: str,
    action: str,
):
    patient_id = str(prediction.get("patientId") or "")
    if not patient_id:
        raise HTTPException(status_code=403, detail="Prediction has no patient owner")

    role = current_user.get("role")
    if role == "Patient":
        if not prediction_belongs_to_patient(prediction, current_user["_id"]):
            # Preserve non-disclosure behavior for patients requesting another
            # patient's prediction by ID.
            raise HTTPException(status_code=404, detail="Prediction not found")
        return None

    decision = require_patient_access(
        current_user=current_user,
        patient_id=patient_id,
        scope=scope,
        db=db,
    )
    record_clinical_access(
        current_user=current_user,
        patient_id=patient_id,
        action=action,
        resource_type="prediction",
        resource_id=str(prediction.get("_id") or ""),
        access_channel=decision.access_channel,
        scope=decision.scope,
        reason=decision.reason,
        db=db,
    )
    return decision


@patient_report_router.post("/generate/{prediction_id}")
def generate_patient_report(
    prediction_id: str,
    request: Request,
    language: str = Query("en", pattern="^(en|ur)$"),
    force: bool = Query(False),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    prediction = find_prediction(db, prediction_id)
    if not prediction or not prediction_belongs_to_patient(prediction, current_user["_id"]):
        raise HTTPException(status_code=404, detail="Prediction not found")

    try:
        report = generate_or_get_report(
            db=db,
            prediction=prediction,
            language=language,
            public_base_url=_public_base_url(request),
            generated_by_user_id=current_user["_id"],
            generated_by_role=current_user.get("role", "Patient"),
            force=force,
        )
    except RuntimeError as exc:
        logger.warning("[REPORTS] Report generation unavailable: %s", exc)
        raise HTTPException(status_code=503, detail="Medical report generation is currently unavailable") from exc
    except Exception as exc:
        logger.exception("[REPORTS] Medical report generation failed for prediction %s", prediction_id)
        raise HTTPException(status_code=500, detail="Unable to generate medical report. Please try again.") from exc

    return {"message": "Medical PDF report is ready", "report": report}


@patient_report_router.get("/prediction/{prediction_id}")
def get_prediction_reports(prediction_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    prediction = find_prediction(db, prediction_id)
    if not prediction or not prediction_belongs_to_patient(prediction, current_user["_id"]):
        raise HTTPException(status_code=404, detail="Prediction not found")
    return {"reports": list_prediction_reports(db, current_user["_id"], prediction_id)}


@patient_report_router.get("/{report_id}/download")
def download_patient_generated_report(report_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    report = _patient_report_or_404(db, report_id, current_user["_id"])
    if report.get("status") != "Completed":
        raise HTTPException(status_code=409, detail="Report generation is not complete")
    return _stream_report(report)


@clinical_router.get("/summary/patient/{patient_id}/latest")
def latest_patient_clinical_summary(patient_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    role = str(current_user.get("role") or "Patient")

    if role == "Patient":
        if str(current_user["_id"]) != str(patient_id):
            raise HTTPException(status_code=403, detail="Access denied")
        decision = None
    else:
        decision = require_patient_access(
            current_user=current_user,
            patient_id=patient_id,
            scope="screening.read",
            db=db,
        )

    prediction = db["predictions"].find_one(
        {"patientId": {"$in": patient_id_variants(patient_id)}},
        sort=[("created_at", -1), ("createdAt", -1), ("date", -1)],
    )
    if not prediction:
        raise HTTPException(status_code=404, detail="No screening prediction found for this patient")

    if decision:
        record_clinical_access(
            current_user=current_user,
            patient_id=patient_id,
            action="VIEW_SCREENING",
            resource_type="prediction",
            resource_id=str(prediction.get("_id") or ""),
            access_channel=decision.access_channel,
            scope=decision.scope,
            reason=decision.reason,
            db=db,
        )

    return build_clinical_summary(db, prediction)


@clinical_router.get("/summary/{prediction_id}")
def clinical_summary(prediction_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    prediction = find_prediction(db, prediction_id)
    if not prediction:
        raise HTTPException(status_code=404, detail="Prediction not found")
    _authorize_prediction(
        db,
        current_user,
        prediction,
        scope="screening.read",
        action="VIEW_SCREENING",
    )
    return build_clinical_summary(db, prediction)


@clinical_router.get("/summary/{prediction_id}/download")
def download_clinical_summary(
    prediction_id: str,
    request: Request,
    language: str = Query("en", pattern="^(en|ur)$"),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    prediction = find_prediction(db, prediction_id)
    if not prediction:
        raise HTTPException(status_code=404, detail="Prediction not found")

    patient_id = str(prediction.get("patientId") or "")
    role = str(current_user.get("role") or "Patient")
    decision = None
    if role == "Patient":
        if not prediction_belongs_to_patient(prediction, current_user["_id"]):
            raise HTTPException(status_code=404, detail="Prediction not found")
    else:
        decision = require_patient_access(
            current_user=current_user,
            patient_id=patient_id,
            scope="reports.download",
            db=db,
        )

    try:
        metadata = generate_or_get_report(
            db=db,
            prediction=prediction,
            language=language,
            public_base_url=_public_base_url(request),
            generated_by_user_id=current_user["_id"],
            generated_by_role=current_user.get("role", "Patient"),
            force=False,
        )
    except RuntimeError as exc:
        logger.warning("[REPORTS] Report generation unavailable: %s", exc)
        raise HTTPException(status_code=503, detail="Medical report generation is currently unavailable") from exc

    report = db["reports"].find_one({"_id": ObjectId(metadata["reportId"])})
    if not report:
        raise HTTPException(status_code=404, detail="Generated report not found")

    if decision:
        record_clinical_access(
            current_user=current_user,
            patient_id=patient_id,
            action="DOWNLOAD_REPORT",
            resource_type="report",
            resource_id=str(report.get("_id") or ""),
            access_channel=decision.access_channel,
            scope=decision.scope,
            reason=decision.reason,
            db=db,
        )

    return _stream_report(report)


@report_verification_router.get("/verify/{report_id}")
def verify_generated_report(report_id: str, code: str = Query(..., min_length=8)):
    """Public verification intentionally returns only minimal non-sensitive data."""
    if not ObjectId.is_valid(report_id):
        return {"valid": False}

    db = get_db()
    report = db["reports"].find_one(
        {"_id": ObjectId(report_id), "reportKind": PDF_REPORT_KIND, "status": "Completed"}
    )
    if not report or not verify_report_code(report, code):
        return {"valid": False}

    patient_id = str(report.get("patientId") or "")
    user = None
    if ObjectId.is_valid(patient_id):
        user = db["users"].find_one({"_id": ObjectId(patient_id)})
    initials = "Patient"
    if user:
        name = str(user.get("name") or "Patient").strip()
        initials = "".join(part[:1].upper() for part in name.split()[:3]) or "Patient"

    generated_at = report.get("generatedAt") or report.get("created_at")
    if isinstance(generated_at, datetime):
        generated_at = generated_at.isoformat()

    return {
        "valid": True,
        "reportNumber": report.get("reportNumber"),
        "reportType": report.get("reportType"),
        "language": report.get("language", "en"),
        "generatedAt": generated_at,
        "patientInitials": initials,
        "screeningDate": report.get("screeningDate"),
        "classification": report.get("classification"),
    }
