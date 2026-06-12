import { apiFetch } from './client'
import type { LeaderboardRow } from './leaderboard'

export type League = {
  id: string
  name: string
  owner_id: string
  invite_code: string
  member_count: number
  is_owner: boolean
}

export type LeagueMember = {
  user_id: string
  display_name: string
  joined_at: string
  is_owner: boolean
}

export const getMyLeagues = () => apiFetch<League[]>('/leagues/me')

export const createLeague = (name: string) =>
  apiFetch<League>('/leagues', { method: 'POST', body: JSON.stringify({ name }) })

export const joinLeague = (invite_code: string) =>
  apiFetch<League>('/leagues/join', {
    method: 'POST',
    body: JSON.stringify({ invite_code }),
  })

export const getLeagueMembers = (id: string) =>
  apiFetch<LeagueMember[]>(`/leagues/${id}/members`)

export const getLeagueLeaderboard = (id: string) =>
  apiFetch<LeaderboardRow[]>(`/leagues/${id}/leaderboard`)

export type LeagueMatchPrediction = {
  user_id: string
  display_name: string
  home_score: number
  away_score: number
  points: number
  outcome: 'exact' | 'sign' | 'wrong' | 'pending'
  scorer_names: string[] | null
  scorer_points: number | null
}

export type LeagueMatchPredictions = {
  match_id: number
  status: string
  home_score: number | null
  away_score: number | null
  total: number
  signs: { home: number; draw: number; away: number }
  top_scores: { home_score: number; away_score: number; count: number }[]
  predictions: LeagueMatchPrediction[]
}

export const getLeagueMatchPredictions = (leagueId: string, matchId: number) =>
  apiFetch<LeagueMatchPredictions>(
    `/leagues/${leagueId}/match/${matchId}/predictions`,
  )

export type LeagueSpecialAnswer = {
  user_id: string
  display_name: string
  answer: { team_tla?: string; player_id?: number; podium?: string[] }
  points: number | null
}

export type LeagueSpecialQuestion = {
  code: string
  title: string
  qtype: 'team' | 'player' | 'podium'
  points: number
  deadline: string
  resolved: boolean
  correct_answer: { team_tla?: string; player_id?: number; podium?: string[] } | null
  sort_order: number
  open: boolean
  answered_count: number
  member_count: number
  answers: LeagueSpecialAnswer[]
}

export const getLeagueSpecial = (leagueId: string) =>
  apiFetch<{ questions: LeagueSpecialQuestion[] }>(`/leagues/${leagueId}/special`)

export const renameLeague = (id: string, name: string) =>
  apiFetch(`/leagues/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) })

export const regenerateCode = (id: string) =>
  apiFetch<{ invite_code: string }>(`/leagues/${id}/regenerate-code`, {
    method: 'POST',
  })

export const removeMember = (id: string, memberId: string) =>
  apiFetch(`/leagues/${id}/members/${memberId}`, { method: 'DELETE' })

export const leaveLeague = (id: string) =>
  apiFetch(`/leagues/${id}/leave`, { method: 'POST' })
