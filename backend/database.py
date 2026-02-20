"""
Mizan.ai — Database (SQLite)
"""
import sqlite3
import os
from datetime import datetime, timedelta
from typing import Optional, List
import bcrypt

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "mizan.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            username        TEXT UNIQUE NOT NULL,
            password_hash   TEXT NOT NULL,
            language        TEXT DEFAULT 'fr',
            score_threshold INTEGER DEFAULT 70,
            created_at      TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS dismissed_articles (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id         INTEGER REFERENCES users(id),
            article_title   TEXT NOT NULL,
            reason          TEXT DEFAULT '',
            dismissed_at    TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS processed_articles (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id         INTEGER REFERENCES users(id),
            url             TEXT NOT NULL,
            processed_at    TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_processed_url
            ON processed_articles(user_id, url);

        CREATE TABLE IF NOT EXISTS url_cache (
            url             TEXT PRIMARY KEY,
            content         TEXT,
            fetched_at      TEXT DEFAULT CURRENT_TIMESTAMP
        );
    """)
    conn.commit()
    conn.close()
    print("✅ Base de données initialisée.")

# ... (hash/verify password functions remain)

def get_cached_content(url: str) -> str:
    """Returns cached content for a URL if it exists (valid forever/until purged)."""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT content FROM url_cache WHERE url = ?", (url,))
    row = cur.fetchone()
    conn.close()
    return row[0] if row else None

def cache_content(url: str, content: str):
    """Saves extracted content to cache."""
    conn = get_db()
    try:
        conn.execute("INSERT OR REPLACE INTO url_cache (url, content) VALUES (?, ?)", (url, content))
        conn.commit()
    except Exception:
        pass
    finally:
        conn.close()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_user(username: str, password: str, language: str = "fr", score_threshold: int = 70) -> int:
    conn = get_db()
    try:
        cursor = conn.execute(
            "INSERT INTO users (username, password_hash, language, score_threshold) VALUES (?, ?, ?, ?)",
            (username, hash_password(password), language, score_threshold)
        )
        conn.commit()
        user_id = cursor.lastrowid
        return user_id
    except sqlite3.IntegrityError:
        return -1  # Username already exists
    finally:
        conn.close()

def get_user_by_username(username: str) -> Optional[dict]:
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def get_user_by_id(user_id: int) -> Optional[dict]:
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def update_user(user_id: int, **kwargs):
    conn = get_db()
    allowed = {"language", "score_threshold"}
    updates = {k: v for k, v in kwargs.items() if k in allowed}
    if not updates:
        conn.close()
        return
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [user_id]
    conn.execute(f"UPDATE users SET {set_clause} WHERE id = ?", values)
    conn.commit()
    conn.close()

def update_password(user_id: int, new_password: str):
    conn = get_db()
    conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hash_password(new_password), user_id))
    conn.commit()
    conn.close()

def dismiss_article(user_id: int, article_title: str, reason: str = ""):
    conn = get_db()
    conn.execute(
        "INSERT INTO dismissed_articles (user_id, article_title, reason) VALUES (?, ?, ?)",
        (user_id, article_title, reason)
    )
    conn.commit()
    conn.close()

def get_dismissed_titles(user_id: int) -> List[str]:
    conn = get_db()
    rows = conn.execute(
        "SELECT article_title FROM dismissed_articles WHERE user_id = ?", (user_id,)
    ).fetchall()
    conn.close()
    return [r["article_title"] for r in rows]


# ── Processed Articles (Anti-Doublon) ────────────────────

def record_processed_urls(user_id: int, urls: List[str]):
    """Record a batch of article URLs as processed for this user."""
    if not urls:
        return
    conn = get_db()
    now = datetime.utcnow().isoformat()
    conn.executemany(
        "INSERT INTO processed_articles (user_id, url, processed_at) VALUES (?, ?, ?)",
        [(user_id, url, now) for url in urls],
    )
    conn.commit()
    conn.close()


def get_recent_processed_urls(user_id: int, days: int = 7) -> set:
    """Return the set of article URLs processed in the last `days` days."""
    conn = get_db()
    cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
    rows = conn.execute(
        "SELECT url FROM processed_articles WHERE user_id = ? AND processed_at >= ?",
        (user_id, cutoff),
    ).fetchall()
    conn.close()
    return {r["url"] for r in rows}


def purge_old_processed(days: int = 7):
    """Delete processed_articles entries older than `days` days."""
    conn = get_db()
    cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
    conn.execute("DELETE FROM processed_articles WHERE processed_at < ?", (cutoff,))
    conn.commit()
    conn.close()

def seed_users():
    """Create default users if they don't exist."""
    print("🌱 Vérification des utilisateurs par défaut...")
    try:
        users = [
            ("admin", "admin123", "fr", 60),
            ("john", "john123", "en", 75),
            ("yuki", "yuki123", "ja", 70),
            ("sarah", "sarah123", "fr", 65)
        ]

        for username, password, lang, threshold in users:
            if not get_user_by_username(username):
                create_user(username, password, language=lang, score_threshold=threshold)
                print(f"   👤 Utilisateur '{username}' créé ({lang})")
            else:
                print(f"   ✓ Utilisateur '{username}' existe déjà")

    except Exception as e:
        print(f"⚠️ Erreur création users par défaut: {e}")
