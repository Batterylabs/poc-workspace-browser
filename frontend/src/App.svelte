<script>
  import { onMount } from 'svelte'
  import { setToken, hasToken, fetchTree, fetchAnnotationStats } from './lib/api.js'
  import {
    darkMode, currentFile, annotationPanelOpen,
    annotationStats, authToken, pendingAnnotation, isOnline
  } from './lib/store.js'
  import { initSyncManager } from './lib/syncManager.js'
  import { refreshPendingCount } from './lib/offlineQueue.js'
  import { initPins, syncAllPins } from './lib/offlinePins.js'

  import SidebarHeader from './components/SidebarHeader.svelte'
  import FileTree from './components/FileTree.svelte'
  import Toolbar from './components/Toolbar.svelte'
  import AnnotationPanel from './components/AnnotationPanel.svelte'
  import MarkdownViewer from './viewers/MarkdownViewer.svelte'
  import CodeViewer from './viewers/CodeViewer.svelte'
  import ImageViewer from './viewers/ImageViewer.svelte'
  import JsonViewer from './viewers/JsonViewer.svelte'
  import FallbackViewer from './viewers/FallbackViewer.svelte'

  // ── Auth state ──────────────────────────────────────────────────────────
  let authInput = ''
  let authenticated = false
  let loading = true
  let error = null
  let tree = null

  // ── Responsive breakpoint ───────────────────────────────────────────────
  // 'mobile' < 768  |  'tablet' 768–1023  |  'desktop' ≥ 1024
  let breakpoint = 'desktop'
  let sidebarOpen = false

  // ── Desktop sidebar collapse (persisted) ────────────────────────────────
  let sidebarCollapsed = typeof localStorage !== 'undefined'
    ? localStorage.getItem('sidebarCollapsed') === 'true'
    : false

  function toggleDesktopSidebar() {
    sidebarCollapsed = !sidebarCollapsed
    if (typeof localStorage !== 'undefined')
      localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed))
  }

  function calcBreakpoint() {
    const w = window.innerWidth
    if (w < 768) return 'mobile'
    if (w < 1024) return 'tablet'
    return 'desktop'
  }

  function handleResize() {
    const next = calcBreakpoint()
    if (next === 'desktop') sidebarOpen = false
    breakpoint = next
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────
  onMount(async () => {
    // Responsive setup
    breakpoint = calcBreakpoint()
    window.addEventListener('resize', handleResize)

    // Dark mode class
    if ($darkMode) document.documentElement.classList.add('dark')

    // Auth: check URL token first
    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('token')
    if (urlToken) {
      setToken(urlToken)
      authToken.set(urlToken)
      const url = new URL(window.location.href)
      url.searchParams.delete('token')
      window.history.replaceState({}, '', url.toString())
    }

    if (hasToken()) {
      authenticated = true
      await loadTree()
    } else {
      loading = false
    }

    // Initialize offline support
    initSyncManager()
    refreshPendingCount().catch(() => {})
    
    // Initialize offline pins (load pinned paths, prefetch if online)
    const token = localStorage.getItem('wb_token') || ''
    if (token) {
      initPins(token).then(() => {
        if (navigator.onLine) syncAllPins().catch(() => {})
      }).catch(() => {})
    }

    // Register service worker
    registerServiceWorker()

    return () => window.removeEventListener('resize', handleResize)
  })

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          console.log('Service worker registered:', reg.scope)
          // Check for updates periodically
          setInterval(() => reg.update(), 60 * 60 * 1000) // hourly
        })
        .catch((err) => {
          console.warn('Service worker registration failed:', err)
        })
    }
  }

  async function handleAuth() {
    if (!authInput.trim()) return
    setToken(authInput.trim())
    authToken.set(authInput.trim())
    authenticated = true
    await loadTree()
  }

  async function loadTree() {
    loading = true
    error = null
    try {
      tree = await fetchTree()
      const stats = await fetchAnnotationStats()
      annotationStats.set(stats)
    } catch (e) {
      error = e.message
      if (e.message.includes('Unauthorized')) authenticated = false
    } finally {
      loading = false
    }
  }

  // ── Viewer routing ──────────────────────────────────────────────────────
  const CODE_EXTS = new Set([
    '.py', '.js', '.ts', '.jsx', '.tsx', '.svelte', '.sh', '.bash',
    '.zsh', '.css', '.scss', '.html', '.htm', '.xml', '.yaml', '.yml',
    '.toml', '.ini', '.cfg', '.sql', '.rs', '.go', '.java', '.kt',
    '.swift', '.c', '.cpp', '.h', '.rb', '.php', '.r', '.tf', '.hcl',
  ])

  function pickViewer(file) {
    if (!file) return null
    if (file.type === 'image') return 'image'
    const ext = file.ext || ''
    if (ext === '.md' || ext === '.markdown') return 'markdown'
    if (ext === '.json') return 'json'
    if (CODE_EXTS.has(ext)) return 'code'
    return 'fallback'
  }

  $: viewerType = pickViewer($currentFile)

  // Close sidebar when file selected on mobile/tablet
  function onFileSelected() {
    if (breakpoint !== 'desktop') sidebarOpen = false
  }

  // Backdrop visible when drawer or overlay panel is open on non-desktop
  $: showBackdrop =
    sidebarOpen ||
    ($annotationPanelOpen && breakpoint !== 'desktop')

  function closeAll() {
    sidebarOpen = false
    if (breakpoint !== 'desktop') annotationPanelOpen.set(false)
  }

  // FAB tapped → open annotation panel with file-level anchor
  function fabTap() {
    pendingAnnotation.set({ anchorType: 'file', anchorId: null, selectedText: '' })
    annotationPanelOpen.set(true)
  }

  $: isDesktop = breakpoint === 'desktop'
  $: isMobile  = breakpoint === 'mobile'
  $: isTablet  = breakpoint === 'tablet'
</script>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- AUTH                                                                    -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
{#if !authenticated && !loading}
  <div class="min-h-screen min-h-[100dvh] flex items-center justify-center
              bg-gray-50 dark:bg-gray-950 px-4">
    <div class="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 w-full max-w-sm
                border border-gray-200 dark:border-gray-800">
      <div class="text-center mb-6">
        <div class="text-5xl mb-3" aria-hidden="true">📁</div>
        <h1 class="text-xl font-semibold text-gray-900 dark:text-white">Workspace Browser</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Enter your access token to continue</p>
      </div>
      <form on:submit|preventDefault={handleAuth} class="space-y-3">
        <input
          type="password"
          bind:value={authInput}
          placeholder="Bearer token…"
          style="min-height:48px"
          class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700
                 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-base
                 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autofocus
        />
        <button
          type="submit"
          style="min-height:48px"
          class="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800
                 text-white rounded-xl text-base font-medium transition-colors"
        >
          Authenticate
        </button>
      </form>
      {#if error}
        <p class="text-red-500 text-sm mt-3 text-center">{error}</p>
      {/if}
    </div>
  </div>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- LOADING                                                                 -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
{:else if loading}
  <div class="min-h-screen min-h-[100dvh] flex items-center justify-center
              bg-gray-50 dark:bg-gray-950">
    <div class="text-center">
      <div class="text-5xl mb-4 animate-spin inline-block" aria-hidden="true">⟳</div>
      <p class="text-gray-500 dark:text-gray-400 text-sm">Loading workspace…</p>
    </div>
  </div>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- MAIN APP                                                                -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
{:else}
  <!-- Root: fill viewport, no body scroll -->
  <div class="flex h-screen h-[100dvh] overflow-hidden bg-white dark:bg-gray-950"
       class:dark={$darkMode}>

    <!-- ── Backdrop ──────────────────────────────────────────────────── -->
    {#if showBackdrop}
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="drawer-backdrop" on:click={closeAll} aria-hidden="true"></div>
    {/if}

    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- FILE TREE SIDEBAR                                               -->
    <!-- Desktop: static | Tablet+Mobile: slide-in drawer              -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    {#if isDesktop}
      <!-- Static sidebar on desktop (collapsible) -->
      <aside class="{sidebarCollapsed ? 'w-[40px]' : 'w-[280px]'} flex-shrink-0 border-r
                     border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden
                     bg-gray-50 dark:bg-gray-900 transition-all duration-200">
        {#if sidebarCollapsed}
          <!-- Collapsed: show only toggle button -->
          <div class="flex flex-col items-center pt-2">
            <button
              on:click={toggleDesktopSidebar}
              class="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700
                     text-gray-500 dark:text-gray-400 text-base leading-none"
              style="min-height:44px;min-width:36px"
              title="Expand sidebar"
              aria-label="Expand file tree"
            >☰</button>
          </div>
        {:else}
          <!-- Expanded: full header + tree -->
          <SidebarHeader showClose={false} showCollapse={true}
                         on:refresh={loadTree} on:collapse={toggleDesktopSidebar} />
          <div class="flex-1 overflow-y-auto">
            {#if tree}<FileTree node={tree} depth={0} on:fileSelected={onFileSelected} />{/if}
          </div>
        {/if}
      </aside>

    {:else}
      <!-- Drawer on tablet/mobile -->
      <div class="sidebar-drawer {sidebarOpen ? 'open' : 'closed'} flex flex-col"
           role="dialog" aria-modal="true" aria-label="File browser">
        <SidebarHeader showClose={true}
                       on:refresh={loadTree}
                       on:close={() => sidebarOpen = false} />
        <div class="flex-1 overflow-y-auto pb-20">
          {#if tree}<FileTree node={tree} depth={0} on:fileSelected={onFileSelected} />{/if}
        </div>
      </div>
    {/if}

    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- CENTER COLUMN (toolbar + viewer)                               -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <div class="flex-1 flex flex-col overflow-hidden min-w-0">

      <!-- Toolbar (contains hamburger on mobile/tablet) -->
      <Toolbar
        {breakpoint}
        {sidebarOpen}
        on:toggleSidebar={() => sidebarOpen = !sidebarOpen}
      />

      <!-- Viewer + optional inline annotation panel -->
      <div class="flex-1 flex overflow-hidden relative">

        <!-- ── File viewer ────────────────────────────────────────── -->
        <main class="flex-1 overflow-y-auto min-w-0 overscroll-contain" id="viewer-pane">
          {#if $currentFile}
            {#if $currentFile._fromCache}
              <div class="px-4 py-1.5 bg-amber-50 dark:bg-amber-900/20 border-b
                          border-amber-200 dark:border-amber-700 text-xs text-amber-700 dark:text-amber-300">
                📦 Viewing cached version (offline)
              </div>
            {/if}
            {#if viewerType === 'markdown'}
              <MarkdownViewer {breakpoint} />
            {:else if viewerType === 'code'}
              <CodeViewer {breakpoint} />
            {:else if viewerType === 'image'}
              <ImageViewer />
            {:else if viewerType === 'json'}
              <JsonViewer />
            {:else}
              <FallbackViewer />
            {/if}
          {:else}
            <div class="flex items-center justify-center h-full
                        text-gray-400 dark:text-gray-600 p-8">
              <div class="text-center">
                <div class="text-6xl mb-4 opacity-30" aria-hidden="true">📄</div>
                <p class="text-sm font-medium">Select a file to view</p>
                {#if !isDesktop}
                  <p class="text-xs mt-2 opacity-70">Tap ☰ to open the file browser</p>
                {/if}
              </div>
            </div>
          {/if}
        </main>

        <!-- ── Desktop: inline annotation sidebar (fixed 350px, never overlays) -->
        {#if isDesktop && $annotationPanelOpen}
          <div style="width:350px;flex-shrink:0"
               class="border-l border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden">
            <AnnotationPanel {breakpoint} />
          </div>
        {/if}

        <!-- ── Tablet: right-side overlay panel ───────────────────── -->
        {#if isTablet}
          <div class="overlay-panel {$annotationPanelOpen ? 'open' : 'closed'} flex flex-col"
               role="dialog" aria-modal="true" aria-label="Comments">
            <AnnotationPanel {breakpoint} />
          </div>
        {/if}

      </div><!-- end viewer row -->
    </div><!-- end center column -->

    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- MOBILE: bottom-sheet annotation panel                          -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    {#if isMobile}
      <div class="bottom-sheet {$annotationPanelOpen ? 'open' : 'closed'} flex flex-col"
           role="dialog" aria-modal="true" aria-label="Comments">
        <!-- Drag handle -->
        <div class="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div class="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></div>
        </div>
        <AnnotationPanel {breakpoint} />
      </div>
    {/if}

    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- MOBILE/TABLET: floating action button                          -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    {#if $currentFile && !isDesktop}
      <button
        class="fab"
        on:click={fabTap}
        aria-label="Add comment"
        style="min-height:56px;min-width:56px;width:56px;height:56px"
      >
        ✏️
      </button>
    {/if}

  </div><!-- end root -->
{/if}
