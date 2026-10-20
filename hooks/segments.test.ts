import { expect, test } from 'claude-code/testing'

import { parseExtra, pickExtraFiles } from './extras'
import { orderedIds, summaryLine } from './segments'
import { DEFAULT_SETTINGS, parseSettings } from './settings'
import type { Settings } from './settings'

const NOW = Date.parse('2026-10-20T00:00:00Z')
const BASE = { dir: '~/app', git: null, model: 'claude-opus-5-5', effort: 'high' }

const render = (figures: object, settings: Settings = DEFAULT_SETTINGS) =>
  summaryLine({ ...BASE, ...figures }, NOW, settings)
    .map(part => part.text)
    .join('')

test('parseSettings reads modes, numbers and lists, and falls back on bad values', () => {
  const settings = parseSettings({
    show_git: 'never',
    show_cost: 'sometimes',
    week_min_pct: -5,
    cost_min_usd: 3,
    order: ' cost , model ,,',
    hidden_segments: 'ext:deploy',
  })
  expect(settings.modes.git).toBe('never')
  expect(settings.modes.cost).toBe('auto')
  expect(settings.weekMinPct).toBe(60)
  expect(settings.costMinUsd).toBe(3)
  expect(settings.order).toEqual(['cost', 'model'])
  expect(settings.hidden).toEqual(['ext:deploy'])
  expect(parseSettings({}).separator).toBe(' · ')
})

test('never hides a segment and always forces one past its threshold', () => {
  const never = parseSettings({ show_effort: 'never' })
  expect(render({}, never)).not.toContain('high')

  const always = parseSettings({ show_cost: 'always', show_week: 'always' })
  expect(render({ costUsd: 0.25, week: { pct: 5 } }, always)).toContain('$0.25')
  expect(render({ costUsd: 0.25, week: { pct: 5 } }, always)).toContain('7d')
  expect(render({ costUsd: 0.25, week: { pct: 5 } })).not.toContain('$')
})

test('auto thresholds follow the settings', () => {
  const settings = parseSettings({ week_min_pct: 10, cost_min_usd: 0.1 })
  expect(render({ costUsd: 0.25, week: { pct: 15 } }, settings)).toContain('$0.25')
  expect(render({ costUsd: 0.25, week: { pct: 15 } }, settings)).toContain('7d')
})

test('order puts listed ids first and keeps the rest in default order', () => {
  expect(orderedIds(['cost', 'nope', 'model', 'cost'], []).slice(0, 3)).toEqual(['cost', 'model', 'effort'])
  expect(render({ costUsd: 5 }, parseSettings({ order: 'cost' })).startsWith('$5.00')).toBe(true)
})

test('separator is configurable', () => {
  expect(render({}, parseSettings({ separator: ' | ' }))).toContain(' | ')
})

test('drop-in extras render in line and can be hidden', () => {
  const extras = [{ id: 'ext:deploy', label: 'deploy', text: 'v42 live', color: 'warning' }]
  const line = (settings: Settings) =>
    summaryLine({ ...BASE, extras }, NOW, settings)
      .map(part => part.text)
      .join('')
  expect(line(DEFAULT_SETTINGS).endsWith('deploy v42 live')).toBe(true)
  expect(line(parseSettings({ hidden_segments: 'ext:deploy' }))).not.toContain('deploy')
  expect(line(parseSettings({ order: 'ext:deploy' })).startsWith('deploy v42 live')).toBe(true)
})

test('pickExtraFiles keeps small json files, sorted, at most 12', () => {
  const file = (name: string, size = 100, kind = 'file') => ({ name, kind, size })
  const picked = pickExtraFiles([
    file('b.json'),
    file('a.json'),
    file('notes.txt'),
    file('big.json', 5_000),
    file('link.json', 100, 'other'),
    file('dir.json', 0, 'dir'),
  ])
  expect(picked.map(entry => entry.name)).toEqual(['a.json', 'b.json'])

  const many = Array.from({ length: 20 }, (_, index) => file(`s${String(index).padStart(2, '0')}.json`))
  expect(pickExtraFiles(many)).toHaveLength(12)
})

test('parseExtra cleans text and rejects bad files', () => {
  const ok = parseExtra('deploy', JSON.stringify({ label: 'deploy', text: 'v42\u001b[31m live', color: 'warning' }))
  expect(ok).toEqual({ id: 'ext:deploy', label: 'deploy', text: 'v42[31m live', color: 'warning' })
  expect(() => parseExtra('deploy', 'not json')).toThrow()
  expect(parseExtra('deploy', JSON.stringify({ label: 'x' }))).toBeUndefined()
  expect(parseExtra('../evil', JSON.stringify({ text: 'x' }))).toBeUndefined()
  expect(parseExtra('deploy', JSON.stringify({ text: 'x', color: 'red; rm' }))?.color).toBeUndefined()
})
