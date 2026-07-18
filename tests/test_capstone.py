import sqlite3

from fde_api_academy.projects.api_operations_dashboard import (
    build_report,
    initialize_database,
    normalize_github_user,
    save_snapshot,
)


def test_capstone_stores_and_reports():
    conn = sqlite3.connect(":memory:")
    initialize_database(conn)
    row = normalize_github_user({"login": "octocat", "name": "The Octocat", "followers": 42})
    save_snapshot(conn, row, "{}")
    assert build_report(conn) == [{"source": "github", "records": 1, "max_metric": 42}]
