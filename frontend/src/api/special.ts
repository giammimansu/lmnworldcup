import { apiFetch } from './client'

export type SpecialType = 'team' | 'player' | 'podium'

// answer / correct_answer per tipo:
//   team   -> { team_tla }
//   player -> { player_id }
//   podium -> { podium: [tla1, tla2, tla3] }
export interface SpecialAnswerValue {
  team_tla?: string
  player_id?: number
  podium?: string[]
}

export interface SpecialQuestion {
  code: string
  title: string
  qtype: SpecialType
  points: number
  deadline: string
  resolved: boolean
  correct_answer: SpecialAnswerValue | null
  sort_order: number
  my_answer: SpecialAnswerValue | null
  my_points: number | null
  open: boolean
}

export interface Team {
  team_tla: string
  team_name: string
  team_crest: string | null
}

export const getSpecialQuestions = () => apiFetch<SpecialQuestion[]>('/special/questions')

export const answerSpecial = (question_code: string, answer: SpecialAnswerValue) =>
  apiFetch<{ ok: true }>('/special/answer', {
    method: 'POST',
    body: JSON.stringify({ question_code, answer }),
  })

export const getTeams = () => apiFetch<Team[]>('/players/teams')
