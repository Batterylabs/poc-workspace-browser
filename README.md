# Workspace Browser

A self-hosted, VPN-accessible file browser for the OpenClaw workspace with inline annotations, Telegram notifications, and beautiful rendering.

## Features

- 📁 **File browser** — full workspace tree with `.browserignore` filtering
- 📝 **Markdown rendering** — `marked.js` + `highlight.js` with `@tailwindcss/typography`
- 💻 **Code viewer** — syntax-highlighted, line-level comments
- 🖼️ **Image viewer** — with zoom controls
- `{}` **JSON viewer** — pretty-printed with syntax highlighting
- 💬 **Inline annotations** — file, block, line, and text-selection anchors
- 🔔 **Telegram notifications** — new comments notify Bruce; all-resolved notifies Shankar
- 🌙 **Dark mode** — persisted in localStorage
- 🔒 **Bearer token auth** — token from URL query param stored in localStorage

## Quick Start

```bash
cd ~/workspace/projects/workspace-browser
./start.sh
```

Then open: `http://mac-mini.local:8081/?token=YOUR_TOKEN`

The token is printed on startup:
```
==============================
  Workspace Browser started
  URL:   http://0.0.0.0:8081
  Token: <your-token-here>
  Root:  /Users/botuser/.openclaw/workspace
==============================
  Access: http://localhost:8081/?token=<your-token-here>
==============================
```

## Configuration

| Env Var | Default | Description |
|---|---|---|
| `BROWSER_TOKEN` | auto-generated UUID | Auth token |
| `WORKSPACE_ROOT` | `/Users/botuser/.openclaw/workspace` | Root directory to serve |
| `BROWSER_PORT` | `8081` | Port to listen on |

## .browserignore

Edit `.browserignore` to hide files/directories from the tree (gitignore-style patterns).

Default exclusions: `.git/`, `__pycache__/`, `node_modules/`, `*.db`, `.env`, auth files.

## Annotation API

| Endpoint | Description |
|---|---|
| `GET /api/annotations?file={path}` | List annotations for a file |
| `POST /api/annotations` | Create a new annotation |
| `POST /api/annotations/{id}/reply` | Reply to a thread |
| `POST /api/annotations/{id}/resolve` | Mark resolved |
| `DELETE /api/annotations/{id}` | Delete annotation |
| `GET /api/annotations/stats` | Per-file open/resolved counts |
| `GET /api/annotations/unresolved?older_than_minutes=30` | For heartbeat use |

## Development

```bash
# Backend only (no frontend build needed)
cd workspace-browser
eval "$(conda shell.bash hook)" && conda activate py313
pip install -r backend/requirements.txt
python -m uvicorn backend.server:app --host 0.0.0.0 --port 8081 --reload

# Frontend dev server (proxies to backend)
cd frontend
npm install
npm run dev

# Build frontend
cd frontend && npm run build
```

## Architecture

```
backend/
  server.py          FastAPI app, auth middleware, SPA serving
  config.py          Token, workspace root, paths
  db.py              SQLite init (aiosqlite)
  routers/
    files.py         File tree + content routes
    annotations.py   CRUD annotation routes
  services/
    notify.py        Telegram via OpenClaw local API
    ignore.py        .browserignore parser

frontend/src/
  App.svelte         Shell: auth, layout, file routing
  lib/
    api.js           Fetch wrappers
    store.js         Svelte stores (global state)
  components/
    FileTree.svelte  Sidebar tree with annotation indicators
    Toolbar.svelte   Breadcrumb + comment toggle
    AnnotationPanel.svelte  Right-side comment panel
    CommentThread.svelte    Thread with replies + resolve
  viewers/
    MarkdownViewer.svelte   marked.js + prose styling
    CodeViewer.svelte       hljs + line anchors
    ImageViewer.svelte      Zoom controls
    JsonViewer.svelte       Pretty JSON
    FallbackViewer.svelte   Raw text / binary
```
