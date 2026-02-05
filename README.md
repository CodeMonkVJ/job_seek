# job_seek

A lightweight job hunt tracker that keeps your search organized: job links, key points, status, LinkedIn outreach, and your Overleaf resume link — all in one place. Built with Flask + SQLite and a single-page UI.

## Features
- Multi-user login with hashed passwords
- One SQLite DB per user
- Track job links with status, YoE, location, and key points
- LinkedIn connections per job with status (PENDING / MESSAGED / REFERRED)
- Overleaf project link per job
- Collapsible job cards with tabbed details

## Tech Stack
- Backend: Python, Flask, SQLite
- Frontend: Vanilla JS + CSS (single page)

## Local Setup (Dev Server)
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open `http://localhost:5000`.

## Docker (Production Image)
### Build
```bash
docker build -t job_seek:latest .
```

### Run (Detached, Expose Port)
```bash
docker run -d --name job_seek \
  -p 5000:5000 \
  -e JOB_SEEK_SECRET="change-me" \
  -v $(pwd)/job_seek:/app/data \
  job_seek:latest
```

Notes:
- `-d` runs the container in the background (detached).
- `-p 5000:5000` maps host port `5000` to container port `5000`.
- Visit `http://localhost:5000` on the host.
- The container runs Gunicorn for production. Override the command to tune workers/threads if needed, for example:
```bash
docker run ... job_seek:latest gunicorn --bind 0.0.0.0:5000 --workers 4 --threads 4 app:app
```

### Stop / Remove
```bash
docker stop job_seek
docker rm job_seek
```

Notes:
- `JOB_SEEK_SECRET` should be a strong random string in production. It can be generated using - `python -c "import secrets; print(secrets.token_urlsafe(32))"`
- The `data/` volume holds the global users DB and per-user SQLite files.

## Project Layout
- `app.py` — Flask API + DB setup
- `templates/index.html` — main UI
- `static/app.js` — UI logic
- `static/styles.css` — UI styles
- `data/` — runtime SQLite files

## Status Codes
Jobs:
- `INTERESTED`, `APPLIED`, `ONGOING`, `ACCEPTED`, `REJECTED`

Connections:
- `PENDING`, `MESSAGED`, `REFERRED`
