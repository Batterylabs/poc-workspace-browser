<script>
  import { annotations, currentFile, annotationPanelOpen,
           annotationStats, pendingAnnotation, isOnline } from '../lib/store.js'
  import { createAnnotation, fetchAnnotations, fetchAnnotationStats } from '../lib/api.js'
  import CommentThread from './CommentThread.svelte'

  export let breakpoint = 'desktop'

  let newComment = ''
  let author = 'shankar'
  let showResolved = false
  let submitting = false

  // Populate from pending annotation (FAB tap or text selection)
  $: if ($pendingAnnotation) {
    // Pre-populate from selection if available
  }

  $: open     = $annotations.filter((a) => !a.resolved && !a.parent_id)
  $: resolved = $annotations.filter((a) =>  a.resolved && !a.parent_id)

  // Compute pin numbers for image-region annotations (1-based, ordered by created_at)
  $: pinNumberMap = (() => {
    let idx = 0
    const map = {}
    // all annotations in order (open + resolved, by created_at)
    const all = [...$annotations].filter(a => !a.parent_id).sort((a, b) =>
      (a.created_at || '').localeCompare(b.created_at || '')
    )
    for (const a of all) {
      if (a.anchor_type === 'image-region' && a.metadata) {
        try {
          const meta = typeof a.metadata === 'string' ? JSON.parse(a.metadata) : a.metadata
          if (meta.type === 'pin') {
            idx++
            map[a.id] = idx
          }
        } catch {}
      }
    }
    return map
  })()

  // Parse metadata for image annotations
  function getAnnotationMeta(ann) {
    if (ann.anchor_type !== 'image-region' || !ann.metadata) return null
    try {
      return typeof ann.metadata === 'string' ? JSON.parse(ann.metadata) : ann.metadata
    } catch { return null }
  }

  $: panelTitle = $currentFile
    ? `Comments · ${$currentFile.name}`
    : 'Comments'

  $: offline = !$isOnline

  async function submitComment() {
    if (!newComment.trim() || !$currentFile) return
    submitting = true
    try {
      const pending = $pendingAnnotation || {}
      const commentText = newComment.trim()
      const result = await createAnnotation({
        filePath: $currentFile.path,
        anchorType:   pending.anchorType   || 'file',
        anchorId:     pending.anchorId     || null,
        selectedText: pending.selectedText || null,
        comment: commentText,
        author,
        metadata:     pending.metadata     || null,
      })
      newComment = ''
      pendingAnnotation.set(null)

      // If queued offline, show it immediately in the list
      if (result && result._pending) {
        annotations.update((anns) => [
          ...anns,
          {
            id: result.id,
            file_path: $currentFile.path,
            anchor_type: pending.anchorType || 'file',
            anchor_id: pending.anchorId || null,
            selected_text: pending.selectedText || null,
            comment: commentText,
            author,
            parent_id: null,
            resolved: false,
            resolved_at: null,
            resolved_by: null,
            created_at: result.created_at,
            metadata: pending.metadata || null,
            replies: [],
            _pending: true,
          },
        ])
      }

      // Reload with timeout to prevent hanging
      await Promise.race([
        reload(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('reload timeout')), 5000))
      ]).catch((e) => console.warn('Reload after submit:', e.message))
    } catch (e) {
      alert('Failed to submit: ' + e.message)
    } finally {
      submitting = false
    }
  }

  async function reload() {
    if (!$currentFile) return
    try {
      const anns   = await fetchAnnotations($currentFile.path)
      const stats  = await fetchAnnotationStats()
      annotations.set(anns)
      annotationStats.set(stats)
    } catch (e) {
      // Silently handle offline reload failures
      if (navigator.onLine) {
        console.error('Failed to reload annotations:', e)
      }
    }
  }

  // Close panel (works for all layouts)
  function close() { annotationPanelOpen.set(false) }

  $: isMobile = breakpoint === 'mobile'
</script>

<!-- ── Wrapper: fills its parent (static sidebar / overlay panel / bottom sheet inner) -->
<div class="flex flex-col h-full overflow-hidden">

  <!-- ── Header ──────────────────────────────────────────────────────── -->
  <div class="flex-shrink-0 flex items-center justify-between px-4 border-b
              border-gray-200 dark:border-gray-800"
       style="min-height:48px">
    <h2 class="font-semibold text-sm text-gray-800 dark:text-gray-200 truncate mr-2">
      {panelTitle}
    </h2>
    <button
      on:click={close}
      class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none
             rounded-lg flex-shrink-0"
      style="min-height:44px;min-width:44px"
      aria-label="Close comments panel"
    >✕</button>
  </div>

  <!-- ── Offline notice ──────────────────────────────────────────────── -->
  {#if offline}
    <div class="flex-shrink-0 mx-4 mt-2 px-3 py-1.5 rounded-lg
                bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
      <p class="text-xs text-amber-700 dark:text-amber-300">
        📡 Offline — comments will be queued and synced when reconnected
      </p>
    </div>
  {/if}

  <!-- ── Pending anchor context (if from selection / line / image pin) ── -->
  {#if $pendingAnnotation?.metadata}
    {@const _meta = (() => { try { return JSON.parse($pendingAnnotation.metadata) } catch { return null } })()}
    {#if _meta?.type === 'pin'}
      <div class="flex-shrink-0 mx-4 mt-3 px-3 py-2 rounded-lg
                  bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700">
        <p class="text-xs text-red-700 dark:text-red-300 font-medium flex items-center gap-1.5">
          <span class="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-xs font-bold"
                style="background-color: {_meta.color || '#ef4444'}">
            {$pendingAnnotation.anchorId?.replace('pin-', '') || '?'}
          </span>
          Add a comment for this pin
        </p>
      </div>
    {/if}
  {:else if $pendingAnnotation?.selectedText}
    <div class="flex-shrink-0 mx-4 mt-3 px-3 py-2 rounded-lg
                bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700">
      <p class="text-xs text-yellow-700 dark:text-yellow-300 font-medium mb-0.5">Commenting on:</p>
      <p class="text-xs text-yellow-800 dark:text-yellow-200 italic line-clamp-2">
        "{$pendingAnnotation.selectedText}"
      </p>
    </div>
  {:else if $pendingAnnotation?.anchorType === 'line' && $pendingAnnotation?.anchorId}
    <div class="flex-shrink-0 mx-4 mt-3 px-3 py-1.5 rounded-lg
                bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700">
      <p class="text-xs text-blue-700 dark:text-blue-300">Line {$pendingAnnotation.anchorId}</p>
    </div>
  {/if}

  <!-- ── New comment compose ───────────────────────────────────────────── -->
  <div class="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-800 space-y-2">
    <!-- Author selector -->
    <div class="flex items-center gap-2">
      <label class="text-xs text-gray-500 dark:text-gray-400">As:</label>
      <select
        bind:value={author}
        class="text-sm px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700
               bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300
               focus:outline-none focus:ring-2 focus:ring-blue-500"
        style="min-height:36px"
      >
        <option value="shankar">Shankar</option>
        <option value="bruce">Bruce</option>
      </select>
    </div>

    <!-- Text area — taller on mobile for easier typing -->
    <textarea
      bind:value={newComment}
      placeholder={offline ? "Add a comment (will sync later)…" : "Add a comment…"}
      rows={isMobile ? 4 : 3}
      class="w-full text-sm px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
             bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white resize-none
             focus:outline-none focus:ring-2 focus:ring-blue-500"
      style="min-height:80px"
    ></textarea>

    <!-- Submit row -->
    <div class="flex gap-2">
      <button
        on:click={submitComment}
        disabled={submitting || !newComment.trim()}
        class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800
               disabled:opacity-50 text-white text-sm rounded-xl font-medium transition-colors"
        style="min-height:44px"
      >
        {#if submitting}
          Submitting…
        {:else if offline}
          Queue Comment
        {:else}
          Add Comment
        {/if}
      </button>
      {#if $pendingAnnotation}
        <button
          on:click={() => pendingAnnotation.set(null)}
          class="px-3 py-2.5 text-gray-500 dark:text-gray-400 text-sm rounded-xl
                 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
          style="min-height:44px"
          aria-label="Clear selection context"
        >✕</button>
      {/if}
    </div>
  </div>

  <!-- ── Thread list ───────────────────────────────────────────────────── -->
  <div class="flex-1 overflow-y-auto overscroll-contain">
    {#if open.length === 0 && resolved.length === 0}
      <div class="p-8 text-center text-sm text-gray-400 dark:text-gray-600">
        <div class="text-3xl mb-2" aria-hidden="true">💬</div>
        No comments yet. Be the first!
      </div>
    {/if}

    {#each open as ann (ann.id)}
      <CommentThread
        annotation={ann}
        pinNumber={pinNumberMap[ann.id] || null}
        annotationMeta={getAnnotationMeta(ann)}
        on:updated={reload}
      />
    {/each}

    <!-- Resolved section (collapsible) -->
    {#if resolved.length > 0}
      <div class="border-t border-gray-100 dark:border-gray-800">
        <button
          on:click={() => showResolved = !showResolved}
          class="w-full px-4 text-xs text-gray-400 dark:text-gray-500
                 hover:text-gray-600 dark:hover:text-gray-400
                 text-left flex items-center gap-2"
          style="min-height:44px"
        >
          <span class="text-green-500">✓</span>
          {showResolved ? 'Hide' : 'Show'} {resolved.length} resolved
          <span class="ml-auto text-gray-300 dark:text-gray-600">{showResolved ? '▾' : '▸'}</span>
        </button>
        {#if showResolved}
          {#each resolved as ann (ann.id)}
            <CommentThread
              annotation={ann}
              pinNumber={pinNumberMap[ann.id] || null}
              annotationMeta={getAnnotationMeta(ann)}
              on:updated={reload}
            />
          {/each}
        {/if}
      </div>
    {/if}
  </div>
</div>
