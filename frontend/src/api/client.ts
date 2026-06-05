import { supabase } from '../lib/supabase'

// Normalizza VITE_API_URL: aggiunge https:// se manca lo schema (altrimenti il
// browser tratta il valore come path relativo e lo appende all'origin del sito)
// e rimuove lo slash finale per evitare doppi slash con `path`.
function normalizeBase(raw: string | undefined): string {
  if (!raw) return ''
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  return withScheme.replace(/\/+$/, '')
}

const BASE = normalizeBase(import.meta.env.VITE_API_URL)

const TIMEOUT_MS = 15000
const MAX_RETRIES = 2
const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504])

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Wrapper fetch che inietta automaticamente il JWT Supabase (quando presente).
// Ritenta solo le GET su errori transitori (rete, timeout, 5xx, cold start
// serverless) con backoff esponenziale. Le mutation non vengono mai ritentate
// per evitare doppie scritture.
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase()
  const canRetry = method === 'GET'

  // getSession() può restituire un access_token scaduto (refresh in background):
  // la prima chiamata va in 401, poi un refresh forzato rigenera il token.
  // Lo facciamo una sola volta per richiesta, anche sulle mutation (la prima
  // è fallita con 401 → nessun rischio di doppia scrittura).
  let authRetried = false

  let lastErr: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)

    try {
      const res = await fetch(`${BASE}${path}`, {
        ...options,
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options.headers || {}),
        },
      })

      if (!res.ok) {
        // Token scaduto: forza un refresh e ritenta una volta (non consuma attempt).
        if (res.status === 401 && !authRetried) {
          authRetried = true
          await supabase.auth.refreshSession()
          attempt--
          continue
        }
        if (canRetry && RETRY_STATUS.has(res.status) && attempt < MAX_RETRIES) {
          await sleep(300 * 2 ** attempt)
          continue
        }
        throw new Error(`API ${res.status}: ${await res.text()}`)
      }
      return res.json() as Promise<T>
    } catch (err) {
      lastErr = err
      // Errore di rete (TypeError) o timeout (AbortError): ritenta solo le GET.
      const retriable = err instanceof TypeError || (err as Error)?.name === 'AbortError'
      if (canRetry && retriable && attempt < MAX_RETRIES) {
        await sleep(300 * 2 ** attempt)
        continue
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastErr
}
