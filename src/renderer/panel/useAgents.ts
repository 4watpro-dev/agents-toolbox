import { useCallback, useEffect, useState } from 'react'
import type { Agent, AgentDraft } from '../../shared/agent'

interface UseAgents {
  agents: Agent[]
  error: string | null
  reload(): void
  save(id: string | null, draft: AgentDraft): Promise<void>
  remove(agent: Agent): void
  setFavorite(id: string, isFavorite: boolean): void
}

const FAILURE = "L'enregistrement a échoué. Réessaie, et si cela persiste, relance l'app."

export function useAgents(): UseAgents {
  const [agents, setAgents] = useState<Agent[]>([])
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    window.toolbox.agents.list().then(setAgents, () => setError('Impossible de charger les agents.'))
  }, [])

  useEffect(reload, [reload])

  const replace = useCallback((agent: Agent) => {
    setAgents((current) =>
      current.some(({ id }) => id === agent.id)
        ? current.map((other) => (other.id === agent.id ? agent : other))
        : [...current, agent]
    )
  }, [])

  const save = useCallback(
    async (id: string | null, draft: AgentDraft) => {
      replace(await window.toolbox.agents.save(id, draft))
      setError(null)
    },
    [replace]
  )

  const remove = useCallback((agent: Agent) => {
    window.toolbox.agents.remove(agent.id).then(
      () => {
        setAgents((current) => current.filter(({ id }) => id !== agent.id))
        setError(null)
      },
      () => setError(FAILURE)
    )
  }, [])

  const setFavorite = useCallback(
    (id: string, isFavorite: boolean) => {
      window.toolbox.agents.setFavorite(id, isFavorite).then(
        (agent) => {
          replace(agent)
          setError(null)
        },
        () => setError(FAILURE)
      )
    },
    [replace]
  )

  return { agents, error, reload, save, remove, setFavorite }
}
