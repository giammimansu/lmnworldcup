import { useNavigate } from 'react-router-dom'
import { useLeagues } from '../leagues/LeagueContext'
import { useAuth } from '../auth/AuthContext'
import { Onboarding } from '../leagues/Onboarding'
import { RegoleContent } from '../components/RegoleContent'
import { Avatar, Button } from '../components/ui'

// Gate: l'utente senza nessuna lega deve crearne una o unirsi prima di
// accedere al resto dell'app. ProtectedRoute reindirizza qui finché leghe = 0.
export default function Welcome() {
  const { refresh } = useLeagues()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const displayName = (user?.user_metadata?.display_name as string) || user?.email || ''

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        gap: 28,
      }}
    >
      <img src="/logo-full.svg" alt="LMN World Cup" style={{ width: 200 }} />

      {/* Profilo loggato */}
      <div
        className="lmn-card"
        style={{ padding: '12px 16px', width: '100%', maxWidth: 440, display: 'flex', alignItems: 'center', gap: 12 }}
      >
        <Avatar name={displayName} size="sm" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--lmn-font-ui)', fontWeight: 600, fontSize: 14, color: 'var(--lmn-ash-100)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayName}
          </div>
          <div style={{ fontFamily: 'var(--lmn-font-mono)', fontSize: 11, color: 'var(--lmn-ash-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>
          Esci
        </Button>
      </div>

      <div className="lmn-card" style={{ padding: 32, width: '100%', maxWidth: 440 }}>
        <h1
          style={{
            fontFamily: 'var(--lmn-font-display)',
            fontSize: 28,
            letterSpacing: '0.04em',
            margin: '0 0 6px',
            color: 'var(--lmn-ash-100)',
          }}
        >
          ENTRA IN UNA LEGA
        </h1>
        <p style={{ color: 'var(--lmn-ash-400)', fontSize: 14, margin: '0 0 24px' }}>
          Per fare pronostici devi far parte di una lega. Creane una e invita gli
          amici, oppure unisciti con un codice invito.
        </p>

        <Onboarding
          onDone={async () => void (await refresh())}
          onComplete={() => navigate('/', { replace: true })}
        />

        <details style={{ marginTop: 24 }}>
          <summary style={{ cursor: 'pointer', color: 'var(--lmn-ash-400)', fontSize: 14 }}>
            Leggi il regolamento
          </summary>
          <div style={{ marginTop: 20 }}>
            <RegoleContent />
          </div>
        </details>
      </div>
    </div>
  )
}
