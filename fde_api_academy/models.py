from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CONTENT_DIR = ROOT / "fde_api_academy" / "content"
PROGRESS_PATH = ROOT / "data" / "progress" / "progress.json"


@dataclass(frozen=True)
class Exercise:
    id: str
    title: str
    prompt: str
    starter_file: str
    validator: str
    skill_weights: dict[str, int]


@dataclass(frozen=True)
class PracticeDrill:
    id: str
    title: str
    prompt: str
    source_title: str
    source_url: str
    verification_note: str
    entry_function: str = ""
    starter_file: str = ""
    example: str = ""
    expected: str = ""
    cases: list[dict[str, Any]] = field(default_factory=list)
    skill_weights: dict[str, int] = field(default_factory=dict)


@dataclass(frozen=True)
class Lesson:
    id: str
    module: int
    title: str
    difficulty: str
    skills: list[str]
    explanation: str
    visual: str
    example_code: str
    guided_exercise: Exercise
    challenge_exercise: Exercise
    reflection_questions: list[str]
    hints: list[str]
    estimated_minutes: int = 25
    project: dict[str, Any] = field(default_factory=dict)
    practice_drills: list[PracticeDrill] = field(default_factory=list)


@dataclass(frozen=True)
class Module:
    id: int
    title: str
    topics: list[str]
    difficulty: str
    lessons: list[Lesson]
