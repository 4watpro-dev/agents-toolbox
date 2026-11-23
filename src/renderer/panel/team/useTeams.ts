import { useCallback, useEffect, useState } from 'react'
import type { Team } from '../../../shared/teams'

/** Équipes enregistrées, rechargées à la demande (après une création ou une suppression). */
export function useTeams(): { teams: Team[]; reload(): void } {
  const [teams, setTeams] = useState<Team[]>([])
  const reload = useCallback(() => {
    void window.toolbox.team.list().then(setTeams)
  }, [])
  useEffect(reload, [reload])
  return { teams, reload }
}
