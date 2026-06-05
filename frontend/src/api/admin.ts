import { apiFetch } from './client'

export interface AdminUser {
  id: string
  email: string
  display_name: string
  is_admin: boolean
  created_at: string
  predictions_count: number
}

export interface SyncLogRow {
  id: number
  run_at: string
  matches_updated: number | null
  status: string | null
  detail: string | null
}

export function getAdminUsers(): Promise<AdminUser[]> {
  return apiFetch<AdminUser[]>('/admin/users')
}

export function overrideMatch(
  matchId: number,
  data: { home_score?: number; away_score?: number; status?: string },
): Promise<{ match_id: number; predictions_rescored: number }> {
  return apiFetch(`/admin/matches/${matchId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function getSyncLog(): Promise<SyncLogRow[]> {
  return apiFetch<SyncLogRow[]>('/admin/sync-log')
}

export function inviteUser(email: string, displayName?: string): Promise<{ invited: boolean }> {
  return apiFetch('/auth/invite', {
    method: 'POST',
    body: JSON.stringify({ email, display_name: displayName }),
  })
}

// ----------------------------------------------------------- Marcatori
export interface MatchGoal {
  id: number
  match_id: number
  player_id: number | null
  player_name: string
  team_tla: string | null
  minute: number | null
  created_at: string
}

export function addGoal(body: {
  match_id: number
  player_id: number
  player_name: string
  team_tla?: string | null
  minute?: number | null
}): Promise<{ ok: boolean }> {
  return apiFetch('/admin/goals', { method: 'POST', body: JSON.stringify(body) })
}

export function delGoal(goalId: number, matchId: number): Promise<{ ok: boolean }> {
  return apiFetch(`/admin/goals/${goalId}?match_id=${matchId}`, { method: 'DELETE' })
}

export function listGoals(matchId: number): Promise<MatchGoal[]> {
  return apiFetch<MatchGoal[]>(`/admin/goals/${matchId}`)
}
