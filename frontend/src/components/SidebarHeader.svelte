<script>
  import { createEventDispatcher } from 'svelte'
  import { darkMode } from '../lib/store.js'

  export let showClose = false

  const dispatch = createEventDispatcher()
</script>

<div class="flex-shrink-0 p-3 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2"
     style="min-height:56px">

  <!-- Logo / title -->
  <span class="text-lg" aria-hidden="true">📁</span>
  <span class="font-semibold text-sm text-gray-700 dark:text-gray-200 flex-1">Workspace</span>

  <div class="flex gap-1 items-center">
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
  </div>
</div>
