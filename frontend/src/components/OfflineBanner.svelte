<script>
  import { isOnline, pendingCount } from '../lib/store.js'

  $: offline = !$isOnline
  $: pending = $pendingCount
</script>

{#if offline}
  <div class="flex items-center gap-2 px-4 bg-amber-500 text-amber-950 z-50"
       style="min-height:32px; animation: slideDown 0.3s ease-out;">
    <span class="w-2 h-2 rounded-full bg-red-600 flex-shrink-0"
          style="animation: pulse 2s infinite;"></span>
    <span class="text-xs font-medium">
      You're offline
      {#if pending > 0}
        — {pending} change{pending !== 1 ? 's' : ''} queued
      {/if}
    </span>
  </div>
{/if}

<style>
  @keyframes slideDown {
    from { transform: translateY(-100%); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
</style>
