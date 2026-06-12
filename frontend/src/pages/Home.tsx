import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type LeaderboardRow } from '../api/leaderboard'
import { getLeagueLeaderboard } from '../api/leagues'
import { getRecap, type Recap } from '../api/recap'
import { getMatches, type Match } from '../api/matches'
import { getSpecialQuestions } from '../api/special'
import { useAuth } from '../auth/AuthContext'
import { useLeagues } from '../leagues/LeagueContext'
import { Avatar, Button } from '../components/ui'
import { Icon } from '../components/Icon'
import { groupLabel, stageLabel } from '../lib/stages'

// ------------------------------------------------------------- Countdown
function useCountdown(target: string | undefined) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  if (!target) return ''
  const diff = new Date(target).getTime() - now
  if (diff <= 0) return 'IN CORSO'
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return d > 0 ? `${d}g ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`
}

// ------------------------------------------------------------- Next match
function NextMatchWidget() {
  const navigate = useNavigate()
  const [next, setNext] = useState<Match | null>(null)
  const countdown = useCountdown(next?.utc_date)

  useEffect(() => {
    // Prossima partita: prima TIMED/SCHEDULED nel futuro (lista già ordinata per utc_date)
    getMatches({})
      .then((matches) => {
        const upcoming = matches.find(
          (m) =>
            (m.status === 'TIMED' || m.status === 'SCHEDULED') &&
            new Date(m.utc_date).getTime() > Date.now(),
        )
        if (upcoming) setNext(upcoming)
      })
      .catch(() => {})
  }, [])

  if (!next) return null

  return (
    <div
      className="lmn-card lmn-card--hoverable"
      style={{ padding: 18, marginBottom: 24, cursor: 'pointer' }}
      onClick={() => navigate(`/match/${next.id}`)}
    >
      <div
        style={{
          fontFamily: 'var(--lmn-font-ui)',
          fontSize: 11,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--lmn-ash-500)',
          marginBottom: 10,
        }}
      >
        Prossima partita · {groupLabel(next.group_name) || stageLabel(next.stage)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          {next.home_team_crest && (
            <img src={next.home_team_crest} alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />
          )}
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--lmn-ash-100)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {next.home_team_name ?? 'Da definire'}
          </span>
        </div>
        <span
          style={{
            fontFamily: 'var(--lmn-font-mono)',
            fontSize: 16,
            color: 'var(--lmn-electric-400, #38bdf8)',
            padding: '0 12px',
            whiteSpace: 'nowrap',
          }}
        >
          {countdown}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--lmn-ash-100)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {next.away_team_name ?? 'Da definire'}
          </span>
          {next.away_team_crest && (
            <img src={next.away_team_crest} alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />
          )}
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------- Trend arrow
function Trend({ value }: { value: number }) {
  if (value > 0)
    return <span style={{ color: 'var(--lmn-success-400)', fontSize: 12 }}>▲ {value}</span>
  if (value < 0)
    return <span style={{ color: 'var(--lmn-danger-400)', fontSize: 12 }}>▼ {Math.abs(value)}</span>
  return <span style={{ color: 'var(--lmn-ash-500)', fontSize: 12 }}>–</span>
}

// ------------------------------------------------------------- Recap giornata
// Lista delle partite concluse della giornata: tap -> dettaglio /match/:id
// (dove si vedono i pronostici di tutta la lega).
function RecapMatchCard({ match }: { match: Recap['matches'][number] }) {
  const navigate = useNavigate()
  return (
    <div
      className="lmn-card lmn-card--hoverable"
      onClick={() => navigate(`/match/${match.id}`)}
      style={{ padding: 16, marginBottom: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
    >
      {/* Risultato reale */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--lmn-ash-100)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {match.home_team_name ?? '—'}
          </span>
          {match.home_team_crest && <img src={match.home_team_crest} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />}
        </div>
        <span style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 26, color: 'var(--lmn-ash-100)', whiteSpace: 'nowrap' }}>
          {match.home_score}–{match.away_score}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          {match.away_team_crest && <img src={match.away_team_crest} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />}
          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--lmn-ash-100)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {match.away_team_name ?? '—'}
          </span>
        </div>
      </div>
      <span style={{ color: 'var(--lmn-ash-500)', fontSize: 18, flexShrink: 0 }}>›</span>
    </div>
  )
}

function LeagueRecap({ leagueId }: { leagueId: string }) {
  const [recap, setRecap] = useState<Recap | null>(null)
  const [md, setMd] = useState<number | undefined>(undefined) // undefined = ultima giornata
  const [latest, setLatest] = useState<number | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')

  useEffect(() => {
    setMd(undefined)
  }, [leagueId])

  useEffect(() => {
    let alive = true
    setState('loading')
    getRecap(leagueId, md)
      .then((data) => {
        if (!alive) return
        setRecap(data)
        // Memorizza la giornata più recente (primo caricamento senza md esplicito).
        setLatest((cur) => (md === undefined && data.matchday != null ? data.matchday : cur))
        setState('ok')
      })
      .catch(() => alive && setState('error'))
    return () => {
      alive = false
    }
  }, [leagueId, md])

  if (state === 'loading')
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
        <span className="lmn-spinner" />
      </div>
    )
  if (state === 'error') return null

  // Pre-torneo: nessuna giornata conclusa.
  if (!recap || recap.matchday === null)
    return (
      <div className="lmn-card" style={{ padding: 28, textAlign: 'center' }}>
        <span style={{ color: 'var(--lmn-ash-500)' }}>
          <Icon name="whistle" size={28} />
        </span>
        <p style={{ color: 'var(--lmn-ash-400)', marginTop: 12, marginBottom: 0, fontSize: 14 }}>
          Il recap apparirà dopo le prime partite concluse.
        </p>
      </div>
    )

  const current = recap.matchday
  const canPrev = current > 1
  const canNext = latest != null && current < latest

  return (
    <div>
      {/* Header con selettore giornata */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 22, letterSpacing: '0.04em', margin: 0, color: 'var(--lmn-ash-100)' }}>
          RECAP GIORNATA {current}
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" size="sm" disabled={!canPrev} onClick={() => setMd(current - 1)}>
            ‹
          </Button>
          <Button variant="ghost" size="sm" disabled={!canNext} onClick={() => setMd(current + 1)}>
            ›
          </Button>
        </div>
      </div>

      {recap.matches.length === 0 ? (
        <div className="lmn-card" style={{ padding: 24, textAlign: 'center', color: 'var(--lmn-ash-500)', fontSize: 14 }}>
          Nessuna partita conclusa in questa giornata.
        </div>
      ) : (
        recap.matches.map((m) => <RecapMatchCard key={m.id} match={m} />)
      )}
    </div>
  )
}

// ------------------------------------------------------------- Page
export default function Home() {
  const { user, signOut, isAdmin } = useAuth()
  const { leagues, current, loading: leaguesLoading, setCurrent } = useLeagues()
  const navigate = useNavigate()
  const [board, setBoard] = useState<LeaderboardRow[]>([])
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [specialDeadline, setSpecialDeadline] = useState<string>()
  const specialCountdown = useCountdown(specialDeadline)

  // Scadenza pronostici di torneo (la più vicina) per il countdown nel banner.
  useEffect(() => {
    getSpecialQuestions()
      .then((qs) => {
        if (qs.length) setSpecialDeadline(qs.map((q) => q.deadline).sort()[0])
      })
      .catch(() => {})
  }, [])

  // Classifica ristretta alla lega selezionata. Polling ogni 60s.
  useEffect(() => {
    if (leaguesLoading) return
    if (!current) {
      setBoard([])
      setState('ok')
      return
    }
    let alive = true
    const load = () =>
      getLeagueLeaderboard(current.id)
        .then((data) => {
          if (!alive) return
          setBoard(data)
          setState('ok')
        })
        .catch(() => alive && setState('error'))
    setState('loading')
    load()
    const t = setInterval(load, 60_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [current?.id, leaguesLoading])

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px 96px' }}>
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
          {isAdmin && (
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin')}>
              Admin
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => navigate('/regole')}>
            Regole
          </Button>
          <Button variant="ghost" size="sm" onClick={signOut}>
            Esci
          </Button>
        </div>
      </header>

      <NextMatchWidget />

      <div
        className="lmn-card lmn-card--hoverable"
        onClick={() => navigate('/special')}
        style={{
          padding: 16,
          marginBottom: 24,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          border: '1px solid var(--lmn-gold-600)',
          background: 'linear-gradient(180deg, rgba(212,168,67,0.10), rgba(212,168,67,0.02))',
        }}
      >
        <span style={{ color: 'var(--lmn-gold-400)' }}>
          <Icon name="star" size={24} filled />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--lmn-font-ui)', fontWeight: 600, fontSize: 14, color: 'var(--lmn-ash-100)' }}>
            Pronostici di torneo
          </div>
          <div style={{ fontSize: 12, color: 'var(--lmn-ash-400)', marginTop: 2 }}>
            Capocannoniere, podio e altro — valgono tanti punti.
          </div>
          {specialCountdown && (
            <div style={{ fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 5, color: 'var(--lmn-ash-400)' }}>
              <Icon name="clock" size={13} />
              {specialCountdown === 'IN CORSO' ? (
                <span>Pronostici chiusi</span>
              ) : (
                <span>
                  Chiusura tra{' '}
                  <span style={{ fontFamily: 'var(--lmn-font-mono)', color: 'var(--lmn-gold-400)', fontWeight: 600 }}>
                    {specialCountdown}
                  </span>
                </span>
              )}
            </div>
          )}
          <div
            onClick={(e) => {
              e.stopPropagation()
              navigate('/special?view=league')
            }}
            style={{
              fontSize: 12,
              marginTop: 8,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              color: 'var(--lmn-gold-400)',
              fontFamily: 'var(--lmn-font-ui)',
              fontWeight: 600,
            }}
          >
            <Icon name="shield" size={13} />
            Vedi i pronostici dei tuoi avversari ›
          </div>
        </div>
        <span style={{ color: 'var(--lmn-ash-500)' }}>›</span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          margin: '0 0 20px',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--lmn-font-display)',
            fontSize: 32,
            letterSpacing: '0.04em',
            margin: 0,
            color: 'var(--lmn-ash-100)',
          }}
        >
          CLASSIFICA
        </h1>
        {/* Selettore lega: dropdown se più leghe, solo nome se una sola. */}
        {leagues.length > 1 ? (
          <select
            value={current?.id ?? ''}
            onChange={(e) => {
              const l = leagues.find((x) => x.id === e.target.value)
              if (l) setCurrent(l)
            }}
            style={{
              background: 'var(--lmn-pitch-500, #182038)',
              color: 'var(--lmn-ash-100)',
              border: '1px solid var(--lmn-ash-800, #283044)',
              borderRadius: 8,
              padding: '8px 12px',
              fontFamily: 'var(--lmn-font-ui)',
              fontSize: 13,
              maxWidth: 180,
            }}
          >
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        ) : current ? (
          <span
            onClick={() => navigate('/leagues')}
            style={{
              fontFamily: 'var(--lmn-font-ui)',
              fontSize: 13,
              color: 'var(--lmn-gold-400)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {current.name}
          </span>
        ) : null}
      </div>

      {/* Nessuna lega: invito a crearne/unirsi a una. */}
      {!leaguesLoading && leagues.length === 0 && (
        <div className="lmn-card" style={{ padding: 32, textAlign: 'center' }}>
          <span style={{ color: 'var(--lmn-gold-500)' }}>
            <Icon name="shield" size={32} />
          </span>
          <p style={{ color: 'var(--lmn-ash-400)', margin: '12px 0 16px' }}>
            Non sei ancora in nessuna lega. Creane una o unisciti con un codice.
          </p>
          <Button onClick={() => navigate('/leagues')} iconRight="trophy">
            Le mie leghe
          </Button>
        </div>
      )}

      {leagues.length > 0 && state === 'loading' && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <span className="lmn-spinner" />
        </div>
      )}

      {state === 'error' && (
        <div className="lmn-card" style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ color: 'var(--lmn-danger-400)', margin: 0 }}>Errore nel caricamento.</p>
        </div>
      )}

      {leagues.length > 0 && state === 'ok' && board.length === 0 && (
        <div className="lmn-card" style={{ padding: 32, textAlign: 'center' }}>
          <span style={{ color: 'var(--lmn-ash-500)' }}>
            <Icon name="trophy" size={32} />
          </span>
          <p style={{ color: 'var(--lmn-ash-400)', marginTop: 12, marginBottom: 0 }}>
            Nessun partecipante ancora.
          </p>
        </div>
      )}

      {state === 'ok' && board.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {board.map((row) => {
            const isMe = row.user_id === user?.id
            return (
              <div
                key={row.user_id}
                className="lmn-card lmn-card--hoverable"
                onClick={() => navigate(isMe ? '/profile' : `/profile/${row.user_id}`)}
                style={{
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                  border: isMe ? '1px solid var(--lmn-gold-600)' : undefined,
                  background: isMe ? 'rgba(212,168,67,0.07)' : undefined,
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--lmn-font-display)',
                    fontSize: 22,
                    color: row.position <= 3 ? 'var(--lmn-gold-500)' : 'var(--lmn-ash-500)',
                    width: 28,
                    textAlign: 'center',
                  }}
                >
                  {row.position}
                </span>
                <Avatar name={row.display_name} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: 'var(--lmn-font-ui)',
                      fontWeight: 600,
                      fontSize: 14,
                      color: 'var(--lmn-ash-100)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.display_name}
                    {isMe && (
                      <span style={{ color: 'var(--lmn-gold-400)', fontSize: 11, marginLeft: 6 }}>TU</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--lmn-ash-500)' }}>
                    {row.accuracy}% precisione · {row.exact_count} esatti
                  </div>
                </div>
                <Trend value={row.trend} />
                <div style={{ textAlign: 'right', minWidth: 48 }}>
                  <div
                    style={{
                      fontFamily: 'var(--lmn-font-display)',
                      fontSize: 22,
                      color: 'var(--lmn-gold-400)',
                      lineHeight: 1,
                    }}
                  >
                    {row.points}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'var(--lmn-ash-500)',
                    }}
                  >
                    punti
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Recap dell'ultima giornata conclusa (sola lettura) */}
      {leagues.length > 0 && current && (
        <div style={{ marginTop: 36 }}>
          <LeagueRecap leagueId={current.id} />
        </div>
      )}

    </div>
  )
}
