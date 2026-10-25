import json

from tests.conftest import auth


def test_create_default_title(client, alice):
    r = client.post("/api/documents", json={}, headers=auth(alice["token"]))
    assert r.status_code == 201
    assert r.json()["title"] == "Untitled document"
    assert r.json()["content"] == {"type": "doc", "content": []}
    client.delete(f"/api/documents/{r.json()['id']}", headers=auth(alice["token"]))


def test_list_splits_owned_and_shared(client, alice, bob):
    r = client.post("/api/documents", json={"title": "shared doc"}, headers=auth(alice["token"]))
    doc_id = r.json()["id"]
    client.post(
        f"/api/documents/{doc_id}/shares",
        json={"email": "bob@demo.test", "role": "editor"},
        headers=auth(alice["token"]),
    )

    alice_docs = client.get("/api/documents", headers=auth(alice["token"])).json()
    bob_docs = client.get("/api/documents", headers=auth(bob["token"])).json()

    assert any(d["id"] == doc_id and d["role"] == "owner" for d in alice_docs["owned"])
    assert not any(d["id"] == doc_id for d in alice_docs["shared"])
    assert any(
        d["id"] == doc_id and d["role"] == "editor" and d["owner"]["email"] == "alice@demo.test"
        for d in bob_docs["shared"]
    )
    assert not any(d["id"] == doc_id for d in bob_docs["owned"])
    client.delete(f"/api/documents/{doc_id}", headers=auth(alice["token"]))


def test_rename_trims_and_validates(client, alice):
    r = client.post("/api/documents", json={}, headers=auth(alice["token"]))
    doc_id = r.json()["id"]

    r = client.patch(f"/api/documents/{doc_id}", json={"title": "  hi  "}, headers=auth(alice["token"]))
    assert r.status_code == 200 and r.json()["title"] == "hi"

    assert (
        client.patch(f"/api/documents/{doc_id}", json={"title": "   "}, headers=auth(alice["token"])).status_code
        == 422
    )
    assert (
        client.patch(f"/api/documents/{doc_id}", json={"title": "x" * 201}, headers=auth(alice["token"])).status_code
        == 422
    )
    client.delete(f"/api/documents/{doc_id}", headers=auth(alice["token"]))


def test_oversize_content_422(client, alice):
    doc = client.post("/api/documents", json={}, headers=auth(alice["token"])).json()
    big = {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "a" * 1_000_100}]}]}
    r = client.patch(
        f"/api/documents/{doc['id']}", json={"content": big}, headers=auth(alice["token"])
    )
    assert r.status_code == 422
    client.delete(f"/api/documents/{doc['id']}", headers=auth(alice["token"]))


def test_invalid_content_shape_422(client, alice):
    doc = client.post("/api/documents", json={}, headers=auth(alice["token"])).json()
    for bad in [
        {"type": "para", "content": []},
        {"type": "doc", "content": "not a list"},
        [1, 2],
        "doc",
    ]:
        r = client.patch(
            f"/api/documents/{doc['id']}", json={"content": bad}, headers=auth(alice["token"])
        )
        assert r.status_code == 422, bad
    client.delete(f"/api/documents/{doc['id']}", headers=auth(alice["token"]))


def test_json_content_roundtrip(client, alice):
    doc = client.post("/api/documents", json={}, headers=auth(alice["token"])).json()
    body = {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "hello"}]}]}
    r = client.patch(f"/api/documents/{doc['id']}", json={"content": body}, headers=auth(alice["token"]))
    assert r.status_code == 200
    assert r.json()["content"] == body
    r = client.get(f"/api/documents/{doc['id']}", headers=auth(alice["token"]))
    assert r.json()["content"] == body
    client.delete(f"/api/documents/{doc['id']}", headers=auth(alice["token"]))
