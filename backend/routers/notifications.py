from datetime import datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from database import get_db
from dependencies import get_current_user
from equipment_service import refresh_equipment_due_notifications

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


def _serialize_notification(doc: dict) -> dict:
    created_at = doc.get("createdAt", datetime.utcnow())
    return {
        "id": str(doc["_id"]),
        "notificationId": str(doc["_id"]),
        "title": doc.get("title", "Notification"),
        "message": doc.get("message", ""),
        "type": doc.get("type", "screening"),
        "read": bool(doc.get("read", False)),
        "createdAt": created_at.isoformat() if isinstance(created_at, datetime) else str(created_at),
        "relatedId": doc.get("relatedId"),
    }


@router.get("")
def get_notifications(current_user: dict = Depends(get_current_user)):
    db = get_db()
    # Phase 10M: due reminders are generated idempotently when a Hospital
    # checks notifications. This needs no background worker and never duplicates
    # the same service/calibration window.
    if current_user.get("role") == "Hospital":
        refresh_equipment_due_notifications(db, current_user)
    docs = db["notifications"].find({"userId": current_user["_id"]}).sort("createdAt", -1)
    return {"notifications": [_serialize_notification(doc) for doc in docs]}


@router.patch("/{notification_id}/read")
def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(notification_id):
        raise HTTPException(status_code=400, detail="Invalid notification ID format")

    db = get_db()
    object_id = ObjectId(notification_id)
    result = db["notifications"].update_one(
        {"_id": object_id, "userId": current_user["_id"]},
        {"$set": {"read": True}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification = db["notifications"].find_one({"_id": object_id})
    return _serialize_notification(notification)


@router.patch("/read-all")
def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    db = get_db()
    result = db["notifications"].update_many(
        {"userId": current_user["_id"], "read": {"$ne": True}},
        {"$set": {"read": True}},
    )
    return {"message": "Notifications marked as read", "updated": result.modified_count}
