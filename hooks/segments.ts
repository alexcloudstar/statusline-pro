import type { Extra, Figures } from '../types'

import { contextColor, formatGit, gaugeParts, limitLine, modelPart, PENDING, shortDir } from './format'
import type { Line } from './format'
import { BUILTIN_IDS, DEFAULT_SETTINGS } from './settings'
import type { BuiltinId, Mode, Settings } from './settings'

const CONTEXT_GAUGE_WIDTH = 5

type Context = { figures: Figures; now: number; settings: Settings; mode: Mode }

type Builtin = {
  label: string
  render: (context: Context) => Line | undefined
}

const contextSegment = ({ figures }: Context): Line => {
  if (figures.ctxPct === undefined) return [{ text: 'ctx ', dim: true }, { text: PENDING, dim: true }]
  return [
    { text: 'ctx ', dim: true },
    ...gaugeParts(figures.ctxPct, CONTEXT_GAUGE_WIDTH, contextColor(figures.ctxPct)),
    { text: ` ${Math.round(figures.ctxPct)}%`, bold: true },
  ]
}

const weekSegment = ({ figures, now, settings, mode }: Context) => {
  const week = figures.week
  const isFresh = week !== undefined && !(week.resetsAt && Date.parse(week.resetsAt) <= now)
  const isWorthShowing = isFresh && week.pct >= settings.weekMinPct
  return mode === 'always' || isWorthShowing ? limitLine('7d', week, now) : undefined
}

const costSegment = ({ figures, settings, mode }: Context) => {
  const cost = figures.costUsd
  if (cost === undefined) return undefined
  return mode === 'always' || cost >= settings.costMinUsd ? [{ text: `$${cost.toFixed(2)}` }] : undefined
}

export const BUILTINS: Record<BuiltinId, Builtin> = {
  model: { label: 'Model', render: ({ figures }) => [modelPart(figures)] },
  effort: {
    label: 'Effort',
    render: ({ figures }) => (figures.effort ? [{ text: figures.effort, color: 'claude' }] : undefined),
  },
  context: { label: 'Context', render: contextSegment },
  five_hour: { label: '5h limit', render: ({ figures, now }) => limitLine('5h', figures.fiveHour, now) },
  week: { label: '7d limit', render: weekSegment },
  dir: { label: 'Directory', render: ({ figures }) => (figures.dir ? [{ text: shortDir(figures.dir) }] : undefined) },
  git: { label: 'Git', render: ({ figures }) => (figures.git ? [{ text: formatGit(figures.git) }] : undefined) },
  cost: { label: 'Cost', render: costSegment },
}

const isBuiltin = (id: string): id is BuiltinId => (BUILTIN_IDS as readonly string[]).includes(id)

export const orderedIds = (order: readonly string[], extras: readonly Extra[]) => {
  const known = new Set<string>([...BUILTIN_IDS, ...extras.map(extra => extra.id)])
  const ids = [...new Set(order.filter(id => known.has(id)))]
  const rest = [...BUILTIN_IDS, ...extras.map(extra => extra.id)].filter(id => !ids.includes(id))
  return [...ids, ...rest]
}

const extraSegment = (extra: Extra): Line => [
  ...(extra.label ? [{ text: `${extra.label} `, dim: true }] : []),
  { text: extra.text, color: extra.color },
]

export const summaryLine = (
  figures: Figures,
  now: number,
  settings: Settings = DEFAULT_SETTINGS,
  extras: readonly Extra[] = figures.extras ?? [],
): Line => {
  const extrasById = new Map(extras.map(extra => [extra.id, extra]))

  const segments = orderedIds(settings.order, extras).flatMap((id): Line[] => {
    if (isBuiltin(id)) {
      const mode = settings.modes[id]
      const segment = mode === 'never' ? undefined : BUILTINS[id].render({ figures, now, settings, mode })
      return segment ? [segment] : []
    }
    const extra = extrasById.get(id)
    return extra && !settings.hidden.includes(id) ? [extraSegment(extra)] : []
  })

  return segments.flatMap((segment, index) =>
    index ? [{ text: settings.separator, dim: true }, ...segment] : segment,
  )
}
