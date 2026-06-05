import { useEffect, useMemo, useState } from 'react'
import {
  answerSpecial,
  getSpecialQuestions,
  getTeams,
  type SpecialAnswerValue,
  type SpecialQuestion,
  type Team,
} from '../api/special'
import { getAllPlayers, type Player } from '../api/players'
import { Badge, Button } from '../components/ui'
import { Icon } from '../components/Icon'
import { SearchSelect, type Option } from '../components/SearchSelect'

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

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px 96px' }}>
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
      <p style={{ color: 'var(--lmn-ash-400)', fontSize: 14, margin: '0 0 20px' }}>
        Pronostici speciali da fare una volta sola, prima del fischio d'inizio. Valgono tanti
        punti: scegli bene.
      </p>

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

      {state === 'ok' && questions.length === 0 && (
        <div className="lmn-card" style={{ padding: 32, textAlign: 'center' }}>
          <span style={{ color: 'var(--lmn-ash-500)' }}>
            <Icon name="star" size={32} />
          </span>
          <p style={{ color: 'var(--lmn-ash-400)', marginTop: 12, marginBottom: 0 }}>
            Nessuna domanda disponibile.
          </p>
        </div>
      )}

      {state === 'ok' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {questions.map((q) => (
            <QuestionCard key={q.code} q={q} teams={teams} players={players} onSaved={load} />
          ))}
        </div>
      )}
    </div>
  )
}
