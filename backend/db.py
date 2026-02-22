"""
SQLite database initialization and helpers using aiosqlite.
"""
import aiosqlite
import logging
from backend.config import DB_PATH

logger = logging.getLogger(__name__)

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS annotations (
    id            TEXT PRIMARY KEY,
    file_path     TEXT NOT NULL,
    anchor_type   TEXT NOT NULL,
    anchor_id     TEXT,
    selected_text TEXT,
    comment       TEXT NOT NULL,
    author        TEXT NOT NULL,
    parent_id     TEXT REFERENCES annotations(id) ON DELETE CASCADE,
    resolved      INTEGER DEFAULT 0,
    resolved_at   DATETIME,
    resolved_by   TEXT,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ann_file_path ON annotations(file_path);
CREATE INDEX IF NOT EXISTS idx_ann_parent    ON annotations(parent_id);
"""


async def get_db() -> aiosqlite.Connection:
    """Open and return a database connection (caller must close)."""
    db = await aiosqlite.connect(str(DB_PATH))
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA foreign_keys = ON")
    return db


async def init_db():
    """Initialize the database schema."""
    async with aiosqlite.connect(str(DB_PATH)) as db:
        await db.executescript(CREATE_TABLE_SQL)
        await db.commit()
    logger.info(f"Database initialized at {DB_PATH}")
