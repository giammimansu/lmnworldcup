import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { getMatch, type Match } from '../api/matches'
import {
  createPrediction,
  createScorerPrediction,
  getMatchSummary,
  getMyPredictions,
  getMyScorerPredictions,
  type MatchSummary,
  type ScorerPrediction,
} from '../api/predictions'
import { getPlayers, type Player } from '../api/players'
import { Badge, Button } from '../components/ui'
import { Icon } from '../components/Icon'
import {
  groupLabel,
  kickoffPassed,
  localTime,
  stageLabel,
  stageMultiplier,
} from '../lib/stages'

// ------------------------------------------------------------- Countdown
function useCountdown(utcDate: string | undefined) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  if (!utcDate) return { expired: false, label: '' }
  const diff = new Date(utcDate).getTime() - now
  if (diff <= 0) return { expired: true, label: '' }
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const label = d > 0 ? `${d}g ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`
  return { expired: false, label }
}

// ------------------------------------------------------------- Toast
function Toast({ kind, message }: { kind: 'success' | 'error'; message: string }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--lmn-pitch-300, #232c48)',
        border: `1px solid ${kind === 'success' ? 'var(--lmn-success-400)' : 'var(--lmn-danger-400)'}`,
        borderRadius: 'var(--lmn-radius-md, 8px)',
        padding: '12px 20px',
        color: kind === 'success' ? 'var(--lmn-success-400)' : 'var(--lmn-danger-400)',
        fontFamily: 'var(--lmn-font-ui)',
        fontSize: 14,
        fontWeight: 600,
        zIndex: 100,
        boxShadow: 'var(--lmn-shadow-lg, 0 8px 24px rgba(0,0,0,0.4))',
      }}
    >
      {message}
    </div>
  )
}

// ------------------------------------------------------------- Score wheel
const WHEEL_ITEM = 48 // altezza riga
const WHEEL_VISIBLE = 3 // righe visibili (dispari → 1 centrale)
const WHEEL_MAX = 20 // gol massimi selezionabili
const WHEEL_PAD = ((WHEEL_VISIBLE - 1) / 2) * WHEEL_ITEM

function ScoreBox({
  value,
  onChange,
  disabled,
  label,
}: {
  value: string
  onChange: (v: string) => void
  disabled: boolean
  label: string
}) {
  const num = value === '' ? 0 : Number(value)
  const ref = useRef<HTMLDivElement>(null)
  const lock = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const items = Array.from({ length: WHEEL_MAX + 1 }, (_, i) => i)

  // Allinea lo scroll al valore corrente (senza generare onChange)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const target = num * WHEEL_ITEM
    if (Math.abs(el.scrollTop - target) > 1) {
      lock.current = true
      el.scrollTop = target
      window.requestAnimationFrame(() => {
        lock.current = false
      })
    }
  }, [num])

  const handleScroll = () => {
    if (disabled || lock.current) return
    const el = ref.current
    if (!el) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const idx = Math.max(0, Math.min(WHEEL_MAX, Math.round(el.scrollTop / WHEEL_ITEM)))
      if (idx !== num) onChange(String(idx))
    }, 90)
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', width: 84, margin: '0 auto' }}>
        {/* riquadro centrale di selezione */}
        <div
          style={{
            position: 'absolute',
            top: WHEEL_PAD,
            left: 0,
            right: 0,
            height: WHEEL_ITEM,
            border: '1px solid var(--lmn-gold-500, #d4af37)',
            borderRadius: 'var(--lmn-radius-md, 8px)',
            pointerEvents: 'none',
          }}
        />
        <div
          ref={ref}
          onScroll={handleScroll}
          style={{
            height: WHEEL_VISIBLE * WHEEL_ITEM,
            width: 84,
            overflowY: disabled ? 'hidden' : 'scroll',
            scrollSnapType: 'y mandatory',
            scrollbarWidth: 'none',
            background: 'var(--lmn-pitch-500, #182038)',
            border: '1px solid var(--lmn-ash-800, #283044)',
            borderRadius: 'var(--lmn-radius-md, 8px)',
            opacity: disabled ? 0.5 : 1,
            WebkitMaskImage:
              'linear-gradient(to bottom, transparent, #000 35%, #000 65%, transparent)',
            maskImage:
              'linear-gradient(to bottom, transparent, #000 35%, #000 65%, transparent)',
          }}
        >
          <div style={{ height: WHEEL_PAD }} />
          {items.map((n) => (
            <div
              key={n}
              style={{
                height: WHEEL_ITEM,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                scrollSnapAlign: 'center',
                fontFamily: 'var(--lmn-font-display)',
                fontSize: 40,
                lineHeight: 1,
                color: n === num ? 'var(--lmn-ash-100)' : 'var(--lmn-ash-600)',
              }}
            >
              {n}
            </div>
          ))}
          <div style={{ height: WHEEL_PAD }} />
        </div>
      </div>
      <div
        style={{
          marginTop: 8,
          fontFamily: 'var(--lmn-font-ui)',
          fontSize: 11,
          letterSpacing: '0.08em',
          color: 'var(--lmn-ash-500)',
          textTransform: 'uppercase',
          maxWidth: 100,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </div>
    </div>
  )
}

// ------------------------------------------------------------- Summary
function SummaryPanel({ summary }: { summary: MatchSummary }) {
  const bars: { label: string; pct: number }[] = [
    { label: '1', pct: summary.signs.home },
    { label: 'X', pct: summary.signs.draw },
    { label: '2', pct: summary.signs.away },
  ]
  return (
    <div className="lmn-card" style={{ padding: 24, marginTop: 16 }}>
      <h3
        style={{
          fontFamily: 'var(--lmn-font-display)',
          fontSize: 20,
          letterSpacing: '0.04em',
          margin: '0 0 16px',
          color: 'var(--lmn-ash-100)',
        }}
      >
        I PRONOSTICI DEGLI ALTRI
      </h3>
      {summary.total === 0 ? (
        <p style={{ color: 'var(--lmn-ash-400)', fontSize: 14, margin: 0 }}>
          Nessun pronostico su questa partita.
        </p>
      ) : (
        <>
          <p
            style={{
              fontFamily: 'var(--lmn-font-mono)',
              fontSize: 12,
              color: 'var(--lmn-ash-500)',
              margin: '0 0 14px',
            }}
          >
            {summary.total} pronostici totali
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {bars.map((b) => (
              <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  style={{
                    fontFamily: 'var(--lmn-font-display)',
                    fontSize: 20,
                    width: 20,
                    color: 'var(--lmn-gold-400)',
                  }}
                >
                  {b.label}
                </span>
                <div className="lmn-progress-track" style={{ flex: 1 }}>
                  <div className="lmn-progress-fill" style={{ width: `${b.pct}%` }} />
                </div>
                <span
                  style={{
                    fontFamily: 'var(--lmn-font-mono)',
                    fontSize: 12,
                    width: 48,
                    textAlign: 'right',
                    color: 'var(--lmn-ash-300)',
                  }}
                >
                  {b.pct}%
                </span>
              </div>
            ))}
          </div>
          {summary.top_scores.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div
                style={{
                  fontFamily: 'var(--lmn-font-ui)',
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--lmn-ash-500)',
                  marginBottom: 10,
                }}
              >
                Risultati più giocati
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {summary.top_scores.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 'var(--lmn-radius-md, 8px)',
                      background: 'var(--lmn-pitch-300, #232c48)',
                      fontFamily: 'var(--lmn-font-display)',
                      fontSize: 22,
                      color: 'var(--lmn-ash-100)',
                    }}
                  >
                    {s.home_score}–{s.away_score}
                    <span
                      style={{
                        fontFamily: 'var(--lmn-font-mono)',
                        fontSize: 11,
                        color: 'var(--lmn-ash-500)',
                        marginLeft: 8,
                      }}
                    >
                      ×{s.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ------------------------------------------------------------- Scorer picker
function scorerSelectStyle(disabled: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '9px 12px',
    background: 'var(--lmn-pitch-500, #182038)',
    border: '1px solid var(--lmn-ash-800, #283044)',
    borderRadius: 'var(--lmn-radius-md, 8px)',
    color: 'var(--lmn-ash-100)',
    fontFamily: 'var(--lmn-font-ui)',
    fontSize: 14,
    opacity: disabled ? 0.5 : 1,
  }
}

function ScorerSlots({
  teamLabel,
  players,
  values,
  onChange,
  disabled,
}: {
  teamLabel: string
  players: Player[]
  values: (number | '')[]
  onChange: (idx: number, v: number | '') => void
  disabled: boolean
}) {
  if (values.length === 0) return null
  const opt = (p: Player) =>
    `${p.shirt_number ?? '–'} · ${p.name}${p.position ? ` · ${p.position}` : ''}`
  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          fontFamily: 'var(--lmn-font-ui)',
          fontSize: 11,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--lmn-ash-400)',
          marginBottom: 6,
        }}
      >
        Marcatori {teamLabel} ({values.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {values.map((v, idx) => (
          <select
            key={idx}
            value={v}
            disabled={disabled}
            onChange={(e) => onChange(idx, e.target.value ? Number(e.target.value) : '')}
            style={scorerSelectStyle(disabled)}
          >
            <option value="">— Scegli marcatore #{idx + 1} —</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {opt(p)}
              </option>
            ))}
          </select>
        ))}
      </div>
    </div>
  )
}

// ------------------------------------------------------------- Page
export default function Predict() {
  const { matchId } = useParams()
  const id = Number(matchId)

  const [match, setMatch] = useState<Match | null>(null)
  const [home, setHome] = useState('')
  const [away, setAway] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const [summary, setSummary] = useState<MatchSummary | null>(null)
  const [homePlayers, setHomePlayers] = useState<Player[]>([])
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([])
  const [scorerHome, setScorerHome] = useState<(number | '')[]>([])
  const [scorerAway, setScorerAway] = useState<(number | '')[]>([])
  const [myScorer, setMyScorer] = useState<ScorerPrediction | null>(null)

  const countdown = useCountdown(match?.utc_date)
  const closed = useMemo(
    () =>
      match
        ? match.status === 'FINISHED' ||
          match.status === 'IN_PLAY' ||
          match.status === 'PAUSED' ||
          kickoffPassed(match.utc_date) ||
          countdown.expired
        : false,
    [match, countdown.expired],
  )

  useEffect(() => {
    getMatch(id).then(setMatch).catch(() => setMatch(null))
    getMyPredictions().then((preds) => {
      const mine = preds.find((p) => p.match_id === id)
      if (mine) {
        setHome(String(mine.home_score))
        setAway(String(mine.away_score))
      }
    })
    getMyScorerPredictions()
      .then((sps) => setMyScorer(sps.find((s) => s.match_id === id) ?? null))
      .catch(() => {})
  }, [id])

  // Carica le rose delle due squadre per il dropdown marcatore
  useEffect(() => {
    if (match?.home_team_tla) {
      getPlayers(match.home_team_tla).then(setHomePlayers).catch(() => setHomePlayers([]))
    }
    if (match?.away_team_tla) {
      getPlayers(match.away_team_tla).then(setAwayPlayers).catch(() => setAwayPlayers([]))
    }
  }, [match?.home_team_tla, match?.away_team_tla])

  // Slot marcatore = numero di gol previsti per squadra (preserva le scelte)
  useEffect(() => {
    const resize = (prev: (number | '')[], n: number) =>
      prev.length === n ? prev : Array.from({ length: n }, (_, i) => prev[i] ?? '')
    const hn = home === '' ? 0 : Number(home)
    const an = away === '' ? 0 : Number(away)
    setScorerHome((prev) => resize(prev, hn))
    setScorerAway((prev) => resize(prev, an))
  }, [home, away])

  // Pre-popola i marcatori salvati, suddivisi per squadra
  useEffect(() => {
    if (!myScorer || !match) return
    const h = myScorer.players.filter((p) => p.team_tla === match.home_team_tla).map((p) => p.player_id)
    const a = myScorer.players.filter((p) => p.team_tla === match.away_team_tla).map((p) => p.player_id)
    if (h.length) setScorerHome(h)
    if (a.length) setScorerAway(a)
  }, [myScorer, match])

  // Summary visibile solo dopo il kickoff
  useEffect(() => {
    if (match && closed) {
      getMatchSummary(id).then(setSummary).catch(() => setSummary(null))
    }
  }, [match, closed, id])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const handleConfirm = async () => {
    const hVal = home === '' ? 0 : Number(home)
    const aVal = away === '' ? 0 : Number(away)
    const slots = [...scorerHome, ...scorerAway]
    if (slots.some((v) => v === '')) {
      setToast({ kind: 'error', message: 'Seleziona tutti i marcatori previsti' })
      return
    }
    setSaving(true)
    try {
      await createPrediction(id, hVal, aVal)
      await createScorerPrediction(id, slots as number[])
      setToast({ kind: 'success', message: 'Pronostico confermato' })
    } catch (err) {
      const msg = err instanceof Error && err.message.includes('403')
        ? 'Pronostici chiusi per questa partita'
        : 'Errore, riprova'
      setToast({ kind: 'error', message: msg })
    } finally {
      setSaving(false)
    }
  }

  if (!match) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <span className="lmn-spinner" />
      </div>
    )
  }

  const multiplier = stageMultiplier(match.stage)
  const played = match.status !== 'TIMED' && match.status !== 'SCHEDULED'

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px 80px' }}>
      <BackButton />

      <div className="lmn-card" style={{ padding: 28, textAlign: 'center' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 10,
            marginBottom: 20,
            flexWrap: 'wrap',
          }}
        >
          <span className="lmn-badge lmn-badge--group">
            {groupLabel(match.group_name) || stageLabel(match.stage)}
          </span>
          {multiplier > 1 && <Badge variant="points">PUNTI x{multiplier}</Badge>}
          {match.status === 'IN_PLAY' || match.status === 'PAUSED' ? (
            <Badge variant="live" live>
              LIVE
            </Badge>
          ) : match.status === 'FINISHED' ? (
            <Badge variant="finished">Finita</Badge>
          ) : (
            <Badge variant="timed">{localTime(match.utc_date)}</Badge>
          )}
        </div>

        {/* Squadre + score input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            gap: 18,
          }}
        >
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            {match.home_team_crest ? (
              <img src={match.home_team_crest} alt="" style={{ width: 56, height: 56, objectFit: 'contain' }} />
            ) : (
              <span style={{ color: 'var(--lmn-ash-500)' }}>
                <Icon name="ball" size={48} />
              </span>
            )}
            <ScoreBox
              value={home}
              onChange={setHome}
              disabled={closed}
              label={match.home_team_name ?? 'Da definire'}
            />
          </div>
          <span
            style={{
              fontFamily: 'var(--lmn-font-display)',
              fontSize: 40,
              color: 'var(--lmn-ash-600)',
              marginTop: 70,
            }}
          >
            —
          </span>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            {match.away_team_crest ? (
              <img src={match.away_team_crest} alt="" style={{ width: 56, height: 56, objectFit: 'contain' }} />
            ) : (
              <span style={{ color: 'var(--lmn-ash-500)' }}>
                <Icon name="ball" size={48} />
              </span>
            )}
            <ScoreBox
              value={away}
              onChange={setAway}
              disabled={closed}
              label={match.away_team_name ?? 'Da definire'}
            />
          </div>
        </div>

        {/* Risultato reale per partite giocate */}
        {played && match.home_score != null && (
          <div
            style={{
              marginTop: 20,
              fontFamily: 'var(--lmn-font-display)',
              fontSize: 24,
              color: 'var(--lmn-ash-300)',
            }}
          >
            RISULTATO: {match.home_score} – {match.away_score}
          </div>
        )}

        {/* Marcatori previsti: tanti quanti i gol previsti per squadra */}
        {!closed && (scorerHome.length > 0 || scorerAway.length > 0) && (
          <div style={{ marginTop: 28, textAlign: 'left' }}>
            <div
              style={{
                fontFamily: 'var(--lmn-font-ui)',
                fontSize: 11,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--lmn-ash-500)',
                marginBottom: 4,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>Marcatori previsti</span>
              <span style={{ color: 'var(--lmn-gold-400)' }}>+2 ciascuno</span>
            </div>
            <ScorerSlots
              teamLabel={match.home_team_name ?? 'Casa'}
              players={homePlayers}
              values={scorerHome}
              onChange={(idx, v) =>
                setScorerHome((prev) => prev.map((x, i) => (i === idx ? v : x)))
              }
              disabled={closed}
            />
            <ScorerSlots
              teamLabel={match.away_team_name ?? 'Ospite'}
              players={awayPlayers}
              values={scorerAway}
              onChange={(idx, v) =>
                setScorerAway((prev) => prev.map((x, i) => (i === idx ? v : x)))
              }
              disabled={closed}
            />
          </div>
        )}

        {/* Countdown / chiusura */}
        <div style={{ marginTop: 24 }}>
          {closed ? (
            <div
              style={{
                fontFamily: 'var(--lmn-font-ui)',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--lmn-ember-400, #f59e0b)',
              }}
            >
              Pronostici chiusi
            </div>
          ) : (
            <>
              <div
                style={{
                  fontFamily: 'var(--lmn-font-ui)',
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--lmn-ash-500)',
                  marginBottom: 6,
                }}
              >
                Chiusura pronostici al calcio d'inizio
              </div>
              <div
                style={{
                  fontFamily: 'var(--lmn-font-mono)',
                  fontSize: 26,
                  color: 'var(--lmn-electric-400, #38bdf8)',
                }}
              >
                {countdown.label}
              </div>
            </>
          )}
        </div>

        {!closed && (
          <div style={{ marginTop: 24 }}>
            <Button onClick={handleConfirm} loading={saving} iconRight="prediction-arrow" size="lg">
              Conferma pronostico
            </Button>
          </div>
        )}
      </div>

      {closed && summary && <SummaryPanel summary={summary} />}

      {toast && <Toast kind={toast.kind} message={toast.message} />}
    </div>
  )
}
