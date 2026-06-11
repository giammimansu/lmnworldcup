export const STAGE_LABELS: Record<string, string> = {
  GROUP_STAGE: 'Gironi',
  LAST_32: 'Sedicesimi',
  LAST_16: 'Ottavi',
  QUARTER_FINALS: 'Quarti',
  SEMI_FINALS: 'Semifinali',
  THIRD_PLACE: 'Finale 3° posto',
  FINAL: 'Finale',
}

export const STAGE_MULTIPLIERS: Record<string, number> = {
  GROUP_STAGE: 1,
  LAST_32: 2,
  LAST_16: 2,
  QUARTER_FINALS: 2,
  SEMI_FINALS: 3,
  THIRD_PLACE: 3,
  FINAL: 3,
}

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage.replace(/_/g, ' ')
}

export function stageMultiplier(stage: string): number {
  return STAGE_MULTIPLIERS[stage] ?? 1
}

export function groupLabel(g: string | null): string {
  return g ? g.replace('GROUP_', 'GRUPPO ') : ''
}

export function kickoffPassed(utcDate: string): boolean {
  return new Date(utcDate).getTime() <= Date.now()
}

export function localTime(utcDate: string): string {
  return new Date(utcDate).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Rome',
  })
}
