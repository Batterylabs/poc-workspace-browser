/**
 * Thin IndexedDB wrapper — promise-based.
 * Database: workspace-browser-offline
 * Object stores: queue (pending annotations), fileCache (viewed files), meta (misc)
 */

const DB_NAME = 'workspace-browser-offline'
const DB_VERSION = 2

/** @type {IDBDatabase|null} */
let _db = null

/**
 * Open (or return cached) database connection.
 * @returns {Promise<IDBDatabase>}
 */
export function openDB() {
  if (_db) return Promise.resolve(_db)

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = event.target.result

      // Queue store: pending annotations/replies
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id' })
      }

      // File cache store: recently viewed files
      if (!db.objectStoreNames.contains('fileCache')) {
        const store = db.createObjectStore('fileCache', { keyPath: 'path' })
        store.createIndex('accessedAt', 'accessedAt', { unique: false })
      }

      // Meta store: misc data (tree cache, etc.)
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' })
      }

      // Pins store: files/folders pinned for offline reading
      if (!db.objectStoreNames.contains('pins')) {
        db.createObjectStore('pins', { keyPath: 'path' })
      }
    }

    request.onsuccess = (event) => {
      _db = event.target.result
      // Handle unexpected close
      _db.onclose = () => { _db = null }
      resolve(_db)
    }

    request.onerror = () => reject(request.error)
  })
}

/**
 * Put a value into an object store.
 */
export async function put(storeName, value) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const req = store.put(value)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Get a value by key from an object store.
 */
export async function get(storeName, key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const req = store.get(key)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Get all values from an object store.
 */
export async function getAll(storeName) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}

/**
 * Delete a value by key from an object store.
 */
export async function del(storeName, key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const req = store.delete(key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/**
 * Clear all entries from an object store.
 */
export async function clear(storeName) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const req = store.clear()
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/**
 * Count entries in an object store.
 */
export async function count(storeName) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const req = store.count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
