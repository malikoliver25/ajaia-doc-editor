from tests.conftest import auth


def test_login_seeded_email(client):
    r = client.post("/api/auth/login", json={"email": "alice@demo.test"})
    assert r.status_code == 200
    body = r.json()
    assert body["user"]["email"] == "alice@demo.test"
    assert body["token"]


def test_login_unknown_email(client):
    r = client.post("/api/auth/login", json={"email": "nobody@demo.test"})
    assert r.status_code == 401


def test_me_with_token(client, alice):
    r = client.get("/api/auth/me", headers=auth(alice["token"]))
    assert r.status_code == 200
    assert r.json()["email"] == "alice@demo.test"


def test_me_without_token(client):
    r = client.get("/api/auth/me")
    assert r.status_code == 401


def test_me_with_bad_token(client):
    r = client.get("/api/auth/me", headers={"Authorization": "Bearer nope"})
    assert r.status_code == 401


def test_logout_invalidates_token(client):
    r = client.post("/api/auth/login", json={"email": "bob@demo.test"})
    token = r.json()["token"]
    r = client.post("/api/auth/logout", headers=auth(token))
    assert r.status_code == 204
    assert client.get("/api/auth/me", headers=auth(token)).status_code == 401
