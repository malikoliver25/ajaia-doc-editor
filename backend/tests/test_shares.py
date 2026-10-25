from tests.conftest import auth


def _share(client, doc_id, token, email, role="editor"):
    return client.post(
        f"/api/documents/{doc_id}/shares",
        json={"email": email, "role": role},
        headers=auth(token),
    )


def test_owner_crud_shares(client, alice, bob):
    doc = client.post("/api/documents", json={}, headers=auth(alice["token"])).json()

    r = _share(client, doc["id"], alice["token"], "bob@demo.test", "viewer")
    assert r.status_code == 201, r.text
    # upsert changes role
    r = _share(client, doc["id"], alice["token"], "bob@demo.test", "editor")
    assert r.status_code == 201 and r.json()["role"] == "editor"

    shares = client.get(f"/api/documents/{doc['id']}/shares", headers=auth(alice["token"])).json()
    assert len(shares) == 1 and shares[0]["user"]["email"] == "bob@demo.test"

    # remove
    bob_id = shares[0]["user"]["id"]
    r = client.delete(f"/api/documents/{doc['id']}/shares/{bob_id}", headers=auth(alice["token"]))
    assert r.status_code == 204
    shares = client.get(f"/api/documents/{doc['id']}/shares", headers=auth(alice["token"])).json()
    assert shares == []
    client.delete(f"/api/documents/{doc['id']}", headers=auth(alice["token"]))


def test_share_unknown_email_404(client, alice):
    doc = client.post("/api/documents", json={}, headers=auth(alice["token"])).json()
    assert (
        _share(client, doc["id"], alice["token"], "ghost@demo.test").status_code == 404
    )
    client.delete(f"/api/documents/{doc['id']}", headers=auth(alice["token"]))


def test_share_with_owner_400(client, alice):
    doc = client.post("/api/documents", json={}, headers=auth(alice["token"])).json()
    assert (
        _share(client, doc["id"], alice["token"], "alice@demo.test").status_code == 400
    )
    client.delete(f"/api/documents/{doc['id']}", headers=auth(alice["token"]))


def test_non_owner_cannot_share(client, alice, bob, carol):
    doc = client.post("/api/documents", json={}, headers=auth(alice["token"])).json()
    _share(client, doc["id"], alice["token"], "bob@demo.test", "editor")
    # Bob (editor) tries to share with Carol -> 403: he can read the doc, so
    # its existence is not masked; owner-only share management fails with 403.
    assert (
        _share(client, doc["id"], bob["token"], "carol@demo.test").status_code == 403
    )
    # Bob cannot list shares either (403: he can read the doc)
    assert (
        client.get(f"/api/documents/{doc['id']}/shares", headers=auth(bob["token"])).status_code == 403
    )
    client.delete(f"/api/documents/{doc['id']}", headers=auth(alice["token"]))
