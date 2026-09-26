"""Clinical access logging for EyeCare AI Phase 10A.

This service intentionally stores metadata about *access*, never copies of the
clinical content that was viewed. The resulting collection is the foundation
for the future patient Privacy & Access Center.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Optional

logger = logging.getLogger(__name__)


def _clean_text(value: Any, *, limit: int = 200) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    return text[:limit]




_NOTIFY_ACTIONS = {
    "VIEW_SCREENING": "viewed your retinal screening",
    "VIEW_RETINAL_IMAGE": "viewed a retinal image",
    "VIEW_REPORT": "viewed a medical report",
    "DOWNLOAD_REPORT": "downloaded a medical report",
    "VIEW_MEDICATION": "viewed your medication information",
    "CREATE_PRESCRIPTION": "created a prescription",
    "START_CONSULTATION": "started a consultation",
    "VIEW_CONSULTATION": "viewed a consultation",
    "QR_SCAN": "viewed your shared Health Card",
}


def _maybe_notify_patient(db, doc: dict[str, Any]) -> None:
    """Create a compact patient notification for meaningful privacy events.

    Repeated views of the same resource by the same actor are throttled for
    thirty minutes so normal clinical navigation does not flood the inbox.
    """

    action = str(doc.get("action") or "")
    phrase = _NOTIFY_ACTIONS.get(action)
    if not phrase:
        return

    actor_role = str(doc.get("actorRole") or "Unknown")
    actor_name = str(doc.get("actorName") or actor_role or "Someone")
    if actor_role == "Patient":
        return

    patient_id = str(doc.get("patientId") or "")
    if not patient_id:
        return

    resource_id = str(doc.get("resourceId") or "")
    key = f"{action}:{doc.get('actorUserId') or actor_role}:{resource_id}"[:300]
    cutoff = datetime.utcnow() - timedelta(minutes=30)
    existing = db["notifications"].find_one(
        {
            "userId": patient_id,
            "type": "privacy_access",
            "privacyEventKey": key,
            "createdAt": {"$gte": cutoff},
        },
        {"_id": 1},
    )
    if existing:
        return

    if action == "QR_SCAN":
        title = "Your Health Card was scanned"
        message = "A shared Health Card link was opened. Review Privacy & Access for details."
    else:
        title = "Clinical access activity"
        message = f"{actor_name} {phrase}."

    db["notifications"].insert_one(
        {
            "userId": patient_id,
            "title": title,
            "message": message[:500],
            "type": "privacy_access",
            "relatedId": resource_id or None,
            "privacyEventKey": key,
            "read": False,
            "createdAt": datetime.utcnow(),
        }
    )


def record_clinical_access(
    db,
    *,
    patient_id: Any,
    actor_user: Optional[dict[str, Any]] = None,
    actor_user_id: Any = None,
    actor_name: str = "",
    actor_role: str = "",
    action: str,
    resource_type: str,
    resource_id: Any = None,
    access_channel: str,
    scope: str = "",
    reason: str = "",
) -> Optional[str]:
    """Write one meaningful clinical-access event.

    The function is deliberately metadata-only. Callers must never pass report
    text, diagnoses, notes, medication names, images, or other clinical values in
    ``reason``. ``reason`` is intended for a short authorization/audit reason such
    as ``accepted_care_connection``.

    Logging is fail-open for application availability: an audit logging failure is
    written to the server log but does not expose data or crash the clinical API.
    """

    try:
        actor_user = actor_user or {}
        actor_id = actor_user_id if actor_user_id is not None else actor_user.get("_id")
        role = actor_role or str(actor_user.get("role") or "Unknown")
        name = actor_name or str(
            actor_user.get("name")
            or actor_user.get("username")
            or role
            or "Unknown"
        )

        doc = {
            "patientId": _clean_text(patient_id, limit=128),
            "actorUserId": _clean_text(actor_id, limit=128),
            "actorName": _clean_text(name, limit=160),
            "actorRole": _clean_text(role, limit=64),
            "action": _clean_text(action, limit=96),
            "resourceType": _clean_text(resource_type, limit=96),
            "resourceId": _clean_text(resource_id, limit=128),
            "accessChannel": _clean_text(access_channel, limit=96),
            "scope": _clean_text(scope, limit=128),
            "reason": _clean_text(reason, limit=200),
            "createdAt": datetime.utcnow(),
        }
        result = db["clinical_access_logs"].insert_one(doc)
        try:
            _maybe_notify_patient(db, doc)
        except Exception:
            logger.exception("[CLINICAL ACCESS] Failed to create privacy notification")
        return str(result.inserted_id)
    except Exception:
        logger.exception("[CLINICAL ACCESS] Failed to persist access event")
        return None
