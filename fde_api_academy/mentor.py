from __future__ import annotations

from .curriculum import find_lesson
from .progress import load_progress, save_progress


LABELS = ["Hint 1", "Hint 2", "Hint 3", "Final"]


def next_hint(lesson_id: str) -> tuple[str, str]:
    lesson = find_lesson(lesson_id)
    progress = load_progress()
    count = progress.mentor_hint_counts.get(lesson_id, 0)
    index = min(count, len(LABELS) - 1)
    progress.mentor_hint_counts[lesson_id] = count + 1
    save_progress(progress)

    hints = lesson.hints
    if index < 3:
        return LABELS[index], hints[min(index, len(hints) - 2)]
    return LABELS[index], hints[-1]


def reset_hints(lesson_id: str) -> None:
    progress = load_progress()
    progress.mentor_hint_counts.pop(lesson_id, None)
    save_progress(progress)
