/**
 * Offline annotation queue — encrypts payloads before storing in IndexedDB.
 *
 * Queue items:
 *   { id, type: 'annotation'|'reply', encryptedPayload: { iv, ciphertext }, createdAt, status }
 *
 * Status: 'pending' | 'syncing' | 'error' | 'conflict'
 */
import { put, get, getAll, del, count, clear as clearStore } from './idb.js'
import { encrypt, decrypt } from './crypto.js'
import { pendingCount } from './store.js'

const STORE = 'queue'

/**
 * Enqueue an annotation or reply for later sync.
 * @param {CryptoKey} key - Derived encryption key
 * @param {'annotation'|'reply'} type
 * @param {object} payload - The annotation/reply data (will be JSON-stringified + encrypted)
 * @returns {Promise<string>} The queued item ID
 */
export async function enqueue(key, type, payload) {
  const id = 'q_' + crypto.randomUUID()
  const plaintext = JSON.stringify(payload)
  const encryptedPayload = await encrypt(key, plaintext)

  await put(STORE, {
    id,
    type,
    encryptedPayload,
    createdAt: new Date().toISOString(),
    status: 'pending',
  })

  await refreshPendingCount()
  return id
}

/**
 * Get all queued items (decrypted).
 * @param {CryptoKey} key
 * @returns {Promise<Array<{ id, type, payload, createdAt, status }>>}
 */
export async function getAllQueued(key) {
  const items = await getAll(STORE)
  const result = []

  for (const item of items) {
    try {
      const plaintext = await decrypt(key, item.encryptedPayload)
      result.push({
        id: item.id,
        type: item.type,
        payload: JSON.parse(plaintext),
        createdAt: item.createdAt,
        status: item.status,
      })
    } catch (e) {
      // Decryption failed — token may have changed
      console.warn('Failed to decrypt queued item:', item.id, e)
    }
  }

  return result
}

/**
 * Get queued items for a specific file (decrypted).
 * @param {CryptoKey} key
 * @param {string} filePath
 * @returns {Promise<Array>}
 */
export async function getQueuedForFile(key, filePath) {
  const all = await getAllQueued(key)
  return all.filter((item) => {
    if (item.type === 'annotation') {
      return item.payload.filePath === filePath
    }
    // Replies don't have filePath directly, but they have parentAnnotationId
    return false
  })
}

/**
 * Update the status of a queued item.
 * @param {string} id
 * @param {string} status
 */
export async function updateStatus(id, status) {
  const item = await get(STORE, id)
  if (item) {
    item.status = status
    await put(STORE, item)
  }
}

/**
 * Remove a queued item (after successful sync).
 * @param {string} id
 */
export async function dequeue(id) {
  await del(STORE, id)
  await refreshPendingCount()
}

/**
 * Clear all queued items.
 */
export async function clearQueue() {
  await clearStore(STORE)
  await refreshPendingCount()
}

/**
 * Get the count of pending items.
 * @returns {Promise<number>}
 */
export async function getPendingCount() {
  return count(STORE)
}

/**
 * Refresh the Svelte store with the current count.
 */
export async function refreshPendingCount() {
  const c = await getPendingCount()
  pendingCount.set(c)
}
