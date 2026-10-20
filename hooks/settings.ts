export const BUILTIN_IDS = [
  'model',
  'effort',
  'context',
  'five_hour',
  'week',
  'dir',
  'git',
  'cost',
] as const

export type BuiltinId = (typeof BUILTIN_IDS)[number]
export type Mode = 'auto' | 'always' | 'never'

export type Settings = {
  modes: Record<BuiltinId, Mode>
  weekMinPct: number
  costMinUsd: number
  separator: string
  order: string[]
  hidden: string[]
}

export const MODES: readonly Mode[] = ['auto', 'always', 'never']

const DEFAULT_WEEK_MIN_PCT = 60
const DEFAULT_COST_MIN_USD = 1
const DEFAULT_SEPARATOR = '  ·  '

export const DEFAULT_SETTINGS: Settings = {
  modes: Object.fromEntries(BUILTIN_IDS.map(id => [id, 'auto'])) as Record<BuiltinId, Mode>,
  weekMinPct: DEFAULT_WEEK_MIN_PCT,
  costMinUsd: DEFAULT_COST_MIN_USD,
  separator: DEFAULT_SEPARATOR,
  order: [],
  hidden: [],
}

const asMode = (value: unknown): Mode => MODES.find(mode => mode === value) ?? 'auto'

const asNumber = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback

export const splitList = (value: unknown) =>
  typeof value === 'string'
    ? value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
    : []

export const showKey = (id: BuiltinId) => `show_${id}`

export const parseSettings = (options: Readonly<Record<string, unknown>>): Settings => ({
  modes: Object.fromEntries(BUILTIN_IDS.map(id => [id, asMode(options[showKey(id)])])) as Record<
    BuiltinId,
    Mode
  >,
  weekMinPct: asNumber(options.week_min_pct, DEFAULT_WEEK_MIN_PCT),
  costMinUsd: asNumber(options.cost_min_usd, DEFAULT_COST_MIN_USD),
  separator: typeof options.separator === 'string' && options.separator ? options.separator : DEFAULT_SEPARATOR,
  order: splitList(options.order),
  hidden: splitList(options.hidden_segments),
})
