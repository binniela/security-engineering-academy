from pathlib import Path

from fde_api_academy.web.server import (
    academy_state,
    lesson_payload,
    save_drill_code,
    save_exercise_code,
    validate_drill,
    validate_lesson,
)


def test_web_state_includes_dashboard_and_modules():
    state = academy_state()
    assert "dashboard" in state
    assert len(state["modules"]) == 17
    assert state["modules"][0]["lessons"][0]["id"] == "m01-python-reporting"


def test_lesson_payload_includes_starter_code_path():
    lesson = lesson_payload("m01-python-reporting")
    assert lesson["guided_exercise"]["absolute_path"].endswith("m01_python_report.py")
    assert "def summarize_users" in lesson["guided_exercise"]["starter_code"]
    assert len(lesson["practice_drills"]) >= 3
    drill = lesson["practice_drills"][0]
    assert drill["source_url"].startswith("https://")
    # Drills are auto-graded but must never leak the answer key to the client.
    assert "cases" not in drill
    assert drill["case_count"] >= 1
    assert drill["entry_function"]
    assert drill["starter_code"]


def test_permission_access_intervals_drill_is_autograded_and_persistent():
    lesson = lesson_payload("m09-auth-env")
    drill = next(item for item in lesson["practice_drills"] if item["id"] == "m09-drill-4")
    path = Path(drill["absolute_path"])
    original = path.read_text(encoding="utf-8")
    solution = """
def get_access_intervals(records, required):
    ranks = {"none": 0, "member": 1, "admin": 2}
    required_rank = ranks[required]
    sorted_records = sorted(records)
    intervals = []
    start = None
    previous_timestamp = None

    for timestamp, permission in sorted_records:
        has_access = ranks[permission] >= required_rank
        if has_access and start is None:
            start = timestamp
        if not has_access and start is not None:
            intervals.append((start, previous_timestamp))
            start = None
        previous_timestamp = timestamp

    if start is not None:
        intervals.append((start, previous_timestamp))

    return intervals
""".lstrip()
    try:
        save_drill_code("m09-auth-env", "m09-drill-4", solution)
        assert path.read_text(encoding="utf-8") == solution
        result = validate_drill("m09-auth-env", "m09-drill-4", minutes=0)
        assert result["passed"] is True
    finally:
        path.write_text(original, encoding="utf-8")


def test_save_exercise_code_writes_student_file():
    lesson = lesson_payload("m01-python-reporting")
    path = Path(lesson["guided_exercise"]["absolute_path"])
    original = path.read_text(encoding="utf-8")
    replacement = "def summarize_users(users):\n    return {'total': len(users), 'active': 0, 'emails': []}\n"
    try:
        result = save_exercise_code("m01-python-reporting", challenge=False, code=replacement)
        assert result["saved"] is True
        assert path.read_text(encoding="utf-8") == replacement
    finally:
        path.write_text(original, encoding="utf-8")


def test_validate_lesson_reports_syntax_errors():
    lesson = lesson_payload("m01-python-reporting")
    path = Path(lesson["guided_exercise"]["absolute_path"])
    original = path.read_text(encoding="utf-8")
    try:
        save_exercise_code("m01-python-reporting", challenge=False, code="def summarize_users(users):\n    print user\n")
        result = validate_lesson("m01-python-reporting", challenge=False, minutes=0)
        assert result["passed"] is False
        assert "SyntaxError" in result["message"]
    finally:
        path.write_text(original, encoding="utf-8")


def test_validate_lesson_captures_print_output():
    lesson = lesson_payload("m01-python-reporting")
    path = Path(lesson["guided_exercise"]["absolute_path"])
    original = path.read_text(encoding="utf-8")
    code = (
        "def summarize_users(users):\n"
        "    print('debug total', len(users))\n"
        "    return {'total': len(users), 'active': sum(1 for user in users if user.get('active')), 'emails': [user.get('email') for user in users]}\n"
    )
    try:
        save_exercise_code("m01-python-reporting", challenge=False, code=code)
        result = validate_lesson("m01-python-reporting", challenge=False, minutes=0)
        assert result["passed"] is True
        assert "debug total 3" in result["stdout"]
    finally:
        path.write_text(original, encoding="utf-8")
