import { useCallback, useState } from 'react'

export type Theme = 'light' | 'dark'

const KEY = 'portfolio-settings'

type Saved = { theme?: Theme; reduceMotion?: boolean; sound?: boolean }

function load(): Saved {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Saved
  } catch {
    return {}
  }
}

function save(patch: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...load(), ...patch }))
  } catch {
    /* storage unavailable: settings just won't persist */
  }
}

export function useSettings() {
  const [theme, setTheme] = useState<Theme>(
    () =>
      (document.documentElement.dataset.theme as Theme | undefined) ??
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  )
  // "Accessibility mode": no animation. Defaults to the OS reduced-motion setting.
  const [reduceMotion, setReduceMotion] = useState<boolean>(
    () => load().reduceMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [sound, setSound] = useState<boolean>(() => load().sound ?? false)

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    // Set synchronously so the canvas can read the new colors right away.
    document.documentElement.dataset.theme = next
    setTheme(next)
    save({ theme: next })
  }, [theme])

  const toggleReduceMotion = useCallback(() => {
    setReduceMotion(!reduceMotion)
    save({ reduceMotion: !reduceMotion })
  }, [reduceMotion])

  const toggleSound = useCallback(() => {
    setSound(!sound)
    save({ sound: !sound })
  }, [sound])

  return { theme, reduceMotion, sound, toggleTheme, toggleReduceMotion, toggleSound }
}
