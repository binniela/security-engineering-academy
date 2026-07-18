from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from .curriculum import all_lessons, load_curriculum
from .models import PROGRESS_PATH


SKILLS = [
    "api",
    "data_parsing",
    "debugging",
    "automation",
    "sql",
    "authentication",
]


@dataclass
class LessonAttempt:
    completed: bool = False
    attempts: int = 0
    passed: int = 0
    time_spent_minutes: int = 0
    completed_at: str | None = None


@dataclass
class Progress:
    lessons: dict[str, LessonAttempt] = field(default_factory=dict)
    projects_completed: list[str] = field(default_factory=list)
    skill_points: dict[str, int] = field(default_factory=lambda: {skill: 0 for skill in SKILLS})
    mentor_hint_counts: dict[str, int] = field(default_factory=dict)


def load_progress(path: Path = PROGRESS_PATH) -> Progress:
    if not path.exists():
        return Progress()
    raw = json.loads(path.read_text(encoding="utf-8"))
    progress = Progress()
    progress.projects_completed = raw.get("projects_completed", [])
    progress.skill_points = {skill: raw.get("skill_points", {}).get(skill, 0) for skill in SKILLS}
    progress.mentor_hint_counts = raw.get("mentor_hint_counts", {})
    progress.lessons = {
        lesson_id: LessonAttempt(**attempt)
        for lesson_id, attempt in raw.get("lessons", {}).items()
    }
    return progress


def save_progress(progress: Progress, path: Path = PROGRESS_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(asdict(progress), indent=2), encoding="utf-8")


def record_attempt(
    lesson_id: str,
    passed: bool,
    minutes: int,
    skill_weights: dict[str, int],
    progress: Progress | None = None,
) -> Progress:
    progress = progress or load_progress()
    attempt = progress.lessons.setdefault(lesson_id, LessonAttempt())
    attempt.attempts += 1
    attempt.time_spent_minutes += max(0, minutes)
    if passed:
        attempt.passed += 1
        attempt.completed = True
        attempt.completed_at = datetime.now(timezone.utc).isoformat()
        for skill, points in skill_weights.items():
            if skill in progress.skill_points:
                progress.skill_points[skill] += points
    save_progress(progress)
    return progress


def dashboard(progress: Progress | None = None) -> dict[str, object]:
    progress = progress or load_progress()
    lessons = all_lessons(load_curriculum())
    completed = [lesson_id for lesson_id, attempt in progress.lessons.items() if attempt.completed]
    total_attempts = sum(attempt.attempts for attempt in progress.lessons.values())
    total_passed = sum(attempt.passed for attempt in progress.lessons.values())
    total_minutes = sum(attempt.time_spent_minutes for attempt in progress.lessons.values())
    completion = round((len(completed) / len(lessons)) * 100, 1) if lessons else 0.0
    accuracy = round((total_passed / total_attempts) * 100, 1) if total_attempts else 0.0
    return {
        "completion_percent": completion,
        "accuracy_percent": accuracy,
        "time_spent_minutes": total_minutes,
        "lessons_completed": len(completed),
        "total_lessons": len(lessons),
        "projects_completed": len(progress.projects_completed),
        "skill_points": progress.skill_points,
    }
