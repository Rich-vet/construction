"""Safe file upload helpers."""

from __future__ import annotations

import uuid
from pathlib import Path

from flask import current_app
from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename

ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
ALLOWED_IMAGE_MIMES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
}


class UploadError(Exception):
    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


def _extension(filename: str) -> str:
    if "." not in filename:
        return ""
    return filename.rsplit(".", 1)[1].lower()


def save_company_logo(file: FileStorage) -> str:
    """Validate and store a company logo; return relative path under uploads."""
    if file is None or not file.filename:
        raise UploadError("Please choose a logo file.")

    ext = _extension(file.filename)
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise UploadError("Logo must be a PNG, JPG, or WEBP image.")

    mime = (file.mimetype or "").lower()
    if mime and mime not in ALLOWED_IMAGE_MIMES:
        raise UploadError("Logo file type is not allowed.")

    file.stream.seek(0, 2)
    size = file.stream.tell()
    file.stream.seek(0)
    max_bytes = current_app.config["MAX_CONTENT_LENGTH"]
    if size > max_bytes:
        raise UploadError("Logo file is too large.")

    safe_name = f"{uuid.uuid4().hex}.{ext}"
    folder = Path(current_app.config["UPLOAD_FOLDER"]) / "logos"
    folder.mkdir(parents=True, exist_ok=True)
    destination = folder / safe_name
    # Discard original filename besides extension.
    _ = secure_filename(file.filename)
    file.save(destination)
    return f"logos/{safe_name}"


ALLOWED_DOCUMENT_EXTENSIONS = {
    "png",
    "jpg",
    "jpeg",
    "webp",
    "pdf",
    "doc",
    "docx",
    "xls",
    "xlsx",
    "txt",
}
ALLOWED_DOCUMENT_MIMES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
}


def save_project_document(file: FileStorage) -> tuple[str, str | None, str | None]:
    """Validate and store a project document/photo; return (relative_path, original, mime)."""
    if file is None or not file.filename:
        raise UploadError("Please choose a file to upload.")

    ext = _extension(file.filename)
    if ext not in ALLOWED_DOCUMENT_EXTENSIONS:
        raise UploadError("File type is not allowed. Use images, PDF, or Office documents.")

    mime = (file.mimetype or "").lower() or None
    # Trust the extension as primary; reject only clearly mismatched known types.
    if mime in {"application/javascript", "text/html", "application/x-msdownload"}:
        raise UploadError("File type is not allowed.")

    file.stream.seek(0, 2)
    size = file.stream.tell()
    file.stream.seek(0)
    max_bytes = current_app.config["MAX_CONTENT_LENGTH"]
    if size > max_bytes:
        raise UploadError("File is too large.")

    original = secure_filename(file.filename) or f"upload.{ext}"
    safe_name = f"{uuid.uuid4().hex}.{ext}"
    folder = Path(current_app.config["UPLOAD_FOLDER"]) / "documents"
    folder.mkdir(parents=True, exist_ok=True)
    file.save(folder / safe_name)
    return f"documents/{safe_name}", original, mime
