import secrets

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session as OrmSession

from .db import get_db
from .models import Session, User

bearer = HTTPBearer(auto_error=False)


def create_session(db: OrmSession, user: User) -> str:
    token = secrets.token_urlsafe(32)
    db.add(Session(token=token, user_id=user.id))
    db.commit()
    return token


def delete_session(db: OrmSession, token: str) -> None:
    db.query(Session).filter(Session.token == token).delete()
    db.commit()


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: OrmSession = Depends(get_db),
) -> User:
    if creds is None:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    session = db.get(Session, creds.credentials)
    if session is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return session.user
