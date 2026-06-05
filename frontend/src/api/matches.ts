import { apiFetch } from './client'

export interface Match {
  id: number
  utc_date: string
  status: 'TIMED' | 'SCHEDULED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED'
  stage: string
  matchday: number | null
  group_name: string | null
  home_team_id: number | null
  home_team_name: string | null
  home_team_tla: string | null
  home_team_crest: string | null
  away_team_id: number | null
  away_team_name: string | null
  away_team_tla: string | null
  away_team_crest: string | null
  home_score: number | null
  away_score: number | null
  last_synced: string | null
}

export interface MatchFilters {
  date?: string // YYYY-MM-DD
  stage?: string
  group?: string
  matchday?: number
}

export function getMatches(filters: MatchFilters = {}): Promise<Match[]> {
  const params = new URLSearchParams()
  if (filters.date) params.set('date', filters.date)
  if (filters.stage) params.set('stage', filters.stage)
  if (filters.group) params.set('group', filters.group)
  if (filters.matchday != null) params.set('matchday', String(filters.matchday))
  const qs = params.toString()
  return apiFetch<Match[]>(`/matches${qs ? `?${qs}` : ''}`)
}

export function getMatch(id: number): Promise<Match> {
  return apiFetch<Match>(`/matches/${id}`)
}
