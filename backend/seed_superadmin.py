"""Secure one-time SuperAdmin bootstrap utility.

Run from backend/:
    python seed_superadmin.py --email admin@example.com --name "EyeCare Admin"

The password is requested through getpass so it is not exposed in shell history.
Normal /signup never accepts the SuperAdmin role.
"""

from __future__ import annotations

import argparse
import getpass
from datetime import datetime

import bcrypt

from database import get_db, init_db


def main() -> None:
    parser = argparse.ArgumentParser(description="Create or reset an EyeCare AI SuperAdmin")
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", default="EyeCare SuperAdmin")
    parser.add_argument("--username", default="superadmin")
    parser.add_argument("--reset-password", action="store_true")
    args = parser.parse_args()

    email = args.email.strip().lower()
    if "@" not in email:
        raise SystemExit("A valid email address is required")

    password = getpass.getpass("SuperAdmin password (minimum 12 characters): ")
    confirm = getpass.getpass("Confirm password: ")
    if password != confirm:
        raise SystemExit("Passwords do not match")
    if len(password) < 12:
        raise SystemExit("Use a password of at least 12 characters")

    init_db()
    db = get_db()
    existing = db["users"].find_one({"email": email})
    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    if existing:
        if existing.get("role") != "SuperAdmin":
            raise SystemExit("That email already belongs to a non-SuperAdmin account. Use a different email.")
        if not args.reset_password:
            raise SystemExit("SuperAdmin already exists. Re-run with --reset-password to rotate its password.")
        db["users"].update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "password": password_hash,
                    "name": args.name.strip() or existing.get("name") or "EyeCare SuperAdmin",
                    "username": args.username.strip() or existing.get("username") or "superadmin",
                    "accountStatus": "active",
                    "verificationStatus": "verified",
                    "is_verified": True,
                    "updatedAt": datetime.utcnow(),
                }
            },
        )
        print("SuperAdmin password rotated successfully.")
        return

    db["users"].insert_one(
        {
            "name": args.name.strip() or "EyeCare SuperAdmin",
            "username": args.username.strip() or "superadmin",
            "email": email,
            "password": password_hash,
            "role": "SuperAdmin",
            "first_name": "",
            "last_name": "",
            "mobile": "",
            "gender": "",
            "dob": "",
            "age": None,
            "is_verified": True,
            "verificationStatus": "verified",
            "accountStatus": "active",
            "createdAt": datetime.utcnow(),
        }
    )
    print("SuperAdmin created successfully.")


if __name__ == "__main__":
    main()
