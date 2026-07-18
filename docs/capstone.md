# Capstone: API Operations Dashboard

Build a local operations dashboard that resembles real startup FDE work.

## Requirements

- Integrate with multiple APIs.
- Use `.env` for secrets and mock/live mode.
- Parse nested JSON responses.
- Store normalized rows and raw JSON in SQLite.
- Generate a useful report.
- Handle errors clearly.
- Log workflow progress.

## Included scaffold

The starter scaffold is:

```text
fde_api_academy/projects/api_operations_dashboard.py
```

Run it with mocks:

```bash
python -m fde_api_academy.projects.api_operations_dashboard
```

## Extension ideas

- Add GitHub repository snapshots.
- Add JSONPlaceholder todos as a task source.
- Add mock OpenAI summarization from `data/mock_responses/openai_summary.json`.
- Add retry logic for 429 and 500 responses.
- Export the dashboard report to CSV.
- Add a command-line argument parser for username and city.
