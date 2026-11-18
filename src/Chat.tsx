import { useCallback, useEffect, useState } from 'react'
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

// Same type as the main titles / nav links.
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
    const delay =
      chars === 0 ? 700 : 22 + Math.random() * 40 + (/[,.!?]/.test(previous) ? 170 : 0)
    const id = window.setTimeout(() => {
      setChars((c) => c + 1)
      if (sound) playTick()
    }, delay)
    return () => window.clearTimeout(id)
  }, [active, typing, chars, text, sound])

  const go = useCallback(
    (index: number) => {
      setChars(0)
      onPage(Math.max(0, Math.min(pages.length - 1, index)))
    },
    [onPage, pages.length],
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

  const visible = active && ready

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
      <p className="text-[8px] leading-3 text-muted">Jairo{typing ? ' · typing' : ''}</p>

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
