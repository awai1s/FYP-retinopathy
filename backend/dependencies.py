from fastapi import Depends, Header, HTTPException

from auth import verify_token
from database import get_db


def get_current_user_token(authorization: str | None = Header(default=None, alias="Authorization")):
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")

    scheme, separator, token = authorization.strip().partition(" ")
    if not separator or scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    payload = verify_token(token.strip())
    if not isinstance(payload, dict) or not payload.get("email"):
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return payload


def get_current_user(payload: dict = Depends(get_current_user_token)):
    db = get_db()
    user = db["users"].find_one({"email": payload["email"]}, {"password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if str(user.get("accountStatus") or "active").strip().lower() == "disabled":
        raise HTTPException(status_code=403, detail="This account has been disabled. Contact EyeCare AI support.")

    # Backward compatibility for accounts created before roles were persisted.
    if "role" not in user:
        db["users"].update_one({"email": payload["email"]}, {"$set": {"role": "Patient"}})
        user["role"] = "Patient"

    user["_id"] = str(user["_id"])
    return user


class RoleChecker:
    def __init__(self, allowed_roles):
        self.allowed_roles = tuple(allowed_roles)

    def __call__(self, user: dict = Depends(get_current_user)):
        if user.get("role") not in self.allowed_roles:
            raise HTTPException(status_code=403, detail="Access denied for this account role")
        return user


class VerifiedProviderChecker:
    """FastAPI dependency enforcing Phase 10C provider verification."""

    def __call__(self, user: dict = Depends(get_current_user)):
        from access_control import require_verified_provider

        return require_verified_provider(user, get_db())
