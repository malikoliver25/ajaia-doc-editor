import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session as OrmSession

from ..access import get_role, require_owner, require_read, require_write
from ..auth import get_current_user
from ..db import get_db
from ..models import Document, DocumentShare, User
from ..schemas import (
    DocumentCreate,
    DocumentFull,
    DocumentList,
    DocumentSummary,
    DocumentUpdate,
    ShareCreate,
    ShareOut,
    UserOut,
)

router = APIRouter(prefix="/api/documents", tags=["documents"])

MAX_CONTENT_BYTES = 1_000_000


def _parse_content(raw: str):
    return json.loads(raw) if raw else {"type": "doc", "content": []}


def _summary(db: OrmSession, doc: Document, role: str) -> DocumentSummary:
    return DocumentSummary(
        id=doc.id,
        title=doc.title,
        owner=UserOut(id=doc.owner.id, email=doc.owner.email, name=doc.owner.name),
        role=role,
        updated_at=doc.updated_at,
    )


@router.get("", response_model=DocumentList)
def list_documents(user: User = Depends(get_current_user), db: OrmSession = Depends(get_db)):
    owned, shared = [], []
    docs = db.scalars(select(Document)).all()
    for doc in docs:
        role = get_role(db, doc, user)
        if role == "owner":
            owned.append(_summary(db, doc, "owner"))
        elif role in ("editor", "viewer"):
            shared.append(_summary(db, doc, role))
    return DocumentList(owned=owned, shared=shared)


@router.post("", response_model=DocumentFull, status_code=201)
def create_document(
    body: DocumentCreate,
    user: User = Depends(get_current_user),
    db: OrmSession = Depends(get_db),
):
    title = body.title if body.title is not None else "Untitled document"
    doc = Document(owner_id=user.id, title=title, content='{"type":"doc","content":[]}')
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return _full(doc, "owner")


def _full(doc: Document, role: str) -> DocumentFull:
    return DocumentFull(
        id=doc.id,
        title=doc.title,
        owner=UserOut(id=doc.owner.id, email=doc.owner.email, name=doc.owner.name),
        role=role,
        content=_parse_content(doc.content),
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )


@router.get("/{document_id}", response_model=DocumentFull)
def get_document(
    document_id: str,
    user: User = Depends(get_current_user),
    db: OrmSession = Depends(get_db),
):
    doc, role = require_read(db, document_id, user)
    return _full(doc, role)


@router.patch("/{document_id}", response_model=DocumentFull)
def update_document(
    document_id: str,
    body: DocumentUpdate,
    user: User = Depends(get_current_user),
    db: OrmSession = Depends(get_db),
):
    doc, role = require_write(db, document_id, user)
    if body.title is not None:
        title = body.title.strip()
        if not 1 <= len(title) <= 200:
            raise HTTPException(status_code=422, detail="Title must be 1-200 characters after trimming")
        doc.title = title
    if body.content is not None:
        content = body.content
        if (
            not isinstance(content, dict)
            or content.get("type") != "doc"
            or not isinstance(content.get("content"), list)
        ):
            raise HTTPException(status_code=422, detail='content must be {"type":"doc","content":[...]}')
        serialized = json.dumps(content)
        if len(serialized.encode("utf-8")) > MAX_CONTENT_BYTES:
            raise HTTPException(status_code=422, detail="Content exceeds 1,000,000 bytes")
        doc.content = serialized
    db.commit()
    db.refresh(doc)
    return _full(doc, role)


@router.delete("/{document_id}", status_code=204)
def delete_document(
    document_id: str,
    user: User = Depends(get_current_user),
    db: OrmSession = Depends(get_db),
):
    doc, _ = require_owner(db, document_id, user)
    db.query(DocumentShare).filter(DocumentShare.document_id == doc.id).delete()
    db.delete(doc)
    db.commit()
