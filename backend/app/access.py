"""Single source of truth for document access control.

Roles: "owner" | "editor" | "viewer" | None (no access).
Non-owners who lack any access must get 404 (no existence leak);
authenticated users with a lower role than required get 403.
"""
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session as OrmSession

from .models import Document, DocumentShare, User


def get_role(db: OrmSession, doc: Document, user: User) -> str | None:
    if doc.owner_id == user.id:
        return "owner"
    share = db.scalar(
        select(DocumentShare).where(
            DocumentShare.document_id == doc.id, DocumentShare.user_id == user.id
        )
    )
    return share.role if share else None


def _fetch_document(db: OrmSession, document_id: str) -> Document | None:
    return db.get(Document, document_id)


def require_read(db: OrmSession, document_id: str, user: User) -> tuple[Document, str]:
    doc = _fetch_document(db, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    role = get_role(db, doc, user)
    if role is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc, role


def require_write(db: OrmSession, document_id: str, user: User) -> tuple[Document, str]:
    doc = _fetch_document(db, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    role = get_role(db, doc, user)
    if role is None:
        raise HTTPException(status_code=404, detail="Document not found")
    if role not in ("owner", "editor"):
        raise HTTPException(status_code=403, detail="Viewers cannot modify this document")
    return doc, role


def require_owner(db: OrmSession, document_id: str, user: User) -> tuple[Document, str]:
    doc = _fetch_document(db, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    role = get_role(db, doc, user)
    if role is None:
        raise HTTPException(status_code=404, detail="Document not found")
    if role != "owner":
        raise HTTPException(status_code=403, detail="Only the owner can do this")
    return doc, role
