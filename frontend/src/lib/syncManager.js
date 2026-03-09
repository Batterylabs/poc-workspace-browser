/**
 * Sync manager — flushes the offline queue when connectivity is restored.
 * Listens for the `online` event and processes all pending items.
 */
import { get as storeGet } from 'svelte/store'
import { syncStatus, authToken, isOnline } from './store.js'
import { deriveKey } from './crypto.js'
import { getAllQueued, dequeue, updateStatus, refreshPendingCount, clearQueue } from './offlineQueue.js'
import { apiFetch } from './api.js'
import { syncAllPins } from './offlinePins.js'

const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000

let _syncing = false
let _initialized = false
let _pingInterval = null
const PING_INTERVAL_MS = 10000  // check server every 10s

/**
 * Initialize the sync manager.
 * Listens for online events AND actively pings the server to detect connectivity.
 */
export function initSyncManager() {
  if (_initialized) return
  _initialized = true

  window.addEventListener('online', () => {
    // Browser thinks we're online — verify with a ping
    pingServer()
  })

  window.addEventListener('offline', () => {
    isOnline.set(false)
  })

  // Set initial state via ping
  pingServer()

  // Active connectivity check — don't rely solely on navigator.onLine
  _pingInterval = setInterval(pingServer, PING_INTERVAL_MS)
}

/**
 * Ping the server to check actual connectivity.
 * Sets isOnline store and triggers sync if transitioning to online.
 */
async function pingServer() {
  try {
    const res = await fetch('/api/annotations/stats', {
      headers: {
        Authorization: `Bearer ${storeGet(authToken)}`,
      },
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok || res.status === 401) {
      // Server reachable (even 401 means network works)
      const wasOffline = !storeGet(isOnline)
      isOnline.set(true)
      if (wasOffline) {
        triggerSync()
        // Re-sync pinned files in background
        syncAllPins().catch(() => {})
      }
    } else {
      isOnline.set(false)
    }
  } catch {
    isOnline.set(false)
  }
}

/**
 * Trigger a sync attempt. Debounced — won't run if already syncing.
 */
export async function triggerSync() {
  if (_syncing) return
  if (!navigator.onLine) return

  const token = storeGet(authToken)
  if (!token) return

  let key
  try {
    key = await deriveKey(token)
  } catch (e) {
    console.error('Sync: failed to derive key', e)
    return
  }

  const items = await getAllQueued(key)
  if (items.length === 0) return

  _syncing = true
  syncStatus.set('syncing')

  let hasErrors = false

  for (const item of items) {
    // Check we're still online
    if (!navigator.onLine) {
      hasErrors = true
      break
    }

    try {
      await updateStatus(item.id, 'syncing')
      await syncItem(item)
      await dequeue(item.id)
    } catch (e) {
      console.error(`Sync failed for ${item.id}:`, e)
      hasErrors = true

      // Determine if we should discard or keep
      if (e.status === 401) {
        // Token invalid — clear everything
        await clearQueue()
        syncStatus.set('error')
        _syncing = false
        return
      } else if (e.status === 404 || e.status === 409) {
        // Conflict or target gone — discard
        await dequeue(item.id)
        console.warn(`Discarded ${item.id}: ${e.status}`)
      } else {
        // Network or server error — keep for retry
        await updateStatus(item.id, 'error')
      }
    }
  }

  await refreshPendingCount()
  syncStatus.set(hasErrors ? 'error' : 'idle')

  // Brief success flash
  if (!hasErrors) {
    syncStatus.set('success')
    setTimeout(() => {
      syncStatus.set('idle')
    }, 3000)
  }

  _syncing = false
}

/**
 * Sync a single queued item to the backend.
 * @param {{ id, type, payload }} item
 */
async function syncItem(item) {
  const { type, payload } = item

  if (type === 'annotation') {
    const res = await apiFetch('/api/annotations', {
      method: 'POST',
      body: JSON.stringify({
        file_path: payload.filePath,
        anchor_type: payload.anchorType || 'file',
        anchor_id: payload.anchorId || null,
        selected_text: payload.selectedText || null,
        comment: payload.comment,
        author: payload.author || 'shankar',
      }),
      _skipOfflineQueue: true,  // Prevent re-queuing during sync
    })
    return res.json()
  }

  if (type === 'reply') {
    const res = await apiFetch(`/api/annotations/${payload.annotationId}/reply`, {
      method: 'POST',
      body: JSON.stringify({
        comment: payload.comment,
        author: payload.author || 'bruce',
      }),
      _skipOfflineQueue: true,
    })
    return res.json()
  }

  throw new Error(`Unknown queue item type: ${type}`)
}
