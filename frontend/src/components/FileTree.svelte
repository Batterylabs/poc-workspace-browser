<script>
  import { createEventDispatcher } from 'svelte'
  import { currentFile, annotationPanelOpen, annotations, annotationStats } from '../lib/store.js'
  import { fetchFile, fetchAnnotations } from '../lib/api.js'

  export let node
  export let depth = 0

  const dispatch = createEventDispatcher()

  // Root is expanded by default; first level dirs start expanded too
  let expanded = depth <= 1

  // ── Icon map ──────────────────────────────────────────────────────────
  const EXT_ICONS = {
    '.md': '📝', '.markdown': '📝',
    '.py': '🐍',
    '.js': '🟨', '.jsx': '🟨', '.cjs': '🟨', '.mjs': '🟨',
    '.ts': '🔷', '.tsx': '🔷',
    '.svelte': '🧡',
    '.json': '{}',
    '.yaml': '⚙️', '.yml': '⚙️', '.toml': '⚙️',
    '.sh': '🖥', '.bash': '🖥', '.zsh': '🖥', '.fish': '🖥',
    '.html': '🌐', '.htm': '🌐',
    '.css': '🎨', '.scss': '🎨', '.less': '🎨',
    '.sql': '🗄',
    '.png': '🖼', '.jpg': '🖼', '.jpeg': '🖼', '.gif': '🖼', '.webp': '🖼', '.svg': '🖼',
    '.pdf': '📕',
    '.txt': '📃', '.log': '📃',
    '.csv': '📊',
    '.rs': '🦀', '.go': '🐹', '.java': '☕',
    '.rb': '💎', '.php': '🐘', '.kt': '🎯', '.swift': '🍎',
    '.c': '🔵', '.cpp': '🔵', '.h': '🔵',
    '.tf': '🏗', '.hcl': '🏗',
    '.r': '📊',
  }

  function getIcon(n) {
    if (n.type === 'directory') return expanded ? '📂' : '📁'
    return EXT_ICONS[n.ext] || '📄'
  }

  // ── File selection ────────────────────────────────────────────────────
  let loading = false

  async function handleClick() {
    if (node.type === 'directory') {
      expanded = !expanded
      return
    }
    if (loading) return
    loading = true
    try {
      const data = await fetchFile(node.path)
      currentFile.set({ ...data, path: node.path, name: node.name, ext: node.ext })
      const anns = await fetchAnnotations(node.path)
      annotations.set(anns)
      dispatch('fileSelected', { path: node.path })
    } catch (e) {
      console.error('Failed to load file:', e)
    } finally {
      loading = false
    }
  }

  // Propagate fileSelected up the tree
  function forwardFileSelected(e) {
    dispatch('fileSelected', e.detail)
  }

  // ── Annotation indicators ─────────────────────────────────────────────
  $: stats = $annotationStats[node?.path] || {}
  $: openCount = stats.open || 0
  $: resolvedCount = stats.resolved || 0
  $: isActive = $currentFile?.path === node?.path

  // Indent: 12px per depth level, min 8px padding-left
  $: paddingLeft = `${depth * 14 + 10}px`
</script>

<div>
  <!-- ── Tree node button ───────────────────────────────────────────── -->
  <button
    class="w-full text-left flex items-center gap-2 rounded-lg transition-colors
           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    class:bg-blue-50={isActive && !loading}
    class:dark:bg-blue-900={isActive}
    class:text-blue-700={isActive}
    class:dark:text-blue-300={isActive}
    class:text-gray-700={!isActive}
    class:dark:text-gray-300={!isActive}
    class:opacity-60={loading}
    style="padding-left: {paddingLeft}; padding-right: 10px; min-height: 40px;"
    on:click={handleClick}
    aria-expanded={node.type === 'directory' ? expanded : undefined}
    aria-label={node.name}
  >
    <!-- Collapse chevron for dirs -->
    {#if node.type === 'directory'}
      <span class="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 w-3 text-center select-none"
            aria-hidden="true">
        {expanded ? '▾' : '▸'}
      </span>
    {:else}
      <span class="w-3 flex-shrink-0"></span>
    {/if}

    <!-- File/dir icon -->
    <span class="text-sm flex-shrink-0 select-none" aria-hidden="true">
      {#if loading}⏳{:else}{getIcon(node)}{/if}
    </span>

    <!-- Name -->
    <span class="truncate text-xs font-mono flex-1" title={node.path}>
      {node.name}
    </span>

    <!-- Annotation dot indicators -->
    {#if node.type === 'file'}
      {#if openCount > 0}
        <span class="flex-shrink-0 flex items-center gap-0.5" aria-label="{openCount} open comment(s)">
          <span class="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0"></span>
          {#if openCount > 1}
            <span class="text-[10px] text-yellow-600 dark:text-yellow-400">{openCount}</span>
          {/if}
        </span>
      {:else if resolvedCount > 0}
        <span class="flex-shrink-0 text-green-500 text-[10px] font-bold" aria-label="All comments resolved">✓</span>
      {/if}
    {/if}
  </button>

  <!-- ── Children ─────────────────────────────────────────────────────── -->
  {#if node.type === 'directory' && expanded && node.children}
    <div role="group">
      {#each node.children as child (child.path)}
        <svelte:self
          node={child}
          depth={depth + 1}
          on:fileSelected={forwardFileSelected}
        />
      {/each}
    </div>
  {/if}
</div>
