import { apiFetch } from './client'

export interface Player {
  id: number
  name: string
  position: string | null
  shirt_number: number | null
  team_tla: string | null
  team_name: string | null
}

export function getPlayers(teamTla: string): Promise<Player[]> {
  return apiFetch<Player[]>(`/players?team_tla=${encodeURIComponent(teamTla)}`)
}

// Tutti i giocatori (per il dropdown capocannoniere dei pronostici di torneo).
export function getAllPlayers(): Promise<Player[]> {
  return apiFetch<Player[]>('/players')
}
