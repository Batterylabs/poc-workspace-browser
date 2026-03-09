# Offline Mode Plan — Workspace Browser

## Architecture Overview

The offline mode adds 6 layers to the existing SPA:

```
┌─────────────────────────────────────────────────────┐
│  UI Layer (Svelte)                                   │
│  - OfflineIndicator component (banner + dot)        │
│  - Pending badge on queued annotations              │
│  - SyncStatus indicator (syncing / error / ok)      │
├─────────────────────────────────────────────────────┤
│  Store Layer (Svelte stores)                         │
│  - isOnline (writable, reactive)                     │
│  - syncStatus ('idle' | 'syncing' | 'error')        │
│  - pendingCount (derived from queue)                │
├─────────────────────────────────────────────────────┤
│  API Layer (api.js — modified)                       │
│  - Intercepts annotation POST failures              │
│  - Falls back to offline queue when offline          │
│  - File fetches check cache first when offline       │
├─────────────────────────────────────────────────────┤
│  Offline Queue (offlineQueue.js)                     │
│  - Queues annotation creates + replies               │
│  - Encrypts payloads before IndexedDB storage        │
│  - Flushes on reconnect, handles conflicts           │
├─────────────────────────────────────────────────────┤
│  Crypto Layer (crypto.js)                            │
│  - PBKDF2 key derivation from auth token             │
│  - AES-256-GCM encrypt/decrypt                       │
│  - Web Crypto API only — no external libs            │
├─────────────────────────────────────────────────────┤
│  Storage Layer (idb.js + Service Worker)             │
│  - IndexedDB: queued annotations, cached files       │
│  - Service Worker: app shell + asset caching         │
└─────────────────────────────────────────────────────┘
```

## New Files

| File | Purpose |
|------|---------|
| `frontend/src/lib/crypto.js` | PBKDF2 key derivation + AES-256-GCM encrypt/decrypt |
| `frontend/src/lib/idb.js` | Thin IndexedDB wrapper (open, get, put, delete, getAll) |
| `frontend/src/lib/offlineQueue.js` | Queue manager: enqueue encrypted items, flush on sync |
| `frontend/src/lib/fileCache.js` | Cache viewed files in encrypted IndexedDB |
| `frontend/src/lib/syncManager.js` | Orchestrates sync on reconnect |
| `frontend/src/components/OfflineIndicator.svelte` | Visual offline/sync status component |
| `frontend/public/sw.js` | Service worker for app shell + asset caching |

## Modified Files

| File | Changes |
|------|---------|
| `frontend/src/lib/store.js` | Add `isOnline`, `syncStatus`, `pendingCount` stores |
| `frontend/src/lib/api.js` | Add offline fallback for annotations + file cache reads |
| `frontend/src/components/AnnotationPanel.svelte` | Queue when offline, show pending badge |
| `frontend/src/components/CommentThread.svelte` | Show pending badge on queued replies |
| `frontend/src/components/Toolbar.svelte` | Mount OfflineIndicator |
| `frontend/src/App.svelte` | Register service worker, init sync manager |
| `frontend/src/main.js` | Register service worker on load |
| `frontend/vite.config.js` | Copy sw.js to build output |

## Implementation Order

### Phase 1: Offline Detection + Stores
1. Add `isOnline`, `syncStatus`, `pendingCount` to `store.js`
2. Listen to `navigator.onLine` + `online`/`offline` events
3. Create `OfflineIndicator.svelte` — shows banner when offline, sync spinner when syncing

### Phase 2: Crypto Layer
1. `crypto.js` — derive AES-256 key from auth token via PBKDF2 (salt = fixed app string)
2. `encrypt(key, plaintext)` → `{ iv, ciphertext }` (both as base64)
3. `decrypt(key, { iv, ciphertext })` → plaintext string
4. Key derived once on auth, stored in memory only (never persisted)

### Phase 3: IndexedDB Wrapper
1. `idb.js` — promise-based wrapper around IndexedDB
2. Database: `workspace-browser-offline`
3. Object stores: `queue` (pending annotations), `fileCache` (viewed files)
4. Operations: `open()`, `put(store, key, value)`, `get(store, key)`, `getAll(store)`, `delete(store, key)`, `clear(store)`

### Phase 4: Offline Queue
1. `offlineQueue.js` — manages annotation/reply queue
2. `enqueue(type, payload)` — encrypts payload, stores in IndexedDB `queue` store
3. `dequeue(id)` — removes item after successful sync
4. `getAll()` — returns all pending items (decrypted)
5. `getPendingCount()` — returns count for store
6. Queue item schema: `{ id, type: 'annotation'|'reply', encryptedPayload, createdAt }`

### Phase 5: File Cache
1. `fileCache.js` — caches file content after successful fetch
2. `cacheFile(path, data)` — encrypts file JSON, stores in IndexedDB
3. `getCachedFile(path)` — retrieves + decrypts
4. `clearOldEntries(maxAge)` — evict files older than N days
5. Max cache size: 50 files (LRU eviction)

### Phase 6: API Integration
1. Modify `api.js`:
   - `createAnnotation` / `replyAnnotation`: try network first, queue on failure when offline
   - `fetchFile`: try network first, fall back to cache when offline
   - `fetchTree`: return cached tree when offline
2. All queued items get a temporary local ID for UI display

### Phase 7: Sync Manager
1. `syncManager.js` — listens for `online` event
2. On reconnect: lock, iterate queue, POST each, dequeue on success
3. Conflict handling: if 409/404 → discard silently (annotation target may have changed)
4. Retry: 3 attempts per item with exponential backoff
5. Updates `syncStatus` store throughout

### Phase 8: Service Worker
1. `sw.js` in `frontend/public/` (copied verbatim to dist root)
2. Install: precache app shell (index.html, CSS, JS bundles)
3. Activate: clean old caches
4. Fetch strategy:
   - App shell (HTML, CSS, JS): Cache-first, network-fallback
   - API calls: Network-first, no SW caching (handled by app-level cache)
   - Fonts: Cache-first (long-lived)
5. Register from `main.js`

### Phase 9: UI Polish
1. OfflineIndicator: amber banner "You're offline — changes will sync when reconnected"
2. Pending annotation badge: dashed border + clock icon
3. Sync in progress: spinning icon in toolbar
4. Sync complete: brief green flash
5. Sync error: red dot with retry button

## Encryption Details

```
Token (UUID string)
    │
    ▼
  PBKDF2 (SHA-256, 100,000 iterations, salt = "workspace-browser-offline-v1")
    │
    ▼
  AES-256-GCM key (CryptoKey object, in-memory only)
    │
    ▼
  encrypt(plaintext) → { iv: Uint8Array(12), ciphertext: ArrayBuffer }
  decrypt({ iv, ciphertext }) → plaintext
```

- Salt is a fixed application-level string (not secret, just domain separation)
- IV is random 12 bytes per encryption, stored alongside ciphertext
- Both IV and ciphertext stored as base64 strings in IndexedDB

## Conflict Resolution

When syncing queued items:
- **201 Created** → success, dequeue
- **401 Unauthorized** → token changed, clear all queue, re-auth required
- **404 Not Found** (for replies) → parent annotation deleted, discard + warn
- **409 Conflict** → discard + warn
- **5xx / Network error** → retry up to 3x, then keep in queue with error flag

## Cache Eviction

- File cache: max 50 entries, LRU eviction (each access updates timestamp)
- Queue: items older than 7 days get warning icon but are kept
- Service worker cache: versioned, old versions cleaned on activate
