import io

from app.services.convert import convert

from tests.conftest import auth


def _upload(client, token, filename, data, content_type="text/plain"):
    return client.post(
        "/api/documents/import",
        files={"file": (filename, io.BytesIO(data), content_type)},
        headers=auth(token),
    )


def test_convert_txt_paragraphs():
    doc = convert("one\n\ntwo\n", ".txt")
    assert doc == {
        "type": "doc",
        "content": [
            {"type": "paragraph", "content": [{"type": "text", "text": "one"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "two"}]},
        ],
    }


def test_convert_md_headings_and_bullets():
    doc = convert("# Title\n\nplain\n\n- a\n- b\n\n## Sub\n* c", ".md")
    types = [n["type"] for n in doc["content"]]
    assert types == ["heading", "paragraph", "bulletList", "heading", "bulletList"]
    assert doc["content"][0]["attrs"]["level"] == 1
    assert doc["content"][0]["content"][0]["text"] == "Title"
    assert doc["content"][3]["attrs"]["level"] == 2
    bl = doc["content"][2]
    assert bl["content"][0]["type"] == "listItem"
    assert bl["content"][0]["content"][0]["content"][0]["text"] == "a"
    # "* c" after a heading is a bullet
    assert doc["content"][4]["content"][0]["content"][0]["content"][0]["text"] == "c"


def test_txt_import(client, alice):
    r = _upload(client, alice["token"], "notes.txt", b"hello world\nsecond line")
    assert r.status_code == 201, r.text
    doc = r.json()
    assert doc["title"] == "notes"
    assert doc["content"]["content"][0]["content"][0]["text"] == "hello world"
    client.delete(f"/api/documents/{doc['id']}", headers=auth(alice["token"]))


def test_md_import(client, alice):
    r = _upload(client, alice["token"], "readme.md", b"# Head\n\n- item one\n- item two")
    assert r.status_code == 201, r.text
    doc = r.json()
    assert doc["title"] == "readme"
    assert [n["type"] for n in doc["content"]["content"]] == ["heading", "bulletList"]
    client.delete(f"/api/documents/{doc['id']}", headers=auth(alice["token"]))


def test_bad_extension_415(client, alice):
    r = _upload(client, alice["token"], "evil.exe", b"MZ...")
    assert r.status_code == 415
    assert ".txt" in r.json()["detail"] and ".md" in r.json()["detail"]


def test_oversize_413(client, alice):
    r = _upload(client, alice["token"], "big.txt", b"a" * (1_000_001))
    assert r.status_code == 413


def test_non_utf8_422(client, alice):
    r = _upload(client, alice["token"], "bad.txt", b"\xff\xfe\xfa")
    assert r.status_code == 422
