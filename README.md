# Local Interview Academies

An interactive local learning platform with separate Forward Deployed Engineer and Security Engineering interview academies.

It focuses on practical startup engineering:

- REST APIs and HTTP
- JSON and nested data parsing
- Authentication and `.env` secrets
- Debugging broken integrations
- Automation workflows
- SQLite storage and reporting
- Realistic FDE interview simulations

## Quick Start

```bash
cd /Users/vincentla/Documents/Playground/fde-api-academy
python3.11 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
fde list
```

## Core Commands

```bash
fde list
fde show m01-python-reporting
fde validate m01-python-reporting
fde validate m05-github-profile --challenge --minutes 45
fde mentor m05-github-profile
fde dashboard
fde paths
```

## Web UI

Run the local browser interface:

```bash
python -m fde_api_academy.web.server
```

Then open:

```text
http://127.0.0.1:8765
```

The browser UI now includes an in-page code editor:

1. Open a lesson.
2. Click `Code`.
3. Edit the Python directly in the browser.
4. Click `Run`.

`Run` saves the student file and runs the lesson validator.

The localhost landing screen lets you choose between:

- **FDE API Academy** for Python, APIs, system design, and customer simulations.
- **Security Engineering Academy** for a 23-module intermediate security curriculum based on Grace Nolan's interview notes and expanded for the current engineering bar.

The Security Engineering Academy includes current concept lessons, applied examples, common weak answers, hands-on lab deliverables, interview rubrics, source notes, and scored knowledge checks. A security module is mastered only after both its lab and knowledge check are complete. Scores, notes, attempts, search state, and phase readiness stay local to the browser.

## Deploy Security Academy to Vercel

The Vercel build publishes only the standalone Security Engineering Academy. It does not deploy the Python backend, FDE interface, or any API routes.

1. Push this repository to GitHub.
2. Import the repository into Vercel.
3. Leave the project root at `fde-api-academy` if this directory is the repository root. For a larger monorepo, set Vercel's Root Directory to `fde-api-academy`.
4. Deploy. The checked-in `vercel.json` runs the static build and publishes `security-dist`.

To preview the exact Vercel output locally:

```bash
node scripts/build-security-site.mjs
python -m http.server 8766 --directory security-dist
```

The deployed academy has no server-side storage. Progress and notes remain in each browser's `localStorage` and do not sync between devices.

## How Lessons Work

Each lesson contains an explanation, visual example, example code, guided exercise, challenge exercise, validation test, reflection questions, and mentor hints.

Each lesson also includes three source-linked interview drills. These are original academy practice prompts based on public interview/prep sources for the same topic, with the source URL shown in the Code tab.

Lessons unlock sequentially. Progress is saved to:

```text
data/progress/progress.json
```

## Mentor Mode

When you are stuck, run:

```bash
fde mentor <lesson-id>
```

The mentor escalates gradually:

1. Small nudge
2. More guidance
3. Detailed guidance
4. Full solution explanation

## Student Files

Implement exercises in:

```text
fde_api_academy/student/
```

The starter files intentionally begin incomplete. Platform tests still pass before you solve them.

## Mock APIs

Mock responses live in:

```text
data/mock_responses/
```

The academy uses mocks by default through:

```text
FDE_ACADEMY_USE_MOCKS=true
```

## Capstone

The final capstone is the API Operations Dashboard:

```bash
python -m fde_api_academy.projects.api_operations_dashboard
```

See [docs/capstone.md](docs/capstone.md).

## Run Tests

```bash
pytest
```
