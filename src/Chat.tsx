import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { playTick } from './sound'

type Props = {
  pages: string[]
  page: number
  /** false once the chat is finished or skipped: it fades out and stops taking input. */
  active: boolean
  reduceMotion: boolean
  /** Soft keyboard ticks while a message is being typed. */
  sound?: boolean
  className?: string
  onPage: (index: number) => void
  onFinish: () => void
}

// TEST: keep the earlier messages on screen. Each new message types at the bottom
// while the previous ones dim to 20% and slide up, so by the end the whole monologue
// is visible. Set to false to go back to one message at a time.
const KEEP_HISTORY = true
const HISTORY_OPACITY = 'opacity-20'
const HISTORY_GAP = 'gap-4'
const HISTORY_SLIDE_MS = 700 // earlier messages glide up this long before the next one starts typing
const LINE_PX = 24 // line height of the message text (leading-6)

// Same type as the main titles / nav links.
// Not every letter ticks, and never faster than this, so the typing stays calm.
const TICK_CHANCE = 0.5
const TICK_MIN_GAP = 85 // ms

const textBtn =
  'cursor-pointer text-base leading-6 text-fg underline-offset-[3px] hover:underline focus-visible:underline focus-visible:outline-none disabled:cursor-default disabled:no-underline disabled:opacity-30 max-md:flex max-md:min-h-11 max-md:min-w-11 max-md:items-center'

export default function Chat({
  pages,
  page,
  active,
  reduceMotion,
  sound = false,
  className = '',
  onPage,
  onFinish,
}: Props) {
  const text = pages[page]
  const last = page === pages.length - 1
  const [chars, setChars] = useState(0) // letters of the current message typed so far
  const [ready, setReady] = useState(false) // for the first fade-in
  const lastTick = useRef(0)
  const shown = reduceMotion ? text.length : Math.min(chars, text.length)
  const typing = shown < text.length

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Typed like a person: a short "thinking" pause, then an irregular rhythm with
  // longer pauses after punctuation.
  useEffect(() => {
    if (!active || !typing) return
    const previous = text[chars - 1] ?? ''
    // history mode: first let the earlier messages glide up, then start typing
    const firstDelay =
      KEEP_HISTORY && !reduceMotion && page > 0 ? HISTORY_SLIDE_MS + 350 : 700
    const delay =
      chars === 0
        ? firstDelay
        : 22 + Math.random() * 40 + (/[,.!?]/.test(previous) ? 170 : 0)
    const id = window.setTimeout(() => {
      setChars((c) => c + 1)
      if (
        sound &&
        Math.random() < TICK_CHANCE &&
        performance.now() - lastTick.current > TICK_MIN_GAP
      ) {
        lastTick.current = performance.now()
        playTick()
      }
    }, delay)
    return () => window.clearTimeout(id)
  }, [active, typing, chars, text, sound, page, reduceMotion])

  const go = useCallback(
    (index: number) => {
      const target = Math.max(0, Math.min(pages.length - 1, index))
      // history mode: going back shows the message already complete
      setChars(KEEP_HISTORY && target < page ? pages[target].length : 0)
      onPage(target)
    },
    [onPage, pages, page],
  )

  // Next first completes a message that is still being typed, then moves on.
  const next = useCallback(() => {
    if (typing) setChars(text.length)
    else if (last) onFinish()
    else go(page + 1)
  }, [typing, text.length, last, onFinish, go, page])

  const previous = useCallback(() => go(page - 1), [go, page])

  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft' && page > 0) previous()
      else if (e.key === 'Escape') onFinish()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, next, previous, onFinish, page])

  // The whole screen is a "next" button: a click or tap anywhere that isn't a button
  // or link (those keep their own job: Previous, the dots, Skip) moves the chat on.
  useEffect(() => {
    if (!active) return
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest('button, a')) return
      next()
    }
    window.addEventListener('click', onClick)
    return () => window.removeEventListener('click', onClick)
  }, [active, next])

  // History mode, part 1: the message being typed always sits at the bottom and is only
  // as tall as the lines typed so far, so every new line pushes the whole stack up.
  const scrollRef = useRef<HTMLDivElement>(null)
  const messageEls = useRef<(HTMLDivElement | null)[]>([])
  const bodyEls = useRef<(HTMLDivElement | null)[]>([])
  const endRef = useRef<HTMLSpanElement | null>(null)
  const lastTops = useRef<number[]>([])
  const settledPage = useRef(-1)

  const measureTops = () =>
    messageEls.current
      .slice(0, page + 1)
      .map((el) => (el ? el.getBoundingClientRect().top : 0))

  useLayoutEffect(() => {
    if (!KEEP_HISTORY) return
    bodyEls.current.forEach((el, i) => {
      if (el && i !== page) el.style.height = '' // finished messages show in full
    })
    const body = bodyEls.current[page]
    const end = endRef.current
    if (!body || !end) return
    const lines = Math.max(1, Math.floor(end.offsetTop / LINE_PX) + 1)
    const height = `${lines * LINE_PX}px`
    if (body.style.height !== height) {
      body.style.height = height
      const scroller = scrollRef.current
      if (scroller) scroller.scrollTop = scroller.scrollHeight
    }
    // stay in sync with where the messages are while typing within one message
    if (settledPage.current === page) lastTops.current = measureTops()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, shown])

  // History mode, part 2: when the message changes, the earlier ones glide from where
  // they were to where they are now (up for the next message, down when going back).
  useLayoutEffect(() => {
    if (!KEEP_HISTORY) return
    const scroller = scrollRef.current
    if (!scroller) return
    scroller.scrollTop = scroller.scrollHeight
    const els = messageEls.current.slice(0, page + 1)
    els.forEach((el) => {
      if (!el) return
      el.style.transition = 'opacity 700ms' // keep the dimming animated, drop any slide
      el.style.transform = ''
    })
    const tops = measureTops()
    if (!reduceMotion) {
      els.forEach((el, i) => {
        const before = lastTops.current[i]
        if (!el || before === undefined) return
        el.style.transform = `translateY(${before - tops[i]}px)`
        void el.offsetHeight // commit the start position, then glide to the new one
        el.style.transition = `transform ${HISTORY_SLIDE_MS}ms cubic-bezier(0.65, 0, 0.35, 1), opacity ${HISTORY_SLIDE_MS}ms`
        el.style.transform = ''
      })
    }
    lastTops.current = tops
    settledPage.current = page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, reduceMotion])

  const visible = active && ready

  const historyView = (
    <div
      ref={scrollRef}
      className="mt-1 flex min-h-0 flex-1 flex-col overflow-y-auto [scrollbar-width:none]"
    >
      <div className={`mt-auto flex flex-col ${HISTORY_GAP}`}>
        {pages.slice(0, page + 1).map((message, i) => {
          const current = i === page
          return (
            <div
              key={i}
              ref={(el) => {
                messageEls.current[i] = el
              }}
              className={`relative text-base leading-6 text-fg ${
                current ? 'opacity-100' : HISTORY_OPACITY
              } ${i > 0 && !reduceMotion ? 'chat-msg-in' : ''}`}
            >
              <p aria-hidden="true" className="mb-1 text-[8px] leading-3 text-muted">
                Jairo{current && typing ? ' · typing' : ''}
              </p>
              {current && <p className="sr-only">{message}</p>}
              <div
                aria-hidden="true"
                ref={(el) => {
                  bodyEls.current[i] = el
                }}
                className="relative overflow-hidden"
              >
                {current ? (
                  <p>
                    {message.slice(0, shown)}
                    <span ref={endRef} />
                    {typing && shown > 0 && (
                      // zero-width, so the cursor never changes how the text wraps
                      <span className="relative inline-block w-0">
                        <span className="absolute top-[3px] left-px h-[1.05em] w-[0.55ch] bg-fg/70" />
                      </span>
                    )}
                    {/* the rest is laid out invisibly: words never re-wrap while typing,
                        but the box only grows when a new line is actually reached */}
                    <span className="invisible">{message.slice(shown)}</span>
                  </p>
                ) : (
                  <p>{message}</p>
                )}
                {current && typing && shown === 0 && (
                  <span className="absolute top-0 left-0 flex h-6 items-center gap-1">
                    {[0, 1, 2].map((d) => (
                      <span
                        key={d}
                        className="typing-dot size-1.5 rounded-full bg-fg"
                        style={{ animationDelay: `${d * 160}ms` }}
                      />
                    ))}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  const singleView = (
    <div className="mt-1 min-h-0 flex-1 overflow-y-auto">
      <p className="sr-only">{text}</p>
      <div aria-hidden="true" className="relative text-base leading-6 text-fg">
        {/* the full text is laid out invisibly so words never re-wrap while typing */}
        <p className="invisible">{text}</p>
        <p className="absolute inset-0">
          {text.slice(0, shown)}
          {typing && shown > 0 && (
            <span className="ml-px inline-block h-[1.05em] w-[0.55ch] translate-y-[3px] bg-fg/70" />
          )}
        </p>
        {typing && shown === 0 && (
          <span className="absolute top-0 left-0 flex h-6 items-center gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="typing-dot size-1.5 rounded-full bg-fg"
                style={{ animationDelay: `${i * 160}ms` }}
              />
            ))}
          </span>
        )}
      </div>
    </div>
  )

  return (
    <aside
      aria-label="Introduction"
      inert={!active}
      className={`flex min-h-0 flex-col transition-opacity ${
        visible
          ? 'opacity-100 duration-700 delay-300'
          : 'pointer-events-none opacity-0 duration-300'
      } ${className}`}
    >
      {!KEEP_HISTORY && (
        <p className="text-[8px] leading-3 text-muted">
          Jairo{typing ? ' · typing' : ''}
        </p>
      )}

      {KEEP_HISTORY ? historyView : singleView}

      <div className="mt-4 flex flex-col gap-1 md:gap-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            className={textBtn}
            onClick={previous}
            disabled={page === 0}
          >
            Previous
          </button>
          <button type="button" className={textBtn} onClick={next}>
            {last && !typing ? 'Enter' : 'Next'}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div className="-ml-1.5 flex items-center max-md:-ml-3.5">
            {pages.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={`Message ${i + 1} of ${pages.length}`}
                aria-current={i === page ? 'step' : undefined}
                className="group flex cursor-pointer items-center justify-center p-1.5 max-md:size-11"
              >
                <span
                  className={`block size-1.5 rounded-full transition-colors ${
                    i === page ? 'bg-fg' : 'bg-subtle/50 group-hover:bg-subtle'
                  }`}
                />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onFinish}
            className="cursor-pointer text-[12px] leading-4 text-subtle underline-offset-[3px] hover:text-fg hover:underline focus-visible:text-fg focus-visible:underline focus-visible:outline-none max-md:flex max-md:min-h-11 max-md:min-w-11 max-md:items-center max-md:justify-end"
          >
            Skip
          </button>
        </div>
      </div>
    </aside>
  )
}
