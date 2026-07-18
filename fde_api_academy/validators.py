from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Any, Callable


ROOT = Path(__file__).resolve().parents[1]
STUDENT_DIR = ROOT / "fde_api_academy" / "student"


def load_student_module(path: str):
    file_path = ROOT / path
    spec = importlib.util.spec_from_file_location(file_path.stem, file_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not import {file_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def assert_function(module: Any, name: str) -> Callable:
    fn = getattr(module, name, None)
    if not callable(fn):
        raise AssertionError(f"Expected a function named {name}().")
    return fn


def validate_user_summary(starter_file: str) -> tuple[bool, str]:
    module = load_student_module(starter_file)
    summarize = assert_function(module, "summarize_users")
    users = [
        {"name": "Ada Lovelace", "email": "ada@example.com", "active": True},
        {"name": "Grace Hopper", "email": "grace@example.com", "active": False},
        {"name": "Katherine Johnson", "email": "kj@example.com", "active": True},
    ]
    result = summarize(users)
    expected = {"total": 3, "active": 2, "emails": ["ada@example.com", "grace@example.com", "kj@example.com"]}
    return result == expected, f"Expected {expected}, got {result!r}"


def validate_extract_contacts(starter_file: str) -> tuple[bool, str]:
    module = load_student_module(starter_file)
    extract = assert_function(module, "extract_contacts")
    payload = {
        "users": [
            {"profile": {"name": "Ada"}, "contact": {"email": "ada@example.com", "phone": "555-0100"}},
            {"profile": {"name": "Linus"}, "contact": {"email": "linus@example.com"}},
        ]
    }
    result = extract(payload)
    expected = [
        {"name": "Ada", "email": "ada@example.com", "phone": "555-0100"},
        {"name": "Linus", "email": "linus@example.com", "phone": None},
    ]
    return result == expected, f"Expected {expected}, got {result!r}"


def validate_json_transform(starter_file: str) -> tuple[bool, str]:
    module = load_student_module(starter_file)
    transform = assert_function(module, "build_repo_report")
    repos = [
        {"name": "api-tool", "stargazers_count": 9, "language": "Python"},
        {"name": "web-ui", "stargazers_count": 3, "language": "TypeScript"},
        {"name": "worker", "stargazers_count": 4, "language": "Python"},
    ]
    result = transform(repos)
    expected = {
        "total_repos": 3,
        "total_stars": 16,
        "top_repo": "api-tool",
        "languages": {"Python": 2, "TypeScript": 1},
    }
    return result == expected, f"Expected {expected}, got {result!r}"


def validate_status_classifier(starter_file: str) -> tuple[bool, str]:
    module = load_student_module(starter_file)
    classify = assert_function(module, "classify_status")
    cases = {200: "success", 201: "success", 204: "success", 400: "client_error", 401: "auth_error", 403: "auth_error", 404: "client_error", 429: "rate_limited", 500: "server_error"}
    wrong = {code: classify(code) for code in cases if classify(code) != cases[code]}
    return not wrong, f"Incorrect classifications: {wrong}"


def validate_github_profile(starter_file: str) -> tuple[bool, str]:
    module = load_student_module(starter_file)
    analyze = assert_function(module, "analyze_profile")
    user = {"login": "octocat", "name": "The Octocat", "public_repos": 3, "followers": 42}
    repos = [
        {"name": "hello-world", "stargazers_count": 80, "language": "Ruby"},
        {"name": "Spoon-Knife", "stargazers_count": 120, "language": "HTML"},
        {"name": "api-notes", "stargazers_count": 12, "language": "Python"},
    ]
    result = analyze(user, repos)
    expected = {
        "username": "octocat",
        "display_name": "The Octocat",
        "total_stars": 212,
        "most_starred_repo": "Spoon-Knife",
        "language_breakdown": {"Ruby": 1, "HTML": 1, "Python": 1},
    }
    return result == expected, f"Expected {expected}, got {result!r}"


def validate_sqlite_store(starter_file: str) -> tuple[bool, str]:
    module = load_student_module(starter_file)
    build = assert_function(module, "build_repository_database")
    import sqlite3

    conn = sqlite3.connect(":memory:")
    build(conn, [
        {"name": "api-tool", "stars": 10, "language": "Python"},
        {"name": "sync-job", "stars": 5, "language": "Python"},
    ])
    rows = conn.execute("select language, sum(stars) from repositories group by language").fetchall()
    return rows == [("Python", 15)], f"Expected aggregated Python stars, got {rows!r}"


VALIDATORS = {
    "validate_user_summary": validate_user_summary,
    "validate_extract_contacts": validate_extract_contacts,
    "validate_json_transform": validate_json_transform,
    "validate_status_classifier": validate_status_classifier,
    "validate_github_profile": validate_github_profile,
    "validate_sqlite_store": validate_sqlite_store,
}


def run_validator(name: str, starter_file: str) -> tuple[bool, str]:
    if name not in VALIDATORS:
        raise KeyError(f"Unknown validator: {name}")
    return VALIDATORS[name](starter_file)


def run_drill(starter_file: str, entry_function: str, cases: list[dict[str, Any]]) -> tuple[bool, str]:
    """Grade a practice drill by running its function against JSON test cases."""
    module = load_student_module(starter_file)
    fn = assert_function(module, entry_function)
    if not cases:
        raise AssertionError("This drill has no grading cases configured yet.")

    def normalize(value: Any) -> Any:
        if isinstance(value, tuple):
            return [normalize(item) for item in value]
        if isinstance(value, list):
            return [normalize(item) for item in value]
        if isinstance(value, dict):
            return {key: normalize(item) for key, item in value.items()}
        return value

    for index, case in enumerate(cases, start=1):
        args = case.get("args", [])
        expected = case.get("expected")
        result = fn(*args)
        if normalize(result) != normalize(expected):
            arg_text = ", ".join(repr(a) for a in args)
            return (
                False,
                f"Case {index}/{len(cases)} failed: {entry_function}({arg_text})\n"
                f"  expected: {expected!r}\n  got:      {result!r}",
            )
    return True, f"All {len(cases)} cases passed for {entry_function}()."
