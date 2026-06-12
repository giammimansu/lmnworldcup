import { apiFetch } from './client'
import type { Outcome } from './predictions'

export interface HistoryEntry {
  match_id: number
  utc_date: string
  home_team_name: string | null
  away_team_name: string | null
  home_team_crest: string | null
  away_team_crest: string | null
  pred_home: number
  pred_away: number
  actual_home: number | null
  actual_away: number | null
  points: number | null
  outcome: Outcome
  scorer_names: string[] | null
  scorer_points: number | null
}

export interface SpecialStat {
  code: string
  title: string
  qtype: 'team' | 'player' | 'podium'
  points: number
  resolved: boolean
  correct_label: string | null
  answer_label: string | null
  my_points: number | null
}

export interface UserStats {
  user_id: string
  display_name: string
  total_points: number
  total_predictions: number
  exact_count: number
  sign_count: number
  wrong_count: number
  missed_count: number
  accuracy: number
  scorers_guessed: number
  scorers_predicted: number
  scorers_accuracy: number
  points_by_matchday: { matchday: number; points: number }[]
  history: HistoryEntry[]
  special: SpecialStat[]
}

export interface Achievement {
  code: string
  name: string
  description: string
  icon: string
  unlocked: boolean
  unlocked_at: string | null
}

export function getMyStats(): Promise<UserStats> {
  return apiFetch<UserStats>('/users/me/stats')
}

export function getUserStats(userId: string): Promise<UserStats> {
  return apiFetch<UserStats>(`/users/${userId}/stats`)
}

export function getMyAchievements(): Promise<{ achievements: Achievement[] }> {
  return apiFetch<{ achievements: Achievement[] }>('/users/me/achievements')
}
