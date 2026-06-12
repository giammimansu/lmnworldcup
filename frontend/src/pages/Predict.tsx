import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { getMatch, type Match } from '../api/matches'
import {
  createPrediction,
  createScorerPrediction,
  getMyPredictions,
  getMyScorerPredictions,
  type ScorerPrediction,
} from '../api/predictions'
import {
  getLeagueMatchPredictions,
  type League,
  type LeagueMatchPredictions,
} from '../api/leagues'
import { useLeagues } from '../leagues/LeagueContext'
import { getPlayers, type Player } from '../api/players'
import { Avatar, Badge, Button } from '../components/ui'
import { Icon } from '../components/Icon'
import { SearchSelect, type Option } from '../components/SearchSelect'
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
const MAX_SCORERS = 3 // marcatori pronosticabili per squadra (anche se i gol > 3)

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
// Badge punti: verde = esatto, ambra = segno, grigio = 0/sbagliato.
function pointsBadgeStyle(outcome: string): React.CSSProperties {
  if (outcome === 'exact')
    return { background: 'rgba(34,168,95,0.18)', color: 'var(--lmn-success-400)' }
  if (outcome === 'sign')
    return { background: 'rgba(212,168,67,0.18)', color: 'var(--lmn-gold-400)' }
  if (outcome === 'pending')
    return { background: 'var(--lmn-pitch-500, #182038)', color: 'var(--lmn-ash-400)' }
  return { background: 'var(--lmn-pitch-500, #182038)', color: 'var(--lmn-ash-500)' }
}

function SummaryPanel({
  data,
  leagues,
  selectedLeagueId,
  onSelectLeague,
}: {
  data: LeagueMatchPredictions
  leagues: League[]
  selectedLeagueId: string
  onSelectLeague: (id: string) => void
}) {
  const bars: { label: string; pct: number }[] = [
    { label: '1', pct: data.signs.home },
    { label: 'X', pct: data.signs.draw },
    { label: '2', pct: data.signs.away },
  ]
  const selectedName = leagues.find((l) => l.id === selectedLeagueId)?.name
  return (
    <div className="lmn-card" style={{ padding: 24, marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <h3
          style={{
            fontFamily: 'var(--lmn-font-display)',
            fontSize: 20,
            letterSpacing: '0.04em',
            margin: 0,
            color: 'var(--lmn-ash-100)',
          }}
        >
          I PRONOSTICI DELLA LEGA
        </h3>
        {leagues.length > 1 ? (
          <select
            value={selectedLeagueId}
            onChange={(e) => onSelectLeague(e.target.value)}
            style={{
              background: 'var(--lmn-pitch-500, #182038)',
              color: 'var(--lmn-ash-100)',
              border: '1px solid var(--lmn-ash-800, #283044)',
              borderRadius: 8,
              padding: '6px 10px',
              fontFamily: 'var(--lmn-font-ui)',
              fontSize: 13,
              maxWidth: 160,
            }}
          >
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        ) : selectedName ? (
          <span style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 12, color: 'var(--lmn-gold-400)', whiteSpace: 'nowrap' }}>
            {selectedName}
          </span>
        ) : null}
      </div>
      {data.total === 0 ? (
        <p style={{ color: 'var(--lmn-ash-400)', fontSize: 14, margin: 0 }}>
          Nessun pronostico in questa lega su questa partita.
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
            {data.total} pronostici nella lega
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
          {data.top_scores.length > 0 && (
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
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {data.top_scores.map((s, i) => (
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

          {/* Pronostici di ogni membro della lega */}
          <div style={{ marginTop: 22 }}>
            <div
              style={{
                fontFamily: 'var(--lmn-font-ui)',
                fontSize: 11,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--lmn-ash-500)',
                marginBottom: 12,
              }}
            >
              Tutti i pronostici
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.predictions.map((p) => {
                const pending = p.outcome === 'pending'
                const resultPts = p.points || 0
                const scorerPts = p.scorer_points ?? 0
                const total = resultPts + scorerPts
                return (
                <div
                  key={p.user_id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: '10px 0',
                    borderBottom: '1px solid var(--lmn-ash-900, #1c2438)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={p.display_name} size="sm" />
                    <span style={{ flex: 1, fontSize: 13, color: 'var(--lmn-ash-200)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.display_name}
                    </span>
                    <span style={{ fontFamily: 'var(--lmn-font-mono)', fontSize: 14, color: 'var(--lmn-ash-100)', minWidth: 44, textAlign: 'center' }}>
                      {p.home_score}–{p.away_score}
                    </span>
                    {/* Totale punti del pronostico (risultato + marcatori) */}
                    <span
                      style={{
                        fontFamily: 'var(--lmn-font-display)',
                        fontSize: 18,
                        lineHeight: 1,
                        minWidth: 46,
                        textAlign: 'right',
                        color: pending
                          ? 'var(--lmn-ash-500)'
                          : total > 0
                            ? 'var(--lmn-gold-400)'
                            : 'var(--lmn-ash-500)',
                      }}
                    >
                      {pending ? '—' : total}
                      {!pending && (
                        <span style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 9, letterSpacing: '0.06em', color: 'var(--lmn-ash-500)', marginLeft: 3 }}>
                          PT
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Dettaglio punti: risultato + marcatori, sempre etichettati */}
                  {!pending && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 38 }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          fontFamily: 'var(--lmn-font-ui)',
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: 6,
                          ...pointsBadgeStyle(p.outcome),
                        }}
                      >
                        Risultato {resultPts > 0 ? `+${resultPts}` : '0'}
                      </span>
                      {p.scorer_names && p.scorer_names.length > 0 && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            fontFamily: 'var(--lmn-font-ui)',
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: scorerPts > 0 ? 'rgba(34,168,95,0.18)' : 'var(--lmn-pitch-500, #182038)',
                            color: scorerPts > 0 ? 'var(--lmn-success-400)' : 'var(--lmn-ash-500)',
                          }}
                          title={p.scorer_names.join(', ')}
                        >
                          ⚽ Marcatori {scorerPts > 0 ? `+${scorerPts}` : '0'}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Nomi marcatori previsti */}
                  {p.scorer_names && p.scorer_names.length > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--lmn-ash-500)', paddingLeft: 38 }}>
                      {p.scorer_names.join(', ')}
                    </div>
                  )}
                </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ------------------------------------------------------------- Scorer picker
function ScorerSlots({
  teamLabel,
  players,
  crest,
  values,
  onChange,
  disabled,
}: {
  teamLabel: string
  players: Player[]
  crest?: string | null
  values: (number | '')[]
  onChange: (idx: number, v: number | '') => void
  disabled: boolean
}) {
  if (values.length === 0) return null
  // Stesso dropdown cercabile dei pronostici di torneo: ricerca, scroll fluido,
  // icona squadra. I duplicati sono ammessi (doppietta) -> nessun exclude.
  const options: Option[] = players.map((p) => ({
    value: String(p.id),
    label: `${p.name}${p.position ? ` · ${p.position}` : ''}`,
    hint: p.shirt_number != null ? `#${p.shirt_number}` : undefined,
    icon: crest ?? null,
  }))
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
          <SearchSelect
            key={idx}
            options={options}
            value={v === '' ? null : String(v)}
            onChange={(val) => onChange(idx, Number(val))}
            placeholder={`Marcatore #${idx + 1}`}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  )
}

// ------------------------------------------------------------- Page
export default function Predict() {
  const { matchId } = useParams()
  const id = Number(matchId)
  const { current, leagues } = useLeagues()
  // Lega di cui vedere i pronostici: default = lega corrente, cambiabile via dropdown.
  const [viewLeagueId, setViewLeagueId] = useState<string | null>(null)
  const viewLeague = leagues.find((l) => l.id === viewLeagueId) ?? current

  const [match, setMatch] = useState<Match | null>(null)
  const [home, setHome] = useState('')
  const [away, setAway] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const [summary, setSummary] = useState<LeagueMatchPredictions | null>(null)
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

  // Slot marcatore = gol previsti per squadra, ma al massimo MAX_SCORERS (un 5-5
  // chiede comunque solo 3 marcatori per lato). Preserva le scelte.
  useEffect(() => {
    const resize = (prev: (number | '')[], n: number) =>
      prev.length === n ? prev : Array.from({ length: n }, (_, i) => prev[i] ?? '')
    const hn = Math.min(home === '' ? 0 : Number(home), MAX_SCORERS)
    const an = Math.min(away === '' ? 0 : Number(away), MAX_SCORERS)
    setScorerHome((prev) => resize(prev, hn))
    setScorerAway((prev) => resize(prev, an))
  }, [home, away])

  // Pre-popola i marcatori salvati, suddivisi per squadra
  useEffect(() => {
    if (!myScorer || !match) return
    const h = myScorer.players.filter((p) => p.team_tla === match.home_team_tla).map((p) => p.player_id).slice(0, MAX_SCORERS)
    const a = myScorer.players.filter((p) => p.team_tla === match.away_team_tla).map((p) => p.player_id).slice(0, MAX_SCORERS)
    if (h.length) setScorerHome(h)
    if (a.length) setScorerAway(a)
  }, [myScorer, match])

  // Allinea la lega visualizzata a quella corrente al primo caricamento.
  useEffect(() => {
    if (current && viewLeagueId === null) setViewLeagueId(current.id)
  }, [current, viewLeagueId])

  // Pronostici della lega: visibili solo dopo il kickoff e con una lega selezionata
  useEffect(() => {
    if (match && closed && viewLeague) {
      getLeagueMatchPredictions(viewLeague.id, id)
        .then(setSummary)
        .catch(() => setSummary(null))
    } else {
      setSummary(null)
    }
  }, [match, closed, id, viewLeague?.id])

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
            {(Number(home) > MAX_SCORERS || Number(away) > MAX_SCORERS) && (
              <div style={{ fontSize: 11, color: 'var(--lmn-ash-500)', marginBottom: 8 }}>
                Massimo {MAX_SCORERS} marcatori per squadra, anche con più gol previsti.
              </div>
            )}
            <ScorerSlots
              teamLabel={match.home_team_name ?? 'Casa'}
              players={homePlayers}
              crest={match.home_team_crest}
              values={scorerHome}
              onChange={(idx, v) =>
                setScorerHome((prev) => prev.map((x, i) => (i === idx ? v : x)))
              }
              disabled={closed}
            />
            <ScorerSlots
              teamLabel={match.away_team_name ?? 'Ospite'}
              players={awayPlayers}
              crest={match.away_team_crest}
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

      {closed && summary && (
        <SummaryPanel
          data={summary}
          leagues={leagues}
          selectedLeagueId={viewLeague?.id ?? ''}
          onSelectLeague={setViewLeagueId}
        />
      )}

      {toast && <Toast kind={toast.kind} message={toast.message} />}
    </div>
  )
}
