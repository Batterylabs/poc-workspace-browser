<script>
  import { currentFile } from '../lib/store.js'

  let zoom = 1

  $: imgSrc = $currentFile?.url || ''
  $: imgName = $currentFile?.name || 'image'

  function zoomIn()  { zoom = Math.min(zoom * 1.25, 8) }
  function zoomOut() { zoom = Math.max(zoom / 1.25, 0.1) }
  function reset()   { zoom = 1 }

  function onWheel(e) {
    e.preventDefault()
    if (e.deltaY < 0) zoomIn()
    else zoomOut()
  }

  // Reset zoom when image changes
  $: if ($currentFile) zoom = 1
</script>

<div class="flex flex-col h-full">
  <!-- Controls -->
  <div class="flex-shrink-0 flex items-center gap-2 px-4 border-b
              border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900"
       style="min-height:48px">
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
    <a
      href={imgSrc}
      target="_blank"
      rel="noopener noreferrer"
      class="ml-auto text-xs text-blue-500 hover:underline px-2"
      style="min-height:36px;display:inline-flex;align-items:center"
    >Open ↗</a>
  </div>

  <!-- Image pan/zoom area -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="flex-1 overflow-auto bg-gray-100 dark:bg-gray-950
           flex items-center justify-center touch-pinch-zoom"
    on:wheel|passive={onWheel}
    style="cursor: {zoom > 1 ? 'grab' : 'default'}"
  >
    {#if imgSrc}
      <img
        src={imgSrc}
        alt={imgName}
        style="
          transform: scale({zoom});
          transform-origin: center center;
          transition: transform 0.1s ease;
          max-width: {zoom <= 1 ? '100%' : 'none'};
          max-height: {zoom <= 1 ? '100%' : 'none'};
          object-fit: contain;
        "
        on:dragstart|preventDefault
      />
    {:else}
      <p class="text-gray-400 text-sm">No image to display</p>
    {/if}
  </div>
</div>
