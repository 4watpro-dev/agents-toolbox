import type { Agent } from '../../shared/agent'

/** Ordre des agents dans la palette : favoris d'abord, puis par nom. ⌘1 à ⌘9 suivent cet ordre. */
export function paletteOrder(agents: Agent[]): Agent[] {
  return [...agents].sort(
    (a, b) => Number(b.isFavorite) - Number(a.isFavorite) || a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
  )
}

/** Agent sélectionné à l'ouverture : celui en cours, sinon le dernier utilisé, sinon le premier. */
export function initialAgentId(ordered: Agent[], current: string | null, lastUsed: string | null): string | null {
  if (current && ordered.some((agent) => agent.id === current)) return current
  if (lastUsed && ordered.some((agent) => agent.id === lastUsed)) return lastUsed
  return ordered[0]?.id ?? null
}

/** Agent voisin, en boucle : +1 pour le suivant, -1 pour le précédent. */
export function neighborAgentId(ordered: Agent[], current: string | null, step: 1 | -1): string | null {
  if (ordered.length === 0) return null
  const index = ordered.findIndex((agent) => agent.id === current)
  const next = (index + step + ordered.length) % ordered.length
  return ordered[index === -1 ? 0 : next]!.id
}
