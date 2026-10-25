import json

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session as OrmSession

from ..auth import get_current_user
from ..db import get_db
from ..models import Document, User
from ..routers.documents import _full
from ..schemas import DocumentFull
from ..services.convert import (
    ALLOWED_EXTENSIONS,
    MAX_IMPORT_BYTES,
    convert,
    import_filename,
)

router = APIRouter(prefix="/api/documents", tags=["import"])


@router.post("/import", response_model=DocumentFull, status_code=201)
def import_document(
    file: UploadFile,
    user: User = Depends(get_current_user),
    db: OrmSession = Depends(get_db),
):
    title, ext = import_filename(file.filename or "file.txt")
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type; allowed types: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )
    raw = file.file.read(MAX_IMPORT_BYTES + 1)
    if len(raw) > MAX_IMPORT_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds the 1 MB limit")
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=422, detail="File must be valid UTF-8")
    doc = Document(owner_id=user.id, title=title, content=json.dumps(convert(text, ext)))
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return _full(doc, "owner")
