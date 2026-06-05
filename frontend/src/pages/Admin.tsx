import { useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import {
  addGoal,
  delGoal,
  getAdminUsers,
  getSyncLog,
  inviteUser,
  listGoals,
  overrideMatch,
  type AdminUser,
  type MatchGoal,
  type SyncLogRow,
} from '../api/admin'
import { getMatches, type Match } from '../api/matches'
import { getPlayers, type Player } from '../api/players'
import { useAuth } from '../auth/AuthContext'
import { Badge, Button, TextInput } from '../components/ui'

function SectionTitle({ children }: { children: string }) {
  return (
    <h2
      style={{
        fontFamily: 'var(--lmn-font-display)',
        fontSize: 22,
        letterSpacing: '0.04em',
        margin: '28px 0 12px',
        color: 'var(--lmn-ash-100)',
      }}
    >
      {children}
    </h2>
  )
}

// ------------------------------------------------------------- Inviti
function InviteSection() {
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [sending, setSending] = useState(false)

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true)
    setMsg(null)
    try {
      await inviteUser(email.trim())
      setMsg({ ok: true, text: `Invito inviato a ${email.trim()}` })
      setEmail('')
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Errore' })
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={handleInvite} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{ flex: 1 }}>
        <TextInput
          label="Email collega"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          state={msg ? (msg.ok ? 'success' : 'error') : undefined}
          hint={msg?.text}
        />
      </div>
      <Button type="submit" loading={sending}>
        Invita
      </Button>
    </form>
  )
}

// ------------------------------------------------------------- Override
function OverrideRow({ match, onDone }: { match: Match; onDone: (msg: string) => void }) {
  const [h, setH] = useState(match.home_score != null ? String(match.home_score) : '')
  const [a, setA] = useState(match.away_score != null ? String(match.away_score) : '')
  const [status, setStatus] = useState(match.status)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const res = await overrideMatch(match.id, {
        ...(h !== '' ? { home_score: Number(h) } : {}),
        ...(a !== '' ? { away_score: Number(a) } : {}),
        status,
      })
      onDone(`Partita ${match.id} aggiornata, ${res.predictions_rescored} pronostici ricalcolati`)
    } catch (err) {
      onDone(err instanceof Error ? err.message : 'Errore override')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: 44,
    padding: '6px 4px',
    textAlign: 'center',
    background: 'var(--lmn-pitch-500, #182038)',
    border: '1px solid var(--lmn-ash-800, #283044)',
    borderRadius: 6,
    color: 'var(--lmn-ash-100)',
    fontFamily: 'var(--lmn-font-mono)',
  }

  return (
    <div
      className="lmn-card"
      style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
    >
      <span style={{ flex: 1, minWidth: 160, fontSize: 13, color: 'var(--lmn-ash-200)' }}>
        {match.home_team_name ?? 'TBD'} – {match.away_team_name ?? 'TBD'}
      </span>
      <input value={h} onChange={(e) => setH(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} style={inputStyle} placeholder="-" />
      <input value={a} onChange={(e) => setA(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} style={inputStyle} placeholder="-" />
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as Match['status'])}
        style={{ ...inputStyle, width: 110, textAlign: 'left' }}
      >
        {['TIMED', 'SCHEDULED', 'IN_PLAY', 'PAUSED', 'FINISHED'].map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <Button size="sm" variant="secondary" loading={saving} onClick={save}>
        Salva
      </Button>
    </div>
  )
}

function OverrideSection({ onMsg }: { onMsg: (m: string) => void }) {
  const [date, setDate] = useState('')
  const [matches, setMatches] = useState<Match[]>([])

  useEffect(() => {
    if (!date) return
    getMatches({ date }).then(setMatches).catch(() => setMatches([]))
  }, [date])

  return (
    <>
      <input
        type="date"
        className="lmn-input"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        style={{ marginBottom: 12, width: 170 }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {matches.map((m) => (
          <OverrideRow key={m.id} match={m} onDone={onMsg} />
        ))}
        {date && matches.length === 0 && (
          <p style={{ color: 'var(--lmn-ash-500)', fontSize: 13 }}>Nessuna partita in questa data.</p>
        )}
      </div>
    </>
  )
}

// ------------------------------------------------------------- Marcatori
function GoalsRow({ match, onMsg }: { match: Match; onMsg: (m: string) => void }) {
  const [players, setPlayers] = useState<Player[]>([])
  const [goals, setGoals] = useState<MatchGoal[]>([])
  const [playerId, setPlayerId] = useState<number | ''>('')
  const [minute, setMinute] = useState('')
  const [busy, setBusy] = useState(false)

  const refreshGoals = () => listGoals(match.id).then(setGoals).catch(() => setGoals([]))

  useEffect(() => {
    const tlas = [match.home_team_tla, match.away_team_tla].filter(Boolean) as string[]
    Promise.all(tlas.map((t) => getPlayers(t)))
      .then((lists) => setPlayers(lists.flat()))
      .catch(() => setPlayers([]))
    refreshGoals()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id])

  const add = async () => {
    if (playerId === '') return
    const p = players.find((x) => x.id === playerId)
    if (!p) return
    setBusy(true)
    try {
      await addGoal({
        match_id: match.id,
        player_id: p.id,
        player_name: p.name,
        team_tla: p.team_tla,
        minute: minute ? Number(minute) : null,
      })
      setMinute('')
      setPlayerId('')
      await refreshGoals()
      onMsg(`Gol aggiunto: ${p.name}`)
    } catch (err) {
      onMsg(err instanceof Error ? err.message : 'Errore aggiunta gol')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (goalId: number, name: string) => {
    setBusy(true)
    try {
      await delGoal(goalId, match.id)
      await refreshGoals()
      onMsg(`Gol rimosso: ${name}`)
    } catch (err) {
      onMsg(err instanceof Error ? err.message : 'Errore rimozione gol')
    } finally {
      setBusy(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: '6px 8px',
    background: 'var(--lmn-pitch-500, #182038)',
    border: '1px solid var(--lmn-ash-800, #283044)',
    borderRadius: 6,
    color: 'var(--lmn-ash-100)',
    fontFamily: 'var(--lmn-font-ui)',
    fontSize: 13,
  }

  return (
    <div className="lmn-card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={{ fontSize: 13, color: 'var(--lmn-ash-200)', fontWeight: 600 }}>
        {match.home_team_name ?? 'TBD'} {match.home_score} – {match.away_score} {match.away_team_name ?? 'TBD'}
      </span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={playerId}
          onChange={(e) => setPlayerId(e.target.value ? Number(e.target.value) : '')}
          style={{ ...inputStyle, flex: 1, minWidth: 180 }}
        >
          <option value="">— Scegli marcatore —</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.team_tla} · {p.shirt_number ?? '–'} · {p.name}
            </option>
          ))}
        </select>
        <input
          value={minute}
          onChange={(e) => setMinute(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
          placeholder="min"
          style={{ ...inputStyle, width: 56, textAlign: 'center' }}
        />
        <Button size="sm" loading={busy} onClick={add}>
          Aggiungi gol
        </Button>
      </div>
      {goals.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {goals.map((g) => (
            <div
              key={g.id}
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--lmn-ash-300)' }}
            >
              <span style={{ flex: 1 }}>
                ⚽ {g.player_name}
                {g.team_tla ? ` (${g.team_tla})` : ''}
                {g.minute != null ? ` · ${g.minute}'` : ''}
              </span>
              <Button size="sm" variant="secondary" loading={busy} onClick={() => remove(g.id, g.player_name)}>
                Rimuovi
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function GoalsSection({ onMsg }: { onMsg: (m: string) => void }) {
  const [date, setDate] = useState('')
  const [matches, setMatches] = useState<Match[]>([])

  useEffect(() => {
    if (!date) return
    getMatches({ date })
      .then((ms) => setMatches(ms.filter((m) => m.status === 'FINISHED')))
      .catch(() => setMatches([]))
  }, [date])

  return (
    <>
      <input
        type="date"
        className="lmn-input"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        style={{ marginBottom: 12, width: 170 }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {matches.map((m) => (
          <GoalsRow key={m.id} match={m} onMsg={onMsg} />
        ))}
        {date && matches.length === 0 && (
          <p style={{ color: 'var(--lmn-ash-500)', fontSize: 13 }}>
            Nessuna partita finita in questa data.
          </p>
        )}
      </div>
    </>
  )
}

// ------------------------------------------------------------- Page
export default function Admin() {
  const { isAdmin, loading } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [log, setLog] = useState<SyncLogRow[]>([])
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!isAdmin) return
    getAdminUsers().then(setUsers).catch(() => {})
    getSyncLog().then(setLog).catch(() => {})
  }, [isAdmin])

  if (loading)
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <span className="lmn-spinner" />
      </div>
    )
  if (!isAdmin) return <Navigate to="/" replace />

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 96px' }}>
      <h1
        style={{
          fontFamily: 'var(--lmn-font-display)',
          fontSize: 32,
          letterSpacing: '0.04em',
          margin: 0,
          color: 'var(--lmn-ash-100)',
        }}
      >
        ADMIN
      </h1>

      {msg && (
        <p style={{ color: 'var(--lmn-electric-400, #38bdf8)', fontFamily: 'var(--lmn-font-mono)', fontSize: 12 }}>
          {msg}
        </p>
      )}

      <SectionTitle>INVITA COLLEGHI</SectionTitle>
      <InviteSection />

      <SectionTitle>UTENTI</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {users.map((u) => (
          <div
            key={u.id}
            className="lmn-card"
            style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}
          >
            <span style={{ flex: 1, fontSize: 13, color: 'var(--lmn-ash-100)', fontWeight: 600 }}>
              {u.display_name}
              {u.is_admin && <Badge variant="points">ADMIN</Badge>}
            </span>
            <span style={{ fontFamily: 'var(--lmn-font-mono)', fontSize: 12, color: 'var(--lmn-ash-500)' }}>
              {u.email}
            </span>
            <span style={{ fontFamily: 'var(--lmn-font-mono)', fontSize: 12, color: 'var(--lmn-gold-400)' }}>
              {u.predictions_count} pron.
            </span>
          </div>
        ))}
      </div>

      <SectionTitle>OVERRIDE RISULTATI</SectionTitle>
      <OverrideSection onMsg={setMsg} />

      <SectionTitle>MARCATORI</SectionTitle>
      <GoalsSection onMsg={setMsg} />

      <SectionTitle>SYNC LOG</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {log.map((row) => (
          <div
            key={row.id}
            style={{
              fontFamily: 'var(--lmn-font-mono)',
              fontSize: 11,
              color: row.status === 'ok' ? 'var(--lmn-ash-400)' : 'var(--lmn-danger-400)',
              padding: '4px 0',
              borderBottom: '1px solid var(--lmn-ash-800, #283044)',
            }}
          >
            {new Date(row.run_at).toLocaleString()} · {row.status} · {row.detail}
          </div>
        ))}
      </div>

    </div>
  )
}
