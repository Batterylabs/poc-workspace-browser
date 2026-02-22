<script>
  import { afterUpdate } from 'svelte'
  import { marked } from 'marked'
  import hljs from 'highlight.js'
  import { currentFile, annotations, pendingAnnotation, annotationPanelOpen } from '../lib/store.js'

  export let breakpoint = 'desktop'

  let rendered = ''
  let container

  // Tailwind arbitrary selectors break Svelte's parser when inlined — define as JS variable
  const articleClass = [
    'prose prose-sm md:prose-base dark:prose-invert max-w-none',
    'prose-headings:font-semibold prose-headings:tracking-tight',
    'prose-code:text-sm prose-code:bg-gray-100 prose-code:dark:bg-gray-800',
    'prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none',
    'prose-pre:bg-[#0d1117] prose-pre:dark:bg-[#0d1117] prose-pre:overflow-x-auto',
    'prose-pre:border prose-pre:border-gray-200 prose-pre:dark:border-gray-700',
    'prose-pre:rounded-xl prose-pre:text-sm',
    'prose-blockquote:border-l-blue-400 prose-blockquote:bg-blue-50 prose-blockquote:dark:bg-blue-950/30',
    'prose-blockquote:rounded-r-lg prose-blockquote:py-1',
    'prose-a:text-blue-600 prose-a:dark:text-blue-400',
    'prose-img:rounded-xl prose-img:shadow-md',
    'prose-table:text-sm',
    '[&_.group:hover_.block-anchor]:opacity-100',
    'selection:bg-yellow-200 dark:selection:bg-yellow-800/60',
  ].join(' ')

  // Configure marked
  marked.setOptions({
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext'
      return hljs.highlight(code, { language }).value
    },
    langPrefix: 'hljs language-',
    gfm: true,
    breaks: false,
  })

  $: if ($currentFile?.content) {
    rendered = marked.parse($currentFile.content || '')
  }

  // Add heading IDs for anchor links
  afterUpdate(() => {
    if (!container) return
    container.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((el) => {
      if (!el.id) {
        el.id = el.textContent
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
      }
    })
  })

  // ── Text selection → annotation ──────────────────────────────────────
  // Works on desktop (mouseup) and mobile (selectionchange / touchend)
  function captureSelection() {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    const text = sel.toString().trim()
    if (!text || text.length < 3) return

    pendingAnnotation.set({ anchorType: 'selection', anchorId: null, selectedText: text })
    annotationPanelOpen.set(true)
  }

  function handleMouseUp() {
    // Small delay so selection is stable
    setTimeout(captureSelection, 50)
  }

  function handleTouchEnd() {
    // On iOS, selection is set after touchend fires
    setTimeout(captureSelection, 200)
  }

  // Block-level comment: clicking the ¶ anchor in each heading/paragraph
  // We inject these via afterUpdate
  function addBlockAnchors() {
    if (!container) return
    container.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote').forEach((el, i) => {
      if (el.dataset.annotateReady) return
      el.dataset.annotateReady = '1'

      const btn = document.createElement('button')
      btn.className =
        'block-anchor inline-block ml-2 text-gray-300 dark:text-gray-700 ' +
        'hover:text-blue-400 dark:hover:text-blue-500 text-xs opacity-0 ' +
        'group-hover:opacity-100 align-middle select-none transition-opacity'
      btn.style.minHeight = '0'
      btn.style.minWidth = '0'
      btn.setAttribute('aria-label', 'Comment on this block')
      btn.textContent = '¶'
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        pendingAnnotation.set({
          anchorType: 'block',
          anchorId: el.id || `block-${i}`,
          selectedText: el.textContent.slice(0, 120),
        })
        annotationPanelOpen.set(true)
      })
      el.classList.add('group')
      el.appendChild(btn)
    })
  }

  afterUpdate(addBlockAnchors)

  // Responsive padding
  $: proseClass = breakpoint === 'mobile'
    ? 'px-4 py-6'
    : breakpoint === 'tablet'
      ? 'px-8 py-8'
      : 'px-10 py-10'
</script>

<svelte:head>
  <link rel="stylesheet"
    href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css"
    id="hljs-theme" />
</svelte:head>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  bind:this={container}
  on:mouseup={handleMouseUp}
  on:touchend={handleTouchEnd}
  class="max-w-3xl mx-auto {proseClass}"
>
  <article class={articleClass}>{@html rendered}</article>
</div>
