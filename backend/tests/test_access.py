from tests.conftest import auth


def test_owner_can_read_write_delete(client, alice):
    r = client.post("/api/documents", json={"title": "access test"}, headers=auth(alice["token"]))
    assert r.status_code == 201
    doc_id = r.json()["id"]

    assert client.get(f"/api/documents/{doc_id}", headers=auth(alice["token"])).status_code == 200
    r = client.patch(
        f"/api/documents/{doc_id}", json={"title": "renamed"}, headers=auth(alice["token"])
    )
    assert r.status_code == 200 and r.json()["title"] == "renamed"
    assert client.delete(f"/api/documents/{doc_id}", headers=auth(alice["token"])).status_code == 204


def test_editor_can_write_not_delete_or_share(client, alice, bob):
    r = client.post("/api/documents", json={}, headers=auth(alice["token"]))
    doc_id = r.json()["id"]
    r = client.post(
        f"/api/documents/{doc_id}/shares",
        json={"email": "bob@demo.test", "role": "editor"},
        headers=auth(alice["token"]),
    )
    assert r.status_code == 201, r.text

    assert client.get(f"/api/documents/{doc_id}", headers=auth(bob["token"])).status_code == 200
    assert (
        client.patch(f"/api/documents/{doc_id}", json={"title": "bob edit"}, headers=auth(bob["token"])).status_code
        == 200
    )
    # editor cannot delete
    assert client.delete(f"/api/documents/{doc_id}", headers=auth(bob["token"])).status_code == 403
    # editor cannot manage shares
    assert (
        client.get(f"/api/documents/{doc_id}/shares", headers=auth(bob["token"])).status_code == 403
    )
    client.delete(f"/api/documents/{doc_id}", headers=auth(alice["token"]))


def test_viewer_read_only(client, alice, bob):
    r = client.post("/api/documents", json={}, headers=auth(alice["token"]))
    doc_id = r.json()["id"]
    client.post(
        f"/api/documents/{doc_id}/shares",
        json={"email": "bob@demo.test", "role": "viewer"},
        headers=auth(alice["token"]),
    )
    assert client.get(f"/api/documents/{doc_id}", headers=auth(bob["token"])).status_code == 200
    assert (
        client.patch(f"/api/documents/{doc_id}", json={"title": "nope"}, headers=auth(bob["token"])).status_code
        == 403
    )
    client.delete(f"/api/documents/{doc_id}", headers=auth(alice["token"]))


def test_stranger_gets_404(client, alice, carol):
    r = client.post("/api/documents", json={}, headers=auth(alice["token"]))
    doc_id = r.json()["id"]
    assert client.get(f"/api/documents/{doc_id}", headers=auth(carol["token"])).status_code == 404
    assert (
        client.patch(f"/api/documents/{doc_id}", json={"title": "x"}, headers=auth(carol["token"])).status_code
        == 404
    )
    assert client.delete(f"/api/documents/{doc_id}", headers=auth(carol["token"])).status_code == 404
    assert (
        client.get(f"/api/documents/{doc_id}/shares", headers=auth(carol["token"])).status_code == 404
    )
    client.delete(f"/api/documents/{doc_id}", headers=auth(alice["token"]))
