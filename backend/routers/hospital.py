from __future__ import annotations

import io
from datetime import datetime
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from access_control import (
    record_clinical_access,
    require_patient_access,
    require_verified_provider,
)
from database import get_db
from dependencies import RoleChecker, VerifiedProviderChecker, get_current_user
from storage import get_file_from_gridfs, upload_file_to_gridfs

router = APIRouter(
    prefix="/api/hospital",
    tags=["Hospital"],
    dependencies=[Depends(RoleChecker(["Hospital"]))],
)


def _same_id(left, right) -> bool:
    return str(left or "") == str(right or "")


@router.get("/profile")
def get_hospital_profile(current_user: dict = Depends(get_current_user)):
    # Profile stays available before Phase 10C verification so the facility can
    # complete information/documents for review.
    db = get_db()
    profile = db["hospital_profiles"].find_one({"userId": current_user["_id"]})
    if not profile:
        return {
            "userId": current_user["_id"],
            "name": current_user.get("name", ""),
            "email": current_user.get("email", ""),
            "hospitalName": current_user.get("name", ""),
            "licenseNumber": "",
            "phone": current_user.get("mobile", ""),
            "address": "",
        }
    profile["id"] = str(profile.pop("_id"))
    return profile


@router.put("/profile")
def update_hospital_profile(
    hospitalName: Optional[str] = Form(None),
    licenseNumber: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    address: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    update_data = {
        k: v
        for k, v in {
            "hospitalName": hospitalName,
            "licenseNumber": licenseNumber,
            "phone": phone,
            "address": address,
            "updatedAt": datetime.utcnow(),
        }.items()
        if v is not None
    }

    db["hospital_profiles"].update_one(
        {"userId": current_user["_id"]},
        {
            "$set": update_data,
            "$setOnInsert": {
                "userId": current_user["_id"],
                "email": current_user.get("email", ""),
                "name": current_user.get("name", ""),
                "createdAt": datetime.utcnow(),
            },
        },
        upsert=True,
    )
    return {"message": "Hospital profile updated successfully"}


@router.get("/reports", dependencies=[Depends(VerifiedProviderChecker())])
def get_hospital_reports(current_user: dict = Depends(get_current_user)):
    db = get_db()
    require_verified_provider(current_user, db)
    reports = list(
        db["reports"].find(
            {
                "$or": [
                    {"hospitalId": current_user["_id"]},
                    {"uploadedByUserId": current_user["_id"]},
                ]
            }
        ).sort("created_at", -1)
    )

    results = []
    for r in reports:
        results.append(
            {
                "id": str(r["_id"]),
                "reportId": str(r["_id"]),
                "reportType": r.get("reportType", "Clinical Report"),
                "hospitalName": r.get("hospitalName") or current_user.get("name", "Hospital"),
                "doctorName": r.get("doctorName", ""),
                "patientId": r.get("patientId", ""),
                "uploadDate": r.get("uploadDate")
                or (
                    r["created_at"].strftime("%Y-%m-%d")
                    if "created_at" in r and isinstance(r["created_at"], datetime)
                    else ""
                ),
                "status": r.get("status", "Completed"),
                "description": r.get("description", ""),
                "fileName": r.get("fileName", ""),
                "fileId": r.get("fileId", ""),
            }
        )
    return {"reports": results}


@router.post("/reports/upload", dependencies=[Depends(VerifiedProviderChecker())])
def upload_hospital_report(
    reportType: str = Form(...),
    hospitalName: str = Form(...),
    doctorName: str = Form(""),
    description: str = Form(""),
    patientId: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    require_verified_provider(current_user, db)

    decision = None
    patient_id = str(patientId or "").strip()
    if patient_id:
        if not ObjectId.is_valid(patient_id):
            raise HTTPException(status_code=400, detail="Invalid patient ID format")
        patient = db["users"].find_one({"_id": ObjectId(patient_id), "role": "Patient"}, {"_id": 1})
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        decision = require_patient_access(
            current_user=current_user,
            patient_id=patient_id,
            scope="reports.write",
            db=db,
        )

    file_id = ""
    file_name = ""
    if file:
        file_id = upload_file_to_gridfs(file)
        file_name = file.filename or ""

    now = datetime.utcnow()
    report_doc = {
        "reportType": reportType,
        "hospitalName": hospitalName or current_user.get("name", "Hospital"),
        "hospitalId": current_user["_id"],
        "doctorName": doctorName,
        "description": description,
        "patientId": patient_id,
        "uploadedByUserId": current_user["_id"],
        "uploaderRole": "Hospital",
        "fileName": file_name,
        "fileId": file_id,
        "uploadDate": now.strftime("%Y-%m-%d"),
        "status": "Completed",
        "created_at": now,
        "updated_at": now,
    }

    res = db["reports"].insert_one(report_doc)
    report_id = str(res.inserted_id)

    # Keep the existing hospital operational audit log but avoid copying
    # sensitive medical content into it.
    db["audit_logs"].insert_one(
        {
            "userId": current_user["_id"],
            "role": "Hospital",
            "action": "UPLOAD_REPORT",
            "resource": "reports",
            "resourceId": report_id,
            "createdAt": now.isoformat(),
        }
    )

    if patient_id:
        db["patient_history"].insert_one(
            {
                "patientId": patient_id,
                "sourceId": report_id,
                "type": "Report",
                "title": f"{reportType} - {hospitalName}",
                "date": now.strftime("%Y-%m-%d"),
                "status": "Completed",
                "created_at": now,
            }
        )
        record_clinical_access(
            current_user=current_user,
            patient_id=patient_id,
            action="UPLOAD_REPORT",
            resource_type="report",
            resource_id=report_id,
            access_channel=decision.access_channel if decision else "hospital_upload",
            scope=decision.scope if decision else "reports.write",
            reason=decision.reason if decision else "hospital_upload",
            db=db,
        )

    return {"message": "Clinical report uploaded successfully", "reportId": report_id}


@router.get("/reports/{report_id}/download", dependencies=[Depends(VerifiedProviderChecker())])
def download_hospital_report(report_id: str, current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(report_id):
        raise HTTPException(status_code=400, detail="Invalid report ID format")

    db = get_db()
    require_verified_provider(current_user, db)
    report = db["reports"].find_one({"_id": ObjectId(report_id)})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    patient_id = str(report.get("patientId") or "").strip()
    owns_report = _same_id(report.get("hospitalId"), current_user["_id"]) or _same_id(
        report.get("uploadedByUserId"), current_user["_id"]
    )

    decision = None
    if not owns_report:
        if not patient_id:
            raise HTTPException(status_code=403, detail="Access denied")
        decision = require_patient_access(
            current_user=current_user,
            patient_id=patient_id,
            scope="reports.download",
            db=db,
        )

    file_id = report.get("fileId")
    if not file_id:
        raise HTTPException(status_code=404, detail="No file attached to this report")

    grid_out, filename, content_type = get_file_from_gridfs(str(file_id))
    data = grid_out.read()

    if patient_id:
        record_clinical_access(
            current_user=current_user,
            patient_id=patient_id,
            action="DOWNLOAD_REPORT",
            resource_type="report",
            resource_id=report_id,
            access_channel=(decision.access_channel if decision else "hospital_owned_report"),
            scope=(decision.scope if decision else "reports.download"),
            reason=(decision.reason if decision else "report_owned_by_hospital"),
            db=db,
        )

    return StreamingResponse(
        io.BytesIO(data),
        media_type=content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "private, max-age=0, must-revalidate",
        },
    )


@router.get("/audit-logs", dependencies=[Depends(VerifiedProviderChecker())])
def get_hospital_audit_logs(current_user: dict = Depends(get_current_user)):
    db = get_db()
    require_verified_provider(current_user, db)
    logs = list(db["audit_logs"].find({"userId": current_user["_id"]}).sort("createdAt", -1).limit(100))
    formatted_logs = []
    for log in logs:
        formatted_logs.append(
            {
                "id": str(log["_id"]),
                "userId": log.get("userId", ""),
                "role": log.get("role", "Hospital"),
                "action": log.get("action", ""),
                "resource": log.get("resource", ""),
                "resourceId": log.get("resourceId", ""),
                "createdAt": log.get("createdAt", ""),
            }
        )
    return {"logs": formatted_logs}


@router.get("/dashboard", dependencies=[Depends(VerifiedProviderChecker())])
def hospital_dashboard(current_user: dict = Depends(get_current_user)):
    db = get_db()
    require_verified_provider(current_user, db)
    h_id = current_user["_id"]
    total_reports = db["reports"].count_documents({"hospitalId": h_id})
    recent_uploads = db["reports"].count_documents(
        {
            "hospitalId": h_id,
            "created_at": {"$gte": datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)},
        }
    )
    return {
        "stats": {
            "totalReports": str(total_reports),
            "todayUploads": str(recent_uploads),
        }
    }
