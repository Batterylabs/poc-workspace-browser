<script>
  import { isOnline, syncStatus, pendingCount } from '../lib/store.js'
  import { triggerSync } from '../lib/syncManager.js'

  $: offline = !$isOnline
  $: syncing = $syncStatus === 'syncing'
  $: syncError = $syncStatus === 'error'
  $: syncSuccess = $syncStatus === 'success'
  $: pending = $pendingCount
</script>

{#if syncing}
  <div class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs
              bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
       title="Syncing queued changes…"
       style="min-height:32px">
    <span class="inline-block" style="animation: spin 1s linear infinite;">⟳</span>
    <span class="hidden sm:inline">Syncing…</span>
  </div>
{:else if syncError && pending > 0}
  <button
    class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs
           bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300
           hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors border-0 cursor-pointer"
    style="min-height:32px; font: inherit;"
    title="Sync failed — click to retry"
    on:click={() => triggerSync()}
  >
    <span>⚠️</span>
    <span class="hidden sm:inline">Retry ({pending})</span>
  </button>
{:else if syncSuccess}
  <div class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs
              bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
       style="min-height:32px; animation: fadeIn 0.3s ease-out;">
    <span>✓</span>
    <span class="hidden sm:inline">Synced</span>
  </div>
{:else if pending > 0 && !offline}
  <div class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs
              bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
       title="{pending} queued change{pending !== 1 ? 's' : ''}"
       style="min-height:32px">
    <span>🕐</span>
    <span class="hidden sm:inline">{pending} pending</span>
  </div>
{/if}

<style>
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>
