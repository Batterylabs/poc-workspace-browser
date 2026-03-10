<script>
  import { createEventDispatcher } from 'svelte'

  export let activeTool = null   // 'arrow' | 'rect' | 'pen' | 'pin' | null
  export let color = '#ef4444'
  export let opacity = 0.8
  export let canUndo = false
  export let canClear = false

  const dispatch = createEventDispatcher()

  const tools = [
    { id: 'arrow', icon: '➜', title: 'Arrow tool' },
    { id: 'rect',  icon: '▭', title: 'Rectangle tool' },
    { id: 'pen',   icon: '✏', title: 'Freehand pen' },
    { id: 'pin',   icon: '📌', title: 'Place numbered pin' },
  ]

  function selectTool(id) {
    dispatch('selectTool', id === activeTool ? null : id)
  }

  function handleColorInput(e) {
    dispatch('colorChange', e.target.value)
  }

  function handleOpacityInput(e) {
    dispatch('opacityChange', parseFloat(e.target.value))
  }
</script>

<div class="flex items-center gap-1 flex-wrap">
  <!-- Drawing tools -->
  {#each tools as tool (tool.id)}
    <button
      on:click={() => selectTool(tool.id)}
      class="text-sm rounded-lg border transition-colors flex items-center justify-center
             {activeTool === tool.id
               ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
               : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}"
      style="min-height:36px;min-width:36px"
      title={tool.title}
      aria-label={tool.title}
      aria-pressed={activeTool === tool.id}
    >{tool.icon}</button>
  {/each}

  <!-- Divider -->
  <div class="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>

  <!-- Color picker -->
  <label class="relative cursor-pointer" title="Drawing color">
    <div class="w-7 h-7 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
         style="background-color: {color}"></div>
    <input
      type="color"
      value={color}
      on:input={handleColorInput}
      class="absolute inset-0 opacity-0 cursor-pointer"
      style="width:28px;height:28px"
    />
  </label>

  <!-- Opacity slider -->
  <div class="flex items-center gap-1 ml-1">
    <span class="text-xs text-gray-400 dark:text-gray-500 select-none" title="Opacity">α</span>
    <input
      type="range"
      min="0.1"
      max="1"
      step="0.05"
      value={opacity}
      on:input={handleOpacityInput}
      class="w-16 h-1 accent-blue-600"
      title="Opacity: {Math.round(opacity * 100)}%"
    />
    <span class="text-xs text-gray-400 dark:text-gray-500 w-8 tabular-nums select-none">
      {Math.round(opacity * 100)}%
    </span>
  </div>

  <!-- Divider -->
  <div class="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>

  <!-- Undo -->
  <button
    on:click={() => dispatch('undo')}
    disabled={!canUndo}
    class="text-sm rounded-lg border border-gray-200 dark:border-gray-700
           hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed
           text-gray-600 dark:text-gray-400 transition-colors"
    style="min-height:36px;min-width:36px"
    title="Undo last drawing"
    aria-label="Undo"
  >↩</button>

  <!-- Clear all -->
  <button
    on:click={() => dispatch('clear')}
    disabled={!canClear}
    class="text-sm rounded-lg border border-gray-200 dark:border-gray-700
           hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400
           disabled:opacity-30 disabled:cursor-not-allowed
           text-gray-600 dark:text-gray-400 transition-colors"
    style="min-height:36px;min-width:36px"
    title="Clear all drawings"
    aria-label="Clear all"
  >🗑</button>
</div>
