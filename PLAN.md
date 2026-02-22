# Workspace Browser — Build Plan

## Summary
A self-hosted, VPN-accessible file browser for the OpenClaw workspace with:
- Token-based authentication
- Markdown rendering with beautiful typography
- Word/Confluence-style inline annotations (file / block / line / selection level)
- Bidirectional Telegram notifications (Shankar → Bruce → Shankar)
- Proactive heartbeat-driven comment resolution
- Extensible viewer architecture (plugin per file type)

---

## Tech Stack
| Layer | Choice | Why |
|---|---|---|
| Backend | FastAPI (Python 3.13, py313 conda env) | Already available, fast, clean API |
| Frontend framework | Svelte + Vite | Compiles to vanilla JS, component model, no React overhead |
| Styling | Tailwind CSS + @tailwindcss/typography | Beautiful prose rendering, utility-first |
| Markdown | marked.js + highlight.js | Reliable, fast, extensible |
| Annotations DB | SQLite (aiosqlite) | Zero infra, file-based, persistent |
| Notifications | OpenClaw local API (http://127.0.0.1:18789) | Already running, Telegram integration |
| Port | 8081 | 8080 is occupied |

---

## Directory Structure
```
projects/workspace-browser/
├── PLAN.md                  # This file
├── README.md
├── .browserignore           # Paths excluded from browsing
├── backend/
│   ├── server.py            # FastAPI app entrypoint
│   ├── config.py            # Auth token, workspace root, ignore rules
│   ├── routers/
│   │   ├── files.py         # GET /api/files, GET /api/file/{path}
│   │   └── annotations.py   # CRUD /api/annotations
│   ├── services/
│   │   ├── notify.py        # Telegram notification sender
│   │   └── ignore.py        # .browserignore parser
│   └── data/
│       └── annotations.db   # SQLite (auto-created)
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.svelte           # Shell: sidebar + viewer pane
│       ├── lib/
│       │   ├── api.js           # fetch wrappers for backend
│       │   └── notify.js        # local event bus
│       ├── components/
│       │   ├── FileTree.svelte          # Left panel, collapsible, icons by type
│       │   ├── AnnotationPanel.svelte   # Right margin thread view
│       │   ├── CommentBubble.svelte     # Inline margin badge (count)
│       │   ├── CommentThread.svelte     # Threaded replies, resolve button
│       │   └── Toolbar.svelte           # Top bar: file path, breadcrumb, actions
│       └── viewers/
│           ├── MarkdownViewer.svelte    # marked.js + block anchors
│           ├── CodeViewer.svelte        # highlight.js + line anchors
│           ├── ImageViewer.svelte       # img tag, zoom
│           ├── JsonViewer.svelte        # pretty-printed, collapsible
│           └── FallbackViewer.svelte    # raw text for unknown types
└── dist/                    # Built frontend (served by FastAPI)
```

---

## .browserignore (default)
```
agents/
.git/
__pycache__/
*.pyc
*.db
node_modules/
dist/
.env
auth.json
auth-profiles.json
```

---

## Annotation Data Model (SQLite)
```sql
CREATE TABLE annotations (
    id           TEXT PRIMARY KEY,        -- UUID
    file_path    TEXT NOT NULL,           -- relative to workspace root
    anchor_type  TEXT NOT NULL,           -- 'file' | 'block' | 'line' | 'selection'
    anchor_id    TEXT,                    -- block element ID, line number, etc.
    selected_text TEXT,                   -- highlighted text for selection anchors
    comment      TEXT NOT NULL,
    author       TEXT NOT NULL,           -- 'shankar' | 'bruce'
    parent_id    TEXT,                    -- for threaded replies (FK self)
    resolved     INTEGER DEFAULT 0,       -- 0=open, 1=resolved
    resolved_at  DATETIME,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Notification Logic

### Shankar comments → Bruce notified (real-time)
Trigger: `POST /api/annotations`
Message to Bruce via Telegram:
```
📝 New comment in `research/semantic-layers/v2-report.md`

> "The query generation component..."

Shankar: "This section needs more depth on Spider 2.0 benchmarks."
```

### Bruce replies → comment thread updated in DB
Bruce replies via annotation API (called by agent from Telegram or heartbeat).

### All comments in a file resolved → Shankar notified
Trigger: after every annotation resolution, check if file has 0 open root-level annotations.
Message to Shankar:
```
✅ All comments in `research/semantic-layers/v2-report.md` have been addressed.
```

### Heartbeat safety net
HEARTBEAT.md entry: check annotations.db for unresolved comments older than 30 minutes → address them proactively.

---

## UI Design Principles
- **Clean, minimal, professional** — think Notion document rendering meets GitHub code review
- Left panel: file tree with icons by type, `.browserignore` items hidden
- Main pane: full-width rendered content
- Right margin: comment count badges anchored to blocks (subtle, not intrusive)
- Click badge or highlight text → annotation panel slides in from right
- Resolved comments: muted/gray, green ✓, "Addressed by Bruce · 2h ago", collapsed by default
- File tree: files with unresolved comments show a dot indicator
- File tree: files with all-resolved comments show a subtle ✓
- Dark/light mode toggle

---

## Authentication
- Single shared Bearer token (stored in `config.py`, configurable via env var `BROWSER_TOKEN`)
- Token passed as query param for initial URL access: `http://mac-mini.local:8081/?token=xxx`
- Stored in browser localStorage after first auth, no re-entry needed
- All API routes protected by token middleware

---

## Viewer Plugin Contract
Each viewer Svelte component must:
- Accept props: `{ content: string, filePath: string, annotations: Annotation[] }`
- Emit events: `annotate({ anchorType, anchorId, selectedText })`
- Export static `canHandle(filename: string): boolean`

---

## Task List

### Phase 0: Cleanup (immediate)
- [ ] Kill existing `python -m http.server` process
- [ ] Enable macOS application firewall

### Phase 1: Backend
- [ ] FastAPI skeleton with token auth middleware
- [ ] `GET /api/files` — directory tree (respecting .browserignore)
- [ ] `GET /api/file/{path}` — file content (text/binary)
- [ ] `POST /api/annotations` — create annotation, fire Telegram notify
- [ ] `GET /api/annotations?file={path}` — list annotations for file
- [ ] `POST /api/annotations/{id}/reply` — threaded reply
- [ ] `POST /api/annotations/{id}/resolve` — mark resolved, check if all resolved → notify Shankar
- [ ] SQLite init + migrations
- [ ] Telegram notify service (POST to OpenClaw local API)
- [ ] .browserignore parser

### Phase 2: Frontend
- [ ] Svelte + Vite + Tailwind scaffold
- [ ] FileTree component (collapsible, icons, annotation dot indicators)
- [ ] Toolbar / breadcrumb
- [ ] MarkdownViewer (marked.js, block anchors, prose styling)
- [ ] CodeViewer (highlight.js, line anchors)
- [ ] ImageViewer
- [ ] JsonViewer
- [ ] FallbackViewer
- [ ] AnnotationPanel (threaded comments, resolve button, recently-resolved state)
- [ ] CommentBubble (margin badge, click to open panel)
- [ ] Selection-to-annotation flow (mouseup → popover → compose)
- [ ] Auth flow (token from URL → localStorage)
- [ ] Dark/light mode

### Phase 3: Integration & Polish
- [ ] FastAPI serves built `dist/` as static files
- [ ] HEARTBEAT.md updated with annotation check
- [ ] Startup script (`start.sh`) that activates conda env and starts server
- [ ] LaunchAgent plist for auto-start on boot
- [ ] README with setup instructions and token config
- [ ] End-to-end test: annotate a file, verify Bruce gets Telegram ping

---

## Running
```bash
# Start (after build)
cd ~/workspace/projects/workspace-browser
./start.sh

# Access (on VPN)
http://botusers-mini.lan:8081/?token=YOUR_TOKEN
```
