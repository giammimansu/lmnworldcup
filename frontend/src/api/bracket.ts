import { apiFetch } from './client'

export interface BracketMatch {
  match_id: number
  utc_date: string
  status: string
  home_team_name: string | null
  home_team_tla: string | null
  home_team_crest: string | null
  away_team_name: string | null
  away_team_tla: string | null
  away_team_crest: string | null
  home_score: number | null
  away_score: number | null
  winner: 'home' | 'away' | null
}

export interface BracketStage {
  stage: string
  matches: BracketMatch[]
}

export function getBracket(): Promise<{ stages: BracketStage[] }> {
  return apiFetch<{ stages: BracketStage[] }>('/bracket')
}
