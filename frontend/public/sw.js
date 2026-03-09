/**
 * Service Worker for Workspace Browser — offline asset caching.
 *
 * Strategy:
 *   - App shell (HTML, CSS, JS): Cache-first, network-fallback
 *   - API calls: Network-only (offline data handled by app-level IndexedDB)
 *   - Fonts (Google Fonts): Cache-first, long-lived
 *   - Everything else: Network-first
 */

const CACHE_VERSION = 'wb-v1'
const CACHE_NAME = `workspace-browser-${CACHE_VERSION}`

// Assets to precache on install (app shell)
// The actual built filenames will have hashes, so we cache them on first fetch
const PRECACHE_URLS = [
  '/',
]

// ── Install ──────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS)
    }).then(() => {
      // Activate immediately (don't wait for old SW to finish)
      return self.skipWaiting()
    })
  )
})

// ── Activate ─────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith('workspace-browser-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    }).then(() => {
      // Take control of all open tabs immediately
      return self.clients.claim()
    })
  )
})

// ── Fetch ────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Skip API calls — offline data handling is done by the app via IndexedDB
  if (url.pathname.startsWith('/api/')) return

  // Google Fonts: cache-first (long-lived, rarely change)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request))
    return
  }

  // App assets (/assets/*): cache-first (hashed filenames = immutable)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request))
    return
  }

  // App shell (HTML, root): network-first with cache fallback
  // This ensures we get updates when online but still work offline
  if (url.pathname === '/' || url.pathname === '/index.html' || !url.pathname.includes('.')) {
    event.respondWith(networkFirst(request))
    return
  }

  // Everything else: network-first
  event.respondWith(networkFirst(request))
})

// ── Strategies ───────────────────────────────────────────────────────────

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch (e) {
    // Offline and not cached — return a fallback
    return new Response('Offline — resource not cached', {
      status: 503,
      statusText: 'Service Unavailable',
    })
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch (e) {
    // Network failed — try cache
    const cached = await caches.match(request)
    if (cached) return cached

    // For navigation requests, return cached index.html (SPA fallback)
    if (request.mode === 'navigate') {
      const indexCached = await caches.match('/')
      if (indexCached) return indexCached
    }

    return new Response('Offline — resource not available', {
      status: 503,
      statusText: 'Service Unavailable',
    })
  }
}
