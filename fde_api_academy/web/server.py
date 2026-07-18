from __future__ import annotations

import argparse
import contextlib
import io
import json
import traceback
from dataclasses import asdict
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from fde_api_academy.curriculum import (
    CurriculumError,
    all_lessons,
    find_lesson,
    load_curriculum,
    unlocked_lessons,
)
from fde_api_academy.mentor import next_hint, reset_hints
from fde_api_academy.models import ROOT
from fde_api_academy.progress import dashboard, load_progress, record_attempt
from fde_api_academy.validators import run_drill, run_validator


STATIC_DIR = Path(__file__).resolve().parent / "static"


def lesson_statuses() -> dict[str, str]:
    modules = load_curriculum()
    progress = load_progress()
    completed = {lesson_id for lesson_id, attempt in progress.lessons.items() if attempt.completed}
    unlocked = unlocked_lessons(modules, completed)
    statuses: dict[str, str] = {}
    for lesson in all_lessons(modules):
        if lesson.id in completed:
            statuses[lesson.id] = "completed"
        elif lesson.id in unlocked:
            statuses[lesson.id] = "unlocked"
        else:
            statuses[lesson.id] = "locked"
    return statuses


def academy_state() -> dict[str, Any]:
    modules = load_curriculum()
    statuses = lesson_statuses()
    return {
        "dashboard": dashboard(),
        "modules": [
            {
                "id": module.id,
                "title": module.title,
                "difficulty": module.difficulty,
                "topics": module.topics,
                "lessons": [
                    {
                        "id": lesson.id,
                        "title": lesson.title,
                        "difficulty": lesson.difficulty,
                        "skills": lesson.skills,
                        "estimated_minutes": lesson.estimated_minutes,
                        "status": statuses[lesson.id],
                    }
                    for lesson in module.lessons
                ],
            }
            for module in modules
        ],
    }


def lesson_payload(lesson_id: str) -> dict[str, Any]:
    lesson = find_lesson(lesson_id)
    statuses = lesson_statuses()
    payload = asdict(lesson)
    payload["status"] = statuses[lesson.id]
    for key in ("guided_exercise", "challenge_exercise"):
        exercise = payload[key]
        starter_path = ROOT / exercise["starter_file"]
        exercise["absolute_path"] = str(starter_path)
        exercise["starter_code"] = starter_path.read_text(encoding="utf-8") if starter_path.exists() else ""
    for drill in payload.get("practice_drills", []):
        starter_rel = drill.get("starter_file") or ""
        starter_path = ROOT / starter_rel if starter_rel else None
        drill["absolute_path"] = str(starter_path) if starter_path else ""
        drill["starter_code"] = (
            starter_path.read_text(encoding="utf-8") if starter_path and starter_path.exists() else ""
        )
        drill["case_count"] = len(drill.get("cases", []))
        drill.pop("cases", None)  # never ship the answer key to the browser
    return payload


def _find_drill(lesson, drill_id):
    for drill in lesson.practice_drills:
        if drill.id == drill_id:
            return drill
    raise CurriculumError(f"Unknown drill: {drill_id}")


def validate_drill(lesson_id: str, drill_id: str, minutes: int) -> dict[str, Any]:
    lesson = find_lesson(lesson_id)
    drill = _find_drill(lesson, drill_id)
    stdout = io.StringIO()
    try:
        with contextlib.redirect_stdout(stdout):
            passed, message = run_drill(drill.starter_file, drill.entry_function, drill.cases)
    except Exception as exc:
        passed = False
        short_error = "".join(traceback.format_exception_only(type(exc), exc)).strip()
        message = f"{type(exc).__name__}: {short_error}"
    record_attempt(lesson.id, passed=passed, minutes=minutes, skill_weights=drill.skill_weights)
    return {
        "passed": passed,
        "message": message,
        "stdout": stdout.getvalue(),
        "exercise": drill.title,
        "dashboard": dashboard(),
        "status": lesson_statuses()[lesson.id],
    }


def save_drill_code(lesson_id: str, drill_id: str, code: str) -> dict[str, Any]:
    lesson = find_lesson(lesson_id)
    drill = _find_drill(lesson, drill_id)
    path = (ROOT / drill.starter_file).resolve()
    student_root = (ROOT / "fde_api_academy" / "student").resolve()
    if student_root not in path.parents:
        raise ValueError("Only student drill files can be edited from the web UI.")
    path.write_text(code, encoding="utf-8")
    return {"saved": True, "path": str(path)}


def validate_lesson(lesson_id: str, challenge: bool, minutes: int) -> dict[str, Any]:
    lesson = find_lesson(lesson_id)
    exercise = lesson.challenge_exercise if challenge else lesson.guided_exercise
    stdout = io.StringIO()
    try:
        with contextlib.redirect_stdout(stdout):
            passed, message = run_validator(exercise.validator, exercise.starter_file)
    except Exception as exc:
        passed = False
        short_error = "".join(traceback.format_exception_only(type(exc), exc)).strip()
        message = f"{type(exc).__name__}: {short_error}"
    record_attempt(lesson.id, passed=passed, minutes=minutes, skill_weights=exercise.skill_weights)
    if passed:
        reset_hints(lesson.id)
    return {
        "passed": passed,
        "message": message,
        "stdout": stdout.getvalue(),
        "exercise": exercise.title,
        "dashboard": dashboard(),
        "status": lesson_statuses()[lesson.id],
    }


def save_exercise_code(lesson_id: str, challenge: bool, code: str) -> dict[str, Any]:
    lesson = find_lesson(lesson_id)
    exercise = lesson.challenge_exercise if challenge else lesson.guided_exercise
    path = (ROOT / exercise.starter_file).resolve()
    student_root = (ROOT / "fde_api_academy" / "student").resolve()
    if student_root not in path.parents:
        raise ValueError("Only student exercise files can be edited from the web UI.")
    path.write_text(code, encoding="utf-8")
    return {"saved": True, "path": str(path)}


class AcademyHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args: Any, **kwargs: Any):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        try:
            if parsed.path == "/api/state":
                self.write_json(academy_state())
                return
            if parsed.path.startswith("/api/lesson/"):
                lesson_id = parsed.path.removeprefix("/api/lesson/")
                self.write_json(lesson_payload(lesson_id))
                return
        except Exception as exc:
            self.write_error(exc)
            return
        if parsed.path in {"/", ""}:
            self.path = "/index.html"
        super().do_GET()

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        super().end_headers()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        try:
            if parsed.path.startswith("/api/mentor/"):
                lesson_id = parsed.path.removeprefix("/api/mentor/")
                label, hint = next_hint(lesson_id)
                self.write_json({"label": label, "hint": hint})
                return
            if parsed.path.startswith("/api/validate/"):
                lesson_id = parsed.path.removeprefix("/api/validate/")
                body = self.read_json_body()
                self.write_json(
                    validate_lesson(
                        lesson_id,
                        challenge=bool(body.get("challenge", False)),
                        minutes=int(body.get("minutes", 15)),
                    )
                )
                return
            if parsed.path.startswith("/api/save/"):
                lesson_id = parsed.path.removeprefix("/api/save/")
                body = self.read_json_body()
                self.write_json(
                    save_exercise_code(
                        lesson_id,
                        challenge=bool(body.get("challenge", False)),
                        code=str(body.get("code", "")),
                    )
                )
                return
            if parsed.path.startswith("/api/save-drill/"):
                lesson_id = parsed.path.removeprefix("/api/save-drill/")
                body = self.read_json_body()
                self.write_json(
                    save_drill_code(
                        lesson_id,
                        drill_id=str(body.get("drill_id", "")),
                        code=str(body.get("code", "")),
                    )
                )
                return
            if parsed.path.startswith("/api/validate-drill/"):
                lesson_id = parsed.path.removeprefix("/api/validate-drill/")
                body = self.read_json_body()
                self.write_json(
                    validate_drill(
                        lesson_id,
                        drill_id=str(body.get("drill_id", "")),
                        minutes=int(body.get("minutes", 10)),
                    )
                )
                return
        except Exception as exc:
            self.write_error(exc)
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def read_json_body(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        if length == 0:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def write_json(self, payload: dict[str, Any]) -> None:
        encoded = json.dumps(payload).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def write_error(self, exc: Exception) -> None:
        payload = {
            "error": type(exc).__name__,
            "message": "".join(traceback.format_exception_only(type(exc), exc)).strip(),
        }
        encoded = json.dumps(payload).encode("utf-8")
        self.send_response(HTTPStatus.BAD_REQUEST)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, format: str, *args: Any) -> None:
        return


def run(host: str = "127.0.0.1", port: int = 8765) -> None:
    server = ThreadingHTTPServer((host, port), AcademyHandler)
    print(f"FDE API Academy web UI running at http://{host}:{port}")
    server.serve_forever()


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the FDE API Academy web UI.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    run(args.host, args.port)


if __name__ == "__main__":
    main()
