import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  getLeagueMembers,
  joinLeague,
  leaveLeague,
  regenerateCode,
  removeMember,
  renameLeague,
  type League,
  type LeagueMember,
} from '../api/leagues'
import { useLeagues } from '../leagues/LeagueContext'
import { InviteCode, Onboarding } from '../leagues/Onboarding'
import { useAuth } from '../auth/AuthContext'
import { Avatar, Button, TextInput } from '../components/ui'
import { Icon } from '../components/Icon'

const H2: React.CSSProperties = {
  fontFamily: 'var(--lmn-font-display)',
  fontSize: 22,
  letterSpacing: '0.04em',
  margin: '0 0 12px',
  color: 'var(--lmn-ash-100)',
}

// ------------------------------------------------------------- Owner management
function Management({ league, onChange }: { league: League; onChange: () => void }) {
  const { user } = useAuth()
  const [members, setMembers] = useState<LeagueMember[]>([])
  const [name, setName] = useState(league.name)
  const [code, setCode] = useState(league.invite_code)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setName(league.name)
    setCode(league.invite_code)
    getLeagueMembers(league.id).then(setMembers).catch(() => {})
  }, [league.id, league.name, league.invite_code])

  const reloadMembers = () => getLeagueMembers(league.id).then(setMembers).catch(() => {})

  if (!league.is_owner) {
    return (
      <div style={{ marginTop: 20 }}>
        <Button
          variant="danger"
          loading={busy}
          onClick={async () => {
            if (!confirm(`Uscire dalla lega "${league.name}"?`)) return
            setBusy(true)
            try {
              await leaveLeague(league.id)
              onChange()
            } finally {
              setBusy(false)
            }
          }}
        >
          Esci dalla lega
        </Button>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InviteCode code={code} />

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <TextInput label="Nome lega" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button
          size="sm"
          loading={busy}
          disabled={name.trim().length < 2 || name === league.name}
          onClick={async () => {
            setBusy(true)
            try {
              await renameLeague(league.id, name.trim())
              onChange()
            } finally {
              setBusy(false)
            }
          }}
        >
          Salva
        </Button>
      </div>

      <Button
        variant="secondary"
        size="sm"
        loading={busy}
        onClick={async () => {
          if (!confirm('Rigenerare il codice? Il vecchio smetterà di funzionare.')) return
          setBusy(true)
          try {
            const r = await regenerateCode(league.id)
            setCode(r.invite_code)
            onChange()
          } finally {
            setBusy(false)
          }
        }}
      >
        Rigenera codice
      </Button>

      <div>
        <h2 style={H2}>MEMBRI ({members.length})</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {members.map((m) => (
            <div
              key={m.user_id}
              className="lmn-card"
              style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}
            >
              <Avatar name={m.display_name} size="sm" />
              <span style={{ flex: 1, fontFamily: 'var(--lmn-font-ui)', fontWeight: 600, fontSize: 14, color: 'var(--lmn-ash-100)' }}>
                {m.display_name}
                {m.is_owner && (
                  <span style={{ color: 'var(--lmn-gold-400)', fontSize: 11, marginLeft: 6 }}>OWNER</span>
                )}
              </span>
              {!m.is_owner && m.user_id !== user?.id && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    if (!confirm(`Rimuovere ${m.display_name}?`)) return
                    await removeMember(league.id, m.user_id)
                    reloadMembers()
                    onChange()
                  }}
                >
                  Rimuovi
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------- Page
export default function Leagues() {
  const { leagues, current, loading, setCurrent, refresh } = useLeagues()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()

  // Deep link: ?code=WC26-XXXXX → precompila/esegue il join (utente già loggato qui).
  useEffect(() => {
    const code = params.get('code')
    if (!code) return
    joinLeague(code)
      .then(async (lg) => {
        await refresh()
        setCurrent(lg)
      })
      .catch(() => {})
      .finally(() => {
        params.delete('code')
        setParams(params, { replace: true })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px 96px' }}>
      <button
        onClick={() => navigate(-1)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--lmn-ash-400)',
          fontFamily: 'var(--lmn-font-ui)',
          fontSize: 14,
          cursor: 'pointer',
          padding: 0,
          marginBottom: 16,
        }}
      >
        ← Indietro
      </button>

      <h1 style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 32, letterSpacing: '0.04em', margin: '0 0 20px', color: 'var(--lmn-ash-100)' }}>
        LE MIE LEGHE
      </h1>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <span className="lmn-spinner" />
        </div>
      )}

      {!loading && leagues.length === 0 && <Onboarding onDone={async () => void (await refresh())} />}

      {!loading && leagues.length > 0 && (
        <>
          {/* Lista leghe selezionabili */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {leagues.map((l) => {
              const active = l.id === current?.id
              return (
                <div
                  key={l.id}
                  className="lmn-card lmn-card--hoverable"
                  onClick={() => setCurrent(l)}
                  style={{
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    cursor: 'pointer',
                    border: active ? '1px solid var(--lmn-gold-600)' : undefined,
                    background: active ? 'rgba(212,168,67,0.07)' : undefined,
                  }}
                >
                  <span style={{ color: active ? 'var(--lmn-gold-400)' : 'var(--lmn-ash-500)' }}>
                    <Icon name="shield" size={22} filled={active} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--lmn-font-ui)', fontWeight: 600, fontSize: 14, color: 'var(--lmn-ash-100)' }}>
                      {l.name}
                      {l.is_owner && (
                        <span style={{ color: 'var(--lmn-gold-400)', fontSize: 11, marginLeft: 6 }}>OWNER</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--lmn-ash-500)' }}>
                      {l.member_count} membri
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Aggiungi un'altra lega */}
          <details style={{ marginBottom: 24 }}>
            <summary style={{ cursor: 'pointer', color: 'var(--lmn-ash-400)', fontSize: 14, marginBottom: 12 }}>
              + Crea o unisciti a un'altra lega
            </summary>
            <div style={{ marginTop: 12 }}>
              <Onboarding onDone={async () => void (await refresh())} />
            </div>
          </details>

          {/* Gestione lega corrente */}
          {current && (
            <>
              <h2 style={H2}>GESTIONE · {current.name.toUpperCase()}</h2>
              <Management league={current} onChange={refresh} />
            </>
          )}
        </>
      )}

    </div>
  )
}
