import json

from fde_api_academy.web.server import STATIC_DIR


DATA_PATH = STATIC_DIR / "data" / "palantir_academy.json"
HTML_PATH = STATIC_DIR / "index.html"
SCRIPT_PATH = STATIC_DIR / "palantir.js"
HUB_PATH = STATIC_DIR / "security-hub.js"


def load_academy():
    return json.loads(DATA_PATH.read_text(encoding="utf-8"))


def test_palantir_academy_prioritizes_the_confirmed_first_interview():
    academy = load_academy()

    assert academy["version"] >= 2
    assert academy["role"]["position"] == "Gotham Dev - Internship"
    assert academy["role"]["product"] == "Gotham"
    assert "Palo Alto" in academy["role"]["location_note"]
    assert [stage["id"] for stage in academy["loop"]] == [
        "coding",
        "behavioral",
        "learning",
        "decomposition",
        "hiring-manager",
    ]
    assert academy["loop"][0]["confidence"] == "Confirmed"
    assert academy["loop"][0]["duration"] == "30-45 min"
    assert all(stage["confidence"] in {"Confirmed", "Medium"} for stage in academy["loop"])
    assert "candidate portal" in academy["methodology"].lower()
    assert "anecdotal" in academy["methodology"].lower()


def test_confirmed_first_round_has_exact_timing_and_practice_protocol():
    academy = load_academy()
    round_data = academy["current_round"]
    serialized = json.dumps(round_data).lower()
    script = SCRIPT_PATH.read_text(encoding="utf-8")

    assert 'selected: "coding"' in script
    assert round_data["name"] == "Technical Problem Solving Interview"
    assert round_data["delivery"] == "30-45 minutes via Microsoft Teams"
    assert round_data["language"] == "Python"
    assert [item["time"] for item in round_data["structure"]] == ["~30 min", "~10 min", "~5 min"]
    assert len(round_data["technical_plan"]) == 5
    assert round_data["technical_plan"][0]["time"] == "0-2 min"
    assert round_data["technical_plan"][-1]["time"] == "26-30 min"
    assert len(round_data["background_prompts"]) == 3
    assert len(round_data["questions_to_ask"]) == 3
    assert len(round_data["prep_sessions"]) == 4
    assert round_data["sources"] == ["candidate-portal"]
    for expected in ("algorithmic", "leetcode", "map the solution", "think aloud", "test"):
        assert expected in serialized


def test_behavioral_section_has_ten_high_value_questions_with_followups():
    academy = load_academy()
    behavioral = academy["behavioral"]
    questions = behavioral["questions"]

    assert len(questions) == 10
    assert len({question["id"] for question in questions}) == 10
    serialized = json.dumps(questions).lower()
    for expected in (
        "tell me about yourself",
        "why palantir",
        "defense tech",
        "failure",
        "critical feedback",
        "tradeoff",
        "collaboration",
        "ownership",
        "learned an unfamiliar",
    ):
        assert expected in serialized

    for question in questions:
        assert len(question["followups"]) >= 3
        assert len(question["blueprint"]) >= 90
        assert len(question["avoid"]) >= 60
        assert question["sources"]

    assert "previous or current job" in behavioral["recent_signal"]
    assert "why Palantir" in behavioral["recent_signal"]
    assert "Never invent" in " ".join(behavioral["answer_framework"])
    assert "Citadel" in academy["sources"]["discord-local"]["note"]
    assert "excluded" in academy["sources"]["discord-local"]["note"]


def test_resume_personalization_is_specific_and_defensible():
    academy = load_academy()
    profile = academy["behavioral"]["resume_profile"]
    stories = profile["stories"]
    resume_grill = academy["hiring_manager"]["resume_grill"]
    serialized = json.dumps({"profile": profile, "grill": resume_grill}).lower()

    assert len(stories) == 6
    assert len({story["id"] for story in stories}) == 6
    assert all(len(story["pressure_questions"]) >= 5 for story in stories)
    assert all(story["best_for"] and story["prove"] and story["caution"] for story in stories)
    for expected in (
        "2,000+",
        "30,000+",
        "okta",
        "touch id",
        "idempotency",
        "oauth2/oidc",
        "99.5%",
        "ml-dsa",
        "fellwind",
    ):
        assert expected in serialized

    assert len(profile["risks"]) >= 5
    assert len(resume_grill["questions"]) >= 12
    assert "candidate evidence" == academy["sources"]["resume-local"]["kind"].lower()
    assert 'sourceBlock(["resume-local"]' in SCRIPT_PATH.read_text(encoding="utf-8")


def test_oa_and_coding_bank_distinguish_reports_from_analogues():
    academy = load_academy()
    oa = academy["oa"]
    problems = academy["coding"]["problems"]

    assert oa["current_format"]["duration"] == "90 minutes"
    assert "REST API" in oa["current_format"]["tasks"]
    assert "SQL" in oa["current_format"]["historical_variant"]
    assert len(oa["execution"]) == 5
    assert len(oa["must_know"]) >= 7
    assert len(problems) >= 12
    assert {problem["priority"] for problem in problems} == {"A", "B"}
    assert all(problem["url"].startswith("https://leetcode.com/problems/") for problem in problems)

    titles = {problem["title"] for problem in problems}
    assert {
        "Find Beautiful Indices in the Given Array I",
        "Merge Intervals",
        "Word Search",
        "Find Players With Zero or One Losses",
        "Merge k Sorted Lists",
        "UTF-8 Validation",
    } <= titles
    assert {problem["evidence"] for problem in problems} >= {
        "Reported exact",
        "Pattern analogue",
        "Pattern coverage",
    }


def test_user_supplied_palantir_tag_screenshots_are_fully_transcribed():
    academy = load_academy()
    tagged = academy["coding"]["tagged_problems"]

    assert len(tagged) == 29
    assert len({problem["number"] for problem in tagged}) == 29
    assert len({problem["slug"] for problem in tagged}) == 29
    assert {difficulty: sum(problem["difficulty"] == difficulty for problem in tagged) for difficulty in ("Easy", "Medium", "Hard")} == {
        "Easy": 5,
        "Medium": 19,
        "Hard": 5,
    }
    assert {problem["number"] for problem in tagged} == {
        5, 23, 56, 136, 146, 210, 217, 219, 220, 244, 245, 273, 303, 325,
        393, 427, 443, 539, 718, 721, 981, 1202, 1232, 2225, 2312, 2539,
        2964, 3006, 3008,
    }
    assert all(problem["acceptance"].endswith("%") for problem in tagged)
    assert all(len(problem["patterns"]) >= 2 for problem in tagged)
    assert "29 Palantir-tagged problems" in SCRIPT_PATH.read_text(encoding="utf-8") or "tagged_problems.length" in SCRIPT_PATH.read_text(encoding="utf-8")
    assert "Company tags are useful practice signals" in academy["sources"]["leetcode-screenshots"]["note"]


def test_grind75_checklist_is_complete_ordered_and_linked():
    academy = load_academy()
    grind75 = academy["coding"]["grind75"]
    tagged_slugs = {problem["slug"] for problem in academy["coding"]["tagged_problems"]}
    script = SCRIPT_PATH.read_text(encoding="utf-8")

    assert len(grind75) == 75
    assert [problem["rank"] for problem in grind75] == list(range(1, 76))
    assert len({problem["slug"] for problem in grind75}) == 75
    assert all(problem["difficulty"] in {"Easy", "Medium", "Hard"} for problem in grind75)
    assert all(10 <= problem["minutes"] <= 60 for problem in grind75)
    assert grind75[0]["title"] == "Two Sum"
    assert grind75[9]["title"] == "Maximum Subarray"
    assert grind75[-1]["title"] == "Kth Smallest Element in a BST"
    assert {difficulty: sum(problem["difficulty"] == difficulty for problem in grind75) for difficulty in ("Easy", "Medium", "Hard")} == {
        "Easy": 24,
        "Medium": 42,
        "Hard": 9,
    }
    assert "meeting-rooms" not in {problem["slug"] for problem in grind75}
    assert len({problem["slug"] for problem in grind75} & tagged_slugs) == 7
    assert academy["sources"]["grind75-official"]["url"] == "https://www.techinterviewhandbook.org/grind75/"
    assert "https://leetcode.com/problems/${esc(problem.slug)}/" in script
    assert 'data-grind-filter="overlap"' in script
    assert "data-grind-block" in script


def test_current_role_source_and_eligibility_are_visible():
    academy = load_academy()
    role = academy["role"]
    html = HTML_PATH.read_text(encoding="utf-8")
    current_role_url = "https://jobs.lever.co/palantir/8bcf4f33-0a79-4248-bbfd-49ac4be9dd8e"

    assert academy["sources"]["official-role"]["url"] == current_role_url
    assert f'href="{current_role_url}"' in html
    assert "f17e98d0-046a-4e6e-9d65-ed0b12dd0ff7" not in html
    assert "2028" in " ".join(role["signals"])
    assert "final internship" in " ".join(role["signals"])


def test_learning_decomposition_and_hiring_manager_are_interview_ready():
    academy = load_academy()
    learning = academy["learning"]
    decomposition = academy["decomposition"]
    hiring_manager = academy["hiring_manager"]

    assert len(learning["protocol"]) >= 6
    assert len(learning["drills"]) >= 4
    assert "race" in json.dumps(learning).lower()
    assert len(decomposition["framework"]) == 7
    assert len(decomposition["scenarios"]) >= 8
    assert "alert-triage" in json.dumps(decomposition).lower()
    assert len(hiring_manager["questions"]) >= 10
    assert "weakest" in hiring_manager["intro"].lower()
    assert len(academy["schedule"]) == 14


def test_palantir_ui_is_integrated_into_the_academy_hub():
    html = HTML_PATH.read_text(encoding="utf-8")
    script = SCRIPT_PATH.read_text(encoding="utf-8")
    hub = HUB_PATH.read_text(encoding="utf-8")

    for element_id in (
        "palantirAcademyView",
        "palantirStageNav",
        "palantirProgress",
        "palantirStageTitle",
        "palantirRoleBrief",
        "palantirPrevious",
        "palantirNext",
        "palantirContent",
    ):
        assert f'id="{element_id}"' in html

    assert 'data-open-academy="palantir"' in html
    assert 'src="/palantir.js?v=2"' in html
    assert "palantir-academy-progress-v1" in script
    assert "#palantir/" in script
    assert "window.PalantirAcademy" in script
    assert 'data-tagged-filter="all"' in script
    assert "data-tagged-difficulty" in script
    assert 'name === "palantir"' in hub
    assert 'window.location.hash.startsWith("#palantir/")' in hub
