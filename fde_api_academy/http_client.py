from __future__ import annotations

import os
from typing import Any

import requests
from dotenv import load_dotenv

from .mock_api.client import MockAPIClient


load_dotenv()


def use_mocks() -> bool:
    return os.getenv("FDE_ACADEMY_USE_MOCKS", "true").lower() in {"1", "true", "yes"}


def github_headers() -> dict[str, str]:
    token = os.getenv("GITHUB_TOKEN")
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def fetch_github_user(username: str) -> dict[str, Any]:
    if use_mocks():
        response = MockAPIClient().get("github_user", username=username)
    else:
        response = requests.get(
            f"https://api.github.com/users/{username}",
            headers=github_headers(),
            timeout=15,
        )
    if response.status_code == 404:
        raise LookupError(f"GitHub user not found: {username}")
    response.raise_for_status() if hasattr(response, "raise_for_status") else None
    return response.json()


def fetch_weather(city: str) -> dict[str, Any]:
    if use_mocks():
        return MockAPIClient().get("weather", city=city).json()
    key = os.getenv("OPENWEATHER_API_KEY")
    if not key:
        raise RuntimeError("OPENWEATHER_API_KEY is required when mocks are disabled.")
    response = requests.get(
        "https://api.openweathermap.org/data/2.5/weather",
        params={"q": city, "appid": key, "units": "imperial"},
        timeout=15,
    )
    response.raise_for_status()
    return response.json()
