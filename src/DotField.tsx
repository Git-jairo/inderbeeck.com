import { useEffect, useRef } from 'react'
import { scenes } from './scenes'

// Grid scale: 1 = the original dense grid, 2 = half as many dots per axis.
// Try it live with ?grid=2 in the URL. The default is 1.5 on desktop and 1 (denser,
// so a phone still gets plenty of dots across) on narrow screens.
const GRID = (() => {
  const v = parseFloat(new URLSearchParams(window.location.search).get('grid') ?? '')
  if (v >= 0.5 && v <= 4) return v
  return window.innerWidth < 768 ? 1 : 1.5
})()

const PITCH = 8 * GRID // px between dot centres
const BASE_R = 0.6 * GRID // radius of a dot at rest inside a picture
const MAX_R = PITCH * 0.36 // fully grown dot
const CAP_R = PITCH * 0.44 // hard cap so spring overshoot never merges dots
const WAVE_MIN = 0.4 * GRID // idle wave: smallest dot
const WAVE_RANGE = 2.0 * GRID // idle wave: how much dots swell on a crest
const ACTIVE_MIX = 0.7 // while a picture shows, 30% of the idle wave stays alive behind it
// Subtle contrast boost while a picture shows: dots that belong to the picture move
// 10% toward the text colour (brighter in dark mode, darker in light mode) and the
// dots around it 10% toward the background. Only the contrast changes, not the hue,
// and it fades in with the picture, so the colour change itself is never noticed.
const COLOR_SHIFT = 0.1
const SHADE_STEPS = 10 // shades each side of neutral, so the shift is quantized into 21 steps

// Sub pages: the dot field shrinks to part of its area (1/3 of the page instead of
// 2/3). The dots don't slide; they dissolve, grainy and noisy, from the far edge toward
// the new boundary, and grow back the same way in reverse.
const REVEAL_SWEEP = 3000 // ms the whole sweep takes, last dot included
// A single dot fades quickly in the middle of the sweep and slowly at its start and
// end, so the first dots drift away and the last few linger before they go.
const REVEAL_FADE_FAST = 260 // ms, dots in the middle of the sweep
const REVEAL_FADE_SLOW = 800 // ms, the first and last dots
const REVEAL_SOFT = 0.09 // while sweeping, pictures fade with springs this much softer (~1s)

// The share of dots that has gone follows an ease-in-out curve over the sweep (cubic):
// a slow start, a faster middle, and a slow finish where the last few dots go one by
// one. This is its inverse: the moment (0..1) at which a given share is reached.
const sweepMoment = (share: number) =>
  share < 0.5 ? Math.pow(share / 4, 1 / 3) : 1 - Math.pow((1 - share) / 4, 1 / 3)

const STATIC_T = 7 // frozen moment of the wave when animation is off
const LEAVE_DELAY = 180 // ms before a picture dissolves back to the wave, so quick re-hovers never flash

// Spring feel: stiff and almost critically damped = snappy, soft landing, no delay.
// Every dot gets its own stiffness/damping so the motion never looks mechanical.
const STIFF_MIN = 220
const STIFF_RANGE = 140
const ZETA_MIN = 0.8
const ZETA_RANGE = 0.2

// Snake
const FRUITS = 5 // fruits on the board at all times
const GOLD_CHANCE = 0.02 // per move: chance the gold fruit appears (when none is on the board)
const GOLD_LIFE = 45 // moves the gold fruit stays before it vanishes
const GOLD_GROWTH = 5 // the snake grows by one on each of this many moves after eating gold
const GOLD_SCORE = 5

/** Scene key that switches the field into the Snake easter egg. */
export const SNAKE = 'snake'

export type GameState = {
  score: number
  dead: boolean
  event?: 'start' | 'eat' | 'gold' | 'die'
}

type Props = {
  /** Key of the picture to draw, or null for the idle wave. */
  scene: string | null
  /** false = accessibility mode: frozen wave, instant changes. */
  animate: boolean
  /** Only used to re-read the CSS colors when it changes. */
  theme: string
  /** Pixels at the bottom that are covered by UI; the game stays above them. */
  insetBottom?: number
  onGame?: (state: GameState) => void
  /** Part of the field that shows dots: 1 = all, 0.5 = the first half. */
  reveal?: number
  /** 'x' keeps the left part (desktop), 'y' keeps the top part (mobile). */
  revealAxis?: 'x' | 'y'
}

type Api = {
  setScene: (key: string | null) => void
  setAnimate: (animate: boolean) => void
  recolor: () => void
  setReveal: (fraction: number, axis: 'x' | 'y') => void
}

type Pt = { x: number; y: number }

const hash = (i: number) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

// Abstract wave: three domain-warped sines, so it never looks like a plain ripple.
function wave(x: number, y: number, t: number) {
  const a = Math.sin(x * 0.07 + t * 0.55 + Math.sin(y * 0.045 - t * 0.35) * 1.8)
  const b = Math.sin(y * 0.06 - t * 0.45 + Math.sin(x * 0.035 + t * 0.28) * 2.2)
  const d = Math.sin((x * 0.5 + y * 0.8) * 0.045 + t * 0.3)
  const v = (a + b + d) / 6 + 0.5
  return v * v * (3 - 2 * v)
}

// '#rgb' / '#rrggbb' -> [r, g, b], or null when the value isn't a hex colour
function parseHex(value: string): number[] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value)
  if (!m) return null
  const h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1]
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}

const KEY_DIRS: Record<string, Pt> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
}

export default function DotField({
  scene,
  animate,
  theme,
  insetBottom = 0,
  onGame,
  reveal = 1,
  revealAxis = 'x',
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const apiRef = useRef<Api | null>(null)
  const initial = useRef({ scene, animate, reveal, revealAxis })
  const insetRef = useRef(insetBottom)
  const onGameRef = useRef(onGame)
  useEffect(() => {
    insetRef.current = insetBottom
    onGameRef.current = onGame
  })

  useEffect(() => {
    const wrap = wrapRef.current!
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!

    let current: string | null = null // the scene effect below enters the first scene with a transition
    let animating = initial.current.animate
    let cols = 0
    let rows = 0
    // Per dot: m = how much the picture replaces the wave, p = picture value.
    // Both follow their targets (tM/tP) through a spring. Changing a target
    // mid-flight just retargets the spring, so any transition can be
    // interrupted by any other and still moves continuously.
    let m = new Float32Array(0)
    let mv = new Float32Array(0)
    let p = new Float32Array(0)
    let pv = new Float32Array(0)
    let tM = new Float32Array(0)
    let tP = new Float32Array(0)
    let k = new Float32Array(0)
    let c = new Float32Array(0)
    let goldMask = new Uint8Array(0) // dots drawn in gold
    // Visibility per dot (0..1) for the shrinking/growing field: each dot fades from
    // visFrom to visTo over visDur ms, starting at visStart.
    let revealPart = initial.current.reveal
    let softUntil = 0 // pictures fade softly (not instantly) while the field sweeps
    let revealAxisNow = initial.current.revealAxis
    let visFrom = new Float32Array(0)
    let visTo = new Float32Array(0)
    let visStart = new Float64Array(0)
    let visDur = new Float32Array(0)
    const goldDots: number[] = []
    let raf = 0
    let leaveTimer = 0
    let last = 0
    let t0 = performance.now()
    let dotColor = '#999'
    let goldColor = '#b99c58'
    // shades[SHADE_STEPS] = the neutral dot colour; lower = toward the background,
    // higher = toward the text colour
    const shades: string[] = Array.from({ length: SHADE_STEPS * 2 + 1 }, () => '#999')
    const shadeDots: number[][] = Array.from({ length: SHADE_STEPS * 2 + 1 }, () => [])

    // ---------- Snake (easter egg) ----------
    // The board is a grid where one cell = 2x2 dots.
    const game = {
      gw: 0,
      gh: 0,
      offX: 0,
      offY: 0,
      snake: [] as Pt[],
      dir: { x: 1, y: 0 } as Pt,
      queue: [] as Pt[],
      foods: [] as Pt[],
      gold: null as Pt | null,
      goldLife: 0,
      growLeft: 0,
      score: 0,
      dead: false,
      acc: 0,
    }
    let gameRunning = false

    const emit = (event?: GameState['event']) =>
      onGameRef.current?.({ score: game.score, dead: game.dead, event })

    const freeCell = () => {
      const taken = new Set<number>()
      const mark = (pt: Pt) => taken.add(pt.y * game.gw + pt.x)
      game.snake.forEach(mark)
      game.foods.forEach(mark)
      if (game.gold) mark(game.gold)
      const free: number[] = []
      for (let i = 0; i < game.gw * game.gh; i++) if (!taken.has(i)) free.push(i)
      if (!free.length) return null
      const pick = free[Math.floor(Math.random() * free.length)]
      return { x: pick % game.gw, y: Math.floor(pick / game.gw) }
    }

    // always keep FRUITS fruits on the board
    const topUpFoods = () => {
      while (game.foods.length < FRUITS) {
        const cell = freeCell()
        if (!cell) break
        game.foods.push(cell)
      }
    }

    const initGame = () => {
      const insetRows = Math.ceil(insetRef.current / PITCH)
      game.gw = Math.max(4, Math.floor((cols - 2) / 2))
      game.gh = Math.max(4, Math.floor((rows - insetRows - 2) / 2))
      game.offX = 1 + ((cols - 2 - game.gw * 2) >> 1)
      game.offY = 1 + ((rows - insetRows - 2 - game.gh * 2) >> 1)
      const hx = game.gw >> 1
      const hy = game.gh >> 1
      game.snake = [
        { x: hx, y: hy },
        { x: hx - 1, y: hy },
        { x: hx - 2, y: hy },
      ]
      game.dir = { x: 1, y: 0 }
      game.queue = []
      game.foods = []
      game.gold = null
      game.goldLife = 0
      game.growLeft = 0
      game.score = 0
      game.dead = false
      game.acc = 0
      topUpFoods()
    }

    // gentle pulse; each fruit has its own phase
    const fruitValue = (now: number, phase: number) =>
      game.dead ? 0 : 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(now / 160 + phase))

    const gamePic = (now: number) => {
      const pic = new Float32Array(cols * rows)
      goldMask.fill(0)
      const cell = (pt: Pt, v: number, gold = false) => {
        for (let j = 0; j < 2; j++)
          for (let i = 0; i < 2; i++) {
            const x = game.offX + pt.x * 2 + i
            const y = game.offY + pt.y * 2 + j
            if (x < 0 || x >= cols || y < 0 || y >= rows) continue
            pic[y * cols + x] = v
            if (gold) goldMask[y * cols + x] = 1
          }
      }
      // faint border one dot outside the playfield
      const set = (x: number, y: number) => {
        if (x >= 0 && x < cols && y >= 0 && y < rows) pic[y * cols + x] = 0.3
      }
      const x0 = game.offX - 1
      const x1 = game.offX + game.gw * 2
      const y0 = game.offY - 1
      const y1 = game.offY + game.gh * 2
      for (let x = x0; x <= x1; x++) {
        set(x, y0)
        set(x, y1)
      }
      for (let y = y0; y <= y1; y++) {
        set(x0, y)
        set(x1, y)
      }
      const len = game.snake.length
      game.snake.forEach((s, idx) => {
        cell(s, game.dead ? 0.35 : idx === 0 ? 1.05 : 0.85 - 0.4 * (idx / len))
      })
      game.foods.forEach((f, idx) => cell(f, fruitValue(now, idx * 1.3)))
      if (game.gold) cell(game.gold, fruitValue(now, 0.7), true)
      return pic
    }

    const writeGame = (now: number) => {
      const pic = gamePic(now)
      for (let i = 0; i < pic.length; i++) {
        tP[i] = pic[i]
        tM[i] = ACTIVE_MIX
      }
    }

    // keep the fruits breathing between moves
    const pulseFood = (now: number) => {
      const setCell = (pt: Pt, v: number) => {
        for (let j = 0; j < 2; j++)
          for (let i = 0; i < 2; i++)
            tP[(game.offY + pt.y * 2 + j) * cols + game.offX + pt.x * 2 + i] = v
      }
      game.foods.forEach((f, idx) => setCell(f, fruitValue(now, idx * 1.3)))
      if (game.gold) setCell(game.gold, fruitValue(now, 0.7))
    }

    const advance = () => {
      if (game.queue.length) game.dir = game.queue.shift()!
      const head = game.snake[0]
      const nx = head.x + game.dir.x
      const ny = head.y + game.dir.y
      const foodIdx = game.foods.findIndex((f) => f.x === nx && f.y === ny)
      const eatGold = game.gold !== null && game.gold.x === nx && game.gold.y === ny
      // The tail stays put (= the snake grows) after a fruit and during gold growth.
      const keepTail = foodIdx >= 0 || game.growLeft > 0
      const body = keepTail ? game.snake : game.snake.slice(0, -1)
      if (
        nx < 0 ||
        ny < 0 ||
        nx >= game.gw ||
        ny >= game.gh ||
        body.some((s) => s.x === nx && s.y === ny)
      ) {
        game.dead = true
        emit('die')
        return
      }
      game.snake.unshift({ x: nx, y: ny })
      if (!keepTail) game.snake.pop()
      if (game.growLeft > 0) game.growLeft--

      let event: GameState['event']
      if (foodIdx >= 0) {
        game.score++
        game.foods.splice(foodIdx, 1)
        event = 'eat'
      }
      if (eatGold) {
        game.score += GOLD_SCORE
        game.gold = null
        game.growLeft += GOLD_GROWTH // one extra segment on each of the next moves
        event = 'gold'
      }
      topUpFoods()

      // The gold fruit shows up now and then, and wanders off if ignored.
      if (game.gold && --game.goldLife <= 0) game.gold = null
      if (!game.gold && Math.random() < GOLD_CHANCE) {
        const cell = freeCell()
        if (cell) {
          game.gold = cell
          game.goldLife = GOLD_LIFE
        }
      }
      if (game.snake.length >= game.gw * game.gh) game.dead = true // board full
      if (game.dead) emit('die')
      else if (event) emit(event)
    }

    const gameTick = (now: number, dt: number) => {
      if (game.dead) return
      game.acc += dt * 1000
      const interval = Math.max(80, 150 - game.score * 1.5)
      let moved = false
      while (game.acc >= interval && !game.dead) {
        game.acc -= interval
        advance()
        moved = true
      }
      if (moved) writeGame(now)
      else pulseFood(now)
    }

    const startGame = () => {
      gameRunning = true
      emit('start')
      if (!animating) start()
    }

    const stopGame = () => {
      gameRunning = false
      if (!animating) cancelAnimationFrame(raf)
    }

    const onKey = (e: KeyboardEvent) => {
      if (current !== SNAKE) return
      if (game.dead && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault()
        initGame()
        writeGame(performance.now())
        emit('start')
        return
      }
      const dir = KEY_DIRS[e.key] ?? KEY_DIRS[e.key.toLowerCase()]
      if (!dir || e.metaKey || e.ctrlKey || e.altKey) return
      e.preventDefault()
      if (!gameRunning || game.dead) return
      const prev = game.queue.length ? game.queue[game.queue.length - 1] : game.dir
      if (
        (dir.x === -prev.x && dir.y === -prev.y) ||
        (dir.x === prev.x && dir.y === prev.y)
      )
        return
      if (game.queue.length < 2) game.queue.push(dir)
    }

    // swipe to steer on touch screens
    let swipe: Pt | null = null
    const onDown = (e: PointerEvent) => {
      swipe = { x: e.clientX, y: e.clientY }
    }
    const onUp = (e: PointerEvent) => {
      if (!swipe || current !== SNAKE) return
      const dx = e.clientX - swipe.x
      const dy = e.clientY - swipe.y
      swipe = null
      if (game.dead && Math.hypot(dx, dy) < 20) {
        initGame()
        writeGame(performance.now())
        emit('start')
        return
      }
      if (Math.hypot(dx, dy) < 24) return
      const key =
        Math.abs(dx) > Math.abs(dy)
          ? dx > 0
            ? 'ArrowRight'
            : 'ArrowLeft'
          : dy > 0
            ? 'ArrowDown'
            : 'ArrowUp'
      onKey(new KeyboardEvent('keydown', { key }))
    }

    // ---------- field ----------
    const recolor = () => {
      const css = getComputedStyle(document.documentElement)
      dotColor = css.getPropertyValue('--dot').trim() || dotColor
      goldColor = css.getPropertyValue('--gold').trim() || goldColor
      const base = parseHex(dotColor)
      const fg = parseHex(css.getPropertyValue('--fg').trim())
      const bg = parseHex(css.getPropertyValue('--bg').trim())
      for (let i = 0; i < shades.length; i++) {
        const shift = ((i - SHADE_STEPS) / SHADE_STEPS) * COLOR_SHIFT
        const target = shift >= 0 ? fg : bg
        shades[i] =
          base && target
            ? `rgb(${[0, 1, 2].map((c) => Math.round(base[c] + (target[c] - base[c]) * Math.abs(shift))).join(',')})`
            : dotColor
      }
      if (!animating) render(STATIC_T)
    }

    // how many columns (axis x) or rows (axis y) still show dots
    const visibleCount = () =>
      Math.round((revealAxisNow === 'x' ? cols : rows) * revealPart)
    const isInside = (i: number, count: number) =>
      revealAxisNow === 'x' ? i % cols < count : Math.floor(i / cols) < count

    const visAt = (i: number, now: number) => {
      const t = (now - visStart[i]) / visDur[i]
      if (t <= 0) return visFrom[i]
      if (t >= 1) return visTo[i]
      return visFrom[i] + (visTo[i] - visFrom[i]) * t * t * (3 - 2 * t)
    }

    const setReveal = (fraction: number, axis: 'x' | 'y') => {
      if (fraction === revealPart && axis === revealAxisNow) return
      const now = performance.now()
      const oldCount =
        axis === revealAxisNow ? visibleCount() : axis === 'x' ? cols : rows
      revealPart = fraction
      revealAxisNow = axis
      const count = visibleCount()
      const moving: { i: number; key: number }[] = []
      for (let i = 0; i < m.length; i++) {
        const target = isInside(i, count) ? 1 : 0
        if (target === visTo[i]) continue
        visFrom[i] = visAt(i, now)
        visTo[i] = target
        if (!animating) {
          visStart[i] = -Infinity
          continue
        }
        const col = i % cols
        const row = Math.floor(i / cols)
        const pos = axis === 'x' ? col : row
        const across = axis === 'x' ? row : col
        // 0 = goes first, 1 = goes last: hiding starts at the far edge and works back
        // toward the new boundary; showing starts at the boundary and works outward
        const order =
          target === 0
            ? (oldCount - 1 - pos) / Math.max(1, oldCount - count)
            : (pos - oldCount) / Math.max(1, count - oldCount)
        // an organic, wobbly edge plus per-dot grain
        const wobble =
          (Math.sin(across * 0.21 + 1.3) + Math.sin(across * 0.07 + pos * 0.05)) * 0.06
        const grain = (hash(i * 7 + 3) - 0.5) * 0.3
        moving.push({ i, key: order + wobble + grain })
      }
      // Ranked in that order, the dots are spread over the sweep along the S-curve.
      moving.sort((a, b) => a.key - b.key)
      moving.forEach(({ i }, rank) => {
        const share = moving.length > 1 ? rank / (moving.length - 1) : 1
        const when = sweepMoment(share)
        const edge = 1 - Math.sin(Math.PI * share) // 1 for the first and last dots
        visDur[i] = REVEAL_FADE_FAST + (REVEAL_FADE_SLOW - REVEAL_FADE_FAST) * edge
        visStart[i] = now + when * (REVEAL_SWEEP - REVEAL_FADE_SLOW)
      })
      if (animating) softUntil = now + REVEAL_SWEEP
      // pictures re-fit themselves to the part that is still visible
      if (current && current !== SNAKE) {
        const pic = sample(current)
        for (let i = 0; i < m.length; i++) tP[i] = pic[i]
      }
      if (!animating) snap()
    }

    const sample = (key: string) => {
      const off = document.createElement('canvas')
      off.width = cols
      off.height = rows
      const o = off.getContext('2d', { willReadFrequently: true })!
      // scenes are drawn into the visible part only, so they stay centred in it
      const count = visibleCount()
      scenes[key]?.(
        o,
        revealAxisNow === 'x' ? count : cols,
        revealAxisNow === 'y' ? count : rows,
      )
      const data = o.getImageData(0, 0, cols, rows).data
      const out = new Float32Array(cols * rows)
      for (let i = 0; i < out.length; i++) out[i] = data[i * 4 + 3] / 255
      return out
    }

    const alloc = () => {
      const n = cols * rows
      m = new Float32Array(n)
      mv = new Float32Array(n)
      p = new Float32Array(n)
      pv = new Float32Array(n)
      tM = new Float32Array(n)
      tP = new Float32Array(n)
      goldMask = new Uint8Array(n)
      visFrom = new Float32Array(n)
      visTo = new Float32Array(n)
      visStart = new Float64Array(n).fill(-Infinity)
      visDur = new Float32Array(n).fill(REVEAL_FADE_FAST)
      const count = visibleCount()
      for (let i = 0; i < n; i++) visFrom[i] = visTo[i] = isInside(i, count) ? 1 : 0
      k = new Float32Array(n)
      c = new Float32Array(n)
      for (let i = 0; i < n; i++) {
        const stiff = STIFF_MIN + hash(i + 999) * STIFF_RANGE
        const zeta = ZETA_MIN + hash(i + 4242) * ZETA_RANGE
        k[i] = stiff
        c[i] = 2 * Math.sqrt(stiff) * zeta
      }
      let pic: Float32Array | null = null
      if (current === SNAKE) {
        initGame()
        pic = gamePic(performance.now())
      } else if (current) {
        pic = sample(current)
      }
      for (let i = 0; i < n; i++) {
        tM[i] = m[i] = current ? ACTIVE_MIX : 0
        tP[i] = p[i] = pic ? pic[i] : 0
      }
    }

    const render = (t: number) => {
      const dpr = window.devicePixelRatio || 1
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, wrap.clientWidth, wrap.clientHeight)
      // The dots fill the panel exactly: the spacing stretches a hair so the free
      // space is spread over all dots, giving the same padding on every side.
      const cellW = wrap.clientWidth / cols
      const cellH = wrap.clientHeight / rows
      goldDots.length = 0
      for (const list of shadeDots) list.length = 0
      const now = performance.now()
      for (let r = 0; r < rows; r++) {
        for (let col = 0; col < cols; col++) {
          const i = r * cols + col
          const rw = WAVE_MIN + WAVE_RANGE * wave(col * GRID, r * GRID, t)
          const rp = BASE_R + (MAX_R - BASE_R) * p[i]
          const vis = visAt(i, now)
          if (vis <= 0.01) continue
          let rad = Math.min(CAP_R, Math.max(0.3, rw + (rp - rw) * m[i]))
          // fading dots simply shrink (the grain is in the timing, not in flicker)
          if (vis < 0.999) rad *= vis
          const x = (col + 0.5) * cellW
          const y = (r + 0.5) * cellH
          if (goldMask[i]) {
            goldDots.push(x, y, rad)
            continue
          }
          // 0 = background dot, 1 = picture dot; scaled by how far the picture is "in"
          const inPicture = Math.min(1, Math.max(0, p[i]))
          const mode = Math.min(1, Math.max(0, m[i] / ACTIVE_MIX))
          const shade = SHADE_STEPS + Math.round(mode * (inPicture * 2 - 1) * SHADE_STEPS)
          shadeDots[shade].push(x, y, rad)
        }
      }
      shadeDots.forEach((list, shade) => {
        if (!list.length) return
        ctx.fillStyle = shades[shade]
        ctx.beginPath()
        for (let j = 0; j < list.length; j += 3) {
          ctx.moveTo(list[j] + list[j + 2], list[j + 1])
          ctx.arc(list[j], list[j + 1], list[j + 2], 0, Math.PI * 2)
        }
        ctx.fill()
      })
      if (goldDots.length) {
        ctx.fillStyle = goldColor
        ctx.beginPath()
        for (let j = 0; j < goldDots.length; j += 3) {
          ctx.moveTo(goldDots[j] + goldDots[j + 2], goldDots[j + 1])
          ctx.arc(goldDots[j], goldDots[j + 1], goldDots[j + 2], 0, Math.PI * 2)
        }
        ctx.fill()
      }
    }

    // Returns true once (nearly) every dot has arrived.
    const step = (dt: number) => {
      const sub = 4 // sub-steps keep the stiff springs stable and smooth
      const h = dt / sub
      // during a sweep, shapes fade away (or in) over about a second instead of snapping
      const soft = performance.now() < softUntil ? REVEAL_SOFT : 1
      const softDamp = Math.sqrt(soft)
      let pending = 0
      for (let i = 0; i < m.length; i++) {
        const kk = k[i] * soft
        const cc = c[i] * softDamp
        for (let s = 0; s < sub; s++) {
          mv[i] += (kk * (tM[i] - m[i]) - cc * mv[i]) * h
          m[i] += mv[i] * h
          pv[i] += (kk * (tP[i] - p[i]) - cc * pv[i]) * h
          p[i] += pv[i] * h
        }
        if (
          Math.abs(tM[i] - m[i]) > 0.06 ||
          Math.abs(tP[i] - p[i]) > 0.06 ||
          Math.abs(mv[i]) > 0.1 ||
          Math.abs(pv[i]) > 0.1
        )
          pending++
      }
      return pending <= m.length * 0.01
    }

    const snap = () => {
      for (let i = 0; i < m.length; i++) {
        m[i] = tM[i]
        p[i] = tP[i]
        mv[i] = pv[i] = 0
      }
      render(STATIC_T)
    }

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (gameRunning) gameTick(now, dt)
      if (animating) {
        const settled = step(dt)
        render((now - t0) / 1000)
        // the game starts once the board has finished drawing itself in
        if (settled && current === SNAKE && !gameRunning) startGame()
      } else {
        snap() // accessibility mode: targets apply instantly
      }
      raf = requestAnimationFrame(frame)
    }

    function start() {
      cancelAnimationFrame(raf)
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }

    // Switch scene right now, whatever is still moving.
    const applyScene = (key: string | null) => {
      if (key === current) return
      if (gameRunning && key !== SNAKE) stopGame()
      if (current === SNAKE) goldMask.fill(0)
      const entering = key !== null
      let pic: Float32Array | null = null
      if (key === SNAKE) {
        initGame()
        pic = gamePic(performance.now())
      } else if (key) {
        pic = sample(key)
      }
      for (let i = 0; i < m.length; i++) {
        // Dots that are (nearly) invisible start the new picture from nothing, so
        // no remnants of the previous picture show; dots that are still visible
        // simply morph from where they are.
        if (entering && m[i] < 0.08) {
          p[i] = 0
          pv[i] = 0
        }
        tM[i] = entering ? ACTIVE_MIX : 0
        if (pic) tP[i] = pic[i]
      }
      current = key
      if (!animating) {
        snap()
        if (key === SNAKE) startGame()
      }
    }

    // Going back to the idle wave waits a moment. Coming back (or moving to
    // another item) inside that window cancels it, so the picture just carries on.
    const setScene = (key: string | null) => {
      window.clearTimeout(leaveTimer)
      const delayed = key === null && current !== null && current !== SNAKE && animating
      if (delayed) leaveTimer = window.setTimeout(() => applyScene(null), LEAVE_DELAY)
      else applyScene(key)
    }

    const setAnimate = (a: boolean) => {
      if (a === animating) return
      animating = a
      if (a) {
        t0 = performance.now() - STATIC_T * 1000 // continue from the frozen frame
        start()
      } else {
        cancelAnimationFrame(raf)
        snap()
        if (gameRunning) start()
      }
    }

    const resize = () => {
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      // The dot count is always even on both axes (never fewer than 8), so the Snake
      // board of 2x2-dot cells plus its 1-dot border fits exactly. It grows two dots
      // at a time as the panel gets bigger; the spacing then stretches slightly so the
      // dots always fill the whole panel with equal padding left and right.
      const even = (n: number) => Math.max(8, 2 * Math.round(n / 2))
      cols = even(w / PITCH)
      rows = even(h / PITCH)
      alloc()
      if (!animating) render(STATIC_T)
    }

    apiRef.current = { setScene, setAnimate, recolor, setReveal }
    recolor()
    resize()
    if (animating) start()

    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    window.addEventListener('keydown', onKey)
    wrap.addEventListener('pointerdown', onDown)
    wrap.addEventListener('pointerup', onUp)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(leaveTimer)
      ro.disconnect()
      window.removeEventListener('keydown', onKey)
      wrap.removeEventListener('pointerdown', onDown)
      wrap.removeEventListener('pointerup', onUp)
      apiRef.current = null
    }
  }, [])

  useEffect(() => apiRef.current?.setAnimate(animate), [animate])
  useEffect(() => apiRef.current?.setScene(scene), [scene])
  useEffect(() => apiRef.current?.recolor(), [theme])
  useEffect(() => apiRef.current?.setReveal(reveal, revealAxis), [reveal, revealAxis])

  return (
    <div ref={wrapRef} className="relative h-full w-full touch-none" aria-hidden="true">
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  )
}
