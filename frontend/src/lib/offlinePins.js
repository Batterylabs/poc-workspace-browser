/**
 * Offline pins — mark files/folders for proactive offline caching.
 * Pin data is encrypted in IndexedDB. Pinned files are prefetched in the background.
 */
import { writable, get as storeGet } from 'svelte/store'
import { put, get, getAll, del } from './idb.js'
import { encrypt, decrypt, deriveKey } from './crypto.js'
import { cacheFile, isFileCached } from './fileCache.js'

const STORE = 'pins'

/** @type {import('svelte/store').Writable<Set<string>>} */
export const pinnedPaths = writable(new Set())

/** @type {import('svelte/store').Writable<Set<string>>} */
export const cachedPaths = writable(new Set())

/** @type {import('svelte/store').Writable<boolean>} */
export const pinSyncing = writable(false)

let _key = null

/**
 * Initialize pins — load from IndexedDB into the store.
 * @param {string} token - Auth token for key derivation
 */
export async function initPins(token) {
  if (!token) return
  _key = await deriveKey(token)

  const entries = await getAll(STORE)
  const paths = new Set()

  for (const entry of entries) {
    try {
      const plaintext = await decrypt(_key, entry.encrypted)
      const data = JSON.parse(plaintext)
      paths.add(data.path)
    } catch {
      // Corrupted entry — remove it
      await del(STORE, entry.path)
    }
  }

  pinnedPaths.set(paths)
  await refreshCachedPaths()
}

/**
 * Check which pinned files are actually cached.
 */
async function refreshCachedPaths() {
  const pins = storeGet(pinnedPaths)
  const cached = new Set()
  for (const path of pins) {
    if (await isFileCached(path)) {
      cached.add(path)
    }
  }
  cachedPaths.set(cached)
}

/**
 * Pin a file or folder for offline reading.
 * @param {string} path
 * @param {'file'|'directory'} type
 */
export async function pinForOffline(path, type) {
  if (!_key) return

  const data = { path, type, pinnedAt: Date.now() }
  const encrypted = await encrypt(_key, JSON.stringify(data))
  await put(STORE, { path, encrypted })

  pinnedPaths.update(s => { s.add(path); return new Set(s) })

  // Prefetch immediately if online
  if (navigator.onLine) {
    prefetchPinned(path, type)
  }
}

/**
 * Unpin a file or folder.
 * @param {string} path
 */
export async function unpinOffline(path) {
  await del(STORE, path)
  pinnedPaths.update(s => { s.delete(path); return new Set(s) })
  cachedPaths.update(s => { s.delete(path); return new Set(s) })
}

/**
 * Check if a path is pinned.
 * @param {string} path
 * @returns {boolean}
 */
export function isPinned(path) {
  return storeGet(pinnedPaths).has(path)
}

/**
 * Prefetch a pinned file or all files in a pinned folder.
 * @param {string} path
 * @param {'file'|'directory'} type
 */
async function prefetchPinned(path, type) {
  if (!_key) return

  try {
    if (type === 'file') {
      await prefetchFile(path)
    } else if (type === 'directory') {
      await prefetchFolder(path)
    }
  } catch (e) {
    console.warn('Prefetch failed for', path, e)
  }

  await refreshCachedPaths()
}

/**
 * Prefetch a single file.
 */
async function prefetchFile(path) {
  if (!_key) return
  // Avoid re-fetching if already cached
  if (await isFileCached(path)) return

  const token = localStorage.getItem('wb_token') || ''
  const res = await fetch(`/api/file/${encodeURIComponent(path)}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) return

  const contentType = res.headers.get('content-type') || ''
  if (contentType.startsWith('image/') || contentType.startsWith('application/octet')) {
    return // Skip binary files
  }

  const data = await res.json()
  if (data.type === 'text') {
    await cacheFile(_key, path, data)
  }
}

/**
 * Prefetch all files in a folder (recursive).
 */
async function prefetchFolder(folderPath) {
  const token = localStorage.getItem('wb_token') || ''
  // Get the file tree to enumerate folder contents
  const res = await fetch('/api/files', {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) return

  const tree = await res.json()
  const files = collectFiles(tree, folderPath)

  // Prefetch in batches of 3 to avoid hammering the server
  pinSyncing.set(true)
  for (let i = 0; i < files.length; i += 3) {
    const batch = files.slice(i, i + 3)
    await Promise.allSettled(batch.map(f => prefetchFile(f)))
  }
  pinSyncing.set(false)
}

/**
 * Recursively collect all file paths under a folder path from the tree.
 */
function collectFiles(node, folderPath) {
  const files = []

  function walk(n, currentPath) {
    const nodePath = currentPath ? `${currentPath}/${n.name}` : n.name
    // Use node.path if available
    const p = n.path || nodePath

    if (n.type === 'file') {
      // Check if this file is under the target folder
      if (p.startsWith(folderPath + '/') || p === folderPath) {
        files.push(p)
      }
    }

    if (n.children) {
      for (const child of n.children) {
        walk(child, p)
      }
    }
  }

  walk(node, '')
  return files
}

/**
 * Sync all pinned items — re-prefetch everything that's pinned.
 * Call this when coming back online.
 */
export async function syncAllPins() {
  if (!_key) return
  if (!navigator.onLine) return

  const entries = await getAll(STORE)
  pinSyncing.set(true)

  for (const entry of entries) {
    try {
      const plaintext = await decrypt(_key, entry.encrypted)
      const data = JSON.parse(plaintext)
      await prefetchPinned(data.path, data.type)
    } catch {
      // Skip corrupted entries
    }
  }

  pinSyncing.set(false)
  await refreshCachedPaths()
}
