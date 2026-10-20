export type Limit = { pct: number; resetsAt?: string }

export type GitSummary = {
  branch: string
  isDirty: boolean
  unpushedCount: number
  hasUpstream: boolean
}

export type Extra = {
  id: string
  label: string
  text: string
  color?: string
}

export type Figures = {
  dir: string | null
  git: GitSummary | null
  model: string | null
  effort: string | null
  extras?: Extra[]
  ctxPct?: number
  ctxTokens?: number
  ctxWindow?: number
  fiveHour?: Limit
  week?: Limit
  costUsd?: number
}

declare module 'claude-code' {
  interface PluginState {
    'statusline-pro': { figures: Figures; isHidden: boolean; revision: number }
  }
}
