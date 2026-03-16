<script>
  import { createEventDispatcher, onMount } from 'svelte'
  import { darkMode } from '../lib/store.js'
  import { fetchRoot, updateRoot } from '../lib/api.js'

  export let showClose = false
  export let showCollapse = false

  const dispatch = createEventDispatcher()

  let currentRoot = ''
  let defaultRoot = ''
  let toggling = false

  $: isWorkspace = currentRoot !== '' && currentRoot === defaultRoot
  $: modeLabel = isWorkspace ? 'Workspace' : currentRoot === '/' ? 'Root (/)' : 'Custom'
  $: toggleTitle = isWorkspace
    ? `Switch to filesystem root (/)`
    : `Switch to workspace (${defaultRoot})`

  onMount(async () => {
    try {
      const res = await fetchRoot()
      currentRoot = res.root
      defaultRoot = res.default_root
    } catch (e) {
      console.warn('Failed to fetch root', e)
    }
  })

  async function toggleRoot() {
    if (toggling) return
    toggling = true
    const newRoot = isWorkspace ? '/' : defaultRoot
    try {
      await updateRoot(newRoot)
      currentRoot = newRoot
      dispatch('refresh')
    } catch (e) {
      console.error('Failed to update root', e)
    } finally {
      toggling = false
    }
  }
</script>

<div class="flex-shrink-0 p-3 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2"
     style="min-height:56px">

  <!-- Logo / title -->
  <span class="text-lg" aria-hidden="true">📁</span>
  <div class="flex flex-col flex-1 min-w-0">
    <span class="font-semibold text-sm text-gray-700 dark:text-gray-200 leading-tight">
      {modeLabel}
    </span>
    {#if currentRoot}
      <span
        class="text-xs text-gray-400 dark:text-gray-500 truncate leading-tight"
        title={currentRoot}
      >{currentRoot}</span>
    {/if}
  </div>

  <div class="flex gap-1 items-center flex-shrink-0">
    <!-- Root toggle pill -->
    <button
      on:click={toggleRoot}
      disabled={toggling}
      title={toggleTitle}
      aria-label={toggleTitle}
      class="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium
             transition-colors select-none
             {isWorkspace
               ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/60'
               : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800/60'}
             disabled:opacity-50 disabled:cursor-not-allowed"
      style="min-height:32px"
    >
      {#if toggling}
        <span class="animate-spin inline-block text-xs">⟳</span>
      {:else}
        <span>{isWorkspace ? '🏠' : '🌍'}</span>
      {/if}
      <span>{isWorkspace ? 'WS' : 'FS'}</span>
    </button>

    <!-- Dark mode toggle -->
    <button
      on:click={() => darkMode.update((d) => !d)}
      class="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700
             text-gray-500 dark:text-gray-400 text-base leading-none"
      style="min-height:44px;min-width:44px"
      title="Toggle dark mode"
      aria-label="Toggle dark mode"
    >
      {$darkMode ? '☀️' : '🌙'}
    </button>

    <!-- Refresh -->
    <button
      on:click={() => dispatch('refresh')}
      class="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700
             text-gray-500 dark:text-gray-400 text-base leading-none"
      style="min-height:44px;min-width:44px"
      title="Refresh file tree"
      aria-label="Refresh"
    >
      ↺
    </button>

    <!-- Close (mobile/tablet drawer) -->
    {#if showClose}
      <button
        on:click={() => dispatch('close')}
        class="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700
               text-gray-500 dark:text-gray-400 text-lg leading-none"
        style="min-height:44px;min-width:44px"
        aria-label="Close sidebar"
      >
        ✕
      </button>
    {/if}

    <!-- Collapse (desktop) -->
    {#if showCollapse}
      <button
        on:click={() => dispatch('collapse')}
        class="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700
               text-gray-500 dark:text-gray-400 text-base leading-none"
        style="min-height:44px;min-width:44px"
        title="Collapse sidebar"
        aria-label="Collapse file tree"
      >‹</button>
    {/if}
  </div>
</div>
