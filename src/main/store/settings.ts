import { join } from 'node:path'
import { app } from 'electron'
import { z } from 'zod'
import { CORNERS, PROVIDERS } from '../../shared/ipc'
import { DEFAULT_SHORTCUT } from '../../shared/shortcut'
import { readJson, writeJson } from './jsonFile'

const SettingsSchema = z.object({
  widget: z.object({
    displayId: z.number().nullable(),
    corner: z.enum(CORNERS)
  }),
  lastAgentId: z.string().nullable().default(null),
  // L'abonnement par défaut : l'API, facturée à l'usage, reste un choix explicite.
  provider: z.enum(PROVIDERS).default('subscription'),
  shortcut: z.string().default(DEFAULT_SHORTCUT)
})

export type Settings = z.infer<typeof SettingsSchema>

const DEFAULTS: Settings = {
  widget: { displayId: null, corner: 'bottom-right' },
  lastAgentId: null,
  provider: 'subscription',
  shortcut: DEFAULT_SHORTCUT
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
