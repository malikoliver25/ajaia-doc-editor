import os
import pathlib
import tempfile

_tmp = tempfile.mkdtemp(prefix="ajaia-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
pathlib.Path(_tmp).mkdir(exist_ok=True)

import pytest
from fastapi.testclient import TestClient

from app.db import Base, SessionLocal, engine
from app.main import app
from app.seed import seed


@pytest.fixture(scope="session", autouse=True)
def _db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()
    yield
    SessionLocal().close()
    engine.dispose()


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def users(client):
    """Login as each seeded user once; return {name: (token, user_dict)}."""
    out = {}
    for email, name in [("alice@demo.test", "Alice"), ("bob@demo.test", "Bob"), ("carol@demo.test", "Carol")]:
        r = client.post("/api/auth/login", json={"email": email})
        assert r.status_code == 200, r.text
        out[name.lower()] = r.json()
    return out


@pytest.fixture
def alice(client, users):
    return users["alice"]


@pytest.fixture
def bob(client, users):
    return users["bob"]


@pytest.fixture
def carol(client, users):
    return users["carol"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def new_doc(client, alice):
    """Fresh doc owned by Alice; cleaned up after the test."""
    r = client.post("/api/documents", json={}, headers=auth(alice["token"]))
    assert r.status_code == 201, r.text
    doc = r.json()
    yield doc
    client.delete(f"/api/documents/{doc['id']}", headers=auth(alice["token"]))
