import json
import re

from fde_api_academy.web.server import STATIC_DIR


COURSE_PATH = STATIC_DIR / "data" / "security_course.json"
INTERVIEW_BANK_PATH = STATIC_DIR / "data" / "security_interview_bank.json"
NOTES_PATH = STATIC_DIR / "data" / "security_notes.md"
HTML_PATH = STATIC_DIR / "index.html"
SCRIPT_PATH = STATIC_DIR / "security.js"
STANDALONE_PATH = STATIC_DIR / "security.html"
HUB_SCRIPT_PATH = STATIC_DIR / "security-hub.js"


def load_course():
    return json.loads(COURSE_PATH.read_text(encoding="utf-8"))


def load_interview_bank():
    return json.loads(INTERVIEW_BANK_PATH.read_text(encoding="utf-8"))


def test_security_course_has_complete_intermediate_learning_path():
    course = load_course()
    modules = course["modules"]

    assert course["version"] >= 3
    assert course["pass_score"] == 80
    assert len(modules) == 23
    assert len({module["id"] for module in modules}) == len(modules)
    assert modules[0]["id"] == "learning-system"
    assert modules[-1]["id"] == "capstone"

    required_ids = {
        "api-security",
        "cloud-containers",
        "secure-development",
        "vulnerability-management",
        "detection-engineering",
        "coding-algorithms",
        "capstone",
    }
    assert required_ids <= {module["id"] for module in modules}


def test_every_security_module_has_deeper_instruction_and_five_sourced_questions():
    course = load_course()
    bank = load_interview_bank()
    sources = bank["sources"]

    assert "anecdotal" in bank["methodology"]
    assert all(source["url"].startswith("https://") for source in sources.values())

    for module in course["modules"]:
        module_bank = bank["modules"][module["id"]]
        questions = [
            {**question, "sources": question.get("sources", module_bank["default_sources"])}
            for question in module["quiz"]
        ] + module_bank["questions"]

        assert len(module["objectives"]) >= 3, module["id"]
        assert len(module["concepts"]) >= 3, module["id"]
        assert len(module["pitfalls"]) >= 2, module["id"]
        assert "lab" not in module, module["id"]
        assert len(module["interview"]["rubric"]) >= 4, module["id"]
        assert len(module_bank["deep_dive"]) >= 2, module["id"]
        assert len(questions) >= 5, module["id"]
        assert module["minutes"] >= 45, module["id"]

        for section in module_bank["deep_dive"]:
            assert len(section["body"]) >= 120, module["id"]
            assert section["sources"], module["id"]
            assert set(section["sources"]) <= set(sources), module["id"]

        for question in questions:
            assert len(question["options"]) == 4, module["id"]
            assert 0 <= question["answer"] < len(question["options"]), module["id"]
            assert len(question["explanation"]) >= 30, module["id"]
            assert question["sources"], module["id"]
            assert set(question["sources"]) <= set(sources), module["id"]


def test_all_grace_nolan_source_sections_are_preserved():
    notes = NOTES_PATH.read_text(encoding="utf-8")
    course = load_course()
    source_titles = [module["source_title"] for module in course["modules"] if module.get("source_title")]

    assert len(source_titles) == 19
    assert len(set(source_titles)) == 19
    for title in source_titles:
        assert re.search(rf"^#{{2,3}} {re.escape(title)}$", notes, re.MULTILINE), title


def test_hands_on_labs_are_removed_from_course_and_ui():
    serialized = json.dumps(load_course()).lower()
    html = HTML_PATH.read_text(encoding="utf-8")
    standalone = STANDALONE_PATH.read_text(encoding="utf-8")
    script = SCRIPT_PATH.read_text(encoding="utf-8")

    assert '"lab"' not in serialized
    assert "securityLab" not in html
    assert "securityLab" not in standalone
    assert "labComplete" not in script
    assert "renderLab" not in script


def test_security_ui_exposes_mastery_controls_and_gates_completion():
    html = HTML_PATH.read_text(encoding="utf-8")
    script = SCRIPT_PATH.read_text(encoding="utf-8")

    for element_id in (
        "securityReadiness",
        "securitySearch",
        "securityAssessment",
        "securitySource",
        "securityPrevious",
        "securityNext",
    ):
        assert f'id="{element_id}"' in html

    assert "return moduleProgress(moduleId, progress).quizPassed" in script
    assert "score >= state.course.pass_score" in script
    assert "Missing source section" in script
    assert "Missing source attribution" in script
    assert "quiz.length < 5" in script
    assert "Question basis" in script


def test_standalone_security_entry_has_no_backend_or_fde_dependencies():
    standalone = STANDALONE_PATH.read_text(encoding="utf-8")
    script = SCRIPT_PATH.read_text(encoding="utf-8")
    hub_script = HUB_SCRIPT_PATH.read_text(encoding="utf-8")

    assert 'data-academy="security"' in standalone
    assert "security-hub.js" not in standalone
    assert "/api/" not in standalone
    assert "/api/" not in script
    assert "FDE API Academy" not in script
    assert "/api/state" in hub_script
