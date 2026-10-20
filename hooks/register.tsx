import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionUsage } from 'claude-code'

import type { Figures, GitSummary } from '../types'

import { readExtras } from './extras'
import { summaryLine } from './segments'
import { parseSettings } from './settings'
import { registerSettingsPane, SETTINGS_PANE_ID, SETTINGS_PANE_TITLE } from './settings-pane'
import { EMPTY_FIGURES } from './state'

const figures = atom({ plugin: 'statusline-pro', key: 'figures' } as const, EMPTY_FIGURES)
const isHidden = atom({ plugin: 'statusline-pro', key: 'isHidden' } as const, false)

const COMMAND_NAME = 'statusline-pro'
const SETTINGS_ARG = 'settings'
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

const isDrawnHere = async ($: EngineInterface) => {
  const surfaces = await $.session.surfaces()
  return surfaces.some(surface => surface !== 'desktop')
}

const readGit = async ($: EngineInterface, cwd: string): Promise<GitSummary | null> => {
  const run = (args: string[]) => $.process.run(['git', ...args], { cwd, timeoutMs: GIT_TIMEOUT_MS })

  const branch = await run(['rev-parse', '--abbrev-ref', 'HEAD'])
  if (branch.exitCode !== 0) return null

  const porcelain = await run(['status', '--porcelain'])
  const ahead = await run(['rev-list', '--count', '@{upstream}..HEAD'])
  const hasUpstream = ahead.exitCode === 0

  return {
    branch: branch.stdout.trim(),
    isDirty: porcelain.stdout.trim().length > 0,
    unpushedCount: hasUpstream ? Number(ahead.stdout.trim()) : 0,
    hasUpstream,
  }
}

const homeRelative = (cwd: string, home: string | undefined) =>
  home && (cwd === home || cwd.startsWith(`${home}/`)) ? `~${cwd.slice(home.length)}` : cwd

const readConfigDir = async ($: EngineInterface) =>
  (await $.env.get('CLAUDE_CONFIG_DIR')) || `${await $.env.get('HOME')}/.claude`

const logFailure = ($: EngineInterface, task: string, error: unknown) => {
  const reason = error instanceof Error ? error.message : String(error)
  $.ui.log(`${$.plugin.name}: ${task} failed: ${reason}`, { to: 'debug' })
}

const refreshExtras = async ($: EngineInterface) => {
  try {
    const extras = await readExtras($, await readConfigDir($))
    await update($, figures, current => ({ ...current, extras }))
  } catch (error) {
    logFailure($, 'reading drop-in segments', error)
  }
}

const refreshPlace = async ($: EngineInterface) => {
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

export const register: Register = (on, options) => {
  const settings = parseSettings(options)

  registerSettingsPane(on)

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: COMMAND_NAME, description: 'Hide or show the status line; "settings" opens its settings' })
    const model = await $.session.model()
    const usage = fromUsage(await $.session.usage())
    await update($, figures, current => ({ ...current, ...usage, model: model || null }))
    const refresh = () => {
      void refreshPlace($)
      void refreshExtras($)
    }
    $.clock.every(REFRESH_INTERVAL_MS, refresh)
    refresh()
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
