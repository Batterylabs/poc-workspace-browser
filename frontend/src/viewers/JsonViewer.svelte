<script>
  import { currentFile } from '../lib/store.js'
  import hljs from 'highlight.js'

  let error = null
  let highlighted = ''
  let summary = ''

  $: {
    error = null
    highlighted = ''
    summary = ''
    const raw = $currentFile?.content || ''
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        const pretty = JSON.stringify(parsed, null, 2)
        highlighted = hljs.highlight(pretty, { language: 'json' }).value
        summary = Array.isArray(parsed)
          ? `Array · ${parsed.length} item${parsed.length !== 1 ? 's' : ''}`
          : `Object · ${Object.keys(parsed).length} key${Object.keys(parsed).length !== 1 ? 's' : ''}`
      } catch (e) {
        error = e.message
        try { highlighted = hljs.highlight(raw, { language: 'json' }).value } catch {}
      }
    }
  }
</script>

<svelte:head>
  <link rel="stylesheet"
    href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css" />
</svelte:head>

<div class="p-4 sm:p-6">
  {#if error}
    <div class="mb-4 px-4 py-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800
                rounded-xl text-red-700 dark:text-red-300 text-sm">
      ⚠️ Invalid JSON: {error}
    </div>
  {/if}

  {#if summary}
    <p class="mb-2 text-xs text-gray-400 dark:text-gray-500 font-mono">{summary}</p>
  {/if}

  <div class="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
    <pre class="text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 p-4 overflow-auto"
         style="tab-size:2"><code class="hljs">{@html highlighted}</code></pre>
  </div>
</div>
