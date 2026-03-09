/**
 * Encryption layer for offline storage.
 * Uses Web Crypto API: PBKDF2 key derivation + AES-256-GCM.
 * No external dependencies.
 */

const SALT = new TextEncoder().encode('workspace-browser-offline-v1')
const PBKDF2_ITERATIONS = 100_000

/** @type {CryptoKey|null} */
let _derivedKey = null

/**
 * Derive an AES-256-GCM key from the auth token using PBKDF2.
 * Caches the key in memory (never persisted).
 * @param {string} token - The auth token (UUID)
 * @returns {Promise<CryptoKey>}
 */
export async function deriveKey(token) {
  if (_derivedKey) return _derivedKey

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(token),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  _derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: SALT,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )

  return _derivedKey
}

/**
 * Clear the cached key (e.g., on logout or token change).
 */
export function clearKey() {
  _derivedKey = null
}

/**
 * Encrypt a plaintext string.
 * @param {CryptoKey} key
 * @param {string} plaintext
 * @returns {Promise<{ iv: string, ciphertext: string }>} base64-encoded iv + ciphertext
 */
export async function encrypt(key, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  )

  return {
    iv: bufToBase64(iv),
    ciphertext: bufToBase64(new Uint8Array(cipherBuffer)),
  }
}

/**
 * Decrypt ciphertext back to a plaintext string.
 * @param {CryptoKey} key
 * @param {{ iv: string, ciphertext: string }} data - base64-encoded iv + ciphertext
 * @returns {Promise<string>}
 */
export async function decrypt(key, { iv, ciphertext }) {
  const ivBuf = base64ToBuf(iv)
  const ctBuf = base64ToBuf(ciphertext)

  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuf },
    key,
    ctBuf
  )

  return new TextDecoder().decode(plainBuffer)
}

// ── Helpers ──────────────────────────────────────────────────────────────

function bufToBase64(buf) {
  let binary = ''
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToBuf(b64) {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}
