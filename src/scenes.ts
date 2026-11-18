// Each scene paints onto a small offscreen canvas (one pixel per dot).
// The alpha of every pixel decides how far that dot grows (0 = idle, 1 = full).
export type Scene = (ctx: CanvasRenderingContext2D, w: number, h: number) => void

const ink = '#000'

// Product design: form meets function. A square and a circle overlap and the
// overlap is the strongest part.
const productDesign: Scene = (ctx, w, h) => {
  const s = Math.min(w, h)
  const cx = w / 2
  const cy = h / 2
  const r = s * 0.24
  const sq = { x: cx - s * 0.34, y: cy - r, size: r * 2 }
  const circle = { x: cx + s * 0.1, y: cy }

  ctx.fillStyle = ink
  ctx.globalAlpha = 0.3
  ctx.beginPath()
  ctx.roundRect(sq.x, sq.y, sq.size, sq.size, s * 0.02)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(circle.x, circle.y, r, 0, Math.PI * 2)
  ctx.fill()

  ctx.save()
  ctx.beginPath()
  ctx.roundRect(sq.x, sq.y, sq.size, sq.size, s * 0.02)
  ctx.clip()
  ctx.globalAlpha = 0.75
  ctx.beginPath()
  ctx.arc(circle.x, circle.y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  ctx.globalAlpha = 1
}

const aiEnablement: Scene = (ctx, w, h) => {
  const s = Math.min(w, h)
  const cx = w / 2
  const cy = h / 2
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.42)
  g.addColorStop(0, 'rgba(0,0,0,1)')
  g.addColorStop(0.55, 'rgba(0,0,0,0.5)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, s * 0.42, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = ink
  ctx.lineWidth = Math.max(1, s * 0.012)
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath()
    ctx.arc(cx, cy, s * (0.14 + i * 0.1), 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.fillStyle = ink
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2
    ctx.beginPath()
    ctx.arc(
      cx + Math.cos(a) * s * 0.34,
      cy + Math.sin(a) * s * 0.34,
      s * 0.022,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }
}

// System design: building blocks. Different squares and rectangles stacked
// on top of each other, shifting left and right, mixing solid, soft and outline.
const systemDesign: Scene = (ctx, w, h) => {
  const s = Math.min(w, h)
  const cx = w / 2
  const cy = h / 2
  const lw = Math.max(1, s * 0.016)
  ctx.fillStyle = ink
  ctx.strokeStyle = ink
  ctx.lineWidth = lw

  // bottom -> top: width, height, horizontal shift, style
  const blocks: {
    w: number
    h: number
    dx: number
    style: 'soft' | 'solid' | 'outline'
  }[] = [
    { w: 0.52, h: 0.13, dx: 0, style: 'soft' },
    { w: 0.28, h: 0.15, dx: 0.12, style: 'solid' },
    { w: 0.38, h: 0.12, dx: -0.1, style: 'outline' },
    { w: 0.18, h: 0.16, dx: 0.1, style: 'solid' },
  ]
  const gap = 0.018 * s
  const total = blocks.reduce((sum, b) => sum + b.h * s, 0) + gap * (blocks.length - 1)
  let y = cy + total / 2

  for (const b of blocks) {
    const bw = b.w * s
    const bh = b.h * s
    y -= bh
    const x = cx - bw / 2 + b.dx * s
    ctx.beginPath()
    ctx.roundRect(x, y, bw, bh, s * 0.012)
    if (b.style === 'outline') {
      ctx.stroke()
    } else {
      ctx.globalAlpha = b.style === 'soft' ? 0.35 : 1
      ctx.fill()
      ctx.globalAlpha = 1
    }
    y -= gap
  }
}

const sports: Scene = (ctx, w, h) => {
  const s = Math.min(w, h)
  const cx = w / 2
  const cy = h / 2
  ctx.strokeStyle = ink
  ctx.lineWidth = Math.max(1, s * 0.012)
  ctx.beginPath()
  ctx.arc(cx, cy, s * 0.3, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cx - s * 0.3, cy)
  ctx.lineTo(cx + s * 0.3, cy)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx - s * 0.62, cy, s * 0.4, -0.7, 0.7)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx + s * 0.62, cy, s * 0.4, Math.PI - 0.7, Math.PI + 0.7)
  ctx.stroke()
  ctx.fillStyle = ink
  ctx.globalAlpha = 0.5
  ctx.beginPath()
  ctx.arc(cx, cy, s * 0.07, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
}

const photography: Scene = (ctx, w, h) => {
  const s = Math.min(w, h)
  const cx = w / 2
  const cy = h / 2
  ctx.fillStyle = ink
  ctx.beginPath()
  ctx.arc(cx, cy, s * 0.38, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.beginPath()
  ctx.arc(cx, cy, s * 0.26, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalCompositeOperation = 'source-over'
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.2)
  g.addColorStop(0, 'rgba(0,0,0,1)')
  g.addColorStop(1, 'rgba(0,0,0,0.15)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, s * 0.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.beginPath()
  ctx.arc(cx - s * 0.06, cy - s * 0.06, s * 0.035, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalCompositeOperation = 'source-over'
}

// Chat: two speech bubbles in conversation. The solid one is "typing".
const chat: Scene = (ctx, w, h) => {
  const s = Math.min(w, h)
  const cx = w / 2
  const cy = h / 2
  ctx.fillStyle = ink

  const bubble = (x: number, y: number, bw: number, bh: number, tailLeft: boolean) => {
    ctx.beginPath()
    ctx.roundRect(x, y, bw, bh, s * 0.06)
    ctx.fill()
    const tx = tailLeft ? x + bw * 0.14 : x + bw * 0.86
    const dir = tailLeft ? -1 : 1
    ctx.beginPath()
    ctx.moveTo(tx - dir * s * 0.05, y + bh - s * 0.01)
    ctx.lineTo(tx + dir * s * 0.06, y + bh - s * 0.01)
    ctx.lineTo(tx + dir * s * 0.01, y + bh + s * 0.07)
    ctx.closePath()
    ctx.fill()
  }

  ctx.globalAlpha = 0.35
  bubble(cx - 0.4 * s, cy - 0.34 * s, 0.52 * s, 0.24 * s, true)
  ctx.globalAlpha = 1
  bubble(cx - 0.12 * s, cy + 0.0 * s, 0.52 * s, 0.24 * s, false)

  // three "typing" dots punched out of the solid bubble
  ctx.globalCompositeOperation = 'destination-out'
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath()
    ctx.arc(cx + 0.14 * s + i * 0.1 * s, cy + 0.12 * s, s * 0.026, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalCompositeOperation = 'source-over'
}

// Marathons: a running track with one runner.
const track: Scene = (ctx, w, h) => {
  const s = Math.min(w, h)
  const cx = w / 2
  const cy = h / 2
  ctx.strokeStyle = ink
  ctx.fillStyle = ink
  ctx.lineWidth = Math.max(1, s * 0.016)

  const lane = (half: number, halfH: number) => {
    ctx.beginPath()
    ctx.roundRect(cx - half, cy - halfH, half * 2, halfH * 2, halfH)
    ctx.stroke()
  }
  lane(0.42 * s, 0.22 * s)
  lane(0.34 * s, 0.14 * s)
  lane(0.26 * s, 0.06 * s)

  ctx.beginPath()
  ctx.arc(cx + 0.16 * s, cy - 0.14 * s, s * 0.036, 0, Math.PI * 2)
  ctx.fill()
}

// ---------- Hover visuals (PNGs in public/visuals) ----------
// White shapes on a transparent background: the transparency is what the dots read,
// so more opaque = bigger dot. The strongest tone of each image is stretched to a
// fully grown dot, so the PNGs don't have to be drawn at full opacity.
const IMAGE_SCALE = 1 // 1 = the image is as tall as the dot grid; lower = smaller
const IMAGE_DENSITY = 0.7 // below 1 = denser: lighter tones grow bigger dots (1 = as drawn)

const imageScene = (file: string): Scene => {
  const img = new Image()
  img.src = encodeURI(`/visuals/${file}`) // preload now, so it is ready on first hover
  return (ctx, w, h) => {
    if (!img.complete || !img.naturalWidth) return
    const box = Math.min(w, h) * IMAGE_SCALE
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, (w - box) / 2, (h - box) / 2, box, box)
    const data = ctx.getImageData(0, 0, w, h)
    let max = 0
    for (let i = 3; i < data.data.length; i += 4) max = Math.max(max, data.data[i])
    if (!max) return
    const gain = 255 / max
    for (let i = 3; i < data.data.length; i += 4)
      data.data[i] =
        255 * Math.pow(Math.min(1, (data.data[i] * gain) / 255), IMAGE_DENSITY)
    ctx.putImageData(data, 0, 0)
  }
}

export const scenes: Record<string, Scene> = {
  // drawn scenes (used by the opening chat)
  'product-design': productDesign,
  'ai-enablement': aiEnablement,
  'system-design': systemDesign,
  sports,
  photography,
  chat,
  track,
  // PNG visuals shown when hovering a menu item
  'hover:product-design': imageScene('Product Design.png'),
  'hover:ai-enablement': imageScene('Ai Enablement.png'),
  'hover:system-design': imageScene('System Design.png'),
  'hover:sports': imageScene('Sports.png'),
  'hover:mail': imageScene('Mail.png'),
  'hover:phone': imageScene('Phone.png'),
}
