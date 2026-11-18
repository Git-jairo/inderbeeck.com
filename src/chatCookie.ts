// Remembers the opening chat in a small first-party cookie ("chat"):
//  - openedAt: when the chat last opened automatically
//  - page:     the message the visitor was on
//  - done:     whether they finished or skipped it
// The chat opens by itself only when the last time is 10+ minutes ago. Within those
// 10 minutes it only comes back for someone who left halfway, and then it picks up
// where they were.
const NAME = 'chat'
const WINDOW_MS = 10 * 60 * 1000
const KEEP_DAYS = 30

export type ChatCookie = { openedAt: number; page: number; done: boolean }

export function readChat(): ChatCookie | null {
  const raw = document.cookie
    .split('; ')
    .find((part) => part.startsWith(`${NAME}=`))
    ?.slice(NAME.length + 1)
  if (!raw) return null
  try {
    const value = JSON.parse(decodeURIComponent(raw)) as Partial<ChatCookie>
    if (typeof value.openedAt !== 'number') return null
    return {
      openedAt: value.openedAt,
      page: Number(value.page) || 0,
      done: Boolean(value.done),
    }
  } catch {
    return null
  }
}

export function writeChat(value: ChatCookie) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${NAME}=${encodeURIComponent(JSON.stringify(value))}; Max-Age=${
    KEEP_DAYS * 24 * 60 * 60
  }; Path=/; SameSite=Lax${secure}`
}

/** Merge a change into the stored state (creates it if there is none yet). */
export function updateChat(change: Partial<ChatCookie>) {
  writeChat({ openedAt: Date.now(), page: 0, done: false, ...readChat(), ...change })
}

/** Decide on page load whether the chat opens, and at which message. */
export function chatOnLoad(now = Date.now()): {
  open: boolean
  page: number
  fresh: boolean
} {
  const saved = readChat()
  if (!saved || now - saved.openedAt >= WINDOW_MS)
    return { open: true, page: 0, fresh: true }
  if (!saved.done) return { open: true, page: saved.page, fresh: false } // resume
  return { open: false, page: 0, fresh: false }
}
