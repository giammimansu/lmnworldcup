import { apiFetch } from './client'

export type RecapPrediction = {
  user_id: string
  display_name: string
  home_score: number
  away_score: number
  points: number
  scorer_names: string[] | null
  scorer_points: number | null
}

export type RecapMatch = {
  id: number
  home_team_name: string | null
  home_team_tla: string | null
  home_team_crest: string | null
  away_team_name: string | null
  away_team_tla: string | null
  away_team_crest: string | null
  home_score: number | null
  away_score: number | null
  stage: string
  predictions: RecapPrediction[]
}

export type Recap = {
  matchday: number | null
  matches: RecapMatch[]
  ranking: { user_id: string; display_name: string; points: number }[]
}

export const getRecap = (leagueId: string, matchday?: number) =>
  apiFetch<Recap>(
    `/leagues/${leagueId}/recap${matchday ? `?matchday=${matchday}` : ''}`,
  )
