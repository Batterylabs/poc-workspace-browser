<script>
  import { currentFile } from '../lib/store.js'
</script>

<div class="p-4 sm:p-6">
  {#if $currentFile?.type === 'binary'}
    <div class="flex flex-col items-center justify-center py-16 sm:py-24
                text-gray-400 dark:text-gray-600">
      <div class="text-6xl mb-4" aria-hidden="true">📎</div>
      <p class="text-sm font-medium text-gray-600 dark:text-gray-400">{$currentFile.name}</p>
      <p class="text-xs mt-1 text-gray-400">
        Binary file · {($currentFile.size / 1024).toFixed(1)} KB
      </p>
    </div>
  {:else}
    <div class="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
      <pre class="text-xs sm:text-sm font-mono text-gray-800 dark:text-gray-200
                  bg-gray-50 dark:bg-gray-900 p-4 whitespace-pre-wrap break-words"
      >{$currentFile?.content || ''}</pre>
    </div>
  {/if}
</div>
