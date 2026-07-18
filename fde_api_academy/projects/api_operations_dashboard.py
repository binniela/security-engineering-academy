from __future__ import annotations

import logging
import sqlite3
from pathlib import Path
from typing import Any

from fde_api_academy.http_client import fetch_github_user, fetch_weather


LOG = logging.getLogger("fde_api_academy.capstone")
DB_PATH = Path(__file__).resolve().parents[2] / "data" / "progress" / "operations.db"


def initialize_database(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        create table if not exists api_snapshots (
            id integer primary key autoincrement,
            source text not null,
            external_id text not null,
            title text not null,
            metric integer not null,
            raw_json text not null,
            created_at text default current_timestamp
        )
        """
    )
    conn.commit()


def normalize_github_user(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "source": "github",
        "external_id": user["login"],
        "title": user.get("name") or user["login"],
        "metric": int(user.get("followers", 0)),
    }


def normalize_weather(weather: dict[str, Any]) -> dict[str, Any]:
    return {
        "source": "weather",
        "external_id": weather["name"],
        "title": weather["weather"][0]["description"],
        "metric": int(weather["main"]["temp"]),
    }


def save_snapshot(conn: sqlite3.Connection, row: dict[str, Any], raw_json: str) -> None:
    conn.execute(
        "insert into api_snapshots (source, external_id, title, metric, raw_json) values (?, ?, ?, ?, ?)",
        (row["source"], row["external_id"], row["title"], row["metric"], raw_json),
    )
    conn.commit()


def build_report(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute(
        "select source, count(*), max(metric) from api_snapshots group by source order by source"
    ).fetchall()
    return [{"source": source, "records": count, "max_metric": max_metric} for source, count, max_metric in rows]


def run_dashboard(username: str = "octocat", city: str = "San Francisco", db_path: Path = DB_PATH) -> list[dict[str, Any]]:
    import json

    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    initialize_database(conn)
    try:
        github_user = fetch_github_user(username)
        weather = fetch_weather(city)
        save_snapshot(conn, normalize_github_user(github_user), json.dumps(github_user))
        save_snapshot(conn, normalize_weather(weather), json.dumps(weather))
        report = build_report(conn)
        LOG.info("Built operations dashboard report with %s rows", len(report))
        return report
    finally:
        conn.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print(run_dashboard())
