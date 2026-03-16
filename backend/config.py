"""
Workspace Browser — Configuration
Auth token is loaded from env var BROWSER_TOKEN, or auto-generated once and persisted here.
"""
import os
import uuid
from pathlib import Path

# ── Workspace root ────────────────────────────────────────────────────────────

class WorkspaceState:
    def __init__(self):
        self.default_root = Path(os.environ.get("WORKSPACE_ROOT", "/Users/botuser/.openclaw/workspace"))
        self.root = self.default_root

    def set_root(self, path: str):
        self.root = Path(path)

workspace_state = WorkspaceState()


# ── Auth token ────────────────────────────────────────────────────────────────
_TOKEN_FILE = Path(__file__).parent / "_token.txt"

def _load_or_create_token() -> str:
    env_token = os.environ.get("BROWSER_TOKEN", "").strip()
    if env_token:
        return env_token
    if _TOKEN_FILE.exists():
        return _TOKEN_FILE.read_text().strip()
    token = str(uuid.uuid4())
    _TOKEN_FILE.write_text(token)
    return token

AUTH_TOKEN: str = _load_or_create_token()

# ── SQLite DB ─────────────────────────────────────────────────────────────────
DB_PATH = Path(__file__).parent / "data" / "annotations.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

# ── OpenClaw notification API ─────────────────────────────────────────────────
OPENCLAW_API = "http://127.0.0.1:18789/api/v1/message"
TELEGRAM_CHAT_ID = "8483574021"

# ── Port ──────────────────────────────────────────────────────────────────────
PORT = int(os.environ.get("BROWSER_PORT", "8081"))

# ── .browserignore path ───────────────────────────────────────────────────────
BROWSERIGNORE_PATH = Path(__file__).parent.parent / ".browserignore"
