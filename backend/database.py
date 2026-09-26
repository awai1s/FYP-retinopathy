import logging
import os
from typing import Optional

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.database import Database
from pymongo.errors import PyMongoError, ServerSelectionTimeoutError

import config

# Load environment variables as dynamic fallback
load_dotenv()

logger = logging.getLogger(__name__)

# Config & Environment Fallbacks
MONGODB_URL = getattr(config, "MONGODB_URL", None) or os.getenv("MONGODB_URL")
DATABASE_NAME = getattr(config, "DATABASE_NAME", None) or os.getenv("DATABASE_NAME")

# Global Client & Database Instance
client: Optional[MongoClient] = None
db: Optional[Database] = None


def _bootstrap_provider_verifications(db_instance: Database) -> None:
    """Create Phase 10C verification shells for legacy Doctor/Hospital users.

    This migration never auto-verifies an existing provider.  Accounts that
    predate Phase 10C become pending + active so they can sign in, complete the
    verification form, and remain blocked from clinical APIs until approved.
    """
    now = __import__("datetime").datetime.utcnow()
    for user in db_instance["users"].find(
        {"role": {"$in": ["Doctor", "Hospital"]}},
        {"role": 1, "verificationStatus": 1, "accountStatus": 1},
    ):
        user_id = str(user["_id"])
        status = str(user.get("verificationStatus") or "pending").lower()
        if status not in {"pending", "under_review", "needs_changes", "verified", "rejected"}:
            status = "pending"
        account_status = str(user.get("accountStatus") or "active").lower()
        if account_status not in {"active", "suspended", "disabled"}:
            account_status = "active"

        db_instance["users"].update_one(
            {"_id": user["_id"]},
            {"$set": {"verificationStatus": status, "accountStatus": account_status}},
        )

        existing = db_instance["provider_verifications"].find_one(
            {"userId": {"$in": [user_id, user["_id"]]}},
            sort=[("updatedAt", -1)],
        )
        if existing:
            # Mirror the canonical verification record back to the user document.
            canonical_status = str(existing.get("status") or status).lower()
            canonical_account = str(existing.get("accountStatus") or account_status).lower()
            db_instance["users"].update_one(
                {"_id": user["_id"]},
                {"$set": {"verificationStatus": canonical_status, "accountStatus": canonical_account}},
            )
            continue

        db_instance["provider_verifications"].insert_one(
            {
                "userId": user_id,
                "role": user["role"],
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
        )


def _setup_indexes(db_instance: Database) -> None:
    """Creates database indexes for optimized query performance."""
    try:
        # Core Users
        db_instance["users"].create_index([("email", 1)], unique=True)
        db_instance["users"].create_index([("username", 1)])
        db_instance["users"].create_index([("mobile", 1)])

        # Reports & Prescriptions
        db_instance["reports"].create_index([("patientId", 1)])
        db_instance["reports"].create_index([("hospitalId", 1)])
        db_instance["reports"].create_index([("uploadedByUserId", 1)])
        db_instance["reports"].create_index(
            [("patientId", 1), ("predictionId", 1), ("reportKind", 1), ("language", 1), ("created_at", -1)]
        )
        db_instance["reports"].create_index([("reportNumber", 1)], unique=True, sparse=True)

        # Appointments and notifications
        db_instance["appointments"].create_index([("patientId", 1)])
        db_instance["appointments"].create_index([("doctorId", 1)])
        db_instance["appointments"].create_index([("status", 1)])
        db_instance["appointments"].create_index([("date", 1), ("time", 1)])
        db_instance["notifications"].create_index([("userId", 1), ("read", 1)])
        db_instance["notifications"].create_index([("createdAt", -1)])
        db_instance["notifications"].create_index([("userId", 1), ("type", 1), ("privacyEventKey", 1), ("createdAt", -1)])

        db_instance["prescriptions"].create_index([("patientId", 1)])
        db_instance["prescriptions"].create_index([("doctorId", 1)])
        db_instance["prescriptions"].create_index(
            [("patientId", 1), ("source", 1), ("active", 1)]
        )
        db_instance["prescriptions"].create_index(
            [("patientId", 1), ("endDate", 1)]
        )

        db_instance["predictions"].create_index([("patientId", 1)])
        # Phase 7 screening lifecycle: efficient patient timelines and future
        # model-worker pickup of queued Pending/Processing predictions.
        db_instance["predictions"].create_index(
            [("patientId", 1), ("created_at", -1)]
        )
        db_instance["predictions"].create_index(
            [("status", 1), ("created_at", 1)]
        )

        # Phase 1/2 longitudinal patient data
        db_instance["health_metrics"].create_index(
            [("patientId", 1), ("recordedAt", -1)]
        )
        adherence = db_instance["medication_adherence"]

        # Phase 1 allowed only one adherence record per prescription/day.
        # Phase 2 tracks individual doses (Morning/Noon/Evening/Night), so
        # migrate the old index safely without deleting any adherence history.
        for index_name, index_info in adherence.index_information().items():
            keys = index_info.get("key", [])
            if keys == [
                ("patientId", 1),
                ("prescriptionId", 1),
                ("scheduledDate", 1),
            ] and index_info.get("unique"):
                adherence.drop_index(index_name)
                logger.info(
                    "[MONGODB] Removed legacy one-dose medication adherence index"
                )

        adherence.update_many(
            {"doseKey": {"$exists": False}},
            {
                "$set": {
                    "doseKey": "Daily",
                    "scheduledTime": "Any time today",
                }
            },
        )

        adherence.create_index(
            [("patientId", 1), ("scheduledDate", -1)]
        )
        adherence.create_index(
            [("patientId", 1), ("status", 1), ("scheduledDate", -1)]
        )
        adherence.create_index(
            [
                ("patientId", 1),
                ("prescriptionId", 1),
                ("scheduledDate", 1),
                ("doseKey", 1),
            ],
            unique=True,
        )

        # Profile Collections
        db_instance["patient_profiles"].create_index([("userId", 1)], unique=True)
        db_instance["patient_profiles"].create_index([("email", 1)])
        db_instance["patient_profiles"].create_index([("eyeCareId", 1)], unique=True, sparse=True)

        db_instance["doctor_profiles"].create_index([("userId", 1)], unique=True)
        db_instance["doctor_profiles"].create_index([("email", 1)])

        db_instance["hospital_profiles"].create_index([("userId", 1)], unique=True)
        db_instance["hospital_profiles"].create_index([("email", 1)])

        # Phase 10A: centralized clinical access / privacy foundation
        access_logs = db_instance["clinical_access_logs"]
        access_logs.create_index([("patientId", 1), ("createdAt", -1)])
        access_logs.create_index([("actorUserId", 1), ("createdAt", -1)])
        access_logs.create_index([("resourceType", 1), ("resourceId", 1)])
        access_logs.create_index([("patientId", 1), ("action", 1), ("createdAt", -1)])

        # Phase 10E: patient-owned Health Card settings and secure QR shares.
        db_instance["health_card_settings"].create_index([("patientId", 1)], unique=True)
        qr_tokens = db_instance["qr_share_tokens"]
        qr_tokens.create_index([("publicId", 1)], unique=True)
        qr_tokens.create_index([("tokenHash", 1)], unique=True)
        qr_tokens.create_index([("patientId", 1), ("createdAt", -1)])
        qr_tokens.create_index([("patientId", 1), ("type", 1), ("revoked", 1), ("expiresAt", -1)])

        # Phase 10D: formal Doctor <-> Patient care relationship.
        # `care_connections` is canonical. The older `connections` collection
        # remains indexed/readable only for migration compatibility.
        care_connections = db_instance["care_connections"]
        care_connections.create_index([("patientId", 1), ("providerId", 1)])
        care_connections.create_index([("status", 1), ("updatedAt", -1)])
        care_connections.create_index([("requestedByUserId", 1), ("status", 1)])
        pair_keys = [("patientId", 1), ("doctorId", 1)]
        existing_pair_index = any(
            spec.get("key") == pair_keys
            for spec in care_connections.index_information().values()
        )
        if not existing_pair_index:
            try:
                # New databases can enforce one official relationship per pair.
                care_connections.create_index(
                    pair_keys,
                    unique=True,
                    name="uniq_care_connection_pair",
                )
            except Exception as exc:
                # A database carrying duplicate legacy records can still start;
                # application-level conflict checks remain active.
                logger.warning("[MONGODB] Could not create unique care connection index: %s", exc)
                care_connections.create_index(pair_keys)

        legacy_connections = db_instance["connections"]
        legacy_connections.create_index([("patientId", 1), ("doctorId", 1)])
        legacy_connections.create_index([("patientId", 1), ("providerId", 1)])
        legacy_connections.create_index([("status", 1)])

        db_instance["users"].create_index(
            [("role", 1), ("verificationStatus", 1), ("accountStatus", 1), ("name", 1)]
        )

        db_instance["provider_verifications"].create_index([("userId", 1)])
        db_instance["provider_verifications"].create_index([("status", 1), ("updatedAt", -1)])
        db_instance["provider_verifications"].create_index([("role", 1), ("status", 1)])
        db_instance["provider_verifications"].create_index([("accountStatus", 1), ("updatedAt", -1)])
        db_instance["provider_verification_audit"].create_index([("timestamp", -1)])
        db_instance["provider_verification_audit"].create_index([("userId", 1), ("timestamp", -1)])
        db_instance["provider_verification_audit"].create_index([("verificationId", 1), ("timestamp", -1)])

        _bootstrap_provider_verifications(db_instance)

        # Phase 10N: Doctor Credential & Hospital Privilege Manager.
        affiliations = db_instance["hospital_doctor_affiliations"]
        try:
            affiliations.create_index(
                [("hospitalId", 1), ("doctorId", 1)],
                unique=True,
                name="uniq_hospital_doctor_affiliation",
            )
        except Exception as exc:
            logger.warning("[MONGODB] Could not create unique hospital-doctor affiliation index: %s", exc)
            affiliations.create_index([("hospitalId", 1), ("doctorId", 1)])
        affiliations.create_index([("hospitalId", 1), ("status", 1), ("updatedAt", -1)])
        affiliations.create_index([("doctorId", 1), ("status", 1), ("updatedAt", -1)])

        privileges = db_instance["doctor_privileges"]
        try:
            privileges.create_index(
                [("hospitalId", 1), ("doctorId", 1), ("privilege", 1)],
                unique=True,
                name="uniq_hospital_doctor_privilege",
            )
        except Exception as exc:
            logger.warning("[MONGODB] Could not create unique doctor privilege index: %s", exc)
            privileges.create_index([("hospitalId", 1), ("doctorId", 1), ("privilege", 1)])
        privileges.create_index([("hospitalId", 1), ("status", 1), ("expiresAt", 1)])
        privileges.create_index([("doctorId", 1), ("status", 1), ("expiresAt", 1)])

        db_instance["doctor_privilege_audit"].create_index(
            [("hospitalId", 1), ("doctorId", 1), ("createdAt", -1)]
        )
        db_instance["doctor_privilege_audit"].create_index(
            [("doctorId", 1), ("privilege", 1), ("createdAt", -1)]
        )
        db_instance["doctor_credential_audit"].create_index(
            [("doctorId", 1), ("createdAt", -1)]
        )
        db_instance["doctor_credential_audit"].create_index(
            [("reviewerId", 1), ("createdAt", -1)]
        )

        # Phase 10F: traceable clinical encounters / consultation cockpit
        encounters = db_instance["clinical_encounters"]
        try:
            encounters.create_index([("appointmentId", 1)], unique=True, name="uniq_encounter_appointment")
        except Exception as exc:
            logger.warning("[MONGODB] Could not create unique encounter appointment index: %s", exc)
            encounters.create_index([("appointmentId", 1)])
        encounters.create_index([("doctorId", 1), ("status", 1), ("updatedAt", -1)])
        encounters.create_index([("patientId", 1), ("status", 1), ("completedAt", -1)])
        encounters.create_index([("patientId", 1), ("completedAt", -1)])

        db_instance["clinical_encounter_addenda"].create_index([("encounterId", 1), ("createdAt", 1)])
        follow_ups = db_instance["clinical_follow_ups"]
        follow_up_index = follow_ups.index_information().get("encounterId_1")
        follow_up_filter = {"encounterId": {"$type": "string"}}
        if follow_up_index and follow_up_index.get("partialFilterExpression") != follow_up_filter:
            follow_ups.drop_index("encounterId_1")
        follow_ups.create_index([("encounterId", 1)], unique=True,
                                partialFilterExpression=follow_up_filter)
        db_instance["clinical_follow_ups"].create_index([("patientId", 1), ("status", 1), ("dueDate", 1)])
        db_instance["clinical_follow_ups"].create_index([("doctorId", 1), ("status", 1), ("dueDate", 1)])
        db_instance["education_assignments"].create_index([("encounterId", 1), ("topicKey", 1)], unique=True)
        db_instance["education_assignments"].create_index([("patientId", 1), ("status", 1), ("assignedAt", -1)])
        db_instance["patient_history"].create_index([("patientId", 1), ("sourceId", 1), ("type", 1)])
        # Phase 10H: private doctor case watchlist. A bookmark never grants
        # clinical access; live care-connection checks are performed when a doctor
        # opens the patient chart.
        watchlist = db_instance["doctor_watchlist"]
        try:
            watchlist.create_index(
                [("doctorId", 1), ("patientId", 1)],
                unique=True,
                name="uniq_doctor_watchlist_patient",
            )
        except Exception as exc:
            logger.warning("[MONGODB] Could not create unique doctor watchlist index: %s", exc)
            watchlist.create_index([("doctorId", 1), ("patientId", 1)])
        watchlist.create_index([("doctorId", 1), ("reviewDate", 1)])
        watchlist.create_index([("doctorId", 1), ("priority", 1), ("reviewDate", 1)])

        # Phase 10I: long-term glasses/contact-lens prescription vault.
        vision_rx = db_instance["vision_prescriptions"]
        vision_rx.create_index([("patientId", 1), ("type", 1), ("isCurrent", -1)])
        try:
            vision_rx.create_index(
                [("patientId", 1), ("type", 1)],
                unique=True,
                partialFilterExpression={"isCurrent": True},
                name="uniq_current_vision_prescription",
            )
        except PyMongoError as exc:
            # Do not prevent application startup if an early development DB has
            # duplicate current rows. The non-unique lookup index above remains.
            logger.warning("[MONGODB] Could not create current vision prescription uniqueness index: %s", exc)
        vision_rx.create_index([("patientId", 1), ("issuedDate", -1)])
        vision_rx.create_index([("patientId", 1), ("expiryDate", 1)])
        vision_rx.create_index([("attachment.fileId", 1)], sparse=True)

        # Phase 10M: Hospital Eye Equipment Lifecycle Manager.
        equipment = db_instance["eye_equipment"]
        try:
            equipment.create_index(
                [("hospitalId", 1), ("assetId", 1)],
                unique=True,
                name="uniq_hospital_equipment_asset",
            )
        except Exception as exc:
            logger.warning("[MONGODB] Could not create unique hospital equipment asset index: %s", exc)
            equipment.create_index([("hospitalId", 1), ("assetId", 1)])
        equipment.create_index([("hospitalId", 1), ("type", 1), ("status", 1)])
        equipment.create_index([("hospitalId", 1), ("nextService", 1)])
        equipment.create_index([("hospitalId", 1), ("nextCalibration", 1)])
        equipment.create_index([("hospitalId", 1), ("serialNumber", 1)], sparse=True)

        equipment_events = db_instance["equipment_events"]
        equipment_events.create_index([("hospitalId", 1), ("equipmentId", 1), ("eventDate", -1)])
        equipment_events.create_index([("hospitalId", 1), ("eventType", 1), ("createdAt", -1)])

        # Only equipment reminders have this key. A sparse compound index also
        # indexes ordinary notifications because userId and type are present.
        notifications = db_instance["notifications"]
        reminder_name = "uniq_equipment_reminder_key"
        reminder_filter = {"equipmentReminderKey": {"$type": "string"}}
        existing_reminder = notifications.index_information().get(reminder_name)
        if existing_reminder and existing_reminder.get("partialFilterExpression") != reminder_filter:
            notifications.drop_index(reminder_name)
        notifications.create_index(
            [("userId", 1), ("type", 1), ("equipmentReminderKey", 1)],
            unique=True,
            partialFilterExpression=reminder_filter,
            name=reminder_name,
        )

        # Phase 10G: medication reconciliation records preserve every medication decision
        reconciliations = db_instance["medication_reconciliations"]
        try:
            reconciliations.create_index([("encounterId", 1)], unique=True, name="uniq_med_reconciliation_encounter")
        except Exception as exc:
            logger.warning("[MONGODB] Could not create unique medication reconciliation index: %s", exc)
            reconciliations.create_index([("encounterId", 1)])
        reconciliations.create_index([("patientId", 1), ("performedAt", -1)])
        reconciliations.create_index([("doctorId", 1), ("performedAt", -1)])
        reconciliations.create_index([("status", 1), ("updatedAt", -1)])
        # Sparse action IDs make retried client actions idempotent without forcing old rows to migrate.
        reconciliations.create_index([("actions.actionId", 1)], sparse=True)


        # AI Assistant / RAG sessions
        db_instance["ai_assistant_sessions"].create_index(
            [("ownerUserId", 1), ("status", 1), ("updatedAt", -1)]
        )
        db_instance["ai_assistant_sessions"].create_index(
            [("ownerUserId", 1), ("patientId", 1), ("contextScope", 1), ("status", 1)]
        )
        db_instance["ai_assistant_messages"].create_index(
            [("sessionId", 1), ("createdAt", 1)]
        )

        # Activity History
        db_instance["patient_history"].create_index([("patientId", 1)])
        db_instance["patient_history"].create_index([("type", 1)])

        logger.info("[MONGODB] Indexes initialized successfully")
    except Exception as e:
        logger.error(f"[MONGODB] Failed to create indexes: {e}")


def init_db() -> Database:
    """Initializes the MongoDB client, verifies connection, and sets up indexes."""
    global client, db

    url = getattr(config, "MONGODB_URL", None) or MONGODB_URL
    db_name = getattr(config, "DATABASE_NAME", None) or DATABASE_NAME

    if not url:
        raise RuntimeError("MONGODB_URL is not configured in environment or config module.")

    logger.info("[MONGODB] Connecting to database '%s' ...", db_name)

    try:
        client = MongoClient(
            url,
            serverSelectionTimeoutMS=10000,
            connectTimeoutMS=10000,
            socketTimeoutMS=10000,
        )
        # Verify connection
        client.admin.command("ping")
        db = client[db_name]
        
        _setup_indexes(db)
        logger.info("[MONGODB] Connected successfully to database '%s'", db_name)
        return db

    except ServerSelectionTimeoutError as exc:
        logger.exception("[MONGODB] Connection timeout: %s", exc)
        raise RuntimeError(
            "Failed to connect to MongoDB. Check MONGODB_URL and Atlas IP whitelist (allow 0.0.0.0/0 for Railway/cloud deployments)."
        ) from exc
    except PyMongoError as exc:
        logger.exception("[MONGODB] Connection failed: %s", exc)
        raise RuntimeError(f"Failed to connect to MongoDB: {exc}") from exc


def get_db() -> Database:
    global db
    if db is None:
        init_db()
    return db


def check_db_connection() -> dict:
    """Health check helper to verify database connection status."""
    if client is None or db is None:
        return {"connected": False, "error": "Database client not initialized"}

    try:
        client.admin.command("ping")
        return {"connected": True, "database": db.name}
    except PyMongoError as exc:
        logger.exception("[MONGODB] Health check failed: %s", exc)
        return {"connected": False, "error": str(exc)}
