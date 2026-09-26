import os
import random
import socket
import logging
import smtplib
import traceback
import requests
from pathlib import Path
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
from email.message import EmailMessage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from dotenv import load_dotenv
from bson import ObjectId
from pymongo.errors import PyMongoError
from pydantic import BaseModel
import bcrypt

from fastapi import FastAPI, Header, HTTPException, Request, File, UploadFile, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import config
from database import db, check_db_connection, get_db, init_db
from auth import create_access_token, verify_token
from dependencies import get_current_user
from email_service import send_otp_email
from models import (
    UserSignup,
    UserLogin,
    VerifyOTP,
    SendOTP,
    ResendOTP,
    CreatePrescription,
    PasswordResetRequest,
    PasswordResetVerify,
    PasswordReset,
    ProfileRoleUpdate,
)

# Import Routers
from routers.integrations import router as integrations_router
from routers.hospital import router as hospital_router
from routers.equipment import router as equipment_router
from routers.doctor import router as doctor_router, public_doctor_router
from routers.shared import router as shared_router
from routers.patient import router as patient_router
from routers.appointments import router as appointments_router
from routers.notifications import router as notifications_router
from routers.clinics import router as clinics_router
from routers.reports import patient_report_router, clinical_router, report_verification_router
from routers.ai_assistant import router as ai_assistant_router
from routers.provider_verification import router as provider_verification_router
from routers.superadmin import router as superadmin_router
from routers.connections import router as connections_router
from routers.privacy import patient_privacy_router, public_health_card_router
from routers.consultations import router as consultations_router
from routers.medication_reconciliation import router as medication_reconciliation_router
from routers.watchlist import router as watchlist_router
from routers.vision_prescriptions import router as vision_prescriptions_router
from routers.education import router as education_router
from routers.credentials_privileges import router as credentials_privileges_router

# ==========================================
# Environment & Logging Configuration
# ==========================================
_DOTENV_PATH = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=_DOTENV_PATH)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ==========================================
# Lifespan & App Setup
# ==========================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    config.log_config_status()

    missing = config.validate_required_config()
    if missing:
        logger.error("[STARTUP] Missing required environment variables: %s", ", ".join(missing))

    try:
        init_db()
    except Exception as exc:
        logger.error("[STARTUP] MongoDB initialization failed: %s", exc)

    yield


app = FastAPI(lifespan=lifespan)

# ==========================================
# CORS Configuration
# ==========================================
# Authentication in this app uses JWT Bearer tokens stored by the frontend;
# it does not depend on cross-origin cookies.  For local development we can
# therefore safely use a wildcard CORS origin with credentials disabled.
# This is deliberately more tolerant than an origin-regex setup and prevents
# Expo Web / Chrome OPTIONS preflights from being rejected when the frontend
# is opened as localhost, 127.0.0.1, a LAN IP, or IPv6 localhost.
#
# Production remains explicit.  Set, for example:
# CORS_ORIGINS=https://your-frontend.example.com,https://www.example.com

def _configured_production_cors_origins() -> list[str]:
    configured = config.CORS_ORIGINS
    if not configured:
        return []

    values = [
        item.strip().rstrip("/")
        for item in configured.split(",")
        if item.strip()
    ]
    return list(dict.fromkeys(values))


if config.IS_RAILWAY:
    CORS_ALLOWED_ORIGINS = _configured_production_cors_origins()
else:
    # Local Expo Web / browser development.
    CORS_ALLOWED_ORIGINS = ["*"]


app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    # The project authenticates with Authorization: Bearer <JWT>, not cookies.
    # Keeping credentials disabled makes wildcard local CORS valid and stable.
    allow_credentials=False,
    # Starlette validates Chromium private-network preflights before the
    # request reaches app middleware. Enable them only for local development.
    allow_private_network=not config.IS_RAILWAY,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Report-ID"],
    max_age=86400,
)


# Include Routers
app.include_router(integrations_router)
app.include_router(hospital_router)
app.include_router(equipment_router)
app.include_router(doctor_router)
app.include_router(public_doctor_router)
app.include_router(shared_router)
app.include_router(patient_router)
app.include_router(appointments_router)
app.include_router(notifications_router)
app.include_router(clinics_router)
app.include_router(patient_report_router)
app.include_router(clinical_router)
app.include_router(report_verification_router)
app.include_router(ai_assistant_router)
app.include_router(provider_verification_router)
app.include_router(superadmin_router)
app.include_router(connections_router)
app.include_router(patient_privacy_router)
app.include_router(public_health_card_router)
app.include_router(consultations_router)
app.include_router(medication_reconciliation_router)
app.include_router(watchlist_router)
app.include_router(vision_prescriptions_router)
app.include_router(education_router)
app.include_router(credentials_privileges_router)


# ==========================================
# Global Exception Handler
# ==========================================
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Full exception details stay in server logs; clients receive a stable,
    # non-sensitive production error response.
    logger.exception("[UNHANDLED ERROR] %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# ==========================================
# Collection Helper Functions
# ==========================================
def _users_collection():
    return get_db()["users"]


def _otp_collection():
    return get_db()["otp_verification"]


def _reports_collection():
    return get_db()["reports"]


def _prescriptions_collection():
    return get_db()["prescriptions"]


def _predictions_collection():
    return get_db()["predictions"]





# ==========================================
# Core Endpoints
# ==========================================
@app.get("/")
def home():
    db_status = check_db_connection()
    return {
        "message": "Backend Connected!",
        "database": db_status.get("database", getattr(config, "DATABASE_NAME", db.name if hasattr(db, 'name') else "Unknown")),
        "mongodb_connected": db_status.get("connected", False),
    }


@app.get("/health")
def health():
    db_status = check_db_connection()
    missing = config.validate_required_config()

    return {
        "status": "ok" if db_status.get("connected") and not missing else "degraded",
        "mongodb": db_status,
        "config": {
            "mongodb_url_set": bool(config.MONGODB_URL),
            "database_name": config.DATABASE_NAME,
            "secret_key_set": bool(config.SECRET_KEY),
            "email_address_set": bool(config.SMTP_USER),
            "email_password_set": bool(config.SMTP_PASSWORD),
            "missing_required": missing,
            "is_railway": config.IS_RAILWAY,
            "clinic_locator_provider": "OpenStreetMap nearby search + Google Maps handoff",
            "clinic_locator_requires_api_key": False,
            "production_cors_configured": bool(config.CORS_ORIGINS) if config.IS_RAILWAY else True,
            "require_patient_connection": config.REQUIRE_PATIENT_CONNECTION,
            "provider_verification_enforced": config.ENFORCE_PROVIDER_VERIFICATION,
            "legacy_relationship_bridge": config.ALLOW_LEGACY_CLINICAL_RELATIONSHIPS,
            "diagnostics_enabled": config.ENABLE_DIAGNOSTIC_ENDPOINTS,
            "health_card_public_url_configured": bool(config.HEALTH_CARD_PUBLIC_BASE_URL),
        },
    }


@app.post("/send-otp")
def send_otp(data: SendOTP):
    email = data.email
    logger.info("[SEND-OTP] Request received for %s", email)

    try:
        existing_user = _users_collection().find_one({"email": email})
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already exists")

        otp = str(random.randint(100000, 999999))
        logger.info("[OTP] Generated one-time code for %s", email)

        _otp_collection().delete_many({"email": email})
        _otp_collection().insert_one({
            "email": email,
            "otp": otp,
            "expiry": datetime.utcnow() + timedelta(minutes=5),
            "verified": False
        })
        logger.info("[OTP] Stored in MongoDB for %s", email)

        send_otp_email(email, otp)
        return {"message": "OTP sent"}

    except HTTPException:
        raise
    except RuntimeError as exc:
        logger.error("[SEND-OTP] Runtime error: %s", exc)
        return JSONResponse(status_code=503, content={"message": "Email service is temporarily unavailable", "status": "unavailable"})
    except PyMongoError as exc:
        logger.exception("[SEND-OTP] MongoDB error: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Database service is temporarily unavailable",
        )
    except Exception as exc:
        logger.exception("[SEND-OTP] Unexpected error: %s", exc)
        raise HTTPException(status_code=500, detail="Unable to process the request")


@app.post("/resend-otp")
def resend_otp(data: ResendOTP):
    email = data.email
    logger.info("[RESEND-OTP] Request received for %s", email)

    try:
        otp = str(random.randint(100000, 999999))
        logger.info("[OTP] Generated one-time code for %s", email)

        _otp_collection().delete_many({"email": email})
        _otp_collection().insert_one({
            "email": email,
            "otp": otp,
            "expiry": datetime.utcnow() + timedelta(minutes=5),
            "verified": False
        })
        logger.info("[OTP] Stored in MongoDB for %s", email)

        send_otp_email(email, otp)
        return {"message": "OTP sent"}

    except HTTPException:
        raise
    except RuntimeError as exc:
        logger.error("[RESEND-OTP] Runtime error: %s", exc)
        return JSONResponse(status_code=503, content={"message": "Email service is temporarily unavailable", "status": "unavailable"})
    except PyMongoError as exc:
        logger.exception("[RESEND-OTP] MongoDB error: %s", exc)
        raise HTTPException(status_code=503, detail="Database service is temporarily unavailable")
    except Exception as exc:
        logger.exception("[RESEND-OTP] Unexpected error: %s", exc)
        raise HTTPException(status_code=500, detail="Unable to process the request")


@app.post("/verify-otp")
def verify_otp(data: VerifyOTP):
    try:
        record = _otp_collection().find_one({"email": data.email, "verified": False})

        if not record:
            raise HTTPException(status_code=404, detail="OTP not found")

        if record["otp"] != data.otp:
            raise HTTPException(status_code=400, detail="Invalid OTP")

        if datetime.utcnow() > record["expiry"]:
            raise HTTPException(status_code=400, detail="OTP expired")

        _otp_collection().update_one(
            {"email": data.email},
            {"$set": {"verified": True}}
        )
        return {"message": "Email Verified Successfully"}

    except HTTPException:
        raise
    except PyMongoError as exc:
        logger.exception("[VERIFY-OTP] MongoDB error: %s", exc)
        raise HTTPException(status_code=503, detail="Database service is temporarily unavailable")


@app.post("/signup")
def signup(user: UserSignup):
    try:
        existing_user = _users_collection().find_one({"email": user.email})
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already exists")

        verified_record = _otp_collection().find_one({"email": user.email, "verified": True})
        if not verified_record:
            raise HTTPException(status_code=403, detail="Please verify your email first.")

        hashed_password = bcrypt.hashpw(
            user.password.encode("utf-8"),
            bcrypt.gensalt()
        )

        is_provider = user.role in {"Doctor", "Hospital"}
        now = datetime.utcnow()
        new_user = {
            "name": user.name,
            "username": user.username,
            "email": user.email,
            "password": hashed_password.decode("utf-8"),
            "role": user.role,
            "first_name": user.first_name or "",
            "last_name": user.last_name or "",
            "mobile": user.mobile or "",
            "gender": user.gender or "",
            "dob": user.dob or "",
            "age": user.age,
            "is_verified": True,
            "accountStatus": "active",
            "createdAt": now,
        }
        if is_provider:
            # Email verification and professional verification are separate.
            # A Doctor/Hospital can sign in after OTP, but clinical APIs remain
            # unavailable until a SuperAdmin approves this status.
            new_user["verificationStatus"] = "pending"

        inserted = _users_collection().insert_one(new_user)
        if is_provider:
            get_db()["provider_verifications"].insert_one(
                {
                    "userId": str(inserted.inserted_id),
                    "role": user.role,
                    "status": "pending",
                    "accountStatus": "active",
                    "details": {},
                    "documents": [],
                    "submittedAt": None,
                    "reviewedBy": None,
                    "reviewedAt": None,
                    "decisionReason": "",
                    "createdAt": now,
                    "updatedAt": now,
                }
            )
        _otp_collection().delete_many({"email": user.email})

        return {
            "message": "User registered successfully",
            "verificationStatus": "pending" if is_provider else None,
            "accountStatus": "active",
        }

    except HTTPException:
        raise
    except PyMongoError as exc:
        logger.exception("[SIGNUP] MongoDB error: %s", exc)
        raise HTTPException(status_code=503, detail="Database service is temporarily unavailable")


@app.post("/login")
def login(user: UserLogin):
    try:
        existing_user = _users_collection().find_one({"email": user.email})

        if not existing_user:
            raise HTTPException(status_code=404, detail="User not found")

        if not existing_user.get("is_verified", False):
            raise HTTPException(status_code=403, detail="Please verify your email first.")

        if not bcrypt.checkpw(
            user.password.encode("utf-8"),
            existing_user["password"].encode("utf-8")
        ):
            raise HTTPException(status_code=401, detail="Invalid password")

        user_role = existing_user.get("role", "Patient")
        account_status = str(existing_user.get("accountStatus") or "active").lower()
        if account_status == "disabled":
            raise HTTPException(status_code=403, detail="This account has been disabled. Contact EyeCare AI support.")

        token = create_access_token({
            "email": existing_user["email"],
            "role": user_role,
        })

        return {
            "message": "Login Successful",
            "access_token": token,
            "token_type": "bearer",
            "role": user_role,
            "verificationStatus": existing_user.get("verificationStatus", "verified" if user_role in {"Patient", "SuperAdmin"} else "pending"),
            "accountStatus": account_status,
        }

    except HTTPException:
        raise
    except PyMongoError as exc:
        logger.exception("[LOGIN] MongoDB error: %s", exc)
        raise HTTPException(status_code=503, detail="Database service is temporarily unavailable")


@app.get("/profile")
@app.get("/api/profile")
def profile(authorization: str = Header(...)):
    try:
        token = authorization.replace("Bearer ", "")
        payload = verify_token(token)

        user = _users_collection().find_one({"email": payload["email"]}, {"password": 0})

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if str(user.get("accountStatus") or "active").strip().lower() == "disabled":
            raise HTTPException(status_code=403, detail="This account has been disabled. Contact EyeCare AI support.")

        # Build profile response with all stored fields, never exposing password
        profile_data = {
            "_id": str(user["_id"]),
            "name": user.get("name", ""),
            "first_name": user.get("first_name", ""),
            "last_name": user.get("last_name", ""),
            "username": user.get("username", ""),
            "email": user.get("email", ""),
            "mobile": user.get("mobile", ""),
            "gender": user.get("gender", ""),
            "dob": user.get("dob", ""),
            "age": user.get("age"),
            "role": user.get("role", "Patient"),
            "is_verified": user.get("is_verified", False),
            "verificationStatus": user.get(
                "verificationStatus",
                "verified" if user.get("role") in {"Patient", "SuperAdmin"} else "pending",
            ),
            "accountStatus": user.get("accountStatus", "active"),
        }

        # Patient-owned profile fields live in patient_profiles rather than the
        # authentication document. Merge only these safe self-profile fields so
        # the existing /api/profile frontend contract can display/edit them.
        if user.get("role") == "Patient":
            patient_profile = get_db()["patient_profiles"].find_one(
                {"userId": str(user["_id"])},
                {"bloodGroup": 1, "address": 1, "emergencyContact": 1, "allergies": 1, "profileImage": 1},
            ) or {}
            profile_data.update(
                {
                    "bloodGroup": patient_profile.get("bloodGroup", ""),
                    "address": patient_profile.get("address", ""),
                    "emergencyContact": patient_profile.get("emergencyContact", ""),
                    "allergies": patient_profile.get("allergies", ""),
                    "profileImage": patient_profile.get("profileImage"),
                }
            )
        return profile_data

    except HTTPException:
        raise
    except PyMongoError as exc:
        logger.exception("[PROFILE] MongoDB error: %s", exc)
        raise HTTPException(status_code=503, detail="Database service is temporarily unavailable")


@app.put("/api/profile/role")
def update_profile_role(
    data: ProfileRoleUpdate,
    current_user: dict = Depends(get_current_user),
):
    # Role changes are intentionally not permitted through a self-service endpoint.
    # Signup is the authoritative role-selection flow; allowing arbitrary changes here
    # would let a Patient self-elevate to Doctor or Hospital.
    if data.role != current_user.get("role"):
        raise HTTPException(
            status_code=403,
            detail="Role changes are managed during signup and cannot be self-assigned after registration.",
        )
    return {"message": "Role unchanged", "role": current_user.get("role")}


# ==========================================
# Password Reset Endpoints
# ==========================================
@app.post("/password-reset/request-otp")
def request_password_reset_otp(data: PasswordResetRequest):
    email = data.email
    logger.info("[PWD-RESET] Request received for %s", email)
    try:
        user = _users_collection().find_one({"email": email})
        if not user:
            raise HTTPException(status_code=404, detail="Email not registered")
            
        otp = str(random.randint(100000, 999999))
        _otp_collection().delete_many({"email": email})
        _otp_collection().insert_one({
            "email": email,
            "otp": otp,
            "expiry": datetime.utcnow() + timedelta(minutes=5),
            "verified": False
        })
        
        send_otp_email(email, otp)
        return {"message": "Password reset OTP sent"}
    except HTTPException:
        raise
    except RuntimeError as exc:
        logger.error("[PWD-RESET] Runtime error: %s", exc)
        return JSONResponse(status_code=503, content={"message": "Email service is temporarily unavailable", "status": "unavailable"})
    except PyMongoError as exc:
        logger.exception("[PWD-RESET] MongoDB error: %s", exc)
        raise HTTPException(status_code=503, detail="Database service is temporarily unavailable")


@app.post("/password-reset/verify-otp")
def verify_password_reset_otp(data: PasswordResetVerify):
    try:
        record = _otp_collection().find_one({"email": data.email, "verified": False})
        if not record:
            raise HTTPException(status_code=404, detail="OTP not found or already verified")
            
        if record["otp"] != data.otp:
            raise HTTPException(status_code=400, detail="Invalid OTP")
            
        if datetime.utcnow() > record["expiry"]:
            raise HTTPException(status_code=400, detail="OTP expired")
            
        _otp_collection().update_one(
            {"email": data.email},
            {"$set": {"verified": True}}
        )
        return {"message": "OTP Verified Successfully"}
    except HTTPException:
        raise
    except PyMongoError as exc:
        logger.exception("[PWD-RESET-VERIFY] MongoDB error: %s", exc)
        raise HTTPException(status_code=503, detail="Database service is temporarily unavailable")


@app.post("/password-reset/reset")
def reset_password(data: PasswordReset):
    try:
        verified_record = _otp_collection().find_one({"email": data.email, "verified": True})
        if not verified_record:
            raise HTTPException(status_code=403, detail="OTP not verified")
            
        if len(data.new_password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
            
        hashed_password = bcrypt.hashpw(
            data.new_password.encode("utf-8"),
            bcrypt.gensalt()
        )
        
        result = _users_collection().update_one(
            {"email": data.email},
            {"$set": {"password": hashed_password.decode("utf-8")}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
            
        _otp_collection().delete_many({"email": data.email})
        
        return {"message": "Password updated successfully"}
    except HTTPException:
        raise
    except PyMongoError as exc:
        logger.exception("[PWD-RESET] MongoDB error: %s", exc)
        raise HTTPException(status_code=503, detail="Database service is temporarily unavailable")


# ==========================================
# Diagnostic / Testing Endpoints
# ==========================================
def _require_diagnostic_mode() -> None:
    if not config.ENABLE_DIAGNOSTIC_ENDPOINTS:
        # Hide diagnostics completely in production instead of advertising that
        # a test endpoint exists.
        raise HTTPException(status_code=404, detail="Not found")


class TestEmail(BaseModel):
    to: str


@app.post("/test-email")
def test_email(data: TestEmail):
    """Diagnostic endpoint — local/dev only."""
    _require_diagnostic_mode()
    load_dotenv(dotenv_path=_DOTENV_PATH, override=True)

    sender_email = (os.getenv("SMTP_USER") or getattr(config, "SMTP_USER", "")).strip()
    sender_password = (os.getenv("SMTP_PASSWORD") or getattr(config, "SMTP_PASSWORD", "")).strip()
    smtp_host = (os.getenv("SMTP_HOST") or getattr(config, "SMTP_HOST", "smtp.gmail.com")).strip()
    smtp_port = int(os.getenv("SMTP_PORT") or getattr(config, "SMTP_PORT", 587))

    logger.info("[TEST-EMAIL] SMTP_USER: %s", sender_email)
    logger.info("[TEST-EMAIL] SMTP_PASSWORD set: %s | length: %d", bool(sender_password), len(sender_password))

    if not sender_email or not sender_password:
        raise HTTPException(status_code=500, detail="SMTP_USER or SMTP_PASSWORD not set in .env")

    try:
        msg = MIMEMultipart()
        msg["From"] = sender_email
        msg["To"] = data.to
        msg["Subject"] = "DR Healthcare - SMTP Diagnostic Test"
        msg.attach(MIMEText(
            f"<h2>SMTP Test</h2><p>This is a diagnostic test from DR Healthcare backend.</p>"
            f"<p>Sender: {sender_email}</p><p>If you received this, SMTP is working correctly.</p>",
            "html"
        ))

        logger.info("[TEST-EMAIL] Connecting to %s:%s ...", smtp_host, smtp_port)
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
            server.starttls()
            logger.info("[TEST-EMAIL] Logging in ...")
            server.login(sender_email, sender_password)
            logger.info("[TEST-EMAIL] Login successful.")
            server.sendmail(sender_email, data.to, msg.as_string())

        logger.info("[TEST-EMAIL] Email delivered to %s", data.to)
        return {"status": "success", "message": f"Test email sent to {data.to}", "sender": sender_email}

    except Exception as e:
        logger.exception("[TEST-EMAIL] FAILED: %s", e)
        raise HTTPException(status_code=500, detail="Diagnostic email test failed")


@app.post("/test-gmail")
def test_gmail(data: TestEmail):
    """Diagnostic endpoint — local/dev only."""
    _require_diagnostic_mode()
    from gmail_service import send_email_gmail, is_gmail_api_available

    if not is_gmail_api_available():
        raise HTTPException(
            status_code=503,
            detail="Gmail API is not available. Run 'python gmail_auth.py' to authorize first.",
        )

    subject = "DR Healthcare — Gmail API Test"
    plain_text = (
        "Gmail API Test\n\n"
        "This is a diagnostic test from DR Healthcare backend.\n"
        "If you received this, Gmail API is working correctly."
    )
    html_content = (
        "<h2>Gmail API Test</h2>"
        "<p>This is a diagnostic test from DR Healthcare backend.</p>"
        "<p>If you received this, <strong>Gmail API</strong> is working correctly.</p>"
    )

    success = send_email_gmail(
        to_email=data.to,
        subject=subject,
        plain_text=plain_text,
        html_content=html_content,
    )

    if success:
        return {"status": "success", "message": f"Gmail API test email sent to {data.to}"}

    raise HTTPException(
        status_code=500,
        detail="Gmail API failed to send the test email. Check server logs for details.",
    )


@app.get("/network-test")
def network_test():
    _require_diagnostic_mode()
    results = {}

    # DNS resolution test
    try:
        ip_addresses = socket.getaddrinfo("smtp.gmail.com", None, socket.AF_UNSPEC, socket.SOCK_STREAM)
        resolved_ips = list({addr[4][0] for addr in ip_addresses})
        results["dns"] = {"status": "resolved", "ips": resolved_ips}
    except Exception as e:
        results["dns"] = {"status": "failed", "error": str(e)}

    # Port connectivity tests
    for port in [587, 465]:
        try:
            socket.create_connection(("smtp.gmail.com", port), timeout=10)
            results[str(port)] = "connected"
        except Exception as e:
            results[str(port)] = {"status": "failed", "type": type(e).__name__, "error": str(e)}

    return results
