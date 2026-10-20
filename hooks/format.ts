import type { Figures, GitSummary, Limit } from '../types'

export type Part = { text: string; color?: string; dim?: boolean; bold?: boolean }
export type Line = Part[]

const LIMIT_GAUGE_WIDTH = 5
export const PENDING = '-'
const MAX_DIR_WIDTH = 32
const MAX_BRANCH_WIDTH = 18
const CONTEXT_WARN_PCT = 50
const CONTEXT_ERROR_PCT = 80
const LIMIT_WARN_PCT = 60
const LIMIT_ERROR_PCT = 85
const SECONDS_PER_DAY = 86_400
const SECONDS_PER_HOUR = 3_600
const SECONDS_PER_MINUTE = 60
const DIRTY_MARK = '*'
const UNPUSHED_MARK = '↑'
const NO_UPSTREAM_MARK = ' (no upstream)'
const MODEL_PATTERN = /^claude-([a-z]+)-(\d{1,2})(?:-(\d{1,2}))?(?:-\d{8})?(\[1m\])?$/

const levelColor = (pct: number, warnAt: number, errorAt: number) =>
  pct >= errorAt ? 'error' : pct >= warnAt ? 'warning' : 'claude'

export const contextColor = (pct: number) => levelColor(pct, CONTEXT_WARN_PCT, CONTEXT_ERROR_PCT)
export const limitColor = (pct: number) => levelColor(pct, LIMIT_WARN_PCT, LIMIT_ERROR_PCT)

export const fit = (text: string, max: number, keep: 'start' | 'end' = 'start') => {
  if (text.length <= max) return text
  return keep === 'end' ? `…${text.slice(text.length - (max - 1))}` : `${text.slice(0, max - 1)}…`
}

export const shortDir = (dir: string, max = MAX_DIR_WIDTH) => {
  if (dir.length <= max) return dir
  const segments = dir.split('/')
  let tail = segments.pop() ?? ''
  if (tail.length + 2 > max) return fit(tail, max, 'end')
  while (segments.length && `…/${segments[segments.length - 1]}/${tail}`.length <= max) {
    tail = `${segments.pop()}/${tail}`
  }
  return `…/${tail}`
}

export const prettyModel = (id: string) => {
  const match = MODEL_PATTERN.exec(id)
  const family = match?.[1]
  if (!match || !family) return id
  const minor = match[3] ? `.${match[3]}` : ''
  const window = match[4] ? ' (1M)' : ''
  return `${family[0]?.toUpperCase()}${family.slice(1)} ${match[2]}${minor}${window}`
}

export const gauge = (pct: number, width: number) => {
  const filled = Math.min(width, Math.max(0, Math.round((pct * width) / 100)))
  return { filled: '▰'.repeat(filled), empty: '▱'.repeat(width - filled) }
}

export const formatEta = (resetsAt: string | undefined, now: number) => {
  if (!resetsAt) return ''
  const seconds = Math.floor((Date.parse(resetsAt) - now) / 1000)
  if (!(seconds > 0)) return 'now'
  const days = Math.floor(seconds / SECONDS_PER_DAY)
  const hours = Math.floor((seconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR)
  const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE)
  return days > 0 ? `${days}d${hours}h` : `${hours}h${minutes}m`
}

export const formatGit = (git: GitSummary) => {
  const dirty = git.isDirty ? DIRTY_MARK : ''
  const unpushed = git.unpushedCount > 0 ? ` ${UNPUSHED_MARK}${git.unpushedCount}` : ''
  const upstream = git.hasUpstream ? '' : NO_UPSTREAM_MARK
  return `⎇ ${fit(git.branch, MAX_BRANCH_WIDTH)}${dirty}${unpushed}${upstream}`
}

export const gaugeParts = (pct: number, width: number, color: string): Part[] => {
  const { filled, empty } = gauge(pct, width)
  return [
    { text: filled, color },
    { text: empty, color: 'subtle' },
  ]
}

export const limitLine = (label: string, limit: Limit | undefined, now: number): Line => {
  if (!limit) return [{ text: `${label} `, dim: true }, { text: PENDING, dim: true }]
  const color = limitColor(limit.pct)
  const eta = formatEta(limit.resetsAt, now)
  return [
    { text: `${label} `, dim: true },
    ...gaugeParts(limit.pct, LIMIT_GAUGE_WIDTH, color),
    color === 'claude'
      ? { text: ` ${Math.round(limit.pct)}%`, dim: true }
      : { text: ` ${Math.round(limit.pct)}%`, color },
    ...(eta ? [{ text: ` ↻${eta}`, dim: true }] : []),
  ]
}

export const modelPart = (figures: Figures): Part => ({
  text: figures.model ? prettyModel(figures.model) : PENDING,
  color: 'claude',
  bold: true,
})
