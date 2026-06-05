import { apiFetch } from './client'

export interface LeaderboardRow {
  position: number
  user_id: string
  display_name: string
  points: number
  exact_count: number
  accuracy: number
  trend: number
}

export function getLeaderboard(): Promise<LeaderboardRow[]> {
  return apiFetch<LeaderboardRow[]>('/leaderboard')
}
