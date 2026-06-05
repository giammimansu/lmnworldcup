import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { Button, TextInput } from '../components/ui'

const PWD_SKIP_KEY = 'lmn_pwd_prompt_skipped'

// Prefill nome/cognome dal display_name esistente (es. "nome.cognome" da email,
// oppure "Nome Cognome" se già impostato).
function splitName(dn = ''): [string, string] {
  const p = dn.trim().split(/[\s._-]+/).filter(Boolean)
  const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : '')
  return [cap(p[0] || ''), cap(p.slice(1).join(' '))]
}

export default function SetPassword() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [pf, pl] = splitName(user?.user_metadata?.display_name as string | undefined)
  const [firstName, setFirstName] = useState(pf)
  const [lastName, setLastName] = useState(pl)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!firstName.trim() || !lastName.trim()) {
      setError('Inserisci nome e cognome')
      return
    }
    if (password.length < 8) {
      setError('Minimo 8 caratteri')
      return
    }
    if (password !== confirm) {
      setError('Le password non coincidono')
      return
    }
    const displayName = `${firstName.trim()} ${lastName.trim()}`
    setSaving(true)
    const { error: err } = await supabase.auth.updateUser({
      password,
      data: { password_set: true, display_name: displayName },
    })
    // Aggiorna anche profiles (usato per classifica/profilo); RLS: update own.
    if (!err && user?.id) {
      await supabase.from('profiles').update({ display_name: displayName }).eq('id', user.id)
    }
    setSaving(false)
    if (err) {
      setError(err.message)
    } else {
      sessionStorage.removeItem(PWD_SKIP_KEY)
      setDone(true)
      setTimeout(() => navigate('/'), 1800)
    }
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
        {done ? (
          <>
            <h2
              style={{
                fontFamily: 'var(--lmn-font-display)',
                fontSize: 28,
                letterSpacing: '0.04em',
                margin: '0 0 12px',
                color: 'var(--lmn-success-400)',
              }}
            >
              PASSWORD IMPOSTATA
            </h2>
            <p style={{ color: 'var(--lmn-ash-400)', fontSize: 14, margin: 0 }}>
              Dal prossimo accesso entri con email e password.
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
              IMPOSTA LA PASSWORD
            </h2>
            <p
              style={{
                color: 'var(--lmn-ash-400)',
                fontSize: 14,
                marginBottom: 24,
                fontFamily: 'var(--lmn-font-mono)',
              }}
            >
              {user?.email}
            </p>
            <form
              onSubmit={handleSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <TextInput
                label="Nome"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                required
              />
              <TextInput
                label="Cognome"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                required
              />
              <TextInput
                label="Nuova password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <TextInput
                label="Conferma password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                state={error ? 'error' : undefined}
                hint={error || 'Minimo 8 caratteri'}
                autoComplete="new-password"
                required
              />
              <Button type="submit" loading={saving} iconRight="shield">
                Salva password
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
