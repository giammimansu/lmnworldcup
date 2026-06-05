import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getMatches, type Match } from '../api/matches'
import { getMyPredictions, type Prediction } from '../api/predictions'
import { useAuth } from '../auth/AuthContext'
import { Badge, Button } from '../components/ui'
import { Icon } from '../components/Icon'
import { groupLabel, kickoffPassed, localTime, stageLabel } from '../lib/stages'

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

function todayISO(): string {
  return toISO(new Date())
}

// Giorni del torneo (11 giugno – 19 luglio 2026) + oggi se fuori range
const TOURNAMENT_START = new Date(2026, 5, 11)
const TOURNAMENT_END = new Date(2026, 6, 19)

function tournamentDays(): string[] {
  const days: string[] = []
  const d = new Date(TOURNAMENT_START)
  while (d <= TOURNAMENT_END) {
    days.push(toISO(d))
    d.setDate(d.getDate() + 1)
  }
  const today = todayISO()
  if (!days.includes(today)) days.unshift(today)
  return days
}

const WEEKDAYS = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB']
const MONTHS = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC']

function DayPicker({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  const days = useRef(tournamentDays()).current
  const stripRef = useRef<HTMLDivElement>(null)
  const drag = useRef({ active: false, moved: false, startX: 0, startScroll: 0 })
  const today = todayISO()

  useEffect(() => {
    const strip = stripRef.current
    const el = strip?.querySelector<HTMLButtonElement>(`[data-day="${value}"]`)
    if (strip && el) {
      strip.scrollTo({
        left: el.offsetLeft - strip.clientWidth / 2 + el.clientWidth / 2,
        behavior: 'smooth',
      })
    }
  }, [value])

  // Rotella mouse → scroll orizzontale (desktop)
  useEffect(() => {
    const strip = stripRef.current
    if (!strip) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault()
        strip.scrollLeft += e.deltaY
      }
    }
    strip.addEventListener('wheel', onWheel, { passive: false })
    return () => strip.removeEventListener('wheel', onWheel)
  }, [])

  // Drag con mouse (desktop); il touch usa lo scroll nativo
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return
    const strip = stripRef.current
    if (!strip) return
    drag.current = { active: true, moved: false, startX: e.clientX, startScroll: strip.scrollLeft }
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const strip = stripRef.current
    if (!strip || !drag.current.active) return
    const dx = e.clientX - drag.current.startX
    if (Math.abs(dx) > 4) drag.current.moved = true
    strip.scrollLeft = drag.current.startScroll - dx
  }
  const endDrag = () => {
    drag.current.active = false
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        ref={stripRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onClickCapture={(e) => {
          // Dopo un drag, sopprimi il click sul chip
          if (drag.current.moved) {
            e.preventDefault()
            e.stopPropagation()
            drag.current.moved = false
          }
        }}
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 8,
          scrollbarWidth: 'none',
          cursor: 'grab',
          userSelect: 'none',
          touchAction: 'pan-x',
        }}
      >
        {days.map((day) => {
          const d = new Date(day + 'T00:00:00')
          const active = day === value
          const isToday = day === today
          return (
            <button
              key={day}
              data-day={day}
              onClick={() => onChange(day)}
              style={{
                flex: '0 0 auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                padding: '8px 14px',
                borderRadius: 'var(--lmn-radius-md, 8px)',
                border: `1px solid ${active ? 'var(--lmn-gold-500)' : 'var(--lmn-ash-800, #283044)'}`,
                background: active ? 'rgba(212, 168, 67, 0.14)' : 'var(--lmn-pitch-500, #182038)',
                cursor: 'pointer',
                transition: 'border-color 150ms, background 150ms',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--lmn-font-ui)',
                  fontSize: 10,
                  letterSpacing: '0.08em',
                  color: active ? 'var(--lmn-gold-400)' : 'var(--lmn-ash-500)',
                }}
              >
                {isToday ? 'OGGI' : WEEKDAYS[d.getDay()]}
              </span>
              <span
                style={{
                  fontFamily: 'var(--lmn-font-display)',
                  fontSize: 22,
                  lineHeight: 1,
                  color: active ? 'var(--lmn-gold-400)' : 'var(--lmn-ash-200)',
                }}
              >
                {d.getDate()}
              </span>
              <span
                style={{
                  fontFamily: 'var(--lmn-font-ui)',
                  fontSize: 9,
                  letterSpacing: '0.08em',
                  color: 'var(--lmn-ash-500)',
                }}
              >
                {MONTHS[d.getMonth()]}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ------------------------------------------------------------- Filtro fase
const STAGE_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Tutte' },
  { value: 'GROUP_STAGE', label: 'Gironi' },
  { value: 'LAST_32', label: 'Sedicesimi' },
  { value: 'LAST_16', label: 'Ottavi' },
  { value: 'QUARTER_FINALS', label: 'Quarti' },
  { value: 'SEMI_FINALS', label: 'Semifinali' },
  { value: 'FINAL', label: 'Finale' },
]

function StageFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        paddingBottom: 8,
        marginBottom: 16,
        scrollbarWidth: 'none',
      }}
    >
      {STAGE_FILTERS.map((f) => (
        <button
          key={f.value}
          className="lmn-pill"
          data-active={value === f.value}
          onClick={() => onChange(f.value)}
          style={{ flex: '0 0 auto' }}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}

// ------------------------------------------------------------- Stato pronostico
type PredStatus = 'done' | 'todo' | 'missed' | null

function predStatus(match: Match, pred: Prediction | undefined): PredStatus {
  const started = kickoffPassed(match.utc_date)
  if (pred) return 'done'
  if (!started) return 'todo'
  return 'missed'
}

function PredStatusDot({ status }: { status: PredStatus }) {
  if (!status) return null
  const colors: Record<NonNullable<PredStatus>, { bg: string; label: string }> = {
    done: { bg: 'var(--lmn-success-400, #4ade80)', label: 'Pronosticata' },
    todo: { bg: 'var(--lmn-ember-400, #f59e0b)', label: 'Da pronosticare' },
    missed: { bg: 'var(--lmn-danger-400, #f87171)', label: 'Non pronosticata' },
  }
  const c = colors[status]
  return (
    <span
      title={c.label}
      style={{
        display: 'inline-block',
        width: 9,
        height: 9,
        borderRadius: '50%',
        background: c.bg,
        flexShrink: 0,
      }}
    />
  )
}

function StatusBadge({ match }: { match: Match }) {
  if (match.status === 'IN_PLAY' || match.status === 'PAUSED')
    return (
      <Badge variant="live" live>
        LIVE
      </Badge>
    )
  if (match.status === 'FINISHED') return <Badge variant="finished">Finita</Badge>
  return <Badge variant="timed">{localTime(match.utc_date)}</Badge>
}

function TeamCrest({ src, name }: { src: string | null; name: string | null }) {
  if (src)
    return <img src={src} alt={name ?? ''} style={{ width: 26, height: 26, objectFit: 'contain' }} />
  return (
    <span style={{ color: 'var(--lmn-ash-500)' }}>
      <Icon name="ball" size={22} />
    </span>
  )
}

function MatchRow({ match, pred }: { match: Match; pred: Prediction | undefined }) {
  const navigate = useNavigate()
  const played = match.status !== 'TIMED' && match.status !== 'SCHEDULED'
  const finished = match.status === 'FINISHED'
  const status = predStatus(match, pred)

  return (
    <div
      className="lmn-card lmn-card--hoverable"
      style={{ padding: 18, cursor: 'pointer' }}
      onClick={() => navigate(`/match/${match.id}`)}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PredStatusDot status={status} />
          <span className="lmn-badge lmn-badge--group">
            {groupLabel(match.group_name) || stageLabel(match.stage)}
          </span>
        </div>
        <StatusBadge match={match} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <TeamCrest src={match.home_team_crest} name={match.home_team_name} />
          <span
            style={{
              fontFamily: 'var(--lmn-font-ui)',
              fontWeight: 600,
              fontSize: 15,
              color: 'var(--lmn-ash-100)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {match.home_team_name ?? 'Da definire'}
          </span>
        </div>
        <span
          style={{
            fontFamily: 'var(--lmn-font-display)',
            fontSize: 30,
            letterSpacing: '0.04em',
            color: played ? 'var(--lmn-ash-100)' : 'var(--lmn-ash-600)',
            padding: '0 14px',
            whiteSpace: 'nowrap',
          }}
        >
          {played ? `${match.home_score ?? 0} : ${match.away_score ?? 0}` : 'vs'}
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flex: 1,
            minWidth: 0,
            justifyContent: 'flex-end',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--lmn-font-ui)',
              fontWeight: 600,
              fontSize: 15,
              color: 'var(--lmn-ash-100)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {match.away_team_name ?? 'Da definire'}
          </span>
          <TeamCrest src={match.away_team_crest} name={match.away_team_name} />
        </div>
      </div>

      {/* Footer: pronostico + punti */}
      {pred && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 14,
            paddingTop: 12,
            borderTop: '1px solid var(--lmn-ash-800, #283044)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--lmn-font-mono)',
              fontSize: 12,
              color: 'var(--lmn-ash-400)',
            }}
          >
            Il tuo pronostico: {pred.home_score}–{pred.away_score}
          </span>
          {finished && pred.points != null && (
            <Badge
              variant={
                pred.outcome === 'exact' ? 'esatto' : pred.outcome === 'sign' ? 'parziale' : 'sbagliato'
              }
            >
              {pred.outcome === 'exact'
                ? `Risultato esatto · +${pred.points} PT`
                : pred.outcome === 'sign'
                  ? `Segno corretto · +${pred.points} PT`
                  : 'Pronostico errato'}
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}

export default function Matches() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  // Giorno e fase vivono nell'URL (?date=&stage=) così tornando indietro da una
  // partita ritrovi il giorno/filtro in cui eri.
  const [params, setParams] = useSearchParams()
  const date = params.get('date') || todayISO()
  const stage = params.get('stage') || ''
  const setDate = (d: string) => {
    const next = new URLSearchParams(params)
    next.set('date', d)
    setParams(next, { replace: true })
  }
  const setStage = (s: string) => {
    const next = new URLSearchParams(params)
    if (s) next.set('stage', s)
    else next.delete('stage')
    setParams(next, { replace: true })
  }
  const [matches, setMatches] = useState<Match[]>([])
  const [predictions, setPredictions] = useState<Map<number, Prediction>>(new Map())
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')

  useEffect(() => {
    setState('loading')
    getMatches({ date, stage: stage || undefined })
      .then((data) => {
        setMatches(data)
        setState('ok')
      })
      .catch(() => setState('error'))
  }, [date, stage])

  useEffect(() => {
    getMyPredictions()
      .then((preds) => setPredictions(new Map(preds.map((p) => [p.match_id, p]))))
      .catch(() => {})
  }, [])

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px 80px' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <img src="/logo-full.svg" alt="LMN World Cup" style={{ height: 44 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" size="sm" onClick={() => navigate('/password')}>
            Password
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/regole')}>
            Regole
          </Button>
          <Button variant="ghost" size="sm" onClick={signOut}>
            Esci
          </Button>
        </div>
      </header>

      <h1
        style={{
          fontFamily: 'var(--lmn-font-display)',
          fontSize: 32,
          letterSpacing: '0.04em',
          margin: '0 0 16px',
          color: 'var(--lmn-ash-100)',
        }}
      >
        PARTITE
      </h1>

      <DayPicker value={date} onChange={setDate} />
      <StageFilter value={stage} onChange={setStage} />

      <p
        style={{
          fontFamily: 'var(--lmn-font-mono)',
          fontSize: 12,
          color: 'var(--lmn-ash-500)',
          marginBottom: 20,
        }}
      >
        {user?.email}
      </p>

      {state === 'loading' && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <span className="lmn-spinner" />
        </div>
      )}

      {state === 'error' && (
        <div className="lmn-card" style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ color: 'var(--lmn-danger-400)', margin: 0 }}>
            Errore nel caricamento delle partite. Riprova.
          </p>
        </div>
      )}

      {state === 'ok' && matches.length === 0 && (
        <div className="lmn-card" style={{ padding: 32, textAlign: 'center' }}>
          <span style={{ color: 'var(--lmn-ash-500)' }}>
            <Icon name="calendar" size={32} />
          </span>
          <p style={{ color: 'var(--lmn-ash-400)', marginTop: 12, marginBottom: 0 }}>
            Nessuna partita in programma per questa data.
          </p>
        </div>
      )}

      {state === 'ok' && matches.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {matches.map((m) => (
            <MatchRow key={m.id} match={m} pred={predictions.get(m.id)} />
          ))}
        </div>
      )}

    </div>
  )
}
