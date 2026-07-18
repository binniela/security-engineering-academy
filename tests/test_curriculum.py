from fde_api_academy.curriculum import all_lessons, load_curriculum, unlocked_lessons


def test_curriculum_has_all_modules():
    modules = load_curriculum()
    assert len(modules) == 17
    assert len(all_lessons(modules)) == 17
    assert modules[0].title == "Python Refresher"
    assert modules[-1].title == "FDE Interview Simulations"


def test_each_lesson_has_source_linked_autograded_drills():
    modules = load_curriculum()
    for lesson in all_lessons(modules):
        assert len(lesson.practice_drills) >= 3
        for drill in lesson.practice_drills:
            assert drill.source_url.startswith("https://")
            assert "erified" in drill.verification_note
            # Every drill is now auto-graded: it needs an entry point and cases.
            assert drill.entry_function
            assert drill.starter_file.startswith("fde_api_academy/student/")
            assert drill.cases, f"{drill.id} has no grading cases"
            assert drill.example and drill.expected


def test_unlocks_sequentially():
    modules = load_curriculum()
    assert unlocked_lessons(modules, completed=set()) == {"m01-python-reporting"}
    unlocked = unlocked_lessons(modules, completed={"m01-python-reporting"})
    assert "m01-python-reporting" in unlocked
    assert "m02-extract-contacts" in unlocked
    assert "m03-json-reports" not in unlocked
