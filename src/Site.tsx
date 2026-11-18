import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Chat from './Chat'
import { buildScript, greeting } from './chatScript'
import DotField, { SNAKE, type GameState } from './DotField'
import { playChime, playNote, playStartup } from './sound'
import { useSettings } from './useSettings'

type Item = { key: string; label: string }

const work: Item[] = [
  { key: 'product-design', label: 'Product Design' },
  { key: 'ai-enablement', label: 'AI Enablement' },
  { key: 'system-design', label: 'System design' },
]

const passion: Item[] = [
  { key: 'sports', label: 'Sports' },
  // Photography is hidden for now. To bring it back, add
  // { key: 'photography', label: 'Photography' } here (the dot visual still exists).
]

const NAV_NOTE = 4 // every nav link plays this same tone; only the contact links differ

function Label({
  children,
  className = '',
  style,
}: {
  children: string
  className?: string
  style?: CSSProperties
}) {
  return (
    <p className={`text-[8px] leading-3 text-muted ${className}`} style={style}>
      {children}
    </p>
  )
}

const NAV_STEP = 70 // ms between nav elements: 10 elements, the last one starts at 630ms and is in by ~1s

const linkBase =
  'text-right text-base leading-6 text-fg underline-offset-[3px] hover:underline focus-visible:underline focus-visible:outline-none'

function Site() {
  const { theme, reduceMotion, sound, toggleTheme, toggleReduceMotion, toggleSound } =
    useSettings()
  const [hover, setHover] = useState<string | null>(null)
  const [game, setGame] = useState(false)
  const [gameInfo, setGameInfo] = useState<GameState | null>(null)
  const typed = useRef('')

  // Mobile: only a "Menu" button shows in the bottom third. Opening it slides the
  // whole page up by exactly as much as is needed to reveal the three groups, so as
  // much of the dot grid as possible stays in view.
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia('(max-width: 767px)').matches,
  )
  const [menuOpen, setMenuOpen] = useState(false)
  const [shift, setShift] = useState(0)
  const navRef = useRef<HTMLElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const bottomRowRef = useRef<HTMLDivElement>(null)
  const showMenu = isMobile && menuOpen

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const onChange = () => setIsMobile(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const nav = navRef.current
    const panel = panelRef.current
    const row = bottomRowRef.current
    if (!nav || !panel || !row) return
    // how far the content of the bottom third overflows once the groups are shown
    const measure = () =>
      setShift(Math.max(0, panel.scrollHeight + row.offsetHeight - nav.clientHeight))
    const ro = new ResizeObserver(measure)
    ro.observe(nav)
    ro.observe(panel)
    ro.observe(row)
    return () => ro.disconnect()
  }, [])

  // Opening chat: in the empty third I talk to the visitor, one message at a time, and
  // the dot grid shows a visual that supports each message. The navigation and the
  // controls stay hidden until the chat is finished or skipped; then the navigation
  // fades in from top to bottom within a second and the controls follow.
  const [intro, setIntro] = useState(true)
  const [script] = useState(() => buildScript(greeting()))
  const [page, setPage] = useState(0)
  const [tick, setTick] = useState(0)
  const visuals = script[page].visuals
  const introScene = visuals[tick % visuals.length]
  const onPage = (index: number) => {
    setPage(index)
    setTick(0)
  }
  // messages with several visuals let them take turns
  useEffect(() => {
    if (!intro || reduceMotion || visuals.length < 2) return
    const id = window.setInterval(() => setTick((t) => t + 1), 2400)
    return () => window.clearInterval(id)
  }, [intro, reduceMotion, visuals.length])

  // Startup swell, only when the visitor has Sound on (it waits for the first
  // click/key if the browser blocks audio before any interaction).
  const [soundAtLoad] = useState(sound)
  useEffect(() => {
    if (soundAtLoad) playStartup()
  }, [soundAtLoad])

  const fade = (i: number) => ({
    className: `transition-opacity ${reduceMotion ? 'duration-0' : 'duration-300'} ${intro ? 'opacity-0' : 'opacity-100'}`,
    style: { transitionDelay: !intro && !reduceMotion ? `${i * NAV_STEP}ms` : '0ms' },
  })
  const controlsFade = {
    className: `transition-opacity ${reduceMotion ? 'duration-0' : 'duration-1000'} ${intro ? 'opacity-0' : 'opacity-100'}`,
    style: { transitionDelay: !intro && !reduceMotion ? '2000ms' : '0ms' },
  }

  // Easter egg: typing GERBEN starts Snake in the dots. Esc leaves again.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape') {
        setGame(false)
        setGameInfo(null)
        return
      }
      if (e.key.length !== 1) return
      typed.current = (typed.current + e.key.toLowerCase()).slice(-6)
      if (typed.current === 'gerben') {
        typed.current = ''
        setGame(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onGame = (state: GameState) => {
    setGameInfo(state)
    if (!sound) return
    if (state.event === 'eat') playNote(5, 0.04)
    if (state.event === 'gold') playNote(5, 0.07)
    if (state.event === 'die') playNote(0, 0.06)
  }

  // contact links get their own soft chime instead of a nav note
  const ping = {
    onMouseEnter: () => sound && playChime(),
    onFocus: () => sound && playChime(),
  }

  const show = (key: string | null) => {
    setHover(key)
    if (key && sound) playNote(NAV_NOTE)
  }

  // Hit areas are padded instead of spaced: each item is 4px taller above and below
  // (same total spacing as before) and the lists pull back by -4px, so the layout is
  // unchanged but there is no dead space between items. `bridge` also joins the
  // first item to the last item of the group above it, across the label.
  const group = (title: string, items: Item[], bridge = false, start = 0) => (
    <div className="flex flex-col items-end gap-1">
      <Label {...fade(start)}>{title}</Label>
      <ul className="-my-1 flex flex-col items-end">
        {items.map((item, index) => (
          <li key={item.key} {...fade(start + 1 + index)}>
            <button
              type="button"
              onMouseEnter={() => show(item.key)}
              onMouseLeave={() => show(null)}
              onFocus={() => show(item.key)}
              onBlur={() => show(null)}
              className={`${linkBase} relative block cursor-pointer py-1 ${
                bridge && index === 0
                  ? "before:absolute before:inset-x-0 before:-top-6 before:h-6 before:content-['']"
                  : ''
              }`}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )

  const toggle = (label: string, on: boolean, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="cursor-pointer text-left text-[8px] leading-3 text-subtle underline-offset-[3px] hover:text-fg hover:underline focus-visible:text-fg focus-visible:underline focus-visible:outline-none max-md:flex max-md:min-h-11 max-md:min-w-11 max-md:items-center max-md:px-2"
    >
      {label}: {on ? 'on' : 'off'}
    </button>
  )

  // Controls: a strip under the dots on desktop, the bottom-left corner on mobile
  // (where every control gets at least a 44 x 44px hit area).
  const controlsContent = (
    <>
      {toggle('Dark mode', theme === 'dark', toggleTheme)}
      {toggle('Accessibility mode', reduceMotion, toggleReduceMotion)}
      {toggle('Sound', sound, () => {
        toggleSound()
        if (!sound) playNote(4, 0.04) // confirmation blip; this click also unlocks audio
      })}
      {game && gameInfo && (
        <span className="ml-auto flex items-center gap-3 text-[8px] leading-3 text-subtle max-md:min-h-11 max-md:w-full">
          <span>
            {gameInfo.dead
              ? `Game over, ${gameInfo.score} · space to restart`
              : `Snake ${gameInfo.score} · arrows / wasd`}
          </span>
          <button
            type="button"
            onClick={() => {
              setGame(false)
              setGameInfo(null)
            }}
            className="cursor-pointer underline-offset-[3px] hover:text-fg hover:underline focus-visible:text-fg focus-visible:underline focus-visible:outline-none max-md:flex max-md:min-h-11 max-md:min-w-11 max-md:items-center"
          >
            exit (esc)
          </button>
        </span>
      )}
    </>
  )

  return (
    <main
      className={`h-dvh w-full overflow-hidden bg-bg font-mono text-fg ${intro ? 'cursor-pointer' : ''}`}
    >
      <div
        className={`grid h-full w-full grid-rows-[minmax(0,2fr)_minmax(0,1fr)] gap-8 p-2.5 transition-transform ${reduceMotion ? 'duration-0' : 'duration-700'} ease-[cubic-bezier(0.65,0,0.35,1)] md:grid-cols-[2fr_1fr] md:grid-rows-1 md:gap-16 md:p-8 md:transition-none`}
        style={{ transform: showMenu && shift ? `translateY(-${shift}px)` : undefined }}
      >
        <section className="relative col-start-1 row-start-1 min-h-0 min-w-0">
          <DotField
            scene={intro ? introScene : game ? SNAKE : hover}
            animate={!reduceMotion}
            theme={theme}
            onGame={onGame}
          />
          <div
            inert={intro}
            className={`absolute inset-x-0 top-full flex h-7 items-center gap-4 overflow-x-auto whitespace-nowrap max-md:hidden ${controlsFade.className}`}
            style={controlsFade.style}
          >
            {controlsContent}
          </div>
        </section>

        <Chat
          className="col-start-1 row-start-2 md:col-start-2 md:row-start-1"
          pages={script.map((p) => p.text)}
          page={page}
          active={intro}
          reduceMotion={reduceMotion}
          onPage={onPage}
          onFinish={() => setIntro(false)}
        />

        <nav
          ref={navRef}
          inert={intro}
          className="col-start-1 row-start-2 flex min-h-0 flex-col items-end md:col-start-2 md:row-start-1 md:justify-between"
          aria-label="Main"
        >
          <div
            className={`grid w-full transition-[grid-template-rows] ${reduceMotion ? 'duration-0' : 'duration-700'} ease-[cubic-bezier(0.65,0,0.35,1)] md:contents ${showMenu ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
          >
            <div
              ref={panelRef}
              inert={isMobile && !menuOpen}
              className="min-h-0 overflow-hidden md:contents"
            >
              <div className="flex flex-col items-end gap-4 pb-4 md:contents">
                <div className="flex flex-col items-end gap-4">
                  {group('Work', work, false, 0)}
                  {group('Passion projects', passion, true, 4)}
                </div>

                <div className="flex flex-col items-end gap-1">
                  <Label {...fade(6)}>Say hi</Label>
                  <ul className="flex flex-col items-end gap-2">
                    <li
                      className={`text-right text-base leading-6 ${fade(7).className}`}
                      style={fade(7).style}
                    >
                      Jairo in der Beeck
                    </li>
                    <li {...fade(8)}>
                      <a
                        className={linkBase}
                        href="mailto:Jairo@inderbeeck.com"
                        {...ping}
                      >
                        Jairo@inderbeeck.com
                      </a>
                    </li>
                    <li {...fade(9)}>
                      <a className={linkBase} href="tel:+31610487300" {...ping}>
                        +31 6 104 873 00
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div
            ref={bottomRowRef}
            className="mt-auto flex w-full items-end justify-between md:hidden"
          >
            <div
              inert={intro}
              className={`-ml-2 flex flex-wrap items-center whitespace-nowrap ${controlsFade.className}`}
              style={controlsFade.style}
            >
              {controlsContent}
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={showMenu}
              className={`${linkBase} -mr-2 flex min-h-11 min-w-11 cursor-pointer items-center justify-end px-2 ${fade(10).className}`}
              style={fade(10).style}
            >
              {showMenu ? 'Close' : 'Menu'}
            </button>
          </div>
        </nav>
      </div>
    </main>
  )
}

export default Site
