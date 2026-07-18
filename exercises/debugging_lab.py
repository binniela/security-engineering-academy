"""Intentionally broken examples for Module 14.

Copy one function into a scratch file, reproduce the failure, then fix it.
"""

import json


def broken_missing_key(payload):
    return [user["contact"]["phone"] for user in payload["users"]]


def broken_bad_json(raw_text):
    data = json.loads(raw_text)
    return data["items"]


def broken_auth_handler(response):
    if response.status_code == 401:
        return response.json()["data"]
    return response.json()


def broken_pagination(fetch_page):
    page = 1
    records = []
    while page < 2:
        records.extend(fetch_page(page))
    return records
