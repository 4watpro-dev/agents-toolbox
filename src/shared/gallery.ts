import type { Agent } from './agent'

export interface GalleryFilter {
  query: string
  /** `null` : toutes les catégories. */
  category: string | null
}

/** Minuscules et sans accents : « ecriture » doit trouver « Écriture ». */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/** Agents correspondant au filtre : favoris d'abord, puis ordre alphabétique. */
export function filterAgents(agents: Agent[], { query, category }: GalleryFilter): Agent[] {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  return agents
    .filter((agent) => {
      if (category !== null && agent.category !== category) return false
      const haystack = normalize(`${agent.name} ${agent.specialty} ${agent.description} ${agent.category}`)
      return words.every((word) => haystack.includes(word))
    })
    .sort(
      (a, b) =>
        Number(b.isFavorite) - Number(a.isFavorite) || a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
    )
}
