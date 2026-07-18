"""Generate auto-graded specs + starter files for every practice drill.

Each drill is defined once here with a reference implementation. Running the
reference over the case inputs produces the expected outputs, so the example,
the EXPECTED text, and the hidden grading cases can never drift apart.

Run:  python -m scripts.build_drills
It rewrites fde_api_academy/content/curriculum.json (adding grading fields to
every practice drill) and writes a starter stub per drill into the student dir.
"""

from __future__ import annotations

import json
import math
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CURRICULUM = ROOT / "fde_api_academy" / "content" / "curriculum.json"
STUDENT_DIR = ROOT / "fde_api_academy" / "student"


# ---------------------------------------------------------------------------
# Reference implementations.  These are the "answer keys"; they never ship to
# the browser, they only drive expected-output generation and live grading.
# ---------------------------------------------------------------------------

def ref_normalize_customer_records(records):
    users, incomplete = [], 0
    for rec in records:
        if not all(k in rec for k in ("name", "email", "active")):
            incomplete += 1
        users.append({
            "name": rec.get("name", "Unknown"),
            "email": rec.get("email", ""),
            "active": rec.get("active", False),
        })
    return {"users": users, "incomplete": incomplete}


def ref_build_text_report(records):
    total = len(records)
    active = sum(1 for r in records if r.get("active"))
    return f"Total customers: {total}\nActive customers: {active}\nInactive customers: {total - active}"


def ref_clean_records(records):
    users = [r for r in records if isinstance(r, dict)]
    return {"users": users, "errors": len(records) - len(users)}


def ref_extract_owner_emails(data):
    emails = []
    for account in data.get("accounts", []):
        owner = account.get("owner") or {}
        email = owner.get("email")
        if email:
            emails.append(email)
    return emails


def ref_flatten_contacts(records):
    rows = []
    for rec in records:
        profile = rec.get("profile") or {}
        company = rec.get("company") or {}
        rows.append({
            "name": profile.get("name"),
            "company": company.get("name"),
            "email": profile.get("email"),
            "phone": profile.get("phone"),
        })
    return rows


def ref_find_missing_emails(data):
    missing = []
    for user in data.get("users", []):
        contact = user.get("contact") or {}
        if not contact.get("email"):
            missing.append(user.get("id"))
    return missing


def ref_summarize_repos(json_string):
    repos = json.loads(json_string)
    languages = {}
    top, top_stars = None, -1
    for repo in repos:
        lang = repo.get("language", "Unknown")
        languages[lang] = languages.get(lang, 0) + 1
        if repo.get("stars", 0) > top_stars:
            top_stars = repo.get("stars", 0)
            top = repo.get("name")
    return {"total": len(repos), "top": top, "languages": languages}


def ref_round_trip(report):
    return json.loads(json.dumps(report))


def ref_flatten_json(data, prefix=""):
    flat = {}
    for key, value in data.items():
        path = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict):
            flat.update(ref_flatten_json(value, path))
        else:
            flat[path] = value
    return flat


def ref_status_action(code):
    if code in (200, 201, 204):
        return "accept"
    if code == 429:
        return "rate-limit backoff"
    if code in (401, 403):
        return "refresh credentials"
    if 500 <= code <= 599:
        return "retry"
    return "escalate"


def ref_explain_status(code):
    if code == 400:
        return "Bad request: the data sent was invalid."
    if code == 404:
        return "Not found: the requested resource does not exist."
    return f"Unexpected status: {code}"


def ref_split_retryable(responses):
    retryable, non_retryable = [], []
    for resp in responses:
        status = resp.get("status")
        if status == 429 or (status and 500 <= status <= 599):
            retryable.append(status)
        else:
            non_retryable.append(status)
    return {"retryable": retryable, "non_retryable": non_retryable}


def ref_build_query(params):
    return {k: v for k, v in params.items() if v not in (None, "", [])}


def ref_collect_all(pages):
    records = []
    for page in pages:
        if not page:
            break
        records.extend(page)
    return records


def ref_filter_results(results, language, min_stars):
    return [r["name"] for r in results if r.get("language") == language and r.get("stars", 0) >= min_stars]


def ref_validate_payload(payload, required):
    missing = [k for k in required if k not in payload]
    return {"valid": not missing, "missing": missing}


def ref_created_id(response):
    if response.get("status") == 201:
        return (response.get("body") or {}).get("id")
    return None


def ref_choose_body(endpoint):
    return "json" if endpoint.get("content_type") == "application/json" else "data"


def ref_choose_update_method(scenario):
    return "PUT" if scenario.get("fields_provided") == "all" else "PATCH"


def ref_build_patch(original, edited):
    return {k: v for k, v in edited.items() if original.get(k) != v}


def ref_guard_put(payload, required):
    missing = [k for k in required if k not in payload]
    return {"allowed": not missing, "missing": missing}


def ref_is_delete_success(status):
    return status == 204


def ref_delete_error_message(status):
    if status == 403:
        return "Forbidden: you do not have permission to delete this resource."
    if status == 404:
        return "Not found: the resource was already deleted or never existed."
    return f"Unexpected status: {status}"


def ref_soft_delete(records, target_id):
    active = []
    for rec in records:
        if rec.get("id") == target_id:
            continue
        if not rec.get("deleted"):
            active.append(rec)
    return active


def ref_build_auth_headers(env):
    token = env.get("API_TOKEN")
    if not token:
        return {}
    return {"Authorization": f"Bearer {token}"}


def ref_diagnose_auth(status):
    if status == 401:
        return "Missing or expired token: re-authenticate and retry."
    if status == 403:
        return "Insufficient permissions: request access for this resource."
    return "No auth issue detected."


def ref_redact_secret(token):
    if len(token) <= 4:
        return "****"
    return "****" + token[-4:]


def ref_repo_report(repos):
    total = len(repos)
    counts = {}
    total_stars, top, top_stars = 0, None, -1
    for repo in repos:
        lang = repo.get("language", "Unknown")
        counts[lang] = counts.get(lang, 0) + 1
        total_stars += repo.get("stargazers_count", 0)
        if repo.get("stargazers_count", 0) > top_stars:
            top_stars = repo.get("stargazers_count", 0)
            top = repo.get("name")
    percentages = {lang: round(c / total * 100) for lang, c in counts.items()}
    return {"total_stars": total_stars, "top_repo": top, "language_percentages": percentages}


def ref_triage_issues(issues, stale_days):
    open_by_label, stale = {}, []
    for issue in issues:
        if issue.get("state") != "open":
            continue
        label = issue.get("label", "unlabeled")
        open_by_label[label] = open_by_label.get(label, 0) + 1
        if issue.get("age_days", 0) > stale_days:
            stale.append(issue.get("id"))
    return {"open_by_label": open_by_label, "stale": stale}


def ref_recent_commit_counts(commits, days):
    counts = {}
    for commit in commits:
        if commit.get("days_ago", 0) < days:
            author = commit.get("author")
            counts[author] = counts.get(author, 0) + 1
    return counts


def ref_pipeline(accounts):
    active = [{"id": a["id"], "name": a["name"], "usage": a["usage"]} for a in accounts if a.get("active")]
    return sorted(active, key=lambda a: a["usage"], reverse=True)


def ref_group_by_plan(records):
    grouped = {}
    for rec in records:
        plan = rec.get("plan")
        bucket = grouped.setdefault(plan, {"count": 0, "total_usage": 0})
        bucket["count"] += 1
        bucket["total_usage"] += rec.get("usage", 0)
    return grouped


def ref_find_outliers(records, threshold):
    return [r["endpoint"] for r in records if r.get("p95", 0) > threshold]


def ref_to_csv_rows(records, columns):
    rows = [list(columns)]
    for rec in records:
        rows.append([str(rec.get(c, "")) for c in columns])
    return rows


def ref_flatten_for_csv(users):
    rows = []
    for user in users:
        profile = user.get("profile") or {}
        contact = user.get("contact") or {}
        rows.append({
            "name": profile.get("name"),
            "email": profile.get("email"),
            "phone": contact.get("phone"),
        })
    return rows


def ref_csv_escape(value):
    if any(ch in value for ch in (",", '"', "\n")):
        return '"' + value.replace('"', '""') + '"'
    return value


def ref_insert_records(records):
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE repos (name TEXT, stars INTEGER)")
    conn.executemany("INSERT INTO repos (name, stars) VALUES (?, ?)", [(r["name"], r["stars"]) for r in records])
    rows = conn.execute("SELECT name FROM repos ORDER BY name").fetchall()
    return [row[0] for row in rows]


def ref_aggregate_by_language(repos):
    grouped = {}
    for repo in repos:
        lang = repo.get("language")
        bucket = grouped.setdefault(lang, {"count": 0, "stars": 0})
        bucket["count"] += 1
        bucket["stars"] += repo.get("stars", 0)
    return grouped


def ref_find_duplicate_ids(records):
    counts = {}
    for rec in records:
        ext = rec.get("external_id")
        counts[ext] = counts.get(ext, 0) + 1
    return {ext: c for ext, c in counts.items() if c > 1}


def ref_safe_get(data, path):
    current = data
    for key in path.split("."):
        if isinstance(current, dict) and key in current:
            current = current[key]
        else:
            return None
    return current


def ref_parse_response(response):
    if response.get("content_type") == "application/json":
        try:
            return {"ok": True, "data": json.loads(response.get("body", ""))}
        except (ValueError, TypeError):
            pass
    return {
        "ok": False,
        "status": response.get("status"),
        "content_type": response.get("content_type"),
        "preview": (response.get("body") or "")[:40],
    }


def ref_backoff_schedule(n):
    return [2 ** i for i in range(n)]


def ref_build_adapter(doc):
    return {
        "base_url": doc.get("base_url"),
        "auth": doc.get("auth"),
        "endpoint": doc.get("endpoint"),
        "params": doc.get("params", []),
        "fields": doc.get("fields", []),
    }


def ref_count_items(fixture):
    body = json.loads(fixture.get("body", "{}"))
    return len(body.get("items", []))


def ref_normalize_event(record):
    source = record.get("source")
    if source == "github":
        return {"source": "github", "metric": "stars", "value": record.get("stars")}
    if source == "weather":
        return {"source": "weather", "metric": "temp", "value": record.get("temp")}
    return {"source": source, "metric": "unknown", "value": None}


def ref_idempotent_sync(existing_ids, incoming):
    return [rec for rec in incoming if rec.get("id") not in existing_ids]


def ref_retry_decision(status):
    return {
        429: "retry with backoff",
        500: "retry",
        400: "do not retry",
        401: "refresh auth",
    }.get(status, "escalate")


def ref_workflow_steps():
    return ["fetch", "store", "export", "log"]


def ref_executive_summary(records):
    total_usage = sum(r.get("usage", 0) for r in records)
    top = max(records, key=lambda r: r.get("usage", 0))["customer"] if records else None
    return {"total_customers": len(records), "total_usage": total_usage, "top_customer": top}


def ref_diagnose_integration(response):
    issues = []
    if response.get("status") == 401:
        issues.append("auth")
    if not response.get("json_valid", True):
        issues.append("parsing")
    if response.get("retries", 1) == 0:
        issues.append("retry")
    return sorted(issues)


def ref_sync_design_components():
    return ["extract", "transform", "load", "audit_log", "error_recovery"]


# --- Drills modeled on concretely reported FDE/FDSE interview tasks ---------

def ref_fetch_all_outlets(pages):
    items = []
    for page in pages:
        items.extend(page.get("data", []))
    return items


def ref_find_series(records, start_year, end_year):
    return [r["name"] for r in records if start_year <= r.get("year", 0) <= end_year]


def ref_session_duration_by_city(cities, clients, sessions):
    client_city = {c["id"]: c["city_id"] for c in clients}
    city_name = {c["id"]: c["name"] for c in cities}
    totals = {}
    for s in sessions:
        city_id = client_city.get(s["client_id"])
        if city_id is None:
            continue
        totals[city_id] = totals.get(city_id, 0) + s.get("duration", 0)
    rows = [{"city": city_name[cid], "total": total} for cid, total in totals.items()]
    rows.sort(key=lambda r: (r["total"], r["city"]))
    return rows


def ref_shape_areas(shapes):
    out = []
    for shape in shapes:
        kind = shape["type"]
        if kind == "circle":
            area = 3.14159265 * shape["r"] ** 2
        elif kind == "rectangle":
            area = shape["w"] * shape["h"]
        elif kind == "square":
            area = shape["side"] ** 2
        else:
            area = 0
        out.append(math.ceil(area))
    return out


def ref_portfolio_value(prices, holdings, date):
    total = 0
    for symbol, shares in holdings.items():
        best_date, best_price = None, None
        for p in prices:
            if p["symbol"] == symbol and p["date"] <= date:
                if best_date is None or p["date"] > best_date:
                    best_date, best_price = p["date"], p["price"]
        if best_price is not None:
            total += shares * best_price
    return total


def ref_count_contacts(pairs):
    contacts = {}
    seen = set()
    for a, b in pairs:
        if a == b:
            continue
        key = tuple(sorted((a, b)))
        if key in seen:
            continue
        seen.add(key)
        contacts.setdefault(a, set()).add(b)
        contacts.setdefault(b, set()).add(a)
    return {person: len(others) for person, others in contacts.items()}


# ---------------------------------------------------------------------------
# Drill specs.  (prompt, entry function, signature params, example args, ref,
# list of case arg-tuples, skill weights)
# ---------------------------------------------------------------------------

SPECS = {
    "m01-drill-1": ("Write normalize_customer_records(records). Each record may have optional 'name', 'email', and 'active' keys. Return {'users': [...], 'incomplete': N} where every user is filled with defaults ('Unknown', '', False) and 'incomplete' counts records missing any of the three keys.",
        "normalize_customer_records", ["records"], [[{"name": "Ada", "email": "ada@x.com", "active": True}, {"name": "Lin"}]], ref_normalize_customer_records,
        [([{"name": "Ada", "email": "ada@x.com", "active": True}, {"name": "Lin"}],), ([],), ([{}],), ([{"name": "A", "email": "a@x.com", "active": False}],)], {"data_parsing": 2}),
    "m01-drill-2": ("Write build_text_report(records). Given customer records (each with an 'active' flag), return a three-line string: 'Total customers: X', 'Active customers: Y', 'Inactive customers: Z' separated by newlines.",
        "build_text_report", ["records"], [[{"active": True}, {"active": False}, {"active": True}]], ref_build_text_report,
        [([{"active": True}, {"active": False}, {"active": True}],), ([],), ([{"active": False}],)], {"data_parsing": 2}),
    "m01-drill-3": ("Write clean_records(records). Some items may not be dictionaries. Return {'users': [...only dict rows...], 'errors': N} where N counts the skipped non-dict rows.",
        "clean_records", ["records"], [[{"name": "A"}, "bad", 5]], ref_clean_records,
        [([{"name": "A"}, "bad", 5],), ([],), ([1, 2, 3],), ([{"x": 1}, {"y": 2}],)], {"debugging": 2}),
    "m02-drill-1": ("Write extract_owner_emails(data) for data shaped like {'accounts': [{'owner': {'email': ...}}]}. Return a list of owner emails, skipping accounts with no owner or no email.",
        "extract_owner_emails", ["data"], [{"accounts": [{"owner": {"email": "a@x.com"}}, {"owner": {}}, {}]}], ref_extract_owner_emails,
        [({"accounts": [{"owner": {"email": "a@x.com"}}, {"owner": {}}, {}]},), ({"accounts": []},), ({},)], {"data_parsing": 2}),
    "m02-drill-2": ("Write flatten_contacts(records). Each record has 'profile' (name, email, phone) and 'company' (name) dicts. Return a flat list of {'name','company','email','phone'} using None for any missing value.",
        "flatten_contacts", ["records"], [[{"profile": {"name": "Ada", "email": "a@x.com", "phone": "555"}, "company": {"name": "Acme"}}]], ref_flatten_contacts,
        [([{"profile": {"name": "Ada", "email": "a@x.com", "phone": "555"}, "company": {"name": "Acme"}}],), ([{"profile": {"name": "Lin"}}],), ([],)], {"data_parsing": 2}),
    "m02-drill-3": ("Write find_missing_emails(data) for data shaped like {'users': [{'id': .., 'contact': {'email': ..}}]}. Return the list of user ids whose contact.email is missing or empty.",
        "find_missing_emails", ["data"], [{"users": [{"id": 1, "contact": {"email": "a@x.com"}}, {"id": 2, "contact": {}}]}], ref_find_missing_emails,
        [({"users": [{"id": 1, "contact": {"email": "a@x.com"}}, {"id": 2, "contact": {}}]},), ({"users": [{"id": 3, "contact": {"email": ""}}]},), ({"users": []},)], {"debugging": 2}),
    "m03-drill-1": ("Write summarize_repos(json_string). The string is JSON for a list of repos (each with 'name', 'stars', 'language'). Return {'total': N, 'top': name_with_most_stars, 'languages': {lang: count}}.",
        "summarize_repos", ["json_string"], ['[{"name": "api", "stars": 9, "language": "Python"}, {"name": "ui", "stars": 3, "language": "TS"}]'], ref_summarize_repos,
        [('[{"name": "api", "stars": 9, "language": "Python"}, {"name": "ui", "stars": 3, "language": "TS"}]',), ('[]',), ('[{"name": "solo", "stars": 1, "language": "Go"}]',)], {"data_parsing": 2}),
    "m03-drill-2": ("Write round_trip(report). Serialize the dict to JSON and parse it back, returning the restored object so it equals the original.",
        "round_trip", ["report"], [{"total": 3, "ok": True}], ref_round_trip,
        [({"total": 3, "ok": True},), ({"nested": {"a": [1, 2]}},), ({},)], {"data_parsing": 1}),
    "m03-drill-3": ("Write flatten_json(data). Turn a nested dict into a flat dict whose keys are dot paths, e.g. {'user': {'profile': {'name': 'Ada'}}} -> {'user.profile.name': 'Ada'}.",
        "flatten_json", ["data"], [{"user": {"profile": {"name": "Ada"}}}], ref_flatten_json,
        [({"user": {"profile": {"name": "Ada"}}},), ({"a": 1, "b": {"c": 2}},), ({},)], {"data_parsing": 2}),
    "m04-drill-1": ("Write status_action(code). Map an HTTP status to an action string: 2xx -> 'accept', 429 -> 'rate-limit backoff', 401/403 -> 'refresh credentials', 5xx -> 'retry', everything else -> 'escalate'.",
        "status_action", ["code"], [429], ref_status_action,
        [(200,), (204,), (429,), (401,), (503,), (418,)], {"debugging": 2}),
    "m04-drill-2": ("Write explain_status(code). Return a customer-facing message: 400 -> 'Bad request: the data sent was invalid.', 404 -> 'Not found: the requested resource does not exist.', otherwise 'Unexpected status: <code>'.",
        "explain_status", ["code"], [404], ref_explain_status,
        [(400,), (404,), (500,)], {"debugging": 1}),
    "m04-drill-3": ("Write split_retryable(responses) where each response is {'status': code}. Return {'retryable': [...statuses...], 'non_retryable': [...]}. Retryable means 429 or any 5xx.",
        "split_retryable", ["responses"], [[{"status": 200}, {"status": 429}, {"status": 500}, {"status": 400}]], ref_split_retryable,
        [([{"status": 200}, {"status": 429}, {"status": 500}, {"status": 400}],), ([],), ([{"status": 503}],)], {"debugging": 2}),
    "m05-drill-1": ("Write build_query(params). Return a new dict that drops any key whose value is None, '' or []. Keep everything else (status, page, per_page, sort).",
        "build_query", ["params"], [{"status": "open", "page": 1, "per_page": None, "sort": ""}], ref_build_query,
        [({"status": "open", "page": 1, "per_page": None, "sort": ""},), ({"a": 0, "b": None},), ({},)], {"api": 2}),
    "m05-drill-2": ("Write collect_all(pages). pages is a list of result pages (each a list). Concatenate records page by page and stop at the first empty page, returning the flattened list.",
        "collect_all", ["pages"], [[[1, 2], [3], []]], ref_collect_all,
        [([[1, 2], [3], []],), ([[1], [2]],), ([[]],), ([],)], {"api": 2}),
    "m05-drill-3": ("Write filter_results(results, language, min_stars). results is a list of {'name','language','stars'}. Return the names whose language matches and stars >= min_stars.",
        "filter_results", ["results", "language", "min_stars"], [[{"name": "a", "language": "Python", "stars": 5}, {"name": "b", "language": "Go", "stars": 9}], "Python", 3], ref_filter_results,
        [([{"name": "a", "language": "Python", "stars": 5}, {"name": "b", "language": "Go", "stars": 9}], "Python", 3), ([{"name": "c", "language": "Python", "stars": 1}], "Python", 3), ([], "Python", 0)], {"api": 2}),
    "m06-drill-1": ("Write validate_payload(payload, required). Return {'valid': bool, 'missing': [keys]} listing any required keys absent from payload.",
        "validate_payload", ["payload", "required"], [{"name": "Ada"}, ["name", "email"]], ref_validate_payload,
        [({"name": "Ada"}, ["name", "email"]), ({"name": "Ada", "email": "a@x.com"}, ["name", "email"]), ({}, [])], {"api": 2}),
    "m06-drill-2": ("Write created_id(response) for response {'status': code, 'body': {'id': ..}}. Return the created id only when status is 201, otherwise None.",
        "created_id", ["response"], [{"status": 201, "body": {"id": 7}}], ref_created_id,
        [({"status": 201, "body": {"id": 7}},), ({"status": 400, "body": {}},), ({"status": 201, "body": {}},)], {"api": 2}),
    "m06-drill-3": ("Write choose_body(endpoint). Return 'json' when endpoint['content_type'] is 'application/json', otherwise 'data' (form body).",
        "choose_body", ["endpoint"], [{"content_type": "application/json"}], ref_choose_body,
        [({"content_type": "application/json"},), ({"content_type": "application/x-www-form-urlencoded"},)], {"api": 1}),
    "m07-drill-1": ("Write choose_update_method(scenario). If scenario['fields_provided'] == 'all' return 'PUT', otherwise return 'PATCH' (partial update is safer when only some fields are present).",
        "choose_update_method", ["scenario"], [{"fields_provided": "some"}], ref_choose_update_method,
        [({"fields_provided": "all"},), ({"fields_provided": "some"},)], {"api": 1}),
    "m07-drill-2": ("Write build_patch(original, edited). Return a dict containing only the fields whose value changed from original to edited.",
        "build_patch", ["original", "edited"], [{"name": "Ada", "plan": "free"}, {"name": "Ada", "plan": "pro"}], ref_build_patch,
        [({"name": "Ada", "plan": "free"}, {"name": "Ada", "plan": "pro"}), ({"a": 1}, {"a": 1}), ({"a": 1, "b": 2}, {"a": 9, "b": 2})], {"api": 2}),
    "m07-drill-3": ("Write guard_put(payload, required). A PUT replaces the whole resource, so return {'allowed': bool, 'missing': [keys]} and only allow when every required field is present.",
        "guard_put", ["payload", "required"], [{"name": "Ada"}, ["name", "email"]], ref_guard_put,
        [({"name": "Ada"}, ["name", "email"]), ({"name": "Ada", "email": "a@x.com"}, ["name", "email"])], {"api": 2}),
    "m08-drill-1": ("Write is_delete_success(status). A DELETE that returns 204 No Content is a success. Return True only for 204, else False.",
        "is_delete_success", ["status"], [204], ref_is_delete_success,
        [(204,), (200,), (404,)], {"api": 1}),
    "m08-drill-2": ("Write delete_error_message(status). 403 -> 'Forbidden: you do not have permission to delete this resource.', 404 -> 'Not found: the resource was already deleted or never existed.', otherwise 'Unexpected status: <code>'.",
        "delete_error_message", ["status"], [403], ref_delete_error_message,
        [(403,), (404,), (500,)], {"debugging": 1}),
    "m08-drill-3": ("Write soft_delete(records, target_id). Each record has an 'id'. Remove the record whose id == target_id and also drop any record already flagged {'deleted': True}, returning the remaining active records.",
        "soft_delete", ["records", "target_id"], [[{"id": 1}, {"id": 2}, {"id": 3, "deleted": True}], 2], ref_soft_delete,
        [([{"id": 1}, {"id": 2}, {"id": 3, "deleted": True}], 2), ([{"id": 1}], 9), ([], 1)], {"api": 2}),
    "m09-drill-1": ("Write build_auth_headers(env) where env is a dict of environment variables. Read env['API_TOKEN'] and return {'Authorization': 'Bearer <token>'}; return {} when the token is missing (never hard-code secrets).",
        "build_auth_headers", ["env"], [{"API_TOKEN": "abc123"}], ref_build_auth_headers,
        [({"API_TOKEN": "abc123"},), ({},)], {"authentication": 2}),
    "m09-drill-2": ("Write diagnose_auth(status). 401 -> 'Missing or expired token: re-authenticate and retry.', 403 -> 'Insufficient permissions: request access for this resource.', otherwise 'No auth issue detected.'.",
        "diagnose_auth", ["status"], [401], ref_diagnose_auth,
        [(401,), (403,), (200,)], {"authentication": 2}),
    "m09-drill-3": ("Write redact_secret(token). Return the token with everything but the last four characters masked, e.g. 'abcd1234' -> '****1234'. Tokens of length <= 4 return '****'.",
        "redact_secret", ["token"], ["abcd1234"], ref_redact_secret,
        [("abcd1234",), ("xy",), ("123456",)], {"authentication": 2}),
    "m10-drill-1": ("Write repo_report(repos). Each repo has 'name', 'stargazers_count', 'language'. Return {'total_stars': N, 'top_repo': name, 'language_percentages': {lang: percent}} where percent is round(count/total*100).",
        "repo_report", ["repos"], [[{"name": "a", "stargazers_count": 10, "language": "Python"}, {"name": "b", "stargazers_count": 5, "language": "Go"}]], ref_repo_report,
        [([{"name": "a", "stargazers_count": 10, "language": "Python"}, {"name": "b", "stargazers_count": 5, "language": "Go"}],), ([{"name": "x", "stargazers_count": 1, "language": "Python"}, {"name": "y", "stargazers_count": 2, "language": "Python"}],)], {"data_parsing": 2}),
    "m10-drill-2": ("Write triage_issues(issues, stale_days). Each issue has 'id', 'label', 'state', 'age_days'. Return {'open_by_label': {label: count}, 'stale': [ids]} counting only open issues and flagging open issues older than stale_days.",
        "triage_issues", ["issues", "stale_days"], [[{"id": 1, "label": "bug", "state": "open", "age_days": 10}, {"id": 2, "label": "bug", "state": "closed", "age_days": 30}], 7], ref_triage_issues,
        [([{"id": 1, "label": "bug", "state": "open", "age_days": 10}, {"id": 2, "label": "bug", "state": "closed", "age_days": 30}], 7), ([], 7)], {"data_parsing": 2}),
    "m10-drill-3": ("Write recent_commit_counts(commits, days). Each commit has 'author' and 'days_ago'. Return {author: count} counting only commits with days_ago < days.",
        "recent_commit_counts", ["commits", "days"], [[{"author": "ada", "days_ago": 1}, {"author": "ada", "days_ago": 10}, {"author": "lin", "days_ago": 2}], 7], ref_recent_commit_counts,
        [([{"author": "ada", "days_ago": 1}, {"author": "ada", "days_ago": 10}, {"author": "lin", "days_ago": 2}], 7), ([], 7)], {"data_parsing": 2}),
    "m11-drill-1": ("Write pipeline(accounts). Each account has 'id','name','usage','active'. Return only active accounts as {'id','name','usage'}, sorted by usage descending.",
        "pipeline", ["accounts"], [[{"id": 1, "name": "a", "usage": 5, "active": True}, {"id": 2, "name": "b", "usage": 9, "active": True}, {"id": 3, "name": "c", "usage": 7, "active": False}]], ref_pipeline,
        [([{"id": 1, "name": "a", "usage": 5, "active": True}, {"id": 2, "name": "b", "usage": 9, "active": True}, {"id": 3, "name": "c", "usage": 7, "active": False}],), ([],)], {"data_parsing": 2}),
    "m11-drill-2": ("Write group_by_plan(records). Each record has 'plan' and 'usage'. Return {plan: {'count': N, 'total_usage': U}}.",
        "group_by_plan", ["records"], [[{"plan": "free", "usage": 2}, {"plan": "free", "usage": 3}, {"plan": "pro", "usage": 10}]], ref_group_by_plan,
        [([{"plan": "free", "usage": 2}, {"plan": "free", "usage": 3}, {"plan": "pro", "usage": 10}],), ([],)], {"data_parsing": 2}),
    "m11-drill-3": ("Write find_outliers(records, threshold). Each record has 'endpoint' and 'p95'. Return the endpoints whose p95 is strictly above threshold.",
        "find_outliers", ["records", "threshold"], [[{"endpoint": "/a", "p95": 120}, {"endpoint": "/b", "p95": 80}], 100], ref_find_outliers,
        [([{"endpoint": "/a", "p95": 120}, {"endpoint": "/b", "p95": 80}], 100), ([], 50)], {"data_parsing": 2}),
    "m12-drill-1": ("Write to_csv_rows(records, columns). Return a list of rows (lists) where the first row is the column headers and each value is str(rec.get(col, '')) so missing optional fields become blank.",
        "to_csv_rows", ["records", "columns"], [[{"name": "Ada", "email": "a@x.com"}, {"name": "Lin"}], ["name", "email"]], ref_to_csv_rows,
        [([{"name": "Ada", "email": "a@x.com"}, {"name": "Lin"}], ["name", "email"]), ([], ["a"])], {"data_parsing": 2}),
    "m12-drill-2": ("Write flatten_for_csv(users). Each user has 'profile' (name, email) and 'contact' (phone). Return a flat list of {'name','email','phone'} using None for missing values.",
        "flatten_for_csv", ["users"], [[{"profile": {"name": "Ada", "email": "a@x.com"}, "contact": {"phone": "555"}}]], ref_flatten_for_csv,
        [([{"profile": {"name": "Ada", "email": "a@x.com"}, "contact": {"phone": "555"}}],), ([{"profile": {"name": "Lin"}}],)], {"data_parsing": 2}),
    "m12-drill-3": ("Write csv_escape(value). If the string contains a comma, double-quote, or newline, wrap it in double quotes and double any internal quotes. Otherwise return it unchanged.",
        "csv_escape", ["value"], ['he said "hi"'], ref_csv_escape,
        [('a,b',), ('he said "hi"',), ('plain',), ('line\nbreak',)], {"data_parsing": 2}),
    "m13-drill-1": ("Write insert_records(records). Each record has 'name' and 'stars'. Create an in-memory SQLite table, insert the rows with a parameterized query, then return the names sorted alphabetically.",
        "insert_records", ["records"], [[{"name": "zeta", "stars": 1}, {"name": "alpha", "stars": 2}]], ref_insert_records,
        [([{"name": "zeta", "stars": 1}, {"name": "alpha", "stars": 2}],), ([],)], {"sql": 2}),
    "m13-drill-2": ("Write aggregate_by_language(repos). Each repo has 'language' and 'stars'. Return {language: {'count': N, 'stars': total}} (group-by language).",
        "aggregate_by_language", ["repos"], [[{"language": "Python", "stars": 3}, {"language": "Python", "stars": 4}, {"language": "Go", "stars": 1}]], ref_aggregate_by_language,
        [([{"language": "Python", "stars": 3}, {"language": "Python", "stars": 4}, {"language": "Go", "stars": 1}],), ([],)], {"sql": 2}),
    "m13-drill-3": ("Write find_duplicate_ids(records). Each record has 'external_id'. Return {external_id: count} for every id that appears more than once.",
        "find_duplicate_ids", ["records"], [[{"external_id": "a"}, {"external_id": "a"}, {"external_id": "b"}]], ref_find_duplicate_ids,
        [([{"external_id": "a"}, {"external_id": "a"}, {"external_id": "b"}],), ([],)], {"sql": 2}),
    "m14-drill-1": ("Write safe_get(data, path). path is a dotted key path like 'user.profile.name'. Walk the nested dict and return the value, or None if any key along the path is missing (no KeyError).",
        "safe_get", ["data", "path"], [{"user": {"profile": {"name": "Ada"}}}, "user.profile.name"], ref_safe_get,
        [({"user": {"profile": {"name": "Ada"}}}, "user.profile.name"), ({"user": {}}, "user.profile.name"), ({}, "a.b")], {"debugging": 2}),
    "m14-drill-2": ("Write parse_response(response) for response {'status','content_type','body'}. If content_type is 'application/json' and body parses, return {'ok': True, 'data': parsed}. Otherwise return {'ok': False, 'status': .., 'content_type': .., 'preview': body[:40]}.",
        "parse_response", ["response"], [{"status": 200, "content_type": "application/json", "body": '{"id": 1}'}], ref_parse_response,
        [({"status": 200, "content_type": "application/json", "body": '{"id": 1}'},), ({"status": 500, "content_type": "text/html", "body": "<html>oops</html>"},), ({"status": 200, "content_type": "application/json", "body": "not json"},)], {"debugging": 2}),
    "m14-drill-3": ("Write backoff_schedule(n). Return the exponential backoff delays for n retries as [1, 2, 4, 8, ...] (i.e. 2**i for i in range(n)).",
        "backoff_schedule", ["n"], [3], ref_backoff_schedule,
        [(3,), (1,), (0,), (5,)], {"automation": 2}),
    "m15-drill-1": ("Write build_adapter(doc). Given an API docs dict, return an adapter {'base_url','auth','endpoint','params','fields'} pulled from the matching doc keys (params/fields default to []).",
        "build_adapter", ["doc"], [{"base_url": "https://api.x.com", "auth": "bearer", "endpoint": "/users", "params": ["page"], "fields": ["id", "name"]}], ref_build_adapter,
        [({"base_url": "https://api.x.com", "auth": "bearer", "endpoint": "/users", "params": ["page"], "fields": ["id", "name"]},), ({"base_url": "https://b.com", "auth": "none", "endpoint": "/x"},)], {"api": 2}),
    "m15-drill-2": ("Write count_items(fixture). fixture is a mock response {'body': json_string} where the body decodes to {'items': [...]}. Return the number of items.",
        "count_items", ["fixture"], [{"body": '{"items": [1, 2, 3]}'}], ref_count_items,
        [({"body": '{"items": [1, 2, 3]}'},), ({"body": '{"items": []}'},)], {"api": 2}),
    "m15-drill-3": ("Write normalize_event(record). github records {'source':'github','stars':N} -> {'source':'github','metric':'stars','value':N}; weather records {'source':'weather','temp':T} -> {'source':'weather','metric':'temp','value':T}.",
        "normalize_event", ["record"], [{"source": "github", "stars": 12}], ref_normalize_event,
        [({"source": "github", "stars": 12},), ({"source": "weather", "temp": 70},)], {"data_parsing": 2}),
    "m16-drill-1": ("Write idempotent_sync(existing_ids, incoming). existing_ids is a list of ids already stored; incoming is a list of records with an 'id'. Return only the records whose id is not already present, so the job is safe to rerun.",
        "idempotent_sync", ["existing_ids", "incoming"], [[1, 2], [{"id": 1}, {"id": 3}]], ref_idempotent_sync,
        [([1, 2], [{"id": 1}, {"id": 3}]), ([], [{"id": 5}]), ([1, 2], [])], {"automation": 2}),
    "m16-drill-2": ("Write retry_decision(status). 429 -> 'retry with backoff', 500 -> 'retry', 400 -> 'do not retry', 401 -> 'refresh auth', anything else -> 'escalate'.",
        "retry_decision", ["status"], [429], ref_retry_decision,
        [(429,), (500,), (400,), (401,), (418,)], {"automation": 2}),
    "m16-drill-3": ("Write workflow_steps(). Return the ordered automation steps for the morning report job as the list ['fetch', 'store', 'export', 'log'].",
        "workflow_steps", [], [], ref_workflow_steps,
        [()], {"automation": 1}),
    "m17-drill-1": ("Write executive_summary(records). Each record has 'customer' and 'usage'. Return {'total_customers': N, 'total_usage': sum, 'top_customer': name_with_highest_usage}.",
        "executive_summary", ["records"], [[{"customer": "Acme", "usage": 12}, {"customer": "Globex", "usage": 20}]], ref_executive_summary,
        [([{"customer": "Acme", "usage": 12}, {"customer": "Globex", "usage": 20}],), ([{"customer": "Solo", "usage": 1}],)], {"data_parsing": 2}),
    "m17-drill-2": ("Write diagnose_integration(response) for {'status', 'json_valid', 'retries'}. Return a sorted list of issue tags: add 'auth' when status is 401, 'parsing' when json_valid is False, and 'retry' when retries is 0.",
        "diagnose_integration", ["response"], [{"status": 401, "json_valid": False, "retries": 0}], ref_diagnose_integration,
        [({"status": 401, "json_valid": False, "retries": 0},), ({"status": 200, "json_valid": True, "retries": 2},), ({"status": 200, "json_valid": False, "retries": 1},)], {"debugging": 2}),
    "m17-drill-3": ("Write sync_design_components(). Return the ordered components of a robust CRM<->product sync as ['extract', 'transform', 'load', 'audit_log', 'error_recovery'].",
        "sync_design_components", [], [], ref_sync_design_components,
        [()], {"automation": 1}),

    # ---- Reported real interview tasks (see NEW_DRILLS attribution) ----
    "m05-drill-4": ("Reported Palantir FDSE 'Finest Food Outlets' HackerRank task. Write fetch_all_outlets(pages). pages is the list of paginated API responses, each {'page','per_page','total_pages','data':[...]}. Return every item from 'data', concatenated across all pages in order.",
        "fetch_all_outlets", ["pages"], [[{"page": 1, "per_page": 2, "total_pages": 2, "data": ["A", "B"]}, {"page": 2, "per_page": 2, "total_pages": 2, "data": ["C"]}]], ref_fetch_all_outlets,
        [([{"page": 1, "per_page": 2, "total_pages": 2, "data": ["A", "B"]}, {"page": 2, "per_page": 2, "total_pages": 2, "data": ["C"]}],), ([{"page": 1, "per_page": 5, "total_pages": 1, "data": []}],), ([{"page": 1, "per_page": 1, "total_pages": 3, "data": ["x"]}, {"page": 2, "per_page": 1, "total_pages": 3, "data": ["y"]}, {"page": 3, "per_page": 1, "total_pages": 3, "data": ["z"]}],)], {"api": 2}),
    "m05-drill-5": ("Reported Palantir REST task (jsonmock tvseries). Write find_series(records, start_year, end_year). Each record is {'name','year'}. Return the names whose year is within [start_year, end_year] inclusive.",
        "find_series", ["records", "start_year", "end_year"], [[{"name": "Show A", "year": 2010}, {"name": "Show B", "year": 2020}], 2000, 2015], ref_find_series,
        [([{"name": "Show A", "year": 2010}, {"name": "Show B", "year": 2020}], 2000, 2015), ([{"name": "Old", "year": 1999}], 2000, 2015), ([], 2000, 2015)], {"api": 2}),
    "m13-drill-4": ("Reported Palantir FDSE SQL task 'Client Session Duration Report'. Write session_duration_by_city(cities, clients, sessions). Join clients to cities (client.city_id -> city.id) and sessions to clients (session.client_id -> client.id). Return [{'city','total'}] of total session duration per city, sorted ascending by total then city name.",
        "session_duration_by_city", ["cities", "clients", "sessions"], [[{"id": 1, "name": "Austin"}, {"id": 2, "name": "Boston"}], [{"id": 10, "city_id": 1}, {"id": 11, "city_id": 2}], [{"client_id": 10, "duration": 30}, {"client_id": 11, "duration": 20}, {"client_id": 10, "duration": 5}]], ref_session_duration_by_city,
        [([{"id": 1, "name": "Austin"}, {"id": 2, "name": "Boston"}], [{"id": 10, "city_id": 1}, {"id": 11, "city_id": 2}], [{"client_id": 10, "duration": 30}, {"client_id": 11, "duration": 20}, {"client_id": 10, "duration": 5}]), ([{"id": 1, "name": "Solo"}], [{"id": 9, "city_id": 1}], [])], {"sql": 2}),
    "m11-drill-4": ("Reported Palantir phone-screen task: portfolio valuation with carry-forward prices. Write portfolio_value(prices, holdings, date). prices is [{'date','symbol','price'}] (sparse, ISO dates); holdings is {symbol: shares}; date is the valuation date. For each holding use the most recent price on or before date (0 if none) and return the total value.",
        "portfolio_value", ["prices", "holdings", "date"], [[{"date": "2024-01-01", "symbol": "AAPL", "price": 100}, {"date": "2024-01-03", "symbol": "AAPL", "price": 110}], {"AAPL": 2}, "2024-01-02"], ref_portfolio_value,
        [([{"date": "2024-01-01", "symbol": "AAPL", "price": 100}, {"date": "2024-01-03", "symbol": "AAPL", "price": 110}], {"AAPL": 2}, "2024-01-02"), ([{"date": "2024-01-05", "symbol": "MSFT", "price": 50}], {"MSFT": 3}, "2024-01-01"), ([{"date": "2024-01-01", "symbol": "A", "price": 10}, {"date": "2024-01-02", "symbol": "B", "price": 20}], {"A": 1, "B": 2}, "2024-01-02")], {"data_parsing": 2}),
    "m01-drill-4": ("Reported Palantir FDSE 'Shape Classes' HackerRank task. Write shape_areas(shapes). Each shape is {'type': 'circle'|'rectangle'|'square', ...dims} ('r' for circle, 'w'/'h' for rectangle, 'side' for square). Use pi = 3.14159265 and return the ceiling of each area as a list of ints.",
        "shape_areas", ["shapes"], [[{"type": "circle", "r": 1.2}, {"type": "square", "side": 3}]], ref_shape_areas,
        [([{"type": "circle", "r": 1.2}, {"type": "square", "side": 3}],), ([{"type": "rectangle", "w": 2, "h": 5}],), ([],)], {"data_parsing": 2}),
    "m14-drill-4": ("Reported Palantir debugging round: fix a double-counting contact-tracing bug. Write count_contacts(pairs). pairs is a list of [a, b] contacts that may be duplicated or reversed. Count each unique undirected contact once (ignore self-pairs) and return {person: number_of_distinct_contacts}.",
        "count_contacts", ["pairs"], [[["ada", "lin"], ["lin", "ada"], ["ada", "sam"]]], ref_count_contacts,
        [([["ada", "lin"], ["lin", "ada"], ["ada", "sam"]],), ([["a", "a"], ["a", "b"]],), ([],)], {"debugging": 2}),
}


# New drills to inject into curriculum.json (lesson id -> metadata stubs).
# Grading fields come from SPECS above; these supply title + real attribution.
PAL_HACKERRANK = "https://www.linkjob.ai/interview-questions/palantir-hackerrank-challenge/"
PAL_PROCESS = "https://www.linkjob.ai/interview-questions/palantir-interview-process-questions/"
NOTE = "Modeled on a task reported by candidates for Palantir's Forward Deployed (Software) Engineer interview; verified against public write-ups on 2026-06-08."

NEW_DRILLS = {
    "m05-github-profile": [
        {"id": "m05-drill-4", "title": "Paginate an API (Finest Food Outlets)",
         "source_title": "Palantir FDSE HackerRank Online Assessment (reported)", "source_url": PAL_HACKERRANK, "verification_note": NOTE},
        {"id": "m05-drill-5", "title": "Filter REST records by period (tvseries)",
         "source_title": "Palantir REST/API interview task (reported)", "source_url": PAL_PROCESS, "verification_note": NOTE},
    ],
    "m13-sqlite-store": [
        {"id": "m13-drill-4", "title": "Session duration per city (SQL join)",
         "source_title": "Palantir FDSE HackerRank SQL task (reported)", "source_url": PAL_HACKERRANK, "verification_note": NOTE},
    ],
    "m11-transformations": [
        {"id": "m11-drill-4", "title": "Portfolio valuation with carry-forward",
         "source_title": "Palantir technical phone screen (reported)", "source_url": PAL_PROCESS, "verification_note": NOTE},
    ],
    "m01-python-reporting": [
        {"id": "m01-drill-4", "title": "Shape areas with ceiling",
         "source_title": "Palantir FDSE HackerRank 'Shape Classes' (reported)", "source_url": PAL_HACKERRANK, "verification_note": NOTE},
    ],
    "m14-debugging-lab": [
        {"id": "m14-drill-4", "title": "Fix double-counted contacts",
         "source_title": "Palantir debugging interview round (reported)", "source_url": PAL_PROCESS, "verification_note": NOTE},
    ],
}


STARTER_IMPORTS = {
    "summarize_repos": "import json",
    "round_trip": "import json",
    "parse_response": "import json",
    "count_items": "import json",
    "insert_records": "import sqlite3",
}


def make_starter(entry: str, params: list[str]) -> str:
    sig = ", ".join(params)
    body = "    # TODO: implement this drill, then press Run to grade it.\n    pass\n"
    header = f"{STARTER_IMPORTS[entry]}\n\n" if entry in STARTER_IMPORTS else ""
    return f"{header}def {entry}({sig}):\n{body}"


def py_repr(value) -> str:
    return repr(value)


def build():
    raw = json.loads(CURRICULUM.read_text(encoding="utf-8"))
    STUDENT_DIR.mkdir(parents=True, exist_ok=True)

    # Inject any new real-sourced drills that aren't already present.
    added = 0
    for module in raw:
        for lesson in module["lessons"]:
            new_meta = NEW_DRILLS.get(lesson["id"])
            if not new_meta:
                continue
            drills = lesson.setdefault("practice_drills", [])
            existing = {d["id"] for d in drills}
            for meta in new_meta:
                if meta["id"] not in existing:
                    drills.append(dict(meta))
                    added += 1

    patched = 0
    for module in raw:
        for lesson in module["lessons"]:
            for drill in lesson.get("practice_drills", []):
                spec = SPECS.get(drill["id"])
                if not spec:
                    continue
                prompt, entry, params, example_args, ref, case_args, skills = spec
                example_out = ref(*example_args)
                cases = [{"args": list(args), "expected": ref(*args)} for args in case_args]
                example_in = ", ".join(py_repr(a) for a in example_args) if example_args else ""
                starter_rel = f"fde_api_academy/student/drill_{drill['id'].replace('-', '_')}.py"
                starter_path = ROOT / starter_rel
                if not starter_path.exists():
                    starter_path.write_text(make_starter(entry, params), encoding="utf-8")

                def fmt_case(args, expected):
                    arg_text = ", ".join(py_repr(a) for a in args)
                    return f"{entry}({arg_text}) -> {py_repr(expected)}"

                shown = min(3, len(case_args))
                visible = [fmt_case(args, ref(*args)) for args in case_args[:shown]]
                hidden = len(case_args) - shown
                case_word = "case" if len(cases) == 1 else "cases"
                header = f"Graded on {len(cases)} test {case_word}. Your function must return exactly these results:"
                if hidden:
                    verb = "is" if hidden == 1 else "are"
                    noun = "case" if hidden == 1 else "cases"
                    header += f"\n(showing {shown}; {hidden} more {noun} {verb} hidden)"
                expected_text = header + "\n\n" + "\n\n".join(visible)

                drill["prompt"] = prompt
                drill["entry_function"] = entry
                drill["starter_file"] = starter_rel
                drill["example"] = f"{entry}({example_in}) -> {py_repr(example_out)}"
                drill["expected"] = expected_text
                drill["cases"] = cases
                drill["skill_weights"] = skills
                patched += 1
    CURRICULUM.write_text(json.dumps(raw, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Added {added} new drills; patched {patched} drills; starter files in {STUDENT_DIR}")


if __name__ == "__main__":
    build()
