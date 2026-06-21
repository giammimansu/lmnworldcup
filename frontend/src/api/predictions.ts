import { apiFetch } from './client'

export type Outcome = 'exact' | 'sign' | 'wrong' | 'pending'

export interface Prediction {
  id: string
  match_id: number
  home_score: number
  away_score: number
  points: number | null
  outcome: Outcome
  created_at: string
  updated_at: string
}

export interface MatchSummary {
  match_id: number
  total: number
  signs: { home: number; draw: number; away: number }
  top_scores: { home_score: number; away_score: number; count: number }[]
}

export function createPrediction(
  matchId: number,
  homeScore: number,
  awayScore: number,
): Promise<Prediction> {
  return apiFetch<Prediction>('/predictions', {
    method: 'POST',
    body: JSON.stringify({
      match_id: matchId,
      home_score: homeScore,
      away_score: awayScore,
    }),
  })
}

export function getMyPredictions(): Promise<Prediction[]> {
  return apiFetch<Prediction[]>('/predictions/me')
}

export function getMatchSummary(matchId: number): Promise<MatchSummary> {
  return apiFetch<MatchSummary>(`/predictions/match/${matchId}/summary`)
}

// ----------------------------------------------------------- Marcatore
export type ScorerOutcome = 'hit' | 'miss' | 'pending'

export interface ScorerPlayer {
  player_id: number
  player_name: string
  team_id: number | null
  team_tla: string | null
}

export interface ScorerPrediction {
  id: string
  match_id: number
  players: ScorerPlayer[]
  points: number | null
  outcome: ScorerOutcome
}

export function createScorerPrediction(
  matchId: number,
  playerIds: number[],
): Promise<ScorerPrediction> {
  return apiFetch<ScorerPrediction>('/predictions/scorer', {
    method: 'POST',
    body: JSON.stringify({ match_id: matchId, player_ids: playerIds }),
  })
}

export function getMyScorerPredictions(): Promise<ScorerPrediction[]> {
  return apiFetch<ScorerPrediction[]>('/predictions/scorer/me')
}
