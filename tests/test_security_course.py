import json
import re

from fde_api_academy.web.server import STATIC_DIR


COURSE_PATH = STATIC_DIR / "data" / "security_course.json"
INTERVIEW_BANK_PATH = STATIC_DIR / "data" / "security_interview_bank.json"
CODING_CHALLENGES_PATH = STATIC_DIR / "data" / "security_coding_challenges.json"
ORAL_BOARDS_PATH = STATIC_DIR / "data" / "security_oral_boards.json"
NOTES_PATH = STATIC_DIR / "data" / "security_notes.md"
HTML_PATH = STATIC_DIR / "index.html"
SCRIPT_PATH = STATIC_DIR / "security.js"
STANDALONE_PATH = STATIC_DIR / "security.html"
HUB_SCRIPT_PATH = STATIC_DIR / "security-hub.js"
CODING_SCRIPT_PATH = STATIC_DIR / "security-coding.js"
CODING_WORKER_PATH = STATIC_DIR / "security-coding-worker.js"


def load_course():
    return json.loads(COURSE_PATH.read_text(encoding="utf-8"))


def load_interview_bank():
    return json.loads(INTERVIEW_BANK_PATH.read_text(encoding="utf-8"))


def load_coding_challenges():
    return json.loads(CODING_CHALLENGES_PATH.read_text(encoding="utf-8"))


def load_oral_boards():
    return json.loads(ORAL_BOARDS_PATH.read_text(encoding="utf-8"))


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

    assert "return moduleProgress(moduleId, progress).oralPassed" in script
    assert 'id="securityOralForm"' in script
    assert 'id="securityOralAnswer"' in script
    assert "No answer choices" in script
    assert 'type="radio"' not in script
    assert "securityQuizForm" not in script
    assert "oral_minimum_words" in script
    assert "Missing source section" in script
    assert "Missing source attribution" in script
    assert "quiz.length < 5" in script


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


def test_security_coding_lab_has_real_sourced_interview_challenges():
    payload = load_coding_challenges()
    challenges = payload["challenges"]

    assert payload["language"] == "Python 3"
    assert "anecdotal" in payload["methodology"]
    assert len(challenges) >= 8
    assert len({challenge["id"] for challenge in challenges}) == len(challenges)
    assert {"Google", "Amazon", "Sucuri", "Kaedim", "Security Compass"} <= {
        challenge["company"].split(" / ")[0] for challenge in challenges
    }

    for challenge in challenges:
        assert challenge["company"]
        assert challenge["role"]
        assert challenge["evidence_level"]
        assert challenge["source_url"].startswith("https://")
        assert len(challenge["source_note"]) >= 100
        assert challenge["entry_function"] in challenge["starter_code"]
        assert len(challenge["visible_tests"]) >= 1
        assert len(challenge["hidden_tests"]) >= 3
        assert all("name" in case and "args" in case and "expected" in case for case in challenge["visible_tests"] + challenge["hidden_tests"])


def test_security_coding_lab_runs_entirely_in_browser():
    standalone = STANDALONE_PATH.read_text(encoding="utf-8")
    coding_script = CODING_SCRIPT_PATH.read_text(encoding="utf-8")
    coding_worker = CODING_WORKER_PATH.read_text(encoding="utf-8")

    for element_id in (
        "securityViewCoding",
        "securityCodingList",
        "securityCodingEditor",
        "securityCodingRun",
        "securityCodingSubmit",
        "securityCodingSource",
    ):
        assert f'id="{element_id}"' in standalone

    assert 'src="/security-coding.js?v=3"' in standalone
    assert "/api/" not in coding_script
    assert "/api/" not in coding_worker
    assert 'new Worker(WORKER_URL, { type: "module" })' in coding_script
    assert "worker.terminate()" in coding_script
    assert "loadPyodide" in coding_worker
    assert "visible_tests" in coding_script
    assert "hidden_tests" in coding_script


def test_oral_boards_replace_easy_multiple_choice_with_deep_scenarios():
    course = load_course()
    interview_bank = load_interview_bank()
    oral_bank = load_oral_boards()
    modules = oral_bank["modules"]

    assert oral_bank["minimum_words"] >= 120
    assert len(modules) >= 14
    assert {
        "networking",
        "web-security",
        "api-security",
        "authentication",
        "identity-access",
        "cloud-containers",
        "secure-development",
        "threat-modeling",
        "detection-engineering",
        "incident-response",
        "coding-algorithms",
        "interview-execution",
    } <= set(modules)

    source_ids = set(interview_bank["sources"])
    for module_id, board in modules.items():
        assert module_id in {module["id"] for module in course["modules"]}
        assert board["frequency"] in {"Core", "Common", "Role-specific"}
        assert len(board["prompt"]) >= 120
        assert len(board["probes"]) == 5
        assert len(board["rubric"]) >= 6
        assert all(len(item) >= 50 for item in board["probes"])
        assert all(len(item) >= 50 for item in board["rubric"])
        assert set(board["sources"]) <= source_ids


def test_authentication_oral_board_covers_full_login_and_compromise_lifecycle():
    board = load_oral_boards()["modules"]["authentication"]
    serialized = json.dumps(board).lower()

    for concept in (
        "logs into",
        "credential verifier",
        "password hashing",
        "credential-stuffing",
        "session identifier",
        "csrf",
        "refresh token",
        "revoke",
        "account recovery",
        "telemetry",
    ):
        assert concept in serialized

    assert board["frequency"] == "Core"
    assert len(board["sources"]) >= 6
