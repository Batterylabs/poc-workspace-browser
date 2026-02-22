/**
 * Global Svelte stores for the Workspace Browser.
 */
import { writable, derived } from 'svelte/store'

export const currentFile = writable(null)        // { path, name, ext, content, type }
export const annotations = writable([])          // for current file
export const annotationStats = writable({})      // { filePath: { open, resolved } }
export const darkMode = writable(
  typeof window !== 'undefined'
    ? localStorage.getItem('wb_dark') === 'true'
    : false
)
export const annotationPanelOpen = writable(false)
export const selectedAnnotation = writable(null)   // annotation being viewed
export const pendingAnnotation = writable(null)    // { anchorType, anchorId, selectedText }
export const authToken = writable(
  typeof window !== 'undefined' ? localStorage.getItem('wb_token') || '' : ''
)

// Persist dark mode
darkMode.subscribe((val) => {
  if (typeof document !== 'undefined') {
    if (val) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('wb_dark', String(val))
  }
})

// Derived: open annotations for current file
export const openAnnotations = derived(annotations, ($anns) =>
  $anns.filter((a) => !a.resolved)
)
export const resolvedAnnotations = derived(annotations, ($anns) =>
  $anns.filter((a) => a.resolved)
)
