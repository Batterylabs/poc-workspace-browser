<script>
  import { onMount, onDestroy } from 'svelte'
  import ImageAnnotationCanvas from '../components/ImageAnnotationCanvas.svelte'
  import ImageAnnotationToolbar from '../components/ImageAnnotationToolbar.svelte'
  import {
    currentFile, annotations, annotationPanelOpen,
    annotationStats, pendingAnnotation
  } from '../lib/store.js'
  import {
    createAnnotation, deleteAnnotation,
    fetchAnnotations, fetchAnnotationStats
  } from '../lib/api.js'

  let zoom = 1
  let imgEl
  let containerEl
  let naturalW = 0
  let naturalH = 0

  // Annotation tool state
  let activeTool = null   // 'arrow' | 'rect' | 'pen' | 'pin' | null
  let color = '#ef4444'
  let opacity = 0.8

  // Preview pin (shown while user is composing a comment)
  let previewPin = null

  $: imgSrc = $currentFile?.url || ''
  $: imgName = $currentFile?.name || 'image'

  // ── Extract shapes & pins from annotations store ───────────────────
  $: imageAnns = ($annotations || []).filter(
    (a) => a.anchor_type === 'image-region' && !a.parent_id
  )

  let shapes = []
  let pins = []

  $: {
    const _shapes = []
    const _pins = []
    for (const ann of imageAnns) {
      if (ann.metadata) {
        try {
          const meta = typeof ann.metadata === 'string' ? JSON.parse(ann.metadata) : ann.metadata
          if (meta.type === 'pin') {
            _pins.push({ ...meta, _annId: ann.id })
          } else if (['arrow', 'rect', 'pen'].includes(meta.type)) {
            _shapes.push({ ...meta, _annId: ann.id })
          }
        } catch {
          // invalid metadata — skip
        }
      }
    }
    shapes = _shapes
    pins = _pins
  }

  // Include preview pin in what the canvas renders
  $: allPins = previewPin ? [...pins, previewPin] : pins

  // ── Zoom ───────────────────────────────────────────────────────────
  function zoomIn()  { zoom = Math.min(zoom * 1.25, 8) }
  function zoomOut() { zoom = Math.max(zoom / 1.25, 0.1) }
  function reset()   { zoom = 1 }

  function onWheel(e) {
    if (activeTool) return    // allow normal scroll while drawing
    e.preventDefault()
    if (e.deltaY < 0) zoomIn()
    else zoomOut()
  }

  // Non-passive wheel listener so preventDefault works
  onMount(() => {
    if (containerEl) {
      containerEl.addEventListener('wheel', onWheel, { passive: false })
    }
  })
  onDestroy(() => {
    if (containerEl) {
      containerEl.removeEventListener('wheel', onWheel)
    }
  })

  // ── Image load ─────────────────────────────────────────────────────
  function onImageLoad(e) {
    naturalW = e.target.naturalWidth
    naturalH = e.target.naturalHeight
  }

  // ── Tool selection ─────────────────────────────────────────────────
  function handleSelectTool(e) {
    activeTool = e.detail
  }

  function handleColorChange(e) {
    color = e.detail
  }

  function handleOpacityChange(e) {
    opacity = e.detail
  }

  // ── Add shape (arrow/rect/pen) — save immediately ──────────────────
  async function handleAddShape(e) {
    const shape = e.detail
    try {
      await createAnnotation({
        filePath: $currentFile.path,
        anchorType: 'image-region',
        comment: '',
        author: 'shankar',
        metadata: JSON.stringify(shape),
      })
      await reload()
    } catch (err) {
      console.error('Failed to save shape:', err)
    }
  }

  // ── Add pin — show preview, open panel for comment ─────────────────
  async function handleAddPin(e) {
    const { x, y } = e.detail
    const pinNum = pins.length + 1
    const pinData = { type: 'pin', x, y, color }

    // Show preview on canvas
    previewPin = { x, y, color, num: pinNum }

    // Open annotation panel with metadata so user can type a comment
    pendingAnnotation.set({
      anchorType: 'image-region',
      anchorId: `pin-${pinNum}`,
      selectedText: null,
      metadata: JSON.stringify(pinData),
    })
    annotationPanelOpen.set(true)
  }

  // Clear preview pin when annotations change (pin was saved)
  $: {
    if (previewPin && imageAnns.length > 0) {
      const found = imageAnns.some((a) => {
        if (!a.metadata) return false
        try {
          const m = typeof a.metadata === 'string' ? JSON.parse(a.metadata) : a.metadata
          return m.type === 'pin' && Math.abs(m.x - previewPin.x) < 0.001 && Math.abs(m.y - previewPin.y) < 0.001
        } catch { return false }
      })
      if (found) previewPin = null
    }
  }

  // ── Undo last image annotation ─────────────────────────────────────
  async function handleUndo() {
    if (imageAnns.length === 0) return
    const last = imageAnns[imageAnns.length - 1]
    try {
      await deleteAnnotation(last.id)
      await reload()
    } catch (err) {
      console.error('Failed to undo:', err)
    }
  }

  // ── Clear all image annotations ────────────────────────────────────
  async function handleClear() {
    if (imageAnns.length === 0) return
    if (!confirm('Clear all drawings and pins from this image?')) return
    try {
      for (const ann of imageAnns) {
        await deleteAnnotation(ann.id)
      }
      await reload()
    } catch (err) {
      console.error('Failed to clear:', err)
    }
  }

  // ── Reload annotations ─────────────────────────────────────────────
  async function reload() {
    if (!$currentFile) return
    try {
      const [anns, stats] = await Promise.all([
        fetchAnnotations($currentFile.path),
        fetchAnnotationStats(),
      ])
      annotations.set(anns)
      annotationStats.set(stats)
    } catch (e) {
      console.error('Failed to reload annotations:', e)
    }
  }

  // Reset state when file changes
  $: if ($currentFile) {
    zoom = 1
    activeTool = null
    previewPin = null
    naturalW = 0
    naturalH = 0
  }
</script>

<div class="flex flex-col h-full">
  <!-- ── Controls bar: zoom + annotation tools ─────────────────────── -->
  <div class="flex-shrink-0 flex items-center gap-2 px-4 border-b
              border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex-wrap"
       style="min-height:48px">
    <!-- Zoom controls -->
    <button
      on:click={zoomOut}
      class="text-sm border border-gray-200 dark:border-gray-700 rounded-lg
             hover:bg-gray-100 dark:hover:bg-gray-800 font-mono"
      style="min-height:36px;min-width:36px"
      aria-label="Zoom out"
    >−</button>
    <span class="text-xs text-gray-500 dark:text-gray-400 w-14 text-center tabular-nums">
      {Math.round(zoom * 100)}%
    </span>
    <button
      on:click={zoomIn}
      class="text-sm border border-gray-200 dark:border-gray-700 rounded-lg
             hover:bg-gray-100 dark:hover:bg-gray-800 font-mono"
      style="min-height:36px;min-width:36px"
      aria-label="Zoom in"
    >+</button>
    <button
      on:click={reset}
      class="text-xs border border-gray-200 dark:border-gray-700 rounded-lg
             hover:bg-gray-100 dark:hover:bg-gray-800 px-2"
      style="min-height:36px"
      aria-label="Reset zoom"
    >Fit</button>

    <!-- Divider -->
    <div class="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>

    <!-- Annotation toolbar -->
    <ImageAnnotationToolbar
      {activeTool}
      {color}
      {opacity}
      canUndo={imageAnns.length > 0}
      canClear={imageAnns.length > 0}
      on:selectTool={handleSelectTool}
      on:colorChange={handleColorChange}
      on:opacityChange={handleOpacityChange}
      on:undo={handleUndo}
      on:clear={handleClear}
    />

    <!-- Spacer + open link -->
    <a
      href={imgSrc}
      target="_blank"
      rel="noopener noreferrer"
      class="ml-auto text-xs text-blue-500 hover:underline px-2 flex-shrink-0"
      style="min-height:36px;display:inline-flex;align-items:center"
    >Open ↗</a>
  </div>

  <!-- ── Image + canvas overlay area ──────────────────────────────── -->
  <div
    bind:this={containerEl}
    class="flex-1 overflow-auto bg-gray-100 dark:bg-gray-950"
    style="cursor: {activeTool ? 'crosshair' : zoom > 1 ? 'grab' : 'default'}"
  >
    {#if imgSrc}
      <div class="flex items-center justify-center min-h-full min-w-full p-4">
        <div
          class="relative inline-block"
          style="
            transform: scale({zoom});
            transform-origin: center center;
            transition: transform 0.1s ease;
          "
        >
          <img
            bind:this={imgEl}
            src={imgSrc}
            alt={imgName}
            on:load={onImageLoad}
            on:dragstart|preventDefault
            class="block select-none"
            style="
              max-width: {zoom <= 1 ? '85vw' : 'none'};
              max-height: {zoom <= 1 ? 'calc(100vh - 200px)' : 'none'};
              object-fit: contain;
            "
          />
          {#if naturalW > 0}
            <ImageAnnotationCanvas
              imgWidth={naturalW}
              imgHeight={naturalH}
              {zoom}
              {activeTool}
              {color}
              {opacity}
              {shapes}
              pins={allPins}
              on:addshape={handleAddShape}
              on:addpin={handleAddPin}
            />
          {/if}
        </div>
      </div>
    {:else}
      <div class="flex items-center justify-center h-full">
        <p class="text-gray-400 text-sm">No image to display</p>
      </div>
    {/if}
  </div>
</div>
