import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  answerSpecial,
  getSpecialQuestions,
  getTeams,
  type SpecialAnswerValue,
  type SpecialQuestion,
  type Team,
} from '../api/special'
import { getAllPlayers, type Player } from '../api/players'
import {
  getLeagueSpecial,
  type LeagueSpecialQuestion,
} from '../api/leagues'
import { useLeagues } from '../leagues/LeagueContext'
import { Avatar, Badge, Button } from '../components/ui'
import { Icon } from '../components/Icon'
import { SearchSelect, type Option } from '../components/SearchSelect'
import BackButton from '../components/BackButton'

// Countdown alla scadenza dei pronostici di torneo.
function useCountdown(target: string | undefined) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  if (!target) return null
  const diff = new Date(target).getTime() - now
  if (diff <= 0) return 'closed'
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return d > 0 ? `${d}g ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`
}

// --------------------------------------------------------------- helpers
function teamLabel(teams: Team[], tla: string | undefined | null): string {
  if (!tla) return '—'
  return teams.find((t) => t.team_tla === tla)?.team_name ?? tla
}

function playerLabel(players: Player[], id: number | undefined | null): string {
  if (!id) return '—'
  const p = players.find((x) => x.id === id)
  return p ? `${p.name}${p.team_tla ? ` (${p.team_tla})` : ''}` : `#${id}`
}

function formatAnswer(
  qtype: 'team' | 'player' | 'podium',
  answer: { team_tla?: string; player_id?: number; podium?: string[] } | null,
  teams: Team[],
  players: Player[],
): string {
  if (!answer) return '—'
  if (qtype === 'team') return teamLabel(teams, answer.team_tla)
  if (qtype === 'player') return playerLabel(players, answer.player_id)
  if (qtype === 'podium')
    return (answer.podium ?? []).map((t) => teamLabel(teams, t)).join(' · ')
  return '—'
}

// --------------------------------------------------------------- Vista lega
function LeagueQuestionCard({
  q,
  teams,
  players,
}: {
  q: LeagueSpecialQuestion
  teams: Team[]
  players: Player[]
}) {
  return (
    <div className="lmn-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ fontFamily: 'var(--lmn-font-ui)', fontWeight: 600, fontSize: 16, color: 'var(--lmn-ash-100)' }}>
            {q.title}
          </div>
          <div style={{ fontSize: 12, color: 'var(--lmn-ash-500)', marginTop: 2 }}>
            {q.qtype === 'podium' ? `${q.points} punti per posizione esatta` : `${q.points} punti`}
          </div>
        </div>
        {q.resolved ? (
          <Badge variant="esatto">Risolta</Badge>
        ) : q.open ? (
          <Badge variant="points">Aperta</Badge>
        ) : (
          <Badge variant="finished">Chiusa</Badge>
        )}
      </div>

      {/* Risposta corretta se risolta */}
      {q.resolved && q.correct_answer && (
        <div style={{ fontSize: 13, color: 'var(--lmn-ash-400)' }}>
          Risposta corretta:{' '}
          <span style={{ color: 'var(--lmn-success-400)' }}>
            {formatAnswer(q.qtype, q.correct_answer, teams, players)}
          </span>
        </div>
      )}

      {/* Domanda ancora aperta: risposte nascoste */}
      {q.open ? (
        <div style={{ fontSize: 13, color: 'var(--lmn-ash-500)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="clock" size={15} />
          Risposte nascoste fino alla scadenza · {q.answered_count}/{q.member_count} hanno risposto
        </div>
      ) : q.answers.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--lmn-ash-500)' }}>Nessuna risposta in questa lega.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {q.answers.map((a) => (
            <div key={a.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar name={a.display_name} size="sm" />
              <span style={{ flex: 1, fontSize: 13, color: 'var(--lmn-ash-200)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.display_name}
              </span>
              <span style={{ fontSize: 13, color: 'var(--lmn-ash-300)', textAlign: 'right', maxWidth: '50%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {formatAnswer(q.qtype, a.answer, teams, players)}
              </span>
              {q.resolved && (
                <span
                  style={{
                    fontFamily: 'var(--lmn-font-ui)',
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 6,
                    minWidth: 40,
                    textAlign: 'center',
                    background: (a.points ?? 0) > 0 ? 'rgba(34,168,95,0.18)' : 'var(--lmn-pitch-500, #182038)',
                    color: (a.points ?? 0) > 0 ? 'var(--lmn-success-400)' : 'var(--lmn-ash-500)',
                  }}
                >
                  {(a.points ?? 0) > 0 ? `+${a.points}` : '0'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function LeagueSpecialView({ teams, players }: { teams: Team[]; players: Player[] }) {
  const { leagues, current } = useLeagues()
  const [viewLeagueId, setViewLeagueId] = useState<string | null>(null)
  const viewLeague = leagues.find((l) => l.id === viewLeagueId) ?? current
  const [questions, setQuestions] = useState<LeagueSpecialQuestion[]>([])
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')

  useEffect(() => {
    if (current && viewLeagueId === null) setViewLeagueId(current.id)
  }, [current, viewLeagueId])

  useEffect(() => {
    if (!viewLeague) return
    setState('loading')
    let alive = true
    getLeagueSpecial(viewLeague.id)
      .then((r) => alive && (setQuestions(r.questions), setState('ok')))
      .catch(() => alive && setState('error'))
    return () => {
      alive = false
    }
  }, [viewLeague?.id])

  if (!viewLeague)
    return (
      <div className="lmn-card" style={{ padding: 24, textAlign: 'center', color: 'var(--lmn-ash-400)' }}>
        Non sei in nessuna lega.
      </div>
    )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Selettore lega */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        {leagues.length > 1 ? (
          <select
            value={viewLeague.id}
            onChange={(e) => setViewLeagueId(e.target.value)}
            style={{
              background: 'var(--lmn-pitch-500, #182038)',
              color: 'var(--lmn-ash-100)',
              border: '1px solid var(--lmn-ash-800, #283044)',
              borderRadius: 8,
              padding: '6px 10px',
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
        ) : (
          <span style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 12, color: 'var(--lmn-gold-400)' }}>
            {viewLeague.name}
          </span>
        )}
      </div>

      {state === 'loading' && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <span className="lmn-spinner" />
        </div>
      )}
      {state === 'error' && (
        <div className="lmn-card" style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ color: 'var(--lmn-danger-400)', margin: 0 }}>Errore nel caricamento.</p>
        </div>
      )}
      {state === 'ok' &&
        questions.map((q) => (
          <LeagueQuestionCard key={q.code} q={q} teams={teams} players={players} />
        ))}
    </div>
  )
}

// --------------------------------------------------------------- QuestionCard
function QuestionCard({
  q,
  teams,
  players,
  onSaved,
}: {
  q: SpecialQuestion
  teams: Team[]
  players: Player[]
  onSaved: () => void
}) {
  // Bozza locale inizializzata dalla risposta salvata.
  const [draft, setDraft] = useState<SpecialAnswerValue>(() => q.my_answer ?? {})
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const locked = !q.open
  const crestByTla = useMemo(() => {
    const m: Record<string, string | null> = {}
    for (const t of teams) m[t.team_tla] = t.team_crest
    return m
  }, [teams])
  const teamOptions: Option[] = useMemo(
    () => teams.map((t) => ({ value: t.team_tla, label: t.team_name, hint: t.team_tla, icon: t.team_crest })),
    [teams],
  )
  const playerOptions: Option[] = useMemo(
    () =>
      players.map((p) => ({
        value: String(p.id),
        // label include il nome nazionale così la ricerca trova anche per squadra.
        label: `${p.name}${p.team_name ? ` · ${p.team_name}` : ''}`,
        hint: p.team_tla ?? undefined,
        icon: p.team_tla ? crestByTla[p.team_tla] : null,
      })),
    [players, crestByTla],
  )

  const canSave = (() => {
    if (q.qtype === 'team') return !!draft.team_tla
    if (q.qtype === 'player') return !!draft.player_id
    if (q.qtype === 'podium') {
      const p = draft.podium ?? []
      return p.length === 3 && p.every(Boolean) && new Set(p).size === 3
    }
    return false
  })()

  const save = async () => {
    setSaving(true)
    setErr(null)
    try {
      await answerSpecial(q.code, draft)
      onSaved()
    } catch (e) {
      setErr((e as Error).message || 'Errore nel salvataggio')
    } finally {
      setSaving(false)
    }
  }

  const setPodium = (i: number, tla: string) => {
    const p = [...(draft.podium ?? ['', '', ''])]
    p[i] = tla
    setDraft({ ...draft, podium: p })
  }

  return (
    <div className="lmn-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div
            style={{
              fontFamily: 'var(--lmn-font-ui)',
              fontWeight: 600,
              fontSize: 16,
              color: 'var(--lmn-ash-100)',
            }}
          >
            {q.title}
          </div>
          <div style={{ fontSize: 12, color: 'var(--lmn-ash-500)', marginTop: 2 }}>
            {q.qtype === 'podium' ? `${q.points} punti per posizione esatta` : `${q.points} punti`}
          </div>
        </div>
        {q.resolved ? (
          <Badge variant={q.my_points ? 'esatto' : 'sbagliato'}>
            {q.my_points ?? 0} pt
          </Badge>
        ) : locked ? (
          <Badge variant="finished">Chiuso</Badge>
        ) : (
          <Badge variant="points">{q.points} pt</Badge>
        )}
      </div>

      {/* Input per tipo */}
      {q.qtype === 'team' && (
        <SearchSelect
          options={teamOptions}
          value={draft.team_tla ?? null}
          onChange={(v) => setDraft({ team_tla: v })}
          placeholder="Scegli una squadra"
          disabled={locked}
        />
      )}

      {q.qtype === 'player' && (
        <SearchSelect
          options={playerOptions}
          value={draft.player_id ? String(draft.player_id) : null}
          onChange={(v) => setDraft({ player_id: Number(v) })}
          placeholder="Scegli un giocatore"
          disabled={locked}
        />
      )}

      {q.qtype === 'podium' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  width: 22,
                  fontFamily: 'var(--lmn-font-display)',
                  fontSize: 18,
                  color: 'var(--lmn-gold-400)',
                  flexShrink: 0,
                }}
              >
                {i + 1}°
              </span>
              <div style={{ flex: 1 }}>
                <SearchSelect
                  options={teamOptions}
                  value={(draft.podium ?? [])[i] || null}
                  onChange={(v) => setPodium(i, v)}
                  placeholder={`${i + 1}ª classificata`}
                  disabled={locked}
                  exclude={new Set((draft.podium ?? []).filter((_, j) => j !== i).filter(Boolean))}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Risposta corretta dopo la risoluzione */}
      {q.resolved && q.correct_answer && (
        <div style={{ fontSize: 13, color: 'var(--lmn-ash-400)' }}>
          Risposta corretta:{' '}
          <span style={{ color: 'var(--lmn-success-400)' }}>
            {q.qtype === 'team' && teamLabel(teams, q.correct_answer.team_tla)}
            {q.qtype === 'player' && playerLabel(players, q.correct_answer.player_id)}
            {q.qtype === 'podium' &&
              (q.correct_answer.podium ?? []).map((t) => teamLabel(teams, t)).join(' · ')}
          </span>
        </div>
      )}

      {err && <div style={{ fontSize: 13, color: 'var(--lmn-danger-400)' }}>{err}</div>}

      {!locked && (
        <Button variant="primary" size="md" onClick={save} loading={saving} disabled={!canSave}>
          {q.my_answer ? 'Aggiorna' : 'Salva'}
        </Button>
      )}
    </div>
  )
}

// --------------------------------------------------------------- Page
export default function Special() {
  const [questions, setQuestions] = useState<SpecialQuestion[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [searchParams] = useSearchParams()
  const [view, setView] = useState<'mine' | 'league'>(
    searchParams.get('view') === 'league' ? 'league' : 'mine',
  )

  const load = () =>
    Promise.all([getSpecialQuestions(), getTeams(), getAllPlayers()])
      .then(([qs, ts, ps]) => {
        setQuestions(qs)
        setTeams(ts)
        setPlayers(ps)
        setState('ok')
      })
      .catch(() => setState('error'))

  useEffect(() => {
    load()
  }, [])

  // Scadenza = la più vicina tra le domande (di norma tutte uguali: primo kickoff).
  const deadline = useMemo(
    () =>
      questions.length
        ? questions.map((q) => q.deadline).sort()[0]
        : undefined,
    [questions],
  )
  const countdown = useCountdown(deadline)

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px 96px' }}>
      <BackButton to="/" />

      <h1
        style={{
          fontFamily: 'var(--lmn-font-display)',
          fontSize: 32,
          letterSpacing: '0.04em',
          margin: '0 0 6px',
          color: 'var(--lmn-ash-100)',
        }}
      >
        PRONOSTICI TORNEO
      </h1>
      <p style={{ color: 'var(--lmn-ash-400)', fontSize: 14, margin: '0 0 16px' }}>
        Pronostici speciali da fare una volta sola, prima del fischio d'inizio. Valgono tanti
        punti: scegli bene.
      </p>

      {/* Toggle vista: i miei pronostici vs quelli della lega */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['mine', 'league'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 8,
              border: view === v ? '1px solid var(--lmn-gold-600)' : '1px solid var(--lmn-ash-800, #283044)',
              background: view === v ? 'rgba(212,168,67,0.10)' : 'var(--lmn-pitch-500, #182038)',
              color: view === v ? 'var(--lmn-gold-400)' : 'var(--lmn-ash-300)',
              fontFamily: 'var(--lmn-font-ui)',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {v === 'mine' ? 'I miei pronostici' : 'La lega'}
          </button>
        ))}
      </div>

      {view === 'league' && <LeagueSpecialView teams={teams} players={players} />}

      {view === 'mine' && countdown && (
        <div
          className="lmn-card"
          style={{
            padding: '12px 16px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            border: countdown === 'closed' ? undefined : '1px solid var(--lmn-gold-600)',
          }}
        >
          <span style={{ color: countdown === 'closed' ? 'var(--lmn-ash-500)' : 'var(--lmn-gold-400)' }}>
            <Icon name="clock" size={18} />
          </span>
          {countdown === 'closed' ? (
            <span style={{ fontSize: 13, color: 'var(--lmn-ash-400)' }}>
              Pronostici di torneo chiusi.
            </span>
          ) : (
            <span style={{ fontSize: 13, color: 'var(--lmn-ash-200)' }}>
              Chiusura tra{' '}
              <span style={{ fontFamily: 'var(--lmn-font-mono)', color: 'var(--lmn-gold-400)', fontWeight: 600 }}>
                {countdown}
              </span>
            </span>
          )}
        </div>
      )}

      {view === 'mine' && state === 'loading' && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <span className="lmn-spinner" />
        </div>
      )}

      {view === 'mine' && state === 'error' && (
        <div className="lmn-card" style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ color: 'var(--lmn-danger-400)', margin: 0 }}>Errore nel caricamento.</p>
        </div>
      )}

      {view === 'mine' && state === 'ok' && questions.length === 0 && (
        <div className="lmn-card" style={{ padding: 32, textAlign: 'center' }}>
          <span style={{ color: 'var(--lmn-ash-500)' }}>
            <Icon name="star" size={32} />
          </span>
          <p style={{ color: 'var(--lmn-ash-400)', marginTop: 12, marginBottom: 0 }}>
            Nessuna domanda disponibile.
          </p>
        </div>
      )}

      {view === 'mine' && state === 'ok' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {questions.map((q) => (
            <QuestionCard key={q.code} q={q} teams={teams} players={players} onSaved={load} />
          ))}
        </div>
      )}
    </div>
  )
}
