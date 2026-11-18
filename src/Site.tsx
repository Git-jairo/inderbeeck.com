import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import Chat from './Chat'
import { chatOnLoad, updateChat, writeChat } from './chatCookie'
import { buildScript, greeting } from './chatScript'
import DotField, { SNAKE, type GameState } from './DotField'
import { playChime, playNote, playStartup } from './sound'
import { HOME_TITLE, PAGES, pageFromPath } from './pages'
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

  // The menu has three forms:
  //  - desktop home: the right-hand column, always visible
  //  - mobile home:  only a "Menu" button in the bottom third; opening it slides the page
  //                  up by just enough to reveal the groups (the empty third is used first)
  //  - sub pages:    a drawer behind a "Menu" button in the bottom-right corner; opening it
  //                  pushes the whole page up by the height of the menu
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia('(max-width: 767px)').matches,
  )
  const [menuOpen, setMenuOpen] = useState(false)
  const [shift, setShift] = useState(0)
  const navRef = useRef<HTMLElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const bottomRowRef = useRef<HTMLDivElement>(null)
  const drawerRef = useRef(false) // read by the measuring below

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
    // how far the page has to move up for the opened menu to fit: in the drawer that is
    // the whole menu; on the mobile home page only what doesn't fit in the bottom third
    const measure = () => {
      const room = drawerRef.current ? row.offsetHeight : nav.clientHeight
      setShift(Math.max(0, panel.scrollHeight + row.offsetHeight - room))
    }
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
  // Sub pages: every menu item opens its own page at its own address. Landing directly
  // on one skips the opening chat.
  const [route, setRoute] = useState<string | null>(
    () => pageFromPath(window.location.pathname)?.key ?? null,
  )
  // keep the last page's content during its fade-out
  const [shownPage, setShownPage] = useState(route)
  if (route && route !== shownPage) setShownPage(route)
  const subPage = PAGES.find((p) => p.key === shownPage) ?? null

  const drawerMenu = route !== null
  const compact = drawerMenu || isMobile // the menu hides behind a "Menu" button
  const showMenu = compact && menuOpen
  useLayoutEffect(() => {
    drawerRef.current = drawerMenu
  }, [drawerMenu])

  const navigate = (key: string | null) => {
    const path = key ? `/${key}` : '/'
    if (window.location.pathname !== path) window.history.pushState(null, '', path)
    setRoute(key)
    setMenuOpen(false)
  }
  useEffect(() => {
    const onPop = () => setRoute(pageFromPath(window.location.pathname)?.key ?? null)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  useEffect(() => {
    const current = PAGES.find((p) => p.key === route)
    document.title = current ? `${current.title} · Jairo in der Beeck` : HOME_TITLE
  }, [route])

  // The chat opens by itself at most once every 10 minutes, or to pick up where a
  // visitor left off (see chatCookie.ts). Landing directly on a sub page skips it.
  const [chatStart] = useState(() =>
    pageFromPath(window.location.pathname) === null
      ? chatOnLoad()
      : { open: false, page: 0, fresh: false },
  )
  const [intro, setIntro] = useState(chatStart.open)
  const [chatRun, setChatRun] = useState(0) // bumped to restart the chat from scratch
  const [script] = useState(() => buildScript(greeting()))
  const [page, setPage] = useState(() => Math.min(chatStart.page, script.length - 1))
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

  // Keep the chat cookie up to date: when it opened, where the visitor is, and whether
  // they finished it.
  const chatShown = useRef(false)
  useEffect(() => {
    if (chatStart.fresh) writeChat({ openedAt: Date.now(), page: 0, done: false })
  }, [chatStart])
  useEffect(() => {
    if (!intro) return
    chatShown.current = true
    updateChat({ page, done: false })
  }, [intro, page])
  useEffect(() => {
    if (!intro && chatShown.current) updateChat({ done: true })
  }, [intro])

  // Clicking my name restarts the chat from the first message.
  const restartChat = () => {
    writeChat({ openedAt: Date.now(), page: 0, done: false })
    chatShown.current = true
    setPage(0)
    setTick(0)
    setChatRun((run) => run + 1)
    setGame(false)
    setGameInfo(null)
    setHover(null)
    navigate(null)
    setIntro(true)
  }

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

  useEffect(() => {
    if (!route || game || intro) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (menuOpen) {
        setMenuOpen(false)
        return
      }
      setRoute(null)
      if (window.location.pathname !== '/') window.history.pushState(null, '', '/')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [route, game, intro, menuOpen])

  const onGame = (state: GameState) => {
    setGameInfo(state)
    if (!sound) return
    if (state.event === 'eat') playNote(5, 0.04)
    if (state.event === 'gold') playNote(5, 0.07)
    if (state.event === 'die') playNote(0, 0.06)
  }

  // Contact links get their own soft chime instead of a nav note, plus their visual.
  const ping = (key: 'mail' | 'phone') => {
    const enter = () => {
      setHover(`hover:${key}`)
      if (sound) playChime()
    }
    const leave = () => setHover(null)
    return { onMouseEnter: enter, onFocus: enter, onMouseLeave: leave, onBlur: leave }
  }

  // Hovering a menu item shows its PNG visual in the dots (public/visuals).
  const show = (key: string | null) => {
    setHover(key ? `hover:${key}` : null)
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
            <a
              href={`/${item.key}`}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
                  return
                e.preventDefault()
                navigate(item.key)
              }}
              onMouseEnter={() => show(item.key)}
              onMouseLeave={() => show(null)}
              onFocus={() => show(item.key)}
              onBlur={() => show(null)}
              aria-current={route === item.key ? 'page' : undefined}
              className={`${linkBase} relative block cursor-pointer py-1 ${
                route === item.key ? 'underline' : ''
              } ${
                bridge && index === 0
                  ? "before:absolute before:inset-x-0 before:-top-6 before:h-6 before:content-['']"
                  : ''
              }`}
            >
              {item.label}
            </a>
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

  // Sub page geometry (matches the grid: padding 0.625rem / 2rem, gaps 2rem / 4rem).
  // Content: next to (desktop) or below (mobile) the third of dots that remains, down to
  // the Menu button. Drawer: starts at the Menu button row, so the menu unfolds below it
  // and the page slides up by exactly the menu's height.
  const contentBox: CSSProperties = isMobile
    ? {
        top: 'calc(0.625rem + (100% - 3.25rem) / 3 + 1.5rem)',
        right: '0.125rem', // page padding minus the 0.5rem pr-2 (room for the Back button)
        bottom: '4.25rem',
        left: '0.625rem',
      }
    : {
        top: '2rem',
        right: '1.5rem', // page padding minus the 0.5rem pr-2 (room for the Back button)
        bottom: '5.5rem',
        left: 'calc(4rem + (100% - 8rem) / 3)',
      }
  const drawerBox: CSSProperties = isMobile
    ? { top: 'calc(100% - 0.625rem - 2.75rem)', right: '0.125rem', left: '0.625rem' }
    : { top: 'calc(100% - 2rem - 2.75rem)', right: '1.5rem' }

  return (
    <main
      className={`h-dvh w-full overflow-hidden bg-bg font-mono text-fg ${intro ? 'cursor-pointer' : ''}`}
    >
      <div
        className={`grid h-full w-full grid-rows-[minmax(0,2fr)_minmax(0,1fr)] gap-8 p-2.5 transition-transform ${reduceMotion ? 'duration-0' : 'duration-700'} ease-[cubic-bezier(0.65,0,0.35,1)] md:grid-cols-[2fr_1fr] md:grid-rows-1 md:gap-16 md:p-8 relative`}
        style={{ transform: showMenu && shift ? `translateY(-${shift}px)` : undefined }}
      >
        <section className="relative col-start-1 row-start-1 min-h-0 min-w-0">
          <DotField
            scene={
              // sub pages leave the remaining dots empty: just the idle wave
              intro ? introScene : game ? SNAKE : route ? null : hover
            }
            animate={!reduceMotion}
            theme={theme}
            onGame={onGame}
            reveal={route && !game && !intro ? 0.5 : 1}
            revealAxis={isMobile ? 'y' : 'x'}
          />

          <div
            inert={intro}
            className={`absolute inset-x-0 top-full flex h-7 items-center gap-4 overflow-x-auto whitespace-nowrap max-md:hidden ${controlsFade.className}`}
            style={controlsFade.style}
          >
            {controlsContent}
          </div>
        </section>

        {/* Sub page content: the 2/3 of the screen the dots give up (right of the dots on
          desktop, below them on mobile), down to the Menu button. Fades in once most
          of the dots have gone. */}
        <article
          inert={!route}
          aria-hidden={!route}
          className={`absolute flex flex-col overflow-x-hidden overflow-y-auto pr-2 transition-opacity ${
            route
              ? `opacity-100 ${reduceMotion ? 'duration-0' : 'delay-[1500ms] duration-700'}`
              : 'pointer-events-none opacity-0 duration-200'
          }`}
          style={contentBox}
        >
          {subPage && (
            <>
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <Label>{subPage.group}</Label>
                  <h1 className="text-base leading-6 text-fg">{subPage.title}</h1>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(null)}
                  className={`${linkBase} -mt-2.5 -mr-2 flex min-h-11 min-w-11 cursor-pointer items-center justify-end px-2`}
                >
                  Back
                </button>
              </div>
              <div className="mt-6 flex max-w-prose flex-col gap-4 text-base leading-6 text-fg">
                {subPage.body.map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            </>
          )}
        </article>

        <Chat
          key={chatRun}
          className="col-start-1 row-start-2 md:col-start-2 md:row-start-1"
          pages={script.map((p) => p.text)}
          page={page}
          active={intro}
          reduceMotion={reduceMotion}
          sound={sound}
          onPage={onPage}
          onFinish={() => setIntro(false)}
        />

        <nav
          ref={navRef}
          inert={intro}
          className={`flex flex-col items-end ${
            drawerMenu
              ? 'absolute pr-2'
              : isMobile
                ? 'col-start-1 row-start-2 min-h-0'
                : 'col-start-2 row-start-1 min-h-0 justify-between'
          }`}
          style={drawerMenu ? drawerBox : undefined}
          aria-label="Main"
        >
          <div
            className={
              compact
                ? `grid w-full transition-[grid-template-rows] ${reduceMotion ? 'duration-0' : 'duration-700'} ease-[cubic-bezier(0.65,0,0.35,1)] ${showMenu ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`
                : 'contents'
            }
          >
            <div
              ref={panelRef}
              inert={compact && !menuOpen}
              className={compact ? 'min-h-0 overflow-hidden' : 'contents'}
            >
              <div
                className={compact ? 'flex flex-col items-end gap-4 pb-4' : 'contents'}
              >
                <div className="flex flex-col items-end gap-4">
                  {group('Work', work, false, 0)}
                  {group('Passion projects', passion, true, 4)}
                </div>

                <div className="flex flex-col items-end gap-1">
                  <Label {...fade(6)}>Say hi</Label>
                  <ul className="flex flex-col items-end gap-2">
                    <li {...fade(7)}>
                      <button
                        type="button"
                        onClick={restartChat}
                        title="Start the introduction again"
                        className={`${linkBase} cursor-pointer`}
                      >
                        Jairo in der Beeck
                      </button>
                    </li>
                    <li {...fade(8)}>
                      <a
                        className={linkBase}
                        href="mailto:Jairo@inderbeeck.com"
                        {...ping('mail')}
                      >
                        Jairo@inderbeeck.com
                      </a>
                    </li>
                    <li {...fade(9)}>
                      <a className={linkBase} href="tel:+31610487300" {...ping('phone')}>
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
            className={
              compact ? 'mt-auto flex w-full items-end justify-between' : 'hidden'
            }
          >
            {isMobile && (
              <div
                inert={intro}
                className={`-ml-2 flex flex-wrap items-center whitespace-nowrap ${controlsFade.className}`}
                style={controlsFade.style}
              >
                {controlsContent}
              </div>
            )}
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={showMenu}
              className={`${linkBase} -mr-2 ml-auto flex min-h-11 min-w-11 cursor-pointer items-center justify-end px-2 ${fade(10).className}`}
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
