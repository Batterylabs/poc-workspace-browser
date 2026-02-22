/**
 * API client for the Workspace Browser backend.
 * Token is loaded from localStorage (set on first auth).
 */

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

async function apiFetch(path, options = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  }

  const res = await fetch(BASE + path, { ...options, headers })

  if (res.status === 401) {
    // Clear bad token
    localStorage.removeItem('wb_token')
    throw new Error('Unauthorized — please provide a valid token')
  }

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API error ${res.status}: ${body}`)
  }

  return res
}

// ── Files ──────────────────────────────────────────────────────────────────

export async function fetchTree() {
  const res = await apiFetch('/api/files')
  return res.json()
}

export async function fetchFile(path) {
  const res = await apiFetch(`/api/file/${encodeURIComponent(path)}`)
  const contentType = res.headers.get('content-type') || ''
  if (contentType.startsWith('image/') || contentType.startsWith('application/octet')) {
    return { type: 'image', url: `/api/file/${encodeURIComponent(path)}?token=${getToken()}` }
  }
  return res.json()
}

export async function fetchFileInfo(path) {
  const res = await apiFetch(`/api/file-info/${encodeURIComponent(path)}`)
  return res.json()
}

// ── Annotations ────────────────────────────────────────────────────────────

export async function fetchAnnotations(filePath) {
  const res = await apiFetch(`/api/annotations?file=${encodeURIComponent(filePath)}`)
  return res.json()
}

export async function fetchAnnotationStats() {
  const res = await apiFetch('/api/annotations/stats')
  return res.json()
}

export async function createAnnotation({ filePath, anchorType, anchorId, selectedText, comment, author = 'shankar' }) {
  const res = await apiFetch('/api/annotations', {
    method: 'POST',
    body: JSON.stringify({
      file_path: filePath,
      anchor_type: anchorType,
      anchor_id: anchorId,
      selected_text: selectedText,
      comment,
      author,
    }),
  })
  return res.json()
}

export async function replyAnnotation(annotationId, { comment, author = 'bruce' }) {
  const res = await apiFetch(`/api/annotations/${annotationId}/reply`, {
    method: 'POST',
    body: JSON.stringify({ comment, author }),
  })
  return res.json()
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
