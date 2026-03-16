/**
 * API client for the Workspace Browser backend.
 * Token is loaded from localStorage (set on first auth).
 * Includes offline fallback: queues annotations when offline, caches files.
 */
import { deriveKey } from './crypto.js'
import { enqueue, getQueuedForFile } from './offlineQueue.js'
import { cacheFile, getCachedFile, cacheTree, getCachedTree } from './fileCache.js'

const BASE = ''

function getToken() {
  return localStorage.getItem('wb_token') || ''
}

export function setToken(token) {
  localStorage.setItem('wb_token', token)
}

export function hasToken() {
  return !!getToken()
}

/**
 * Get the derived encryption key (lazy, cached in crypto module).
 * @returns {Promise<CryptoKey|null>}
 */
async function getKey() {
  const token = getToken()
  if (!token) return null
  try {
    return await deriveKey(token)
  } catch (e) {
    console.warn('Failed to derive encryption key:', e)
    return null
  }
}

export async function apiFetch(path, options = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  }

  // Remove internal flags before passing to fetch
  const { _skipOfflineQueue, ...fetchOptions } = options

  const res = await fetch(BASE + path, { ...fetchOptions, headers })

  if (res.status === 401) {
    // Clear bad token
    localStorage.removeItem('wb_token')
    throw new Error('Unauthorized — please provide a valid token')
  }

  if (!res.ok) {
    const err = new Error(`API error ${res.status}: ${await res.text()}`)
    err.status = res.status
    throw err
  }

  return res
}

// ── Files ──────────────────────────────────────────────────────────────────

export async function fetchTree() {
  try {
    const res = await apiFetch('/api/files')
    const tree = await res.json()
    // Cache tree for offline use
    const key = await getKey()
    if (key) {
      cacheTree(key, tree).catch(() => {}) // fire-and-forget
    }
    return tree
  } catch (e) {
    // If offline, try cache
    if (!navigator.onLine) {
      const key = await getKey()
      if (key) {
        const cached = await getCachedTree(key)
        if (cached) return cached
      }
    }
    throw e
  }
}

export async function fetchFile(path) {
  const key = await getKey()

  try {
    const res = await apiFetch(`/api/file/${encodeURIComponent(path)}`)
    const contentType = res.headers.get('content-type') || ''
    if (contentType.startsWith('image/') || contentType.startsWith('application/octet')) {
      return { type: 'image', url: `/api/file/${encodeURIComponent(path)}?token=${getToken()}` }
    }
    const data = await res.json()
    // Cache for offline use
    if (key && data.type === 'text') {
      cacheFile(key, path, data).catch(() => {}) // fire-and-forget
    }
    return data
  } catch (e) {
    // If offline, try cache
    if (!navigator.onLine && key) {
      const cached = await getCachedFile(key, path)
      if (cached) {
        cached._fromCache = true
        return cached
      }
    }
    throw e
  }
}

export async function fetchFileInfo(path) {
  const res = await apiFetch(`/api/file-info/${encodeURIComponent(path)}`)
  return res.json()
}

// ── Annotations ────────────────────────────────────────────────────────────

export async function fetchAnnotations(filePath) {
  try {
    const res = await apiFetch(`/api/annotations?file=${encodeURIComponent(filePath)}`)
    const anns = await res.json()

    // Merge in any queued (pending) annotations for this file
    const key = await getKey()
    if (key) {
      const queued = await getQueuedForFile(key, filePath)
      for (const q of queued) {
        if (q.type === 'annotation') {
          anns.push({
            id: q.id,
            file_path: q.payload.filePath,
            anchor_type: q.payload.anchorType || 'file',
            anchor_id: q.payload.anchorId || null,
            selected_text: q.payload.selectedText || null,
            comment: q.payload.comment,
            author: q.payload.author || 'shankar',
            parent_id: null,
            resolved: false,
            resolved_at: null,
            resolved_by: null,
            created_at: q.createdAt,
            replies: [],
            _pending: true,  // UI flag
          })
        }
      }
    }

    return anns
  } catch (e) {
    // If offline or network error, return only queued annotations
    const isNetworkError = !navigator.onLine || e.message?.includes('fetch') || e.name === 'TypeError'
    if (isNetworkError || !navigator.onLine) {
      const key = await getKey()
      if (key) {
        const queued = await getQueuedForFile(key, filePath)
        return queued
          .filter((q) => q.type === 'annotation')
          .map((q) => ({
            id: q.id,
            file_path: q.payload.filePath,
            anchor_type: q.payload.anchorType || 'file',
            anchor_id: q.payload.anchorId || null,
            selected_text: q.payload.selectedText || null,
            comment: q.payload.comment,
            author: q.payload.author || 'shankar',
            parent_id: null,
            resolved: false,
            resolved_at: null,
            resolved_by: null,
            created_at: q.createdAt,
            replies: [],
            _pending: true,
          }))
      }
    }
    throw e
  }
}

export async function fetchAnnotationStats() {
  try {
    const res = await apiFetch('/api/annotations/stats')
    return res.json()
  } catch (e) {
    if (!navigator.onLine) return {}
    throw e
  }
}

export async function createAnnotation({ filePath, anchorType, anchorId, selectedText, comment, author = 'shankar', metadata = null }) {
  // If offline, queue it
  if (!navigator.onLine) {
    const key = await getKey()
    if (!key) throw new Error('Cannot queue offline — no encryption key')
    const queueId = await enqueue(key, 'annotation', {
      filePath, anchorType, anchorId, selectedText, comment, author, metadata,
    })
    return { id: queueId, created_at: new Date().toISOString(), _pending: true }
  }

  // Online: try normal POST
  try {
    const res = await apiFetch('/api/annotations', {
      method: 'POST',
      body: JSON.stringify({
        file_path: filePath,
        anchor_type: anchorType,
        anchor_id: anchorId,
        selected_text: selectedText,
        comment,
        author,
        metadata,
      }),
    })
    return res.json()
  } catch (e) {
    // Any network error — queue it for offline sync
    const key = await getKey()
    if (key) {
      const { isOnline: isOnlineStore } = await import('./store.js')
      const { get: storeGet } = await import('svelte/store')
      isOnlineStore.set(false)  // Mark as offline since server is unreachable
      const queueId = await enqueue(key, 'annotation', {
        filePath, anchorType, anchorId, selectedText, comment, author, metadata,
      })
      return { id: queueId, created_at: new Date().toISOString(), _pending: true }
    }
    throw e
  }
}

export async function replyAnnotation(annotationId, { comment, author = 'bruce' }) {
  // If offline, queue it
  if (!navigator.onLine) {
    const key = await getKey()
    if (!key) throw new Error('Cannot queue offline — no encryption key')
    const queueId = await enqueue(key, 'reply', {
      annotationId, comment, author,
    })
    return { id: queueId, created_at: new Date().toISOString(), _pending: true }
  }

  try {
    const res = await apiFetch(`/api/annotations/${annotationId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ comment, author }),
    })
    return res.json()
  } catch (e) {
    const key = await getKey()
    if (key) {
      const { isOnline: isOnlineStore } = await import('./store.js')
      isOnlineStore.set(false)
      const queueId = await enqueue(key, 'reply', {
        annotationId, comment, author,
      })
      return { id: queueId, created_at: new Date().toISOString(), _pending: true }
    }
    throw e
  }
}

export async function resolveAnnotation(annotationId, author = 'bruce') {
  const res = await apiFetch(`/api/annotations/${annotationId}/resolve?author=${encodeURIComponent(author)}`, {
    method: 'POST',
  })
  return res.json()
}

export async function deleteAnnotation(annotationId) {
  const res = await apiFetch(`/api/annotations/${annotationId}`, {
    method: 'DELETE',
  })
  return res.json()
}

export async function fetchRoot() {
  const res = await apiFetch(`/api/root`)
  return res.json()
}

export async function updateRoot(path) {
  const res = await apiFetch(`/api/root`, {
    method: 'POST',
    body: JSON.stringify({ path }),
  })
  return res.json()
}
