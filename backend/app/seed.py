import json

from sqlalchemy import select
from sqlalchemy.orm import Session as OrmSession

from .models import Document, User

SEED_USERS = [
    ("alice@demo.test", "Alice"),
    ("bob@demo.test", "Bob"),
    ("carol@demo.test", "Carol"),
]

SAMPLE_CONTENT = {
    "type": "doc",
    "content": [
        {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "Welcome"}]},
        {
            "type": "paragraph",
            "content": [{"type": "text", "text": "This is a sample document to get you started."}],
        },
    ],
}


def get_or_create_user(db: OrmSession, email: str, name: str) -> User:
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(email=email, name=name)
        db.add(user)
        db.flush()
    return user


def seed(db: OrmSession) -> None:
    alice = get_or_create_user(db, SEED_USERS[0][0], SEED_USERS[0][1])
    get_or_create_user(db, SEED_USERS[1][0], SEED_USERS[1][1])
    get_or_create_user(db, SEED_USERS[2][0], SEED_USERS[2][1])
    if not db.scalar(select(Document).where(Document.owner_id == alice.id)):
        db.add(
            Document(
                owner_id=alice.id,
                title="Welcome to Ajaia",
                content=json.dumps(SAMPLE_CONTENT),
            )
        )
    db.commit()
