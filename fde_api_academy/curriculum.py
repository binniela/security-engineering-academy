from __future__ import annotations

import json
from pathlib import Path

from .models import CONTENT_DIR, Exercise, Lesson, Module, PracticeDrill


class CurriculumError(RuntimeError):
    pass


def _exercise(raw: dict) -> Exercise:
    return Exercise(
        id=raw["id"],
        title=raw["title"],
        prompt=raw["prompt"],
        starter_file=raw["starter_file"],
        validator=raw["validator"],
        skill_weights=raw.get("skill_weights", {}),
    )


def _practice_drill(raw: dict) -> PracticeDrill:
    return PracticeDrill(
        id=raw["id"],
        title=raw["title"],
        prompt=raw["prompt"],
        source_title=raw["source_title"],
        source_url=raw["source_url"],
        verification_note=raw["verification_note"],
        entry_function=raw.get("entry_function", ""),
        starter_file=raw.get("starter_file", ""),
        example=raw.get("example", ""),
        expected=raw.get("expected", ""),
        cases=raw.get("cases", []),
        skill_weights=raw.get("skill_weights", {}),
    )


def load_curriculum(path: Path = CONTENT_DIR / "curriculum.json") -> list[Module]:
    if not path.exists():
        raise CurriculumError(f"Missing curriculum file: {path}")

    raw_modules = json.loads(path.read_text(encoding="utf-8"))
    modules: list[Module] = []
    for raw_module in raw_modules:
        lessons = [
            Lesson(
                id=lesson["id"],
                module=raw_module["id"],
                title=lesson["title"],
                difficulty=lesson["difficulty"],
                skills=lesson["skills"],
                explanation=lesson["explanation"],
                visual=lesson["visual"],
                example_code=lesson["example_code"],
                guided_exercise=_exercise(lesson["guided_exercise"]),
                challenge_exercise=_exercise(lesson["challenge_exercise"]),
                reflection_questions=lesson["reflection_questions"],
                hints=lesson["hints"],
                estimated_minutes=lesson.get("estimated_minutes", 25),
                project=lesson.get("project", {}),
                practice_drills=[_practice_drill(drill) for drill in lesson.get("practice_drills", [])],
            )
            for lesson in raw_module["lessons"]
        ]
        modules.append(
            Module(
                id=raw_module["id"],
                title=raw_module["title"],
                topics=raw_module["topics"],
                difficulty=raw_module["difficulty"],
                lessons=lessons,
            )
        )
    return modules


def all_lessons(modules: list[Module]) -> list[Lesson]:
    return [lesson for module in modules for lesson in module.lessons]


def find_lesson(lesson_id: str, modules: list[Module] | None = None) -> Lesson:
    modules = modules or load_curriculum()
    for lesson in all_lessons(modules):
        if lesson.id == lesson_id:
            return lesson
    raise CurriculumError(f"Unknown lesson: {lesson_id}")


def unlocked_lessons(modules: list[Module], completed: set[str]) -> set[str]:
    unlocked: set[str] = set()
    for lesson in all_lessons(modules):
        unlocked.add(lesson.id)
        if lesson.id not in completed:
            break
    return unlocked
