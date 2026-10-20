import type { Elements } from 'claude-code'

import type { Extra, Figures } from '../types'

import { EXTRAS_DIR_NAME } from './extras'
import { BUILTINS, orderedIds, summaryLine } from './segments'
import type { BuiltinId, Settings } from './settings'

export const SETTINGS_PANE_TITLE = 'Status line settings'

const LABEL_WIDTH = 16
const STATE_WIDTH = 8
const SHOWN = 'shown'
const HIDDEN = 'hidden'

type SettingsViewProps = {
  elements: Elements['terminal']
  settings: Settings
  figures: Figures
  now: number
  onCycleMode: (id: BuiltinId) => void
  onToggleHidden: (id: string) => void
  onMove: (ids: readonly string[], index: number, step: -1 | 1) => void
}

const labelOf = (id: string, extra: Extra | undefined) =>
  extra ? extra.label || id : BUILTINS[id as BuiltinId].label

const stateOf = (id: string, extra: Extra | undefined, settings: Settings) => {
  if (!extra) return settings.modes[id as BuiltinId]
  return settings.hidden.includes(id) ? HIDDEN : SHOWN
}

export const settingsView = ({
  elements,
  settings,
  figures,
  now,
  onCycleMode,
  onToggleHidden,
  onMove,
}: SettingsViewProps) => {
  const { Box, Button, Text } = elements
  const extras = figures.extras ?? []
  const ids = orderedIds(settings.order, extras)
  const preview = summaryLine(figures, now, settings, extras)

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
        const onToggle = extra ? () => onToggleHidden(id) : () => onCycleMode(id as BuiltinId)

        return (
          <Box key={`row:${id}`}>
            <Text>{labelOf(id, extra).padEnd(LABEL_WIDTH)}</Text>
            <Button key={`state:${id}`} label={stateOf(id, extra, settings).padEnd(STATE_WIDTH)} onPress={onToggle} />
            <Button key={`up:${id}`} label=" ↑ " plain onPress={() => onMove(ids, index, -1)} />
            <Button key={`down:${id}`} label=" ↓ " plain onPress={() => onMove(ids, index, 1)} />
          </Box>
        )
      })}
      <Text> </Text>
      <Text dimColor>auto: show when it matters. always / never: force it.</Text>
      <Text dimColor>More segments: drop JSON files in ~/.claude/{EXTRAS_DIR_NAME}/</Text>
    </Box>
  )
}
