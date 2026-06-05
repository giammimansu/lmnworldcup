import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { Button, TextInput } from '../components/ui'

type Mode = 'password' | 'magic'
type Status = 'idle' | 'sending' | 'sent' | 'error'

export default function Login() {
  const { user, loading } = useAuth()
  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  if (!loading && user) return <Navigate to="/" replace />

  const handlePassword = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) return
    setStatus('sending')
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) {
      setErrorMsg(
        error.message.includes('Invalid login credentials')
          ? 'Email o password errati'
          : error.message,
      )
      setStatus('error')
    }
    // Successo: onAuthStateChange aggiorna la sessione → redirect automatico
  }

  const handleMagic = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('sending')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: window.location.origin,
        shouldCreateUser: true, // Sprint 6: registrazione self-service
      },
    })
    if (error) {
      setErrorMsg(
        error.message.includes('rate limit')
          ? 'Troppe richieste: riprova tra qualche minuto'
          : error.message,
      )
      setStatus('error')
    } else {
      setStatus('sent')
    }
  }

  const switchMode = (m: Mode) => {
    setMode(m)
    setStatus('idle')
    setErrorMsg('')
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        gap: 32,
      }}
    >
      <img src="/logo-full.svg" alt="LMN World Cup" style={{ width: 200 }} />

      <div
        className="lmn-card"
        style={{ padding: 32, width: '100%', maxWidth: 400, textAlign: 'center' }}
      >
        {status === 'sent' ? (
          <>
            <h2
              style={{
                fontFamily: 'var(--lmn-font-display)',
                fontSize: 28,
                letterSpacing: '0.04em',
                margin: '0 0 12px',
                color: 'var(--lmn-ash-100)',
              }}
            >
              CONTROLLA LA TUA EMAIL
            </h2>
            <p style={{ color: 'var(--lmn-ash-400)', fontSize: 14, margin: 0 }}>
              Ti abbiamo inviato un magic link a{' '}
              <span style={{ fontFamily: 'var(--lmn-font-mono)', color: 'var(--lmn-gold-400)' }}>
                {email}
              </span>
              . Aprilo per entrare in campo.
            </p>
          </>
        ) : (
          <>
            <h2
              style={{
                fontFamily: 'var(--lmn-font-display)',
                fontSize: 28,
                letterSpacing: '0.04em',
                margin: '0 0 6px',
                color: 'var(--lmn-ash-100)',
              }}
            >
              ENTRA IN CAMPO
            </h2>
            <p style={{ color: 'var(--lmn-ash-400)', fontSize: 14, marginBottom: 24 }}>
              Indovina. Scala. Domina.
            </p>

            {mode === 'password' ? (
              <form
                onSubmit={handlePassword}
                style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
              >
                <TextInput
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
                <TextInput
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  state={status === 'error' ? 'error' : undefined}
                  hint={status === 'error' ? errorMsg : undefined}
                  autoComplete="current-password"
                  required
                />
                <Button type="submit" loading={status === 'sending'} iconRight="lightning">
                  Accedi
                </Button>
                <button
                  type="button"
                  onClick={() => switchMode('magic')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--lmn-ash-400)',
                    fontFamily: 'var(--lmn-font-ui)',
                    fontSize: 13,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Password dimenticata o primo accesso? Usa il magic link
                </button>
              </form>
            ) : (
              <form
                onSubmit={handleMagic}
                style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
              >
                <TextInput
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  state={status === 'error' ? 'error' : undefined}
                  hint={status === 'error' ? errorMsg : undefined}
                  autoComplete="email"
                  required
                />
                <Button type="submit" loading={status === 'sending'} iconRight="lightning">
                  Invia magic link
                </Button>
                <button
                  type="button"
                  onClick={() => switchMode('password')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--lmn-ash-400)',
                    fontFamily: 'var(--lmn-font-ui)',
                    fontSize: 13,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Torna al login con password
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
