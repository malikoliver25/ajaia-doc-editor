from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session as OrmSession

from ..auth import create_session, delete_session, get_current_user
from ..db import get_db
from ..models import User
from ..schemas import LoginRequest, LoginResponse, UserOut
from ..seed import SEED_USERS

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, db: OrmSession = Depends(get_db)):
    email = body.email.lower()
    if email not in (u[0] for u in SEED_USERS):
        raise HTTPException(status_code=401, detail="Unknown email; only seeded demo accounts can log in")
    user = db.scalar(select(User).where(User.email == email))
    token = create_session(db, user)
    return LoginResponse(token=token, user=UserOut(id=user.id, email=user.email, name=user.name))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/logout", status_code=204)
def logout(request: Request, user: User = Depends(get_current_user), db: OrmSession = Depends(get_db)):
    token = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    delete_session(db, token)
