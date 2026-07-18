import json
import re

from fde_api_academy.web.server import STATIC_DIR


COURSE_PATH = STATIC_DIR / "data" / "security_course.json"
NOTES_PATH = STATIC_DIR / "data" / "security_notes.md"
HTML_PATH = STATIC_DIR / "index.html"
SCRIPT_PATH = STATIC_DIR / "security.js"
STANDALONE_PATH = STATIC_DIR / "security.html"
HUB_SCRIPT_PATH = STATIC_DIR / "security-hub.js"


def load_course():
    return json.loads(COURSE_PATH.read_text(encoding="utf-8"))


def test_security_course_has_complete_intermediate_learning_path():
    course = load_course()
    modules = course["modules"]

    assert course["version"] >= 2
    assert course["pass_score"] == 100
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


def test_every_security_module_has_instruction_practice_and_assessment():
    for module in load_course()["modules"]:
        assert len(module["objectives"]) >= 3, module["id"]
        assert len(module["concepts"]) >= 3, module["id"]
        assert len(module["pitfalls"]) >= 2, module["id"]
        assert len(module["lab"]["deliverables"]) >= 3, module["id"]
        assert len(module["interview"]["rubric"]) >= 4, module["id"]
        assert len(module["quiz"]) >= 2, module["id"]
        assert module["minutes"] >= 45, module["id"]

        for question in module["quiz"]:
            assert len(question["options"]) == 4, module["id"]
            assert 0 <= question["answer"] < len(question["options"]), module["id"]
            assert len(question["explanation"]) >= 30, module["id"]


def test_all_grace_nolan_source_sections_are_preserved():
    notes = NOTES_PATH.read_text(encoding="utf-8")
    course = load_course()
    source_titles = [module["source_title"] for module in course["modules"] if module.get("source_title")]

    assert len(source_titles) == 19
    assert len(set(source_titles)) == 19
    for title in source_titles:
        assert re.search(rf"^#{{2,3}} {re.escape(title)}$", notes, re.MULTILINE), title


def test_active_labs_include_safety_boundary_for_dual_use_work():
    serialized = json.dumps(load_course()).lower()
    assert "authorized local or lab targets" in serialized
    assert "build ssh botnet" not in serialized
    assert "uncontrolled offensive automation" in serialized


def test_security_ui_exposes_mastery_controls_and_gates_completion():
    html = HTML_PATH.read_text(encoding="utf-8")
    script = SCRIPT_PATH.read_text(encoding="utf-8")

    for element_id in (
        "securityReadiness",
        "securitySearch",
        "securityLab",
        "securityAssessment",
        "securitySource",
        "securityPrevious",
        "securityNext",
    ):
        assert f'id="{element_id}"' in html

    assert "record.quizPassed && record.labComplete" in script
    assert "score >= state.course.pass_score" in script
    assert "Missing source section" in script


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
