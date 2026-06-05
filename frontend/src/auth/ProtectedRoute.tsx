import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useLeagues } from '../leagues/LeagueContext'

// Primo accesso (magic link) → utente senza password. Chiedi di impostarla.
// "Salta per ora" setta questo flag → niente prompt fino al prossimo accesso.
const PWD_SKIP_KEY = 'lmn_pwd_prompt_skipped'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const { leagues, loading: leaguesLoading } = useLeagues()
  const { pathname } = useLocation()

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span className="lmn-spinner" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  const needsPassword = !user.user_metadata?.password_set
  const skipped = sessionStorage.getItem(PWD_SKIP_KEY) === '1'
  if (needsPassword && !skipped && pathname !== '/password') {
    return <Navigate to="/password" replace />
  }

  // Gate lega: per pronosticare serve almeno una lega. Finché 0 → /welcome.
  // Aspetta il caricamento per evitare un redirect a vuoto.
  if (!needsPassword && !leaguesLoading && leagues.length === 0 && pathname !== '/welcome') {
    return <Navigate to="/welcome" replace />
  }
  // Già in una lega ma su /welcome (es. back) → torna alla home.
  if (!leaguesLoading && leagues.length > 0 && pathname === '/welcome') {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
