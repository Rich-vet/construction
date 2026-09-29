"""Safe file upload helpers."""

from __future__ import annotations

import re
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

# Declared Content-Type must match extension (octet-stream / zip allowed for Office).
EXT_TO_MIMES: dict[str, set[str]] = {
    "png": {"image/png"},
    "jpg": {"image/jpeg", "image/jpg"},
    "jpeg": {"image/jpeg", "image/jpg"},
    "webp": {"image/webp"},
    "pdf": {"application/pdf"},
    "doc": {"application/msword", "application/octet-stream"},
    "docx": {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/octet-stream",
        "application/zip",
    },
    "xls": {"application/vnd.ms-excel", "application/octet-stream"},
    "xlsx": {
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/octet-stream",
        "application/zip",
    },
    "txt": {"text/plain", "application/octet-stream"},
}

BLOCKED_MIMES = {
    "application/javascript",
    "text/html",
    "text/javascript",
    "application/x-msdownload",
    "application/x-executable",
    "application/x-dosexec",
    "application/xhtml+xml",
}

MAGIC_PREFIXES: dict[str, tuple[bytes, ...]] = {
    "png": (b"\x89PNG\r\n\x1a\n",),
    "jpg": (b"\xff\xd8\xff",),
    "jpeg": (b"\xff\xd8\xff",),
    "pdf": (b"%PDF",),
}


class UploadError(Exception):
    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


def _extension(filename: str) -> str:
    if "." not in filename:
        return ""
    return filename.rsplit(".", 1)[1].lower()


def _read_size(file: FileStorage) -> int:
    file.stream.seek(0, 2)
    size = file.stream.tell()
    file.stream.seek(0)
    return size


def _read_head(file: FileStorage, nbytes: int = 16) -> bytes:
    head = file.stream.read(nbytes)
    file.stream.seek(0)
    return head or b""


def _assert_safe_original_name(filename: str) -> None:
    if not filename or filename.strip() in {".", ".."}:
        raise UploadError("Invalid file name.")
    if re.search(r"[\\/]|(\.\.)", filename):
        raise UploadError("File name contains invalid path characters.")


def _assert_mime_matches_ext(ext: str, mime: str | None) -> None:
    if not mime:
        return
    mime_n = mime.lower()
    if mime_n in BLOCKED_MIMES:
        raise UploadError("File type is not allowed.")
    allowed = EXT_TO_MIMES.get(ext)
    if allowed is None:
        return
    if mime_n not in allowed:
        raise UploadError("File content type does not match the file extension.")


def _assert_magic(ext: str, file: FileStorage) -> None:
    if ext == "webp":
        head = _read_head(file, 12)
        if not (head.startswith(b"RIFF") and len(head) >= 12 and head[8:12] == b"WEBP"):
            raise UploadError("File contents do not match the declared file type.")
        return
    prefixes = MAGIC_PREFIXES.get(ext)
    if not prefixes:
        return
    head = _read_head(file, 16)
    if not any(head.startswith(p) for p in prefixes):
        raise UploadError("File contents do not match the declared file type.")


def save_company_logo(file: FileStorage) -> str:
    """Validate and store a company logo; return relative path under uploads."""
    if file is None or not file.filename:
        raise UploadError("Please choose a logo file.")

    _assert_safe_original_name(file.filename)
    ext = _extension(file.filename)
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise UploadError("Logo must be a PNG, JPG, or WEBP image.")

    mime = (file.mimetype or "").lower() or None
    if mime and mime not in ALLOWED_IMAGE_MIMES and mime != "application/octet-stream":
        raise UploadError("Logo file type is not allowed.")
    # Logos: allow octet-stream only when magic bytes match.
    if mime and mime != "application/octet-stream":
        _assert_mime_matches_ext(ext, mime)

    size = _read_size(file)
    max_bytes = int(current_app.config.get("MAX_LOGO_BYTES") or (2 * 1024 * 1024))
    max_bytes = min(max_bytes, int(current_app.config["MAX_CONTENT_LENGTH"]))
    if size <= 0:
        raise UploadError("Logo file is empty.")
    if size > max_bytes:
        raise UploadError("Logo file is too large.")

    _assert_magic(ext, file)

    safe_name = f"{uuid.uuid4().hex}.{ext}"
    folder = Path(current_app.config["UPLOAD_FOLDER"]) / "logos"
    folder.mkdir(parents=True, exist_ok=True)
    destination = folder / safe_name
    _ = secure_filename(file.filename)
    file.save(destination)
    return f"logos/{safe_name}"


def save_project_document(file: FileStorage) -> tuple[str, str | None, str | None]:
    """Validate and store a project document/photo; return (relative_path, original, mime)."""
    if file is None or not file.filename:
        raise UploadError("Please choose a file to upload.")

    _assert_safe_original_name(file.filename)
    ext = _extension(file.filename)
    if ext not in ALLOWED_DOCUMENT_EXTENSIONS:
        raise UploadError("File type is not allowed. Use images, PDF, or Office documents.")

    mime = (file.mimetype or "").lower() or None
    if mime in BLOCKED_MIMES:
        raise UploadError("File type is not allowed.")
    _assert_mime_matches_ext(ext, mime)

    size = _read_size(file)
    max_bytes = current_app.config["MAX_CONTENT_LENGTH"]
    if size <= 0:
        raise UploadError("File is empty.")
    if size > max_bytes:
        raise UploadError("File is too large.")

    if ext in MAGIC_PREFIXES or ext == "webp":
        _assert_magic(ext, file)

    original = secure_filename(file.filename) or f"upload.{ext}"
    original = Path(original).name
    if not original or original in {".", ".."}:
        original = f"upload.{ext}"

    safe_name = f"{uuid.uuid4().hex}.{ext}"
    folder = Path(current_app.config["UPLOAD_FOLDER"]) / "documents"
    folder.mkdir(parents=True, exist_ok=True)
    file.save(folder / safe_name)
    return f"documents/{safe_name}", original, mime
