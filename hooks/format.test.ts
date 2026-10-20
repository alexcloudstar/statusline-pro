import { expect, test } from 'claude-code/testing'

import { formatEta, formatGit, gauge, prettyModel, shortDir } from './format'
import { summaryLine } from './segments'

test('prettyModel names the family, version and window', () => {
  expect(prettyModel('claude-opus-5-5[1m]')).toBe('Opus 5.5 (1M)')
  expect(prettyModel('claude-opus-4-20250514')).toBe('Opus 4')
  expect(prettyModel('something-else')).toBe('something-else')
})

test('gauge fills in proportion and stays inside its width', () => {
  expect(gauge(50, 10)).toEqual({ filled: '▰▰▰▰▰', empty: '▱▱▱▱▱' })
  expect(gauge(150, 4).filled).toBe('▰▰▰▰')
  expect(gauge(-5, 4).filled).toBe('')
})

test('formatEta counts down in days and hours, or hours and minutes', () => {
  const now = Date.parse('2026-10-20T00:00:00Z')
  expect(formatEta('2026-10-20T02:41:00Z', now)).toBe('2h41m')
  expect(formatEta('2026-10-23T02:00:00Z', now)).toBe('3d2h')
  expect(formatEta('2026-10-19T00:00:00Z', now)).toBe('now')
  expect(formatEta(undefined, now)).toBe('')
})

test('formatGit marks dirty, unpushed and missing upstream', () => {
  expect(formatGit({ branch: 'main', isDirty: true, unpushedCount: 2, hasUpstream: true })).toBe('⎇ main* ↑2')
  expect(formatGit({ branch: 'feat', isDirty: false, unpushedCount: 0, hasUpstream: false })).toBe(
    '⎇ feat (no upstream)',
  )
})

test('summaryLine joins the figures on one line', () => {
  const figures = { dir: '~/app', git: null, model: 'claude-opus-5-5', effort: 'high', ctxPct: 40 }
  const text = summaryLine(figures, 0)
    .map(part => part.text)
    .join('')
  expect(text).toBe('Opus 5.5 · high · ctx ▰▰▱▱▱ 40% · 5h - · ~/app')
})

test('summaryLine shows 7d and cost only once they matter', () => {
  const now = Date.parse('2026-10-20T00:00:00Z')
  const base = { dir: null, git: null, model: null, effort: null }
  const render = (extra: object) =>
    summaryLine({ ...base, ...extra }, now)
      .map(part => part.text)
      .join('')

  expect(render({ week: { pct: 20 }, costUsd: 0.5 })).not.toContain('7d')
  expect(render({ week: { pct: 20 }, costUsd: 0.5 })).not.toContain('$')
  expect(render({ week: { pct: 70, resetsAt: '2026-10-22T00:00:00Z' } })).toContain('7d')
  expect(render({ week: { pct: 70, resetsAt: '2026-10-19T00:00:00Z' } })).not.toContain('7d')
  expect(render({ costUsd: 2.5 })).toContain('$2.50')
})

test('shortDir keeps the last segments of a long path', () => {
  expect(shortDir('~/dev/app')).toBe('~/dev/app')
  expect(shortDir('~/Desktop/clients/acme/projects/web/app', 20)).toBe('…/projects/web/app')
})
