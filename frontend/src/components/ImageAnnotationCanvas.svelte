<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'

  export let imgWidth = 0
  export let imgHeight = 0
  export let zoom = 1
  export let activeTool = null   // 'arrow' | 'rect' | 'pen' | 'pin' | null
  export let color = '#ef4444'
  export let opacity = 0.8
  export let shapes = []         // array of shape objects
  export let pins = []           // array of pin objects

  const dispatch = createEventDispatcher()

  let canvas
  let ctx
  let drawing = false
  let startX = 0, startY = 0
  let currentPoints = []
  let previewShape = null

  $: canvasW = imgWidth
  $: canvasH = imgHeight

  $: if (canvas && canvasW && canvasH) {
    canvas.width = canvasW
    canvas.height = canvasH
    redraw()
  }

  $: if (ctx) redraw(shapes, pins, previewShape, color, opacity)

  onMount(() => {
    if (canvas) {
      ctx = canvas.getContext('2d')
    }
  })

  function getPos(e) {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvasW / rect.width
    const scaleY = canvasH / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  function onMouseDown(e) {
    if (!activeTool) return
    e.preventDefault()
    e.stopPropagation()
    const pos = getPos(e)

    if (activeTool === 'pin') {
      dispatch('addpin', { x: pos.x / canvasW, y: pos.y / canvasH })
      return
    }

    drawing = true
    startX = pos.x
    startY = pos.y
    currentPoints = [pos]
  }

  function onMouseMove(e) {
    if (!drawing || !activeTool) return
    e.preventDefault()
    const pos = getPos(e)

    if (activeTool === 'pen') {
      currentPoints = [...currentPoints, pos]
      previewShape = { type: 'pen', points: currentPoints, color, opacity }
    } else if (activeTool === 'arrow') {
      previewShape = { type: 'arrow', x1: startX, y1: startY, x2: pos.x, y2: pos.y, color, opacity }
    } else if (activeTool === 'rect') {
      previewShape = { type: 'rect', x1: startX, y1: startY, x2: pos.x, y2: pos.y, color, opacity }
    }
    redraw()
  }

  function onMouseUp(e) {
    if (!drawing || !activeTool) return
    drawing = false
    const pos = getPos(e)

    let shape = null
    if (activeTool === 'pen' && currentPoints.length > 1) {
      shape = { type: 'pen', points: currentPoints.map(p => ({ x: p.x / canvasW, y: p.y / canvasH })), color, opacity }
    } else if (activeTool === 'arrow') {
      const dx = pos.x - startX, dy = pos.y - startY
      if (Math.sqrt(dx*dx + dy*dy) > 5) {
        shape = { type: 'arrow', x1: startX/canvasW, y1: startY/canvasH, x2: pos.x/canvasW, y2: pos.y/canvasH, color, opacity }
      }
    } else if (activeTool === 'rect') {
      const dx = pos.x - startX, dy = pos.y - startY
      if (Math.abs(dx) > 3 && Math.abs(dy) > 3) {
        shape = { type: 'rect', x1: startX/canvasW, y1: startY/canvasH, x2: pos.x/canvasW, y2: pos.y/canvasH, color, opacity }
      }
    }

    previewShape = null
    if (shape) dispatch('addshape', shape)
    currentPoints = []
    redraw()
  }

  function redraw() {
    if (!ctx || !canvasW || !canvasH) return
    ctx.clearRect(0, 0, canvasW, canvasH)

    // Draw saved shapes
    for (const s of shapes) {
      drawShape(s, true)
    }

    // Draw preview
    if (previewShape) {
      drawShape(previewShape, false)
    }

    // Draw pins
    for (let i = 0; i < pins.length; i++) {
      drawPin(pins[i], i + 1)
    }
  }

  function drawShape(s, normalized) {
    ctx.save()
    ctx.globalAlpha = s.opacity || 0.8
    ctx.strokeStyle = s.color || '#ef4444'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (s.type === 'pen') {
      ctx.beginPath()
      const pts = s.points
      if (pts.length < 2) { ctx.restore(); return }
      const p0 = normalized ? { x: pts[0].x * canvasW, y: pts[0].y * canvasH } : pts[0]
      ctx.moveTo(p0.x, p0.y)
      for (let i = 1; i < pts.length; i++) {
        const p = normalized ? { x: pts[i].x * canvasW, y: pts[i].y * canvasH } : pts[i]
        ctx.lineTo(p.x, p.y)
      }
      ctx.stroke()
    } else if (s.type === 'rect') {
      const x1 = normalized ? s.x1 * canvasW : s.x1
      const y1 = normalized ? s.y1 * canvasH : s.y1
      const x2 = normalized ? s.x2 * canvasW : s.x2
      const y2 = normalized ? s.y2 * canvasH : s.y2
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)
    } else if (s.type === 'arrow') {
      const x1 = normalized ? s.x1 * canvasW : s.x1
      const y1 = normalized ? s.y1 * canvasH : s.y1
      const x2 = normalized ? s.x2 * canvasW : s.x2
      const y2 = normalized ? s.y2 * canvasH : s.y2
      drawArrow(x1, y1, x2, y2)
    }
    ctx.restore()
  }

  function drawArrow(x1, y1, x2, y2) {
    const headLen = 15
    const angle = Math.atan2(y2 - y1, x2 - x1)
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    // Arrowhead
    ctx.beginPath()
    ctx.moveTo(x2, y2)
    ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI/6), y2 - headLen * Math.sin(angle - Math.PI/6))
    ctx.moveTo(x2, y2)
    ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI/6), y2 - headLen * Math.sin(angle + Math.PI/6))
    ctx.stroke()
  }

  function drawPin(pin, num) {
    const x = pin.x * canvasW
    const y = pin.y * canvasH
    const r = 14
    ctx.save()
    ctx.globalAlpha = 0.9
    // Circle
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = pin.color || '#ef4444'
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.stroke()
    // Number
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 12px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(num), x, y)
    ctx.restore()
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<canvas
  bind:this={canvas}
  class="absolute inset-0 w-full h-full"
  style="cursor: {activeTool ? 'crosshair' : 'default'}; pointer-events: {activeTool ? 'auto' : 'none'}; touch-action: none;"
  on:mousedown={onMouseDown}
  on:mousemove={onMouseMove}
  on:mouseup={onMouseUp}
  on:mouseleave={() => { if (drawing) { drawing = false; previewShape = null; currentPoints = []; redraw() } }}
></canvas>
