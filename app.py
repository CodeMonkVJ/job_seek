from __future__ import annotations

import os
import re
import sqlite3
from datetime import datetime
from pathlib import Path

from flask import Flask, jsonify, request, session, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
USERS_DIR = DATA_DIR / "users"
GLOBAL_DB = DATA_DIR / "users.db"

ALLOWED_STATUSES = {"APPLIED", "INTERESTED", "ONGOING", "ACCEPTED", "REJECTED"}
USERNAME_RE = re.compile(r"^[a-zA-Z0-9_\-]{3,32}$")

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("JOB_SEEK_SECRET", "dev-secret-change-me")


def _connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_global_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    USERS_DIR.mkdir(parents=True, exist_ok=True)
    with _connect(GLOBAL_DB) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                db_path TEXT UNIQUE NOT NULL,
                created_at TEXT NOT NULL
            );
            """
        )


def init_user_db(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with _connect(db_path) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                link TEXT NOT NULL,
                status TEXT NOT NULL,
                yoe TEXT,
                location TEXT,
                keypoints TEXT,
                resume_tex TEXT,
                created_at TEXT NOT NULL
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS connections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id INTEGER NOT NULL,
                url TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
            );
            """
        )
        _ensure_jobs_column(conn, "title", "TEXT")


def _ensure_jobs_column(conn: sqlite3.Connection, column: str, column_type: str) -> None:
    existing = conn.execute("PRAGMA table_info(jobs)").fetchall()
    columns = {row["name"] for row in existing}
    if column not in columns:
        conn.execute(f"ALTER TABLE jobs ADD COLUMN {column} {column_type}")


def ensure_user_db_schema(db_path: Path) -> None:
    if not db_path.exists():
        init_user_db(db_path)
        return
    with _connect(db_path) as conn:
        _ensure_jobs_column(conn, "title", "TEXT")


def _current_user_db() -> Path | None:
    db_path = session.get("db_path")
    return Path(db_path) if db_path else None


def _require_auth() -> tuple[bool, dict] | None:
    if "user_id" not in session:
        return False, {"error": "not_authenticated"}
    return None


@app.route("/")
def index():
    return send_from_directory("templates", "index.html")


@app.route("/static/<path:filename>")
def static_files(filename: str):
    return send_from_directory("static", filename)


@app.route("/api/register", methods=["POST"])
def register():
    payload = request.get_json(silent=True) or {}
    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""

    if not USERNAME_RE.match(username):
        return jsonify({"error": "invalid_username"}), 400
    if len(password) < 8:
        return jsonify({"error": "password_too_short"}), 400

    db_path = USERS_DIR / f"{username}.db"
    init_user_db(db_path)

    try:
        with _connect(GLOBAL_DB) as conn:
            conn.execute(
                "INSERT INTO users (username, password_hash, db_path, created_at) VALUES (?, ?, ?, ?)",
                (username, generate_password_hash(password), str(db_path), datetime.utcnow().isoformat()),
            )
    except sqlite3.IntegrityError:
        return jsonify({"error": "username_taken"}), 409

    return jsonify({"ok": True})


@app.route("/api/login", methods=["POST"])
def login():
    payload = request.get_json(silent=True) or {}
    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""

    with _connect(GLOBAL_DB) as conn:
        row = conn.execute(
            "SELECT id, username, password_hash, db_path FROM users WHERE username = ?",
            (username,),
        ).fetchone()

    if not row or not check_password_hash(row["password_hash"], password):
        return jsonify({"error": "invalid_credentials"}), 401

    session["user_id"] = row["id"]
    session["username"] = row["username"]
    session["db_path"] = row["db_path"]

    return jsonify({"ok": True, "username": row["username"]})


@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"ok": True})


@app.route("/api/me")
def me():
    if "user_id" not in session:
        return jsonify({"authenticated": False})
    return jsonify({"authenticated": True, "username": session.get("username")})


@app.route("/api/jobs", methods=["GET", "POST"])
def jobs():
    auth_error = _require_auth()
    if auth_error:
        return jsonify(auth_error[1]), 401

    db_path = _current_user_db()
    if not db_path:
        return jsonify({"error": "no_db"}), 500
    ensure_user_db_schema(db_path)

    if request.method == "POST":
        payload = request.get_json(silent=True) or {}
        title = (payload.get("title") or "").strip()
        link = (payload.get("link") or "").strip()
        status = (payload.get("status") or "INTERESTED").strip().upper()
        yoe = (payload.get("yoe") or "").strip()
        location = (payload.get("location") or "").strip()
        keypoints = (payload.get("keypoints") or "").strip()

        if not link:
            return jsonify({"error": "link_required"}), 400
        if status not in ALLOWED_STATUSES:
            return jsonify({"error": "invalid_status"}), 400

        with _connect(db_path) as conn:
            conn.execute(
                """
                INSERT INTO jobs (title, link, status, yoe, location, keypoints, resume_tex, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    title or None,
                    link,
                    status,
                    yoe or None,
                    location or None,
                    keypoints or None,
                    None,
                    datetime.utcnow().isoformat(),
                ),
            )
        return jsonify({"ok": True})

    with _connect(db_path) as conn:
        rows = conn.execute(
            "SELECT id, title, link, status, yoe, location, keypoints, resume_tex, created_at FROM jobs ORDER BY created_at DESC"
        ).fetchall()
        jobs_list = []
        for row in rows:
            connections = conn.execute(
                "SELECT id, url, created_at FROM connections WHERE job_id = ? ORDER BY created_at DESC",
                (row["id"],),
            ).fetchall()
            jobs_list.append(
                {
                    "id": row["id"],
                    "title": row["title"],
                    "link": row["link"],
                    "status": row["status"],
                    "yoe": row["yoe"],
                    "location": row["location"],
                    "keypoints": row["keypoints"],
                    "resume_tex": row["resume_tex"],
                    "created_at": row["created_at"],
                    "connections": [
                        {"id": c["id"], "url": c["url"], "created_at": c["created_at"]}
                        for c in connections
                    ],
                }
            )

    return jsonify({"jobs": jobs_list})


@app.route("/api/jobs/<int:job_id>", methods=["PATCH"])
def update_job(job_id: int):
    auth_error = _require_auth()
    if auth_error:
        return jsonify(auth_error[1]), 401

    db_path = _current_user_db()
    if not db_path:
        return jsonify({"error": "no_db"}), 500
    ensure_user_db_schema(db_path)

    payload = request.get_json(silent=True) or {}
    fields = {}

    if "status" in payload:
        status = (payload.get("status") or "").strip().upper()
        if status not in ALLOWED_STATUSES:
            return jsonify({"error": "invalid_status"}), 400
        fields["status"] = status

    for key in ("title", "link", "yoe", "location", "keypoints"):
        if key in payload:
            fields[key] = (payload.get(key) or "").strip() or None

    if not fields:
        return jsonify({"error": "no_fields"}), 400

    set_clause = ", ".join(f"{k} = ?" for k in fields.keys())
    values = list(fields.values()) + [job_id]

    with _connect(db_path) as conn:
        conn.execute(f"UPDATE jobs SET {set_clause} WHERE id = ?", values)

    return jsonify({"ok": True})


@app.route("/api/jobs/<int:job_id>/resume", methods=["POST"])
def upload_resume(job_id: int):
    auth_error = _require_auth()
    if auth_error:
        return jsonify(auth_error[1]), 401

    db_path = _current_user_db()
    if not db_path:
        return jsonify({"error": "no_db"}), 500

    payload = request.get_json(silent=True) or {}
    resume_tex = payload.get("resume_tex")
    if resume_tex is None:
        return jsonify({"error": "resume_required"}), 400

    with _connect(db_path) as conn:
        conn.execute("UPDATE jobs SET resume_tex = ? WHERE id = ?", (resume_tex, job_id))

    return jsonify({"ok": True})


@app.route("/api/jobs/<int:job_id>/connections", methods=["POST"])
def add_connection(job_id: int):
    auth_error = _require_auth()
    if auth_error:
        return jsonify(auth_error[1]), 401

    db_path = _current_user_db()
    if not db_path:
        return jsonify({"error": "no_db"}), 500

    payload = request.get_json(silent=True) or {}
    url = (payload.get("url") or "").strip()
    if not url:
        return jsonify({"error": "url_required"}), 400

    with _connect(db_path) as conn:
        conn.execute(
            "INSERT INTO connections (job_id, url, created_at) VALUES (?, ?, ?)",
            (job_id, url, datetime.utcnow().isoformat()),
        )

    return jsonify({"ok": True})


init_global_db()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
