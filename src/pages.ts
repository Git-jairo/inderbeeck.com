// The sub pages, one per menu item. Each has its own address (/product-design, ...).
// The dot visual on the left is the same PNG as the menu hover (public/visuals).
//
// NOTE: the body text is placeholder copy, to be replaced with the real content.
export type SubPage = {
  key: string
  title: string
  group: string
  body: string[]
}

export const PAGES: SubPage[] = [
  {
    key: 'product-design',
    title: 'Product Design',
    group: 'Work',
    body: [
      'Placeholder. This page will show selected product design work: the problem, the approach and the outcome.',
    ],
  },
  {
    key: 'ai-enablement',
    title: 'AI Enablement',
    group: 'Work',
    body: [
      'Placeholder. This page will show how I help teams put AI to work in a way that is meaningful, accessible and genuinely helpful.',
    ],
  },
  {
    key: 'system-design',
    title: 'System design',
    group: 'Work',
    body: [
      'Placeholder. This page will show design systems and the building blocks behind them.',
    ],
  },
  {
    key: 'sports',
    title: 'Sports',
    group: 'Passion projects',
    body: [
      'Placeholder. This page will be about training people at the studio in Amsterdam, and about running marathons and ultras.',
    ],
  },
]

export const HOME_TITLE = 'Hi, Welcome to my Creative Space'

export function pageFromPath(path: string) {
  const clean = path.replace(/\/+$/, '') || '/'
  return PAGES.find((p) => `/${p.key}` === clean) ?? null
}
