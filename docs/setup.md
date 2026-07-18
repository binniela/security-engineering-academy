# Setup Guide

## 1. Create a virtual environment

```bash
cd /Users/vincentla/Documents/Playground/fde-api-academy
python3.11 -m venv .venv
source .venv/bin/activate
```

If `python3.11` is not installed, use any Python version newer than 3.11.

## 2. Install dependencies

```bash
pip install -e ".[dev]"
```

Or:

```bash
pip install -r requirements.txt
```

## 3. Configure environment variables

```bash
cp .env.example .env
```

The academy uses mocks by default. Add real tokens only when you want to try live API calls.

## 4. Start learning

```bash
fde list
fde show m01-python-reporting
fde validate m01-python-reporting
fde mentor m01-python-reporting
fde dashboard
```

Or launch the website UI:

```bash
python -m fde_api_academy.web.server
```

Then visit:

```text
http://127.0.0.1:8765
```

In the website, click `Code`, edit the Python directly, then press `Run`.
The page saves the student exercise file and runs validation for you.

Student exercise files live in:

```text
fde_api_academy/student/
```

Progress is stored locally in:

```text
data/progress/progress.json
```
