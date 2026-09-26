"""RAG/voice endpoints for the EyeCare AI assistant."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from access_control import (
    list_authorized_patient_ids,
    record_clinical_access,
    require_patient_access,
    require_verified_provider,
)
from database import get_db
from dependencies import get_current_user
from rag_service import build_patient_context, detect_language, generate_rag_answer, transcribe_audio


router = APIRouter(prefix="/api/ai-assistant", tags=["AI Assistant"])


class CreateSessionPayload(BaseModel):
    patientId: Optional[str] = None


class SendMessagePayload(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    language: Optional[str] = None


def _require_provider_verification_if_needed(db, current_user: dict) -> None:
    if str(current_user.get("role") or "Patient") in {"Doctor", "Hospital"}:
        require_verified_provider(current_user, db)



def _id_variants(value: Any) -> list[Any]:
    text = str(value or "")
    result: list[Any] = [text]
    if ObjectId.is_valid(text):
        result.append(ObjectId(text))
    return result


def _serialize_datetime(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _serialize_session(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(doc.get("_id")),
        "ownerUserId": str(doc.get("ownerUserId") or ""),
        "ownerRole": str(doc.get("ownerRole") or "Patient"),
        "patientId": str(doc.get("patientId")) if doc.get("patientId") else None,
        "contextScope": str(doc.get("contextScope") or "basic_role"),
        "status": str(doc.get("status") or "active"),
        "createdAt": _serialize_datetime(doc.get("createdAt")),
        "updatedAt": _serialize_datetime(doc.get("updatedAt")),
    }


def _serialize_message(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(doc.get("_id")),
        "sessionId": str(doc.get("sessionId") or ""),
        "role": str(doc.get("role") or "assistant"),
        "content": str(doc.get("content") or ""),
        "language": str(doc.get("language") or detect_language(str(doc.get("content") or ""))),
        "mode": doc.get("mode"),
        "sources": list(doc.get("sources") or []),
        "createdAt": _serialize_datetime(doc.get("createdAt")) or datetime.utcnow().isoformat(),
    }


def _get_owned_session(db, session_id: str, user_id: str) -> dict[str, Any]:
    if not ObjectId.is_valid(session_id):
        raise HTTPException(status_code=400, detail="Invalid assistant session ID")

    session = db["ai_assistant_sessions"].find_one(
        {
            "_id": ObjectId(session_id),
            "ownerUserId": {"$in": _id_variants(user_id)},
            "status": "active",
        }
    )
    if not session:
        raise HTTPException(status_code=404, detail="AI Assistant session not found")
    return session


def _authorized_patient_ids(db, current_user: dict[str, Any]) -> set[str]:
    """Use the centralized Phase 10A authorization relationship."""
    return list_authorized_patient_ids(current_user, db)


def _validate_context_patient(
    db,
    current_user: dict[str, Any],
    patient_id: Optional[str],
) -> tuple[Optional[str], str]:
    role = str(current_user.get("role") or "Patient")
    owner_id = str(current_user["_id"])

    if role == "Patient":
        if patient_id and str(patient_id) != owner_id:
            raise HTTPException(status_code=403, detail="Patients can only use their own health context")
        return owner_id, "self"

    if not patient_id:
        return None, "basic_role"

    patient_id = str(patient_id)
    require_patient_access(
        current_user=current_user,
        patient_id=patient_id,
        scope="ai.patient_context.read",
        db=db,
    )
    return patient_id, "authorized_patient"


def _patient_display(db, patient_id: str) -> Optional[dict[str, Any]]:
    query_values = _id_variants(patient_id)
    user = db["users"].find_one({"_id": {"$in": query_values}})
    if not user:
        return None
    if str(user.get("role") or "Patient") != "Patient":
        return None
    return {
        "id": str(user["_id"]),
        "name": str(user.get("name") or user.get("username") or "Patient"),
        "username": user.get("username"),
    }


@router.get("/health")
def assistant_health():
    import os

    llm_ready = bool(
        (os.getenv("RAG_LLM_API_KEY") or "").strip()
        and (os.getenv("RAG_LLM_BASE_URL") or "").strip()
        and (os.getenv("RAG_LLM_MODEL") or "").strip()
    )
    stt_ready = bool(
        (os.getenv("RAG_STT_API_KEY") or os.getenv("OPENAI_API_KEY") or "").strip()
    )
    return {
        "status": "ok",
        "rag": True,
        "languages": ["en", "ur"],
        "answerMode": "rag_llm" if llm_ready else "rag_extract",
        "nativeVoiceTranscriptionConfigured": stt_ready,
        "webVoiceRecognition": "browser",
    }


@router.get("/context-options")
def context_options(current_user: dict = Depends(get_current_user)):
    db = get_db()
    _require_provider_verification_if_needed(db, current_user)
    role = str(current_user.get("role") or "Patient")
    scopes = ["self"] if role == "Patient" else ["basic_role", "authorized_patient"]
    return {
        "role": role,
        "availableScopes": scopes,
        "patientContextEnabled": True,
        "languages": ["en", "ur"],
        "message": (
            "The assistant retrieves trusted bilingual eye-health knowledge. "
            "Patient context is used only when the logged-in account is authorized."
        ),
    }


@router.get("/authorized-patients")
def authorized_patients(current_user: dict = Depends(get_current_user)):
    db = get_db()
    _require_provider_verification_if_needed(db, current_user)
    ids = _authorized_patient_ids(db, current_user)
    patients = []
    for patient_id in sorted(ids):
        patient = _patient_display(db, patient_id)
        if patient:
            patients.append(patient)
    patients.sort(key=lambda item: item["name"].lower())
    return {"patients": patients}


@router.get("/sessions")
def list_sessions(current_user: dict = Depends(get_current_user)):
    db = get_db()
    _require_provider_verification_if_needed(db, current_user)
    docs = list(
        db["ai_assistant_sessions"].find(
            {
                "ownerUserId": {"$in": _id_variants(current_user["_id"])},
                "status": "active",
            }
        ).sort("updatedAt", -1).limit(30)
    )
    return {"sessions": [_serialize_session(doc) for doc in docs]}


@router.post("/sessions")
def create_session(
    payload: CreateSessionPayload,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    _require_provider_verification_if_needed(db, current_user)
    owner_id = str(current_user["_id"])
    patient_id, scope = _validate_context_patient(db, current_user, payload.patientId)

    query: dict[str, Any] = {
        "ownerUserId": {"$in": _id_variants(owner_id)},
        "status": "active",
        "contextScope": scope,
    }
    if patient_id:
        query["patientId"] = {"$in": _id_variants(patient_id)}
    else:
        query["patientId"] = None

    existing = db["ai_assistant_sessions"].find_one(query, sort=[("updatedAt", -1)])
    if existing:
        return _serialize_session(existing)

    now = datetime.utcnow()
    doc = {
        "ownerUserId": owner_id,
        "ownerRole": str(current_user.get("role") or "Patient"),
        "patientId": patient_id,
        "contextScope": scope,
        "status": "active",
        "createdAt": now,
        "updatedAt": now,
    }
    inserted = db["ai_assistant_sessions"].insert_one(doc)
    doc["_id"] = inserted.inserted_id
    return _serialize_session(doc)


@router.get("/sessions/{session_id}/messages")
def get_messages(
    session_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    _require_provider_verification_if_needed(db, current_user)
    session = _get_owned_session(db, session_id, str(current_user["_id"]))
    docs = list(
        db["ai_assistant_messages"].find(
            {"sessionId": session_id}
        ).sort("createdAt", 1).limit(200)
    )
    return {
        "session": _serialize_session(session),
        "messages": [_serialize_message(doc) for doc in docs],
    }


@router.post("/sessions/{session_id}/messages")
def send_message(
    session_id: str,
    payload: SendMessagePayload,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    _require_provider_verification_if_needed(db, current_user)
    owner_id = str(current_user["_id"])
    session = _get_owned_session(db, session_id, owner_id)

    content = payload.message.strip()
    language = detect_language(content, payload.language)
    now = datetime.utcnow()

    user_doc = {
        "sessionId": session_id,
        "role": "user",
        "content": content,
        "language": language,
        "sources": [],
        "createdAt": now,
    }
    user_insert = db["ai_assistant_messages"].insert_one(user_doc)
    user_doc["_id"] = user_insert.inserted_id

    history_docs = list(
        db["ai_assistant_messages"].find(
            {
                "sessionId": session_id,
                "_id": {"$ne": user_insert.inserted_id},
            },
            {"role": 1, "content": 1, "createdAt": 1},
        ).sort("createdAt", -1).limit(8)
    )
    history = [
        {"role": str(doc.get("role")), "content": str(doc.get("content") or "")}
        for doc in reversed(history_docs)
        if doc.get("role") in {"user", "assistant"}
    ]

    patient_context = None
    patient_id = session.get("patientId")
    if patient_id:
        # Recheck authorization on every message. Relationships can change after
        # a session was created.
        validated_patient, _ = _validate_context_patient(
            db,
            current_user,
            str(patient_id),
        )
        if validated_patient:
            decision = require_patient_access(
                current_user=current_user,
                patient_id=validated_patient,
                scope="ai.patient_context.read",
                db=db,
            )
            patient_context = build_patient_context(db, validated_patient)
            if str(current_user.get("role") or "Patient") != "Patient":
                record_clinical_access(
                    current_user=current_user,
                    patient_id=validated_patient,
                    action="VIEW_AI_PATIENT_CONTEXT",
                    resource_type="ai_patient_context",
                    resource_id=session_id,
                    access_channel=decision.access_channel,
                    scope=decision.scope,
                    reason=decision.reason,
                    db=db,
                )

    result = generate_rag_answer(
        question=content,
        requested_language=language,
        patient_context=patient_context,
        conversation_history=history,
    )

    assistant_doc = {
        "sessionId": session_id,
        "role": "assistant",
        "content": result["answer"],
        "language": result["language"],
        "mode": result["mode"],
        "sources": result["sources"],
        "createdAt": datetime.utcnow(),
    }
    assistant_insert = db["ai_assistant_messages"].insert_one(assistant_doc)
    assistant_doc["_id"] = assistant_insert.inserted_id

    db["ai_assistant_sessions"].update_one(
        {"_id": session["_id"]},
        {
            "$set": {
                "updatedAt": datetime.utcnow(),
                "lastLanguage": result["language"],
            }
        },
    )

    return {
        "sessionId": session_id,
        "language": result["language"],
        "mode": result["mode"],
        "userMessage": _serialize_message(user_doc),
        "assistantMessage": _serialize_message(assistant_doc),
    }


@router.post("/transcribe")
async def transcribe_voice(
    language: str = Form("en"),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    _require_provider_verification_if_needed(db, current_user)
    normalized_language = "ur" if str(language).lower().startswith("ur") else "en"
    content_type = str(file.content_type or "").lower()
    if content_type and not content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="Please upload an audio recording")

    audio = await file.read()
    if not audio:
        raise HTTPException(status_code=400, detail="The voice recording is empty")
    if len(audio) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Voice recording is too large. Keep it under 15 MB.")

    try:
        result = transcribe_audio(
            audio_bytes=audio,
            filename=file.filename or "voice.m4a",
            content_type=content_type or "audio/m4a",
            requested_language=normalized_language,
        )
        return result
    except RuntimeError as exc:
        import logging
        logging.getLogger(__name__).warning("[AI ASSISTANT] Voice transcription unavailable: %s", exc)
        raise HTTPException(status_code=503, detail="Voice transcription is currently unavailable") from exc
