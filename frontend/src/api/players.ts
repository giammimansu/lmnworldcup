import { apiFetch } from './client'

export interface Player {
  id: number
  name: string
  position: string | null
  shirt_number: number | null
  team_id: number | null
  team_tla: string | null
  team_name: string | null
}

// Filtra per team_id (stabile) e non per TLA: il TLA di football-data può
// cambiare tra i sync (es. Uruguay URY->URU) e disallinearsi dalla rosa.
export function getPlayers(teamId: number): Promise<Player[]> {
  return apiFetch<Player[]>(`/players?team_id=${teamId}`)
}

// Tutti i giocatori (per il dropdown capocannoniere dei pronostici di torneo).
export function getAllPlayers(): Promise<Player[]> {
  return apiFetch<Player[]>('/players')
}
