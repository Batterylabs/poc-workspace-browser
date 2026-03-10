<script>
  import { createEventDispatcher } from 'svelte'
  import { currentFile, annotationPanelOpen, annotations, annotationStats, selectedPaths } from '../lib/store.js'
  import { fetchFile, fetchAnnotations } from '../lib/api.js'
  import { pinnedPaths, cachedPaths, pinForOffline, unpinOffline } from '../lib/offlinePins.js'

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
      try { localStorage.setItem('wb_lastFile', node.path) } catch {}
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

  // ── Offline pins ────────────────────────────────────────────────────────
  $: pinned = $pinnedPaths.has(node?.path)
  $: cached = $cachedPaths.has(node?.path)
  // For folders: check if the folder path is pinned
  $: folderPinned = node?.type === 'directory' && $pinnedPaths.has(node?.path)

  let pinning = false
  async function togglePin(e) {
    e.stopPropagation()
    pinning = true
    try {
      if (pinned || folderPinned) {
        await unpinOffline(node.path)
      } else {
        await pinForOffline(node.path, node.type)
      }
    } catch (err) {
      console.error('Pin toggle failed:', err)
    } finally {
      pinning = false
    }
  }

  // ── Selection checkbox ──────────────────────────────────────────────────
  $: isSelected = $selectedPaths.has(node?.path)

  function toggleSelection(e) {
    e.stopPropagation()
    const newSet = new Set($selectedPaths)
    if (newSet.has(node.path)) {
      newSet.delete(node.path)
    } else {
      newSet.add(node.path)
    }
    selectedPaths.set(newSet)
  }

  // Indent: 12px per depth level, min 8px padding-left
  $: paddingLeft = `${depth * 14 + 10}px`
</script>

<div>
  <!-- ── Tree node button ───────────────────────────────────────────── -->
  <div class="group flex items-center gap-1" style="padding-left: {paddingLeft}; padding-right: 10px;">
    <!-- Selection checkbox -->
    <input
      type="checkbox"
      checked={isSelected}
      on:change={toggleSelection}
      class="flex-shrink-0 w-4 h-4 cursor-pointer"
      aria-label="Select {node.name}"
    />

    <!-- Pin for offline button -->
    <button
      on:click={togglePin}
      disabled={pinning}
      class="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded
             text-[11px] leading-none transition-opacity
             {pinned || folderPinned
               ? 'opacity-100'
               : 'opacity-0 group-hover:opacity-60 hover:!opacity-100'}"
      title={pinned || folderPinned ? 'Unpin from offline' : 'Pin for offline reading'}
      aria-label={pinned || folderPinned ? `Unpin ${node.name}` : `Pin ${node.name} for offline`}
    >
      {#if pinning}
        <span class="animate-spin text-[9px]">⏳</span>
      {:else if pinned || folderPinned}
        <span class="w-2 h-2 rounded-sm bg-blue-500 flex-shrink-0" title="Pinned"></span>
      {:else}
        <span class="w-2 h-2 rounded-sm border border-gray-300 dark:border-gray-600 flex-shrink-0"></span>
      {/if}
    </button>
    
    <!-- File/folder button -->
    <button
      class="flex-1 text-left flex items-center gap-2 rounded-lg transition-colors
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      class:bg-blue-50={isActive && !loading}
      class:dark:bg-blue-900={isActive}
      class:text-blue-700={isActive}
      class:dark:text-blue-300={isActive}
      class:text-gray-700={!isActive}
      class:dark:text-gray-300={!isActive}
      class:opacity-60={loading}
      style="min-height: 40px; padding: 0 6px;"
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

      <!-- Offline pin indicator -->
      {#if pinned || folderPinned}
        <span class="flex-shrink-0 flex items-center gap-0.5"
              title={cached ? 'Pinned & cached for offline' : 'Pinned — caching...'}
              aria-label={cached ? 'Available offline' : 'Pinning for offline'}>
          {#if cached}
            <span class="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0"></span>
          {:else}
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 animate-pulse"></span>
          {/if}
        </span>
      {/if}
    </button>
  </div>

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
