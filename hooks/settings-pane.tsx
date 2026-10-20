import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { EXTRAS_DIR_NAME } from './extras'
import { BUILTINS, orderedIds, summaryLine } from './segments'
import { MODES, parseSettings, showKey } from './settings'
import type { BuiltinId, Mode, Settings } from './settings'
import { EMPTY_FIGURES } from './state'

const figures = atom({ plugin: 'statusline-pro', key: 'figures' } as const, EMPTY_FIGURES)
const revision = atom({ plugin: 'statusline-pro', key: 'revision' } as const, 0)

export const SETTINGS_PANE_ID = 'settings'
export const SETTINGS_PANE_TITLE = 'Status line settings'

const LABEL_WIDTH = 16
const STATE_WIDTH = 8
const SHOWN = 'shown'
const HIDDEN = 'hidden'

const configKey = ($: EngineInterface, field: string) => `${$.plugin.name}.${field}`

const readSettings = async ($: EngineInterface): Promise<Settings> => {
  const prefix = configKey($, '')
  const rows = await $.config.list()
  const options = Object.fromEntries(
    rows.filter(row => row.key.startsWith(prefix)).map(row => [row.key.slice(prefix.length), row.value]),
  )
  return parseSettings(options)
}

const setOption = async ($: EngineInterface, field: string, value: string) => {
  await $.config.set({ key: configKey($, field), value })
  await update($, revision, count => count + 1)
}

const nextMode = (mode: Mode) => MODES[(MODES.indexOf(mode) + 1) % MODES.length] ?? 'auto'

const move = async ($: EngineInterface, ids: readonly string[], index: number, step: -1 | 1) => {
  const target = index + step
  if (target < 0 || target >= ids.length) return
  const order = [...ids]
  const moved = order[index]
  const swapped = order[target]
  if (moved === undefined || swapped === undefined) return
  order[index] = swapped
  order[target] = moved
  await setOption($, 'order', order.join(','))
}

const toggleHidden = async ($: EngineInterface, settings: Settings, id: string) => {
  const hidden = settings.hidden.includes(id)
    ? settings.hidden.filter(item => item !== id)
    : [...settings.hidden, id]
  await setOption($, 'hidden_segments', hidden.join(','))
}

export const registerSettingsPane = (on: Parameters<Register>[0]) => {
  on('ui.render', { component: 'Pane', requestId: SETTINGS_PANE_ID }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    await read($, revision)
    const settings = await readSettings($)
    const current = await read($, figures)
    const extras = current.extras ?? []
    const ids = orderedIds(settings.order, extras)
    const preview = summaryLine(current, await $.clock.now(), settings, extras)

    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold>{SETTINGS_PANE_TITLE}</Text>
        <Text wrap="truncate-end">
          {preview.map(part => (
            <Text color={part.color} dimColor={part.dim} bold={part.bold}>
              {part.text}
            </Text>
          ))}
        </Text>
        <Text> </Text>
        {ids.map((id, index) => {
          const extra = extras.find(item => item.id === id)
          const label = extra ? extra.label || id : BUILTINS[id as BuiltinId].label
          const state = extra ? (settings.hidden.includes(id) ? HIDDEN : SHOWN) : settings.modes[id as BuiltinId]
          const onToggle = extra
            ? () => toggleHidden($, settings, id)
            : () => setOption($, showKey(id as BuiltinId), nextMode(settings.modes[id as BuiltinId]))

          return (
            <Box key={`row:${id}`}>
              <Text>{label.padEnd(LABEL_WIDTH)}</Text>
              <Button key={`state:${id}`} label={state.padEnd(STATE_WIDTH)} onPress={onToggle} />
              <Button key={`up:${id}`} label=" ↑ " plain onPress={() => move($, ids, index, -1)} />
              <Button key={`down:${id}`} label=" ↓ " plain onPress={() => move($, ids, index, 1)} />
            </Box>
          )
        })}
        <Text> </Text>
        <Text dimColor>auto: show when it matters. always / never: force it.</Text>
        <Text dimColor>More segments: drop JSON files in ~/.claude/{EXTRAS_DIR_NAME}/</Text>
      </Box>
    )
  })
}
