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
