/**
 * File cache — stores recently viewed files in encrypted IndexedDB.
 * LRU eviction: max 50 entries.
 */
import { put, get, getAll, del } from './idb.js'
import { encrypt, decrypt } from './crypto.js'

const STORE = 'fileCache'
const MAX_ENTRIES = 50

/**
 * Cache a file's content (text or JSON response).
 * @param {CryptoKey} key - Encryption key
 * @param {string} path - File path (used as key)
 * @param {object} data - The file data object (from API response)
 */
export async function cacheFile(key, path, data) {
  const plaintext = JSON.stringify(data)
  const encrypted = await encrypt(key, plaintext)

  await put(STORE, {
    path,
    encrypted,
    accessedAt: Date.now(),
    cachedAt: Date.now(),
  })

  // LRU eviction
  await evictIfNeeded()
}

/**
 * Retrieve a cached file.
 * @param {CryptoKey} key - Encryption key
 * @param {string} path - File path
 * @returns {Promise<object|null>} The file data or null if not cached
 */
export async function getCachedFile(key, path) {
  const entry = await get(STORE, path)
  if (!entry) return null

  try {
    const plaintext = await decrypt(key, entry.encrypted)
    // Update access time (LRU)
    entry.accessedAt = Date.now()
    await put(STORE, entry)
    return JSON.parse(plaintext)
  } catch (e) {
    console.warn('Failed to decrypt cached file:', path, e)
    // Remove corrupted entry
    await del(STORE, path)
    return null
  }
}

/**
 * Check if a file is cached (without decrypting).
 * @param {string} path
 * @returns {Promise<boolean>}
 */
export async function isFileCached(path) {
  const entry = await get(STORE, path)
  return !!entry
}

/**
 * Cache the file tree.
 * @param {CryptoKey} key
 * @param {object} tree
 */
export async function cacheTree(key, tree) {
  const plaintext = JSON.stringify(tree)
  const encrypted = await encrypt(key, plaintext)
  await put('meta', { key: 'tree', encrypted, cachedAt: Date.now() })
}

/**
 * Get cached file tree.
 * @param {CryptoKey} key
 * @returns {Promise<object|null>}
 */
export async function getCachedTree(key) {
  const entry = await get('meta', 'tree')
  if (!entry) return null

  try {
    const plaintext = await decrypt(key, entry.encrypted)
    return JSON.parse(plaintext)
  } catch (e) {
    console.warn('Failed to decrypt cached tree:', e)
    return null
  }
}

/**
 * Evict oldest entries if over MAX_ENTRIES.
 */
async function evictIfNeeded() {
  const all = await getAll(STORE)
  if (all.length <= MAX_ENTRIES) return

  // Sort by accessedAt ascending (oldest first)
  all.sort((a, b) => (a.accessedAt || 0) - (b.accessedAt || 0))

  const toRemove = all.length - MAX_ENTRIES
  for (let i = 0; i < toRemove; i++) {
    await del(STORE, all[i].path)
  }
}
