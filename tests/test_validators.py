from pathlib import Path

from fde_api_academy.validators import run_validator


def test_validator_can_validate_correct_temp_solution(tmp_path):
    solution = tmp_path / "solution.py"
    solution.write_text(
        "def summarize_users(users):\n"
        "    return {'total': len(users), 'active': sum(1 for u in users if u.get('active')), 'emails': [u.get('email') for u in users]}\n",
        encoding="utf-8",
    )

    import fde_api_academy.validators as validators

    original = validators.ROOT
    validators.ROOT = Path("/")
    try:
        passed, message = run_validator("validate_user_summary", str(solution))
    finally:
        validators.ROOT = original
    assert passed, message
