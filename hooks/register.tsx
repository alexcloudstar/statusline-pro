import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionUsage } from 'claude-code'

import type { Extra, Figures, GitSummary } from '../types'

import { EXTRAS_DIR_NAME, JSON_SUFFIX, parseExtra, pickExtraFiles } from './extras'
import { summaryLine } from './segments'
import { MODES, parseSettings } from './settings'
import type { BuiltinId, Mode, Settings } from './settings'
import { SETTINGS_PANE_TITLE, settingsView } from './settings-view'

const EMPTY_FIGURES: Figures = { dir: null, git: null, model: null, effort: null }
const figures = atom({ plugin: 'statusline-pro', key: 'figures' } as const, EMPTY_FIGURES)
const isHidden = atom({ plugin: 'statusline-pro', key: 'isHidden' } as const, false)
const revision = atom({ plugin: 'statusline-pro', key: 'revision' } as const, 0)

const COMMAND_NAME = 'statusline-pro'
const SETTINGS_ARG = 'settings'
const SETTINGS_PANE_ID = 'settings'
const CONFIG_PREFIX = 'statusline-pro.'
const REFRESH_INTERVAL_MS = 10_000
const GIT_TIMEOUT_MS = 4_000
const HIDDEN_TEXT = 'Status line hidden.'
const SHOWN_TEXT = 'Status line shown.'
const SETTINGS_OPENED_TEXT = 'Status line settings opened.'

const findLimit = (usage: Pick<SessionUsage, 'rateLimits'>, kind: string) => {
  const limit = usage.rateLimits.find(candidate => candidate.kind === kind)
  return limit ? { pct: limit.percentUsed, resetsAt: limit.resetsAt } : undefined
}

const fromUsage = (usage: Pick<SessionUsage, 'context' | 'rateLimits' | 'cost'>): Partial<Figures> => ({
  ctxPct: usage.context.percent,
  ctxTokens: usage.context.tokens,
  ctxWindow: usage.context.window,
  fiveHour: findLimit(usage, 'five_hour'),
  week: findLimit(usage, 'seven_day'),
  costUsd: usage.cost?.usd,
})

const homeRelative = (cwd: string, home: string | undefined) =>
  home && (cwd === home || cwd.startsWith(`${home}/`)) ? `~${cwd.slice(home.length)}` : cwd

const nextMode = (mode: Mode) => MODES[(MODES.indexOf(mode) + 1) % MODES.length] ?? 'auto'

function logFailure($: EngineInterface, task: string, error: unknown) {
  const reason = error instanceof Error ? error.message : String(error)
  $.ui.log(`statusline-pro: ${task} failed: ${reason}`, { to: 'debug' })
}

async function isDrawnHere($: EngineInterface) {
  const surfaces = await $.session.surfaces()
  return surfaces.some(surface => surface !== 'desktop')
}

async function readGit($: EngineInterface, cwd: string): Promise<GitSummary | null> {
  const branch = await $.process.run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], { cwd, timeoutMs: GIT_TIMEOUT_MS })
  if (branch.exitCode !== 0) return null

  const porcelain = await $.process.run(['git', 'status', '--porcelain'], { cwd, timeoutMs: GIT_TIMEOUT_MS })
  const ahead = await $.process.run(['git', 'rev-list', '--count', '@{upstream}..HEAD'], {
    cwd,
    timeoutMs: GIT_TIMEOUT_MS,
  })
  const hasUpstream = ahead.exitCode === 0

  return {
    branch: branch.stdout.trim(),
    isDirty: porcelain.stdout.trim().length > 0,
    unpushedCount: hasUpstream ? Number(ahead.stdout.trim()) : 0,
    hasUpstream,
  }
}

async function readConfigDir($: EngineInterface) {
  return (await $.env.get('CLAUDE_CONFIG_DIR')) || `${await $.env.get('HOME')}/.claude`
}

async function readExtras($: EngineInterface, configDir: string): Promise<Extra[]> {
  const dir = `${configDir}/${EXTRAS_DIR_NAME}`
  if (!(await $.fs.exists(dir))) return []

  const extras: Extra[] = []
  for (const file of pickExtraFiles(await $.fs.list(dir))) {
    try {
      const raw = await $.fs.read(`${dir}/${file.name}`)
      const extra = parseExtra(file.name.slice(0, -JSON_SUFFIX.length), raw)
      if (extra) extras.push(extra)
    } catch (error) {
      logFailure($, `reading ${file.name}`, error)
    }
  }
  return extras
}

async function refreshExtras($: EngineInterface) {
  try {
    const extras = await readExtras($, await readConfigDir($))
    await update($, figures, current => ({ ...current, extras }))
  } catch (error) {
    logFailure($, 'reading drop-in segments', error)
  }
}

async function refreshPlace($: EngineInterface) {
  try {
    if (!(await isDrawnHere($))) return
    const cwd = await $.session.cwd()
    const dir = homeRelative(cwd, await $.env.get('HOME'))
    await update($, figures, current => ({ ...current, dir }))
    const git = await readGit($, cwd)
    await update($, figures, current => ({ ...current, git }))
  } catch (error) {
    logFailure($, 'reading the working directory and git state', error)
  }
}

async function readSettings($: EngineInterface): Promise<Settings> {
  const rows = await $.config.list()
  const options = Object.fromEntries(
    rows
      .filter(row => row.key.startsWith(CONFIG_PREFIX))
      .map(row => [row.key.slice(CONFIG_PREFIX.length), row.value]),
  )
  return parseSettings(options)
}

async function setShowMode($: EngineInterface, id: BuiltinId, value: Mode) {
  switch (id) {
    case 'model':
      await $.config.set({ key: 'statusline-pro.show_model', value: value })
      break
    case 'effort':
      await $.config.set({ key: 'statusline-pro.show_effort', value: value })
      break
    case 'context':
      await $.config.set({ key: 'statusline-pro.show_context', value: value })
      break
    case 'five_hour':
      await $.config.set({ key: 'statusline-pro.show_five_hour', value: value })
      break
    case 'week':
      await $.config.set({ key: 'statusline-pro.show_week', value: value })
      break
    case 'dir':
      await $.config.set({ key: 'statusline-pro.show_dir', value: value })
      break
    case 'git':
      await $.config.set({ key: 'statusline-pro.show_git', value: value })
      break
    case 'cost':
      await $.config.set({ key: 'statusline-pro.show_cost', value: value })
      break
  }
}

async function cycleMode($: EngineInterface, settings: Settings, id: BuiltinId) {
  try {
    await setShowMode($, id, nextMode(settings.modes[id]))
    await update($, revision, count => count + 1)
  } catch (error) {
    logFailure($, `changing ${id}`, error)
  }
}

async function toggleHidden($: EngineInterface, settings: Settings, id: string) {
  const hidden = settings.hidden.includes(id) ? settings.hidden.filter(item => item !== id) : [...settings.hidden, id]
  try {
    await $.config.set({ key: 'statusline-pro.hidden_segments', value: hidden.join(',') })
    await update($, revision, count => count + 1)
  } catch (error) {
    logFailure($, `toggling ${id}`, error)
  }
}

async function moveSegment($: EngineInterface, ids: readonly string[], index: number, step: -1 | 1) {
  const target = index + step
  const moved = ids[index]
  const swapped = ids[target]
  if (moved === undefined || swapped === undefined) return

  const order = [...ids]
  order[index] = swapped
  order[target] = moved
  try {
    await $.config.set({ key: 'statusline-pro.order', value: order.join(',') })
    await update($, revision, count => count + 1)
  } catch (error) {
    logFailure($, `moving ${moved}`, error)
  }
}

export const register: Register = (on, options) => {
  const settings = parseSettings(options)

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: COMMAND_NAME, description: 'Hide or show the status line; "settings" opens its settings' })
    const model = await $.session.model()
    const usage = fromUsage(await $.session.usage())
    await update($, figures, current => ({ ...current, ...usage, model: model || null }))
    $.clock.every(REFRESH_INTERVAL_MS, () => {
      void refreshPlace($)
      void refreshExtras($)
    })
    void refreshPlace($)
    void refreshExtras($)
    return next(e)
  })

  on('command.run', { command: COMMAND_NAME }, async ($, e) => {
    if (e.args.trim() === SETTINGS_ARG) {
      await $.ui.open({ id: SETTINGS_PANE_ID, title: SETTINGS_PANE_TITLE })
      return { text: SETTINGS_OPENED_TEXT }
    }
    const hidden = await update($, isHidden, current => !current)
    return { text: hidden ? HIDDEN_TEXT : SHOWN_TEXT }
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (!e.agentId) {
      void refreshPlace($)
      void refreshExtras($)
    }
    return result
  })

  on('turn.step', async function* ($, e, next) {
    if (!e.agentId) {
      const effort = e.effort === undefined ? null : String(e.effort)
      await update($, figures, current => ({ ...current, model: e.model, effort }))
    }
    return yield* next(e)
  })

  on('session.measure', async ($, e, next) => {
    const usage = fromUsage(e)
    await update($, figures, current => ({ ...current, ...usage }))
    return next(e)
  })

  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    const hasCompacted = !e.agentId && e.trigger !== 'precompute' && !result.skip
    if (hasCompacted) {
      await update($, figures, current => ({ ...current, ctxPct: undefined, ctxTokens: undefined }))
    }
    return result
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: SETTINGS_PANE_ID }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)

    await read($, revision)
    const paneSettings = await readSettings($)
    return settingsView({
      elements: $.ui.resolve(e),
      settings: paneSettings,
      figures: await read($, figures),
      now: await $.clock.now(),
      onCycleMode: id => void cycleMode($, paneSettings, id),
      onToggleHidden: id => void toggleHidden($, paneSettings, id),
      onMove: (ids, index, step) => void moveSegment($, ids, index, step),
    })
  })

  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    if (e.surface === 'desktop' || (await read($, isHidden))) return next(e)

    const { Text } = $.ui.resolve(e)
    const parts = summaryLine(await read($, figures), await $.clock.now(), settings)

    return (
      <Text wrap="truncate-end">
        {parts.map(part => (
          <Text color={part.color} dimColor={part.dim} bold={part.bold}>
            {part.text}
          </Text>
        ))}
      </Text>
    )
  })
}
