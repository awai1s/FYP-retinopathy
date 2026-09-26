from datetime import datetime
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, Form, HTTPException, Query

from access_control import (
    record_clinical_access,
    require_patient_access,
    require_verified_provider,
)
from database import get_db
from dependencies import RoleChecker, VerifiedProviderChecker, get_current_user
from models import CreatePrescription

router = APIRouter(
    prefix="/api/doctor",
    tags=["Doctor"],
    dependencies=[Depends(RoleChecker(["Doctor"]))],
)

DEFAULT_SLOTS = [
    "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
    "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM",
]


@router.get("/profile")
def get_doctor_profile(current_user: dict = Depends(get_current_user)):
    # Profile remains available before Phase 10C verification so a provider can
    # complete the information that will later be reviewed.
    db = get_db()
    profile = db["doctor_profiles"].find_one({"userId": current_user["_id"]})
    if not profile:
        return {
            "userId": current_user["_id"],
            "name": current_user.get("name", ""),
            "email": current_user.get("email", ""),
            "specialization": "",
            "licenseNumber": "",
            "hospital": "",
            "phone": "",
            "experience": "",
        }
    profile["id"] = str(profile.pop("_id"))
    return profile


@router.put("/profile")
def update_doctor_profile(
    specialization: Optional[str] = Form(None),
    licenseNumber: Optional[str] = Form(None),
    hospital: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    experience: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    update_data = {
        k: v
        for k, v in {
            "specialization": specialization,
            "licenseNumber": licenseNumber,
            "hospital": hospital,
            "phone": phone,
            "experience": experience,
            "updatedAt": datetime.utcnow(),
        }.items()
        if v is not None
    }

    db["doctor_profiles"].update_one(
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
    return {"message": "Doctor profile updated successfully"}


@router.post("/prescriptions", dependencies=[Depends(VerifiedProviderChecker())])
def create_prescription(data: CreatePrescription, current_user: dict = Depends(get_current_user)):
    db = get_db()
    require_verified_provider(current_user, db)

    if not ObjectId.is_valid(str(data.patientId)):
        raise HTTPException(status_code=400, detail="Invalid patient ID format")
    patient = db["users"].find_one({"_id": ObjectId(str(data.patientId)), "role": "Patient"}, {"_id": 1})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    decision = require_patient_access(
        current_user=current_user,
        patient_id=str(data.patientId),
        scope="prescription.write",
        db=db,
    )

    now = datetime.utcnow()
    doc = {
        "patientId": str(data.patientId),
        "doctorId": current_user["_id"],
        "doctorName": current_user.get("name", ""),
        "source": "Doctor",
        "medicationDetails": data.medicationDetails,
        "instructions": data.instructions,
        "date": now.strftime("%Y-%m-%d"),
        "created_at": now,
        "updated_at": now,
    }
    res = db["prescriptions"].insert_one(doc)
    prescription_id = str(res.inserted_id)

    db["patient_history"].insert_one(
        {
            "patientId": str(data.patientId),
            "sourceId": prescription_id,
            "type": "Prescription",
            "title": "Doctor Prescription",
            "date": now.strftime("%Y-%m-%d"),
            "status": "Issued",
            "created_at": now,
        }
    )

    record_clinical_access(
        current_user=current_user,
        patient_id=str(data.patientId),
        action="CREATE_PRESCRIPTION",
        resource_type="prescription",
        resource_id=prescription_id,
        access_channel=decision.access_channel,
        scope=decision.scope,
        reason=decision.reason,
        db=db,
    )

    return {"message": "Prescription created successfully", "prescriptionId": prescription_id}


@router.get("/prescriptions", dependencies=[Depends(VerifiedProviderChecker())])
def list_doctor_prescriptions(current_user: dict = Depends(get_current_user)):
    db = get_db()
    require_verified_provider(current_user, db)
    prescriptions = list(db["prescriptions"].find({"doctorId": current_user["_id"]}))
    result = []
    for p in prescriptions:
        p["id"] = str(p.pop("_id"))
        result.append(p)
    return {"prescriptions": result}


@router.get("/dashboard", dependencies=[Depends(VerifiedProviderChecker())])
def doctor_dashboard(current_user: dict = Depends(get_current_user)):
    db = get_db()
    require_verified_provider(current_user, db)
    doctor_id = current_user["_id"]
    prescriptions_count = db["prescriptions"].count_documents({"doctorId": doctor_id})
    unique_patients = db["prescriptions"].distinct("patientId", {"doctorId": doctor_id})
    appointments_count = db["appointments"].count_documents({"doctorId": doctor_id})
    return {
        "stats": {
            "totalPrescriptions": str(prescriptions_count),
            "uniquePatients": str(len(unique_patients)),
            "totalAppointments": str(appointments_count),
        }
    }


@router.get("/availability", dependencies=[Depends(VerifiedProviderChecker())])
def get_own_availability(
    date: str = Query(..., description="Date formatted as YYYY-MM-DD"),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    require_verified_provider(current_user, db)
    booked = list(
        db["appointments"].find(
            {
                "doctorId": current_user["_id"],
                "date": date,
                "status": {"$nin": ["Cancelled", "Rejected"]},
            },
            {"time": 1},
        )
    )
    booked_times = {b.get("time") for b in booked if b.get("time")}
    available = [slot for slot in DEFAULT_SLOTS if slot not in booked_times]
    return {"date": date, "availableSlots": available}


public_doctor_router = APIRouter(prefix="/api/doctors", tags=["Doctors"])


@public_doctor_router.get("/{doctor_id}/availability")
def get_doctor_availability_for_patient(
    doctor_id: str,
    date: str = Query(..., description="Date formatted as YYYY-MM-DD"),
    current_user: dict = Depends(get_current_user),
):
    """Patient-facing availability remains compatible with current booking flow."""
    del current_user
    db = get_db()
    if not ObjectId.is_valid(str(doctor_id)):
        raise HTTPException(status_code=400, detail="Invalid doctor ID format")
    doctor = db["users"].find_one(
        {"_id": ObjectId(str(doctor_id)), "role": "Doctor"},
        {"role": 1, "verificationStatus": 1, "accountStatus": 1},
    )
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    require_verified_provider({**doctor, "_id": str(doctor["_id"])}, db)
    booked = list(
        db["appointments"].find(
            {
                "doctorId": doctor_id,
                "date": date,
                "status": {"$nin": ["Cancelled", "Rejected"]},
            },
            {"time": 1},
        )
    )
    booked_times = {b.get("time") for b in booked if b.get("time")}
    available = [slot for slot in DEFAULT_SLOTS if slot not in booked_times]
    return {"date": date, "availableSlots": available}
