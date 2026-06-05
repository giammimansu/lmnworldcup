import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { getMyLeagues, joinLeague, type League } from '../api/leagues'
import { useAuth } from '../auth/AuthContext'

const LS_CURRENT = 'lmn:current-league'
const LS_PENDING_JOIN = 'lmn:pending-join-code'

type Ctx = {
  leagues: League[]
  current: League | null
  loading: boolean
  setCurrent: (l: League) => void
  refresh: () => Promise<League[]>
}

const LeagueCtx = createContext<Ctx>({} as Ctx)

/** Salva un codice da consumare dopo il login (deep link `?code=`). */
export function stashPendingJoinCode(code: string) {
  localStorage.setItem(LS_PENDING_JOIN, code.trim().toUpperCase())
}

export function LeagueProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [leagues, setLeagues] = useState<League[]>([])
  const [current, setCurrentState] = useState<League | null>(null)
  const [loading, setLoading] = useState(true)

  const setCurrent = useCallback((l: League) => {
    setCurrentState(l)
    localStorage.setItem(LS_CURRENT, l.id)
  }, [])

  const refresh = useCallback(async () => {
    const ls = await getMyLeagues()
    setLeagues(ls)
    const savedId = localStorage.getItem(LS_CURRENT)
    setCurrentState((c) => {
      const keepId = c?.id ?? savedId
      const next = (keepId && ls.find((x) => x.id === keepId)) || ls[0] || null
      if (next) localStorage.setItem(LS_CURRENT, next.id)
      return next
    })
    return ls
  }, [])

  // All'avvio: se l'URL contiene ?code= (deep link condiviso), salvalo subito.
  // Sopravvive al redirect su /login e viene consumato dopo l'autenticazione.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')
    if (code) stashPendingJoinCode(code)
  }, [])

  useEffect(() => {
    if (!user) {
      setLeagues([])
      setCurrentState(null)
      setLoading(false)
      return
    }
    let alive = true
    ;(async () => {
      // Consuma un eventuale codice di join in sospeso (deep link prima del login).
      const pending = localStorage.getItem(LS_PENDING_JOIN)
      if (pending) {
        localStorage.removeItem(LS_PENDING_JOIN)
        try {
          const joined = await joinLeague(pending)
          if (alive) localStorage.setItem(LS_CURRENT, joined.id)
        } catch {
          /* codice non più valido: ignora */
        }
      }
      try {
        await refresh()
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [user, refresh])

  return (
    <LeagueCtx.Provider value={{ leagues, current, loading, setCurrent, refresh }}>
      {children}
    </LeagueCtx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useLeagues = () => useContext(LeagueCtx)
