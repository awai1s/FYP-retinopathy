"""GridFS storage with Phase 10A upload hardening."""

from __future__ import annotations

from pathlib import Path

from bson import ObjectId
from fastapi import HTTPException, UploadFile
from gridfs import GridFS, NoFile

import config
from database import get_db

ALLOWED_TYPES = {
    "image/jpeg": {".jpg", ".jpeg"},
    "image/jpg": {".jpg", ".jpeg"},
    "image/png": {".png"},
    "application/pdf": {".pdf"},
}
MAX_SIZE = config.UPLOAD_MAX_MB * 1024 * 1024


def get_fs():
    return GridFS(get_db())


def _looks_like_declared_type(content: bytes, content_type: str) -> bool:
    if content_type in {"image/jpeg", "image/jpg"}:
        return content.startswith(b"\xff\xd8\xff")
    if content_type == "image/png":
        return content.startswith(b"\x89PNG\r\n\x1a\n")
    if content_type == "application/pdf":
        return b"%PDF-" in content[:1024]
    return False


def upload_file_to_gridfs(file: UploadFile) -> str:
    content_type = str(file.content_type or "").strip().lower()
    filename = str(file.filename or "upload").strip()
    suffix = Path(filename).suffix.lower()

    allowed_extensions = ALLOWED_TYPES.get(content_type)
    if not allowed_extensions or suffix not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Allowed files: JPEG, PNG, and PDF",
        )

    content = file.file.read(MAX_SIZE + 1)
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    if len(content) > MAX_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File size exceeds the {config.UPLOAD_MAX_MB} MB limit",
        )
    if not _looks_like_declared_type(content, content_type):
        raise HTTPException(status_code=400, detail="Uploaded file content does not match its declared type")

    fs = get_fs()
    file_id = fs.put(content, filename=filename, content_type=content_type)
    return str(file_id)


def get_file_from_gridfs(file_id: str):
    """Retrieve a GridFS stream; route-level authorization must happen first."""
    if not ObjectId.is_valid(file_id):
        raise HTTPException(status_code=400, detail="Invalid file ID format")

    fs = get_fs()
    try:
        grid_out = fs.get(ObjectId(file_id))
        filename = getattr(grid_out, "filename", "downloaded_file")
        content_type = getattr(grid_out, "content_type", "application/octet-stream")
        return grid_out, filename, content_type
    except NoFile:
        raise HTTPException(status_code=404, detail="File not found in storage")
