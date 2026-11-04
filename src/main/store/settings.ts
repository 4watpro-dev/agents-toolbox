import { join } from 'node:path'
import { app } from 'electron'
import { z } from 'zod'
import { CORNERS } from '../../shared/ipc'
import { readJson, writeJson } from './jsonFile'

const SettingsSchema = z.object({
  widget: z.object({
    displayId: z.number().nullable(),
    corner: z.enum(CORNERS)
  })
})

export type Settings = z.infer<typeof SettingsSchema>

const DEFAULTS: Settings = {
  widget: { displayId: null, corner: 'bottom-right' }
}

const settingsPath = (): string => join(app.getPath('userData'), 'settings.json')

export function loadSettings(): Settings {
  return readJson(settingsPath(), SettingsSchema, DEFAULTS)
}

export function saveSettings(settings: Settings): void {
  writeJson(settingsPath(), settings)
}
