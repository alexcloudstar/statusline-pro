import type { Extra } from '../types'

export const EXTRAS_DIR_NAME = 'status-segments'
export const EXTRA_ID_PREFIX = 'ext:'
export const JSON_SUFFIX = '.json'

const MAX_FILES = 12
const MAX_FILE_BYTES = 2_048
const MAX_STEM_LENGTH = 40
const MAX_LABEL_LENGTH = 16
const MAX_TEXT_LENGTH = 40
const COLOR_PATTERN = /^[a-z]{1,20}$/
const STEM_PATTERN = /^[A-Za-z0-9_-]+$/
const CONTROL_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g

type ListedFile = { name: string; kind: string; size: number }

const clean = (value: unknown, max: number) =>
  typeof value === 'string' ? value.replace(CONTROL_PATTERN, '').trim().slice(0, max) : ''

export const pickExtraFiles = <T extends ListedFile>(entries: readonly T[]) =>
  entries
    .filter(entry => entry.kind === 'file' && entry.name.endsWith(JSON_SUFFIX) && entry.size <= MAX_FILE_BYTES)
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, MAX_FILES)

export const parseExtra = (stem: string, raw: string): Extra | undefined => {
  if (!STEM_PATTERN.test(stem) || stem.length > MAX_STEM_LENGTH) return undefined
  const data: unknown = JSON.parse(raw)
  if (typeof data !== 'object' || data === null) return undefined

  const fields = data as Record<string, unknown>
  const text = clean(fields.text, MAX_TEXT_LENGTH)
  if (!text) return undefined

  const color = typeof fields.color === 'string' && COLOR_PATTERN.test(fields.color) ? fields.color : undefined
  return { id: `${EXTRA_ID_PREFIX}${stem}`, label: clean(fields.label, MAX_LABEL_LENGTH), text, color }
}
