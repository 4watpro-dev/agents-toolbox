import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { z } from 'zod'

/**
 * Lit un fichier JSON et le valide. Un fichier absent ou corrompu donne la
 * valeur de repli : un fichier abîmé ne doit pas empêcher l'app de démarrer.
 */
export function readJson<S extends z.ZodType>(path: string, schema: S, fallback: z.output<S>): z.output<S> {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    return fallback
  }
  try {
    const result = schema.safeParse(JSON.parse(raw))
    if (result.success) return result.data
    console.warn(`[store] contenu invalide ignoré : ${path}`)
  } catch {
    console.warn(`[store] JSON illisible ignoré : ${path}`)
  }
  return fallback
}

/** Écrit via un fichier temporaire : une coupure ne laisse pas de fichier tronqué. */
export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.tmp`
  writeFileSync(temporary, JSON.stringify(value, null, 2), 'utf8')
  renameSync(temporary, path)
}
