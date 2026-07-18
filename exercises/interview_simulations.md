# FDE Interview Simulations

Use these as timed practice prompts. Speak your assumptions out loud, build a small working version, then add tests or validation.

## Easy

Pull the mocked GitHub user response and generate a one-paragraph profile report.

Success criteria:
- Handles missing optional `name`.
- Reports username, follower count, and public repo count.
- Has one test or CLI validation.

## Medium

Integrate with a paginated repository endpoint and export a CSV summary.

Success criteria:
- Fetches all pages until an empty page.
- Exports name, stars, and language.
- Handles HTTP 429 with a clear retry/backoff plan.

## Hard

Sync GitHub and weather data into SQLite and generate an API operations dashboard.

Success criteria:
- Uses `.env` configuration.
- Stores normalized rows and raw JSON.
- Aggregates records by source.
- Logs failures with enough context to debug.
- Explains how you would deploy or schedule the workflow.
