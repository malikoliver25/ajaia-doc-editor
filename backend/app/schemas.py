from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel


class UserOut(BaseModel):
    id: int
    email: str
    name: str


class LoginRequest(BaseModel):
    email: str


class LoginResponse(BaseModel):
    token: str
    user: UserOut


class DocumentSummary(BaseModel):
    id: str
    title: str
    owner: UserOut
    role: Literal["owner", "editor", "viewer"]
    updated_at: datetime


class DocumentList(BaseModel):
    owned: list[DocumentSummary]
    shared: list[DocumentSummary]


class DocumentFull(BaseModel):
    id: str
    title: str
    owner: UserOut
    role: Literal["owner", "editor", "viewer"]
    content: Any
    created_at: datetime
    updated_at: datetime


class DocumentCreate(BaseModel):
    title: str | None = None


class DocumentUpdate(BaseModel):
    title: str | None = None
    content: Any = None


class ShareOut(BaseModel):
    user: UserOut
    role: Literal["editor", "viewer"]


class ShareCreate(BaseModel):
    email: str
    role: Literal["editor", "viewer"]
