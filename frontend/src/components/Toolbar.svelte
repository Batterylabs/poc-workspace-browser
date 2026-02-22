<script>
  import { createEventDispatcher } from 'svelte'
  import { currentFile, annotationPanelOpen, openAnnotations } from '../lib/store.js'

  export let breakpoint = 'desktop'
  export let sidebarOpen = false

  const dispatch = createEventDispatcher()

  $: file = $currentFile
  $: parts = file?.path ? file.path.split('/') : []
  $: openCount = $openAnnotations.length

  // On mobile only show the last 1 path segment; tablet: last 2; desktop: all
  $: visibleParts = breakpoint === 'mobile'
    ? parts.slice(-1)
    : breakpoint === 'tablet'
      ? parts.slice(-2)
      : parts
  $: truncated = visibleParts.length < parts.length
</script>

<header class="flex-shrink-0 flex items-center gap-2 px-3 border-b
               border-gray-200 dark:border-gray-800
               bg-white dark:bg-gray-900"
        style="min-height:48px">

  <!-- ── Hamburger (hidden on desktop) ───────────────────────────────── -->
  {#if breakpoint !== 'desktop'}
    <button
      on:click={() => dispatch('toggleSidebar')}
      class="flex-shrink-0 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800
             text-gray-600 dark:text-gray-400 transition-colors"
      style="min-height:44px;min-width:44px"
      aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
      aria-expanded={sidebarOpen}
    >
      <!-- Animated hamburger → X -->
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {#if sidebarOpen}
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M6 18L18 6M6 6l12 12" />
        {:else}
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 6h16M4 12h16M4 18h16" />
        {/if}
      </svg>
    </button>
  {/if}

  <!-- ── Breadcrumb ────────────────────────────────────────────────────── -->
  <nav class="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400
              flex-1 min-w-0 overflow-hidden"
       aria-label="File path">
    {#if file}
      {#if truncated}
        <span class="text-gray-400 dark:text-gray-600 flex-shrink-0">…</span>
        <span class="text-gray-300 dark:text-gray-600 flex-shrink-0">/</span>
      {:else}
        <span class="text-gray-400 dark:text-gray-600 flex-shrink-0 hidden sm:inline">workspace</span>
      {/if}

      {#each visibleParts as part, i}
        {#if i > 0 || truncated}
          <span class="text-gray-300 dark:text-gray-600 flex-shrink-0">/</span>
        {:else if !truncated && breakpoint !== 'mobile'}
          <span class="text-gray-300 dark:text-gray-600 flex-shrink-0">/</span>
        {/if}
        <span
          class="truncate"
          class:text-gray-900={i === visibleParts.length - 1}
          class:dark:text-white={i === visibleParts.length - 1}
          class:font-medium={i === visibleParts.length - 1}
          class:text-gray-500={i < visibleParts.length - 1}
          title={file.path}
        >{part}</span>
      {/each}
    {:else}
      <span class="text-gray-400 dark:text-gray-600 italic text-xs">No file selected</span>
    {/if}
  </nav>

  <!-- ── Actions ───────────────────────────────────────────────────────── -->
  {#if file}
    <div class="flex items-center gap-2 flex-shrink-0">
      <!-- File type badge (hide on mobile to save space) -->
      {#if breakpoint === 'desktop' && file.ext}
        <span class="text-xs text-gray-400 dark:text-gray-500 font-mono px-1">
          {file.ext}
        </span>
      {/if}

      <!-- Comments toggle -->
      <button
        on:click={() => annotationPanelOpen.update((v) => !v)}
        class="flex items-center gap-1.5 rounded-lg text-xs font-medium transition-colors px-3
               {$annotationPanelOpen
                 ? 'bg-yellow-200 text-yellow-900 dark:bg-yellow-800 dark:text-yellow-100'
                 : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/60 dark:text-yellow-200'}"
        style="min-height:44px"
        aria-label="Toggle comments panel"
        aria-pressed={$annotationPanelOpen}
      >
        <span>💬</span>
        <!-- Show count on all sizes; hide label text on small phones -->
        <span class="hidden xs:inline sm:inline">
          {openCount > 0 ? `${openCount}` : ''}
        </span>
        <span class="hidden sm:inline">
          {openCount > 0
            ? `comment${openCount !== 1 ? 's' : ''}`
            : 'Comments'}
        </span>
        {#if openCount > 0}
          <span class="sm:hidden inline font-bold">{openCount}</span>
        {/if}
      </button>
    </div>
  {/if}
</header>
