from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session as OrmSession

from ..access import require_owner
from ..auth import get_current_user
from ..db import get_db
from ..models import DocumentShare, User
from ..schemas import ShareCreate, ShareOut, UserOut

router = APIRouter(prefix="/api/documents/{document_id}/shares", tags=["shares"])


@router.get("", response_model=list[ShareOut])
def list_shares(
    document_id: str,
    user: User = Depends(get_current_user),
    db: OrmSession = Depends(get_db),
):
    require_owner(db, document_id, user)
    shares = db.scalars(
        select(DocumentShare).where(DocumentShare.document_id == document_id)
    ).all()
    return [
        ShareOut(user=UserOut(id=s.user.id, email=s.user.email, name=s.user.name), role=s.role)
        for s in shares
    ]


@router.post("", response_model=ShareOut, status_code=201)
def add_share(
    document_id: str,
    body: ShareCreate,
    user: User = Depends(get_current_user),
    db: OrmSession = Depends(get_db),
):
    doc, _ = require_owner(db, document_id, user)
    target = db.scalar(select(User).where(User.email == body.email.lower()))
    if target is None:
        raise HTTPException(status_code=404, detail="No user with that email")
    if target.id == user.id or target.id == doc.owner_id:
        raise HTTPException(status_code=400, detail="Cannot share a document with its owner")
    share = db.scalar(
        select(DocumentShare).where(
            DocumentShare.document_id == doc.id, DocumentShare.user_id == target.id
        )
    )
    if share is None:
        share = DocumentShare(document_id=doc.id, user_id=target.id, role=body.role)
        db.add(share)
    else:
        share.role = body.role
    db.commit()
    return ShareOut(user=UserOut(id=target.id, email=target.email, name=target.name), role=share.role)


@router.delete("/{user_id}", status_code=204)
def remove_share(
    document_id: str,
    user_id: int,
    user: User = Depends(get_current_user),
    db: OrmSession = Depends(get_db),
):
    require_owner(db, document_id, user)
    share = db.scalar(
        select(DocumentShare).where(
            DocumentShare.document_id == document_id, DocumentShare.user_id == user_id
        )
    )
    if share is None:
        raise HTTPException(status_code=404, detail="Share not found")
    db.delete(share)
    db.commit()
