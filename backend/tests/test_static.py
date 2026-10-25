"""Static-serving tests: skip (not fail) when frontend/dist is absent."""
from pathlib import Path

import pytest

DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
pytestmark = pytest.mark.skipif(
    not DIST.is_dir(), reason="frontend/dist not built; run npm run build to enable"
)


def test_api_unknown_404_json(client):
    r = client.get("/api/nonexistent")
    assert r.status_code == 404
    assert r.headers["content-type"].startswith("application/json")


def test_root_serves_html(client):
    r = client.get("/")
    assert r.status_code == 200
    assert "text/html" in r.headers["content-type"]


def test_spa_fallback(client):
    r = client.get("/documents/some-fake-id")
    assert r.status_code == 200
    assert "text/html" in r.headers["content-type"]
