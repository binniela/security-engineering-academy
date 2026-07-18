from __future__ import annotations

import argparse
from pathlib import Path

try:
    from rich.console import Console
    from rich.markdown import Markdown
    from rich.panel import Panel
    from rich.table import Table
except ModuleNotFoundError:
    import re

    class Console:
        def print(self, value: object = "") -> None:
            print(re.sub(r"\[/?[a-z_ ]+\]", "", str(value)))

    class Markdown:
        def __init__(self, text: str):
            self.text = text

        def __str__(self) -> str:
            return self.text

    class Panel:
        def __init__(self, text: object, title: str | None = None):
            self.text = text
            self.title = title

        @classmethod
        def fit(cls, text: object):
            return cls(text)

        def __str__(self) -> str:
            heading = f"{self.title}\n" if self.title else ""
            return f"{heading}{self.text}"

    class Table:
        def __init__(self, title: str | None = None):
            self.title = title
            self.columns: list[str] = []
            self.rows: list[tuple[str, ...]] = []

        def add_column(self, name: str) -> None:
            self.columns.append(name)

        def add_row(self, *values: str) -> None:
            self.rows.append(tuple(values))

        def __str__(self) -> str:
            lines = [self.title or "", " | ".join(self.columns)]
            lines.extend(" | ".join(row) for row in self.rows)
            return "\n".join(line for line in lines if line)

from .curriculum import all_lessons, find_lesson, load_curriculum, unlocked_lessons
from .mentor import next_hint, reset_hints
from .progress import dashboard, load_progress, record_attempt
from .validators import run_validator


console = Console()


def cmd_list(_: argparse.Namespace) -> None:
    modules = load_curriculum()
    completed = {lesson_id for lesson_id, attempt in load_progress().lessons.items() if attempt.completed}
    unlocked = unlocked_lessons(modules, completed)
    table = Table(title="FDE API Academy Curriculum")
    table.add_column("Lesson")
    table.add_column("Title")
    table.add_column("Difficulty")
    table.add_column("Status")
    for lesson in all_lessons(modules):
        if lesson.id in completed:
            status = "completed"
        elif lesson.id in unlocked:
            status = "unlocked"
        else:
            status = "locked"
        table.add_row(lesson.id, lesson.title, lesson.difficulty, status)
    console.print(table)


def cmd_show(args: argparse.Namespace) -> None:
    lesson = find_lesson(args.lesson_id)
    console.print(Panel.fit(f"[bold]{lesson.id}: {lesson.title}[/bold]\n{lesson.difficulty} | {', '.join(lesson.skills)}"))
    console.print(Markdown(lesson.explanation))
    console.print(Panel(lesson.visual, title="Visual Example"))
    console.print(Panel(lesson.example_code, title="Example Code"))
    console.print(Panel(lesson.guided_exercise.prompt, title=f"Guided Exercise: {lesson.guided_exercise.title}"))
    console.print(Panel(lesson.challenge_exercise.prompt, title=f"Challenge: {lesson.challenge_exercise.title}"))
    console.print("[bold]Reflection[/bold]")
    for question in lesson.reflection_questions:
        console.print(f"- {question}")


def cmd_dashboard(_: argparse.Namespace) -> None:
    stats = dashboard()
    table = Table(title="Skill Dashboard")
    table.add_column("Metric")
    table.add_column("Value")
    for key in ["completion_percent", "accuracy_percent", "time_spent_minutes", "lessons_completed", "total_lessons", "projects_completed"]:
        table.add_row(key.replace("_", " ").title(), str(stats[key]))
    console.print(table)

    skills = Table(title="Skill Mastery")
    skills.add_column("Skill")
    skills.add_column("Points")
    for skill, points in stats["skill_points"].items():
        skills.add_row(skill.replace("_", " ").title(), str(points))
    console.print(skills)


def cmd_validate(args: argparse.Namespace) -> None:
    lesson = find_lesson(args.lesson_id)
    exercise = lesson.challenge_exercise if args.challenge else lesson.guided_exercise
    passed, message = run_validator(exercise.validator, exercise.starter_file)
    record_attempt(lesson.id, passed=passed, minutes=args.minutes, skill_weights=exercise.skill_weights)
    if passed:
        reset_hints(lesson.id)
        console.print(f"[green]Passed[/green] {exercise.title}")
    else:
        console.print(f"[red]Not yet[/red] {message}")
        console.print("Run `fde mentor {}` for a hint ladder.".format(lesson.id))


def cmd_mentor(args: argparse.Namespace) -> None:
    label, hint = next_hint(args.lesson_id)
    console.print(Panel(hint, title=label))


def cmd_reset_hints(args: argparse.Namespace) -> None:
    reset_hints(args.lesson_id)
    console.print(f"Reset mentor hints for {args.lesson_id}.")


def cmd_paths(_: argparse.Namespace) -> None:
    root = Path(__file__).resolve().parents[1]
    console.print(f"Project: {root}")
    console.print(f"Student exercises: {root / 'fde_api_academy' / 'student'}")
    console.print(f"Progress JSON: {root / 'data' / 'progress' / 'progress.json'}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="fde", description="FDE API Academy")
    sub = parser.add_subparsers(required=True)

    list_parser = sub.add_parser("list", help="List lessons and unlock status")
    list_parser.set_defaults(func=cmd_list)

    show = sub.add_parser("show", help="Show a lesson")
    show.add_argument("lesson_id")
    show.set_defaults(func=cmd_show)

    validate = sub.add_parser("validate", help="Validate an exercise")
    validate.add_argument("lesson_id")
    validate.add_argument("--challenge", action="store_true")
    validate.add_argument("--minutes", type=int, default=15)
    validate.set_defaults(func=cmd_validate)

    mentor = sub.add_parser("mentor", help="Get the next mentor hint")
    mentor.add_argument("lesson_id")
    mentor.set_defaults(func=cmd_mentor)

    reset = sub.add_parser("reset-hints", help="Reset hint ladder for a lesson")
    reset.add_argument("lesson_id")
    reset.set_defaults(func=cmd_reset_hints)

    dash = sub.add_parser("dashboard", help="Show progress and skill mastery")
    dash.set_defaults(func=cmd_dashboard)

    paths = sub.add_parser("paths", help="Show important local paths")
    paths.set_defaults(func=cmd_paths)
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
