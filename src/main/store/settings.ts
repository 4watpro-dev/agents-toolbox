import { join } from 'node:path'
import { app } from 'electron'
import { z } from 'zod'
import { CORNERS } from '../../shared/ipc'
import { readJson, writeJson } from './jsonFile'

const SettingsSchema = z.object({
  widget: z.object({
    displayId: z.number().nullable(),
    corner: z.enum(CORNERS)
  }),
  lastAgentId: z.string().nullable().default(null)
})

export type Settings = z.infer<typeof SettingsSchema>

const DEFAULTS: Settings = {
  widget: { displayId: null, corner: 'bottom-right' },
  lastAgentId: null
}

const settingsPath = (): string => join(app.getPath('userData'), 'settings.json')

let current: Settings | null = null

export function getSettings(): Settings {
  current ??= readJson(settingsPath(), SettingsSchema, DEFAULTS)
  return current
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...getSettings(), ...patch }
  writeJson(settingsPath(), current)
}
