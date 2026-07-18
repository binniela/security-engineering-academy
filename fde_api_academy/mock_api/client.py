from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
MOCKS = ROOT / "data" / "mock_responses"


class MockResponse:
    def __init__(self, status_code: int, payload: Any):
        self.status_code = status_code
        self._payload = payload
        self.text = json.dumps(payload)

    def json(self) -> Any:
        return self._payload

    @property
    def ok(self) -> bool:
        return 200 <= self.status_code < 300


class MockAPIClient:
    """Tiny local stand-in for external APIs used in lessons and tests."""

    def get(self, resource: str, **params: Any) -> MockResponse:
        payload = self._load(f"{resource}.json")
        if resource == "github_user" and params.get("username") == "missing-user":
            return MockResponse(404, {"message": "Not Found"})
        return MockResponse(200, payload)

    def post(self, resource: str, json_payload: dict[str, Any]) -> MockResponse:
        if not json_payload:
            return MockResponse(400, {"error": "payload required"})
        payload = {"id": 101, **json_payload}
        return MockResponse(201, payload)

    def patch(self, resource: str, json_payload: dict[str, Any]) -> MockResponse:
        original = self._load(f"{resource}.json")
        if isinstance(original, dict):
            original.update(json_payload)
        return MockResponse(200, original)

    def delete(self, resource: str) -> MockResponse:
        if resource == "locked_record":
            return MockResponse(403, {"error": "forbidden"})
        return MockResponse(204, {})

    def _load(self, filename: str) -> Any:
        path = MOCKS / filename
        if not path.exists():
            raise FileNotFoundError(f"Missing mock response: {path}")
        return json.loads(path.read_text(encoding="utf-8"))
