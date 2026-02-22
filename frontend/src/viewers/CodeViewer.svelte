<script>
  import { afterUpdate } from 'svelte'
  import hljs from 'highlight.js'
  import { currentFile, annotations, annotationPanelOpen, pendingAnnotation } from '../lib/store.js'

  export let breakpoint = 'desktop'

  let lines = []

  $: if ($currentFile?.content !== undefined) {
    lines = ($currentFile.content || '').split('\n')
    // Don't include trailing empty line
    if (lines.length && lines[lines.length - 1] === '') lines = lines.slice(0, -1)
  }

  // Annotated line numbers
  $: annotatedLines = new Set(
    $annotations
      .filter((a) => a.anchor_type === 'line' && !a.resolved)
      .map((a) => Number(a.anchor_id))
  )

  // Language detection
  const LANG_MAP = {
    '.py': 'python', '.js': 'javascript', '.jsx': 'javascript',
    '.ts': 'typescript', '.tsx': 'typescript', '.svelte': 'xml',
    '.sh': 'bash', '.bash': 'bash', '.zsh': 'bash',
    '.html': 'html', '.htm': 'html', '.css': 'css', '.scss': 'scss',
    '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml',
    '.sql': 'sql', '.rs': 'rust', '.go': 'go', '.java': 'java',
    '.kt': 'kotlin', '.swift': 'swift', '.c': 'c', '.cpp': 'cpp',
    '.rb': 'ruby', '.php': 'php', '.r': 'r',
    '.tf': 'hcl', '.hcl': 'hcl',
  }

  let highlightedLines = []

  // Batch highlight: highlight the full file and then split by line
  $: {
    const ext = $currentFile?.ext || ''
    const lang = LANG_MAP[ext] || 'plaintext'
    const code = ($currentFile?.content || '')
    try {
      const full = hljs.highlight(code, { language: lang }).value
      highlightedLines = full.split('\n')
      // trim trailing empty
      if (highlightedLines.length && highlightedLines[highlightedLines.length - 1] === '') {
        highlightedLines = highlightedLines.slice(0, -1)
      }
    } catch {
      highlightedLines = lines.map((l) =>
        l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      )
    }
  }

  function annotateClick(lineNum) {
    pendingAnnotation.set({
      anchorType: 'line',
      anchorId: String(lineNum),
      selectedText: lines[lineNum - 1] || '',
    })
    annotationPanelOpen.set(true)
  }

  function handleMouseUp() {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    const text = sel.toString().trim()
    if (!text || text.length < 3) return
    pendingAnnotation.set({ anchorType: 'selection', anchorId: null, selectedText: text })
    annotationPanelOpen.set(true)
  }

  function handleTouchEnd() {
    setTimeout(() => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) return
      const text = sel.toString().trim()
      if (!text || text.length < 3) return
      pendingAnnotation.set({ anchorType: 'selection', anchorId: null, selectedText: text })
      annotationPanelOpen.set(true)
    }, 200)
  }

  // On mobile, line numbers are hidden (too narrow); on tablet+desktop shown
  $: showLineNums = breakpoint !== 'mobile'
</script>

<svelte:head>
  <link rel="stylesheet"
    href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css" />
</svelte:head>

<!-- Horizontal scroll container -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="overflow-x-auto overscroll-x-contain bg-[#0d1117] min-h-full"
  on:mouseup={handleMouseUp}
  on:touchend={handleTouchEnd}
>
  <table class="min-w-full border-collapse text-sm font-mono">
    <tbody>
      {#each highlightedLines as hlLine, i}
        {@const lineNum = i + 1}
        {@const hasAnn = annotatedLines.has(lineNum)}
        <tr
          id="L{lineNum}"
          class="group"
          class:bg-yellow-50={hasAnn}
          class:dark:bg-yellow-950={hasAnn}
        >
          <!-- Line number (hidden on mobile) -->
          {#if showLineNums}
            <td class="select-none w-10 text-right pr-3 pl-4 py-0
                       text-gray-500 align-top leading-6
                       border-r border-gray-700">
              <button
                on:click={() => annotateClick(lineNum)}
                class="w-full text-right font-mono hover:text-blue-500 dark:hover:text-blue-400
                       text-[11px] leading-6 opacity-0 group-hover:opacity-100 transition-opacity"
                style="min-height:0;min-width:0"
                title="Comment on line {lineNum}"
                aria-label="Comment on line {lineNum}"
              >{lineNum}</button>
            </td>
          {/if}

          <!-- Annotation gutter dot -->
          <td class="w-4 align-top leading-6 py-0"
              class:pl-4={!showLineNums}>
            {#if hasAnn}
              <span class="block w-1 h-[1.5em] bg-yellow-400 rounded-sm mt-[2px]"
                    aria-hidden="true"></span>
            {/if}
          </td>

          <!-- Code -->
          <td class="pr-6 py-0 leading-6 text-[#e6edf3] whitespace-pre align-top">
            {@html hlLine || ' '}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
