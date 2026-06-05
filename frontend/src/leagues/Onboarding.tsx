import { useState } from 'react'
import { createLeague, joinLeague } from '../api/leagues'
import { useLeagues } from './LeagueContext'
import { Button, TextInput } from '../components/ui'

const H2: React.CSSProperties = {
  fontFamily: 'var(--lmn-font-display)',
  fontSize: 22,
  letterSpacing: '0.04em',
  margin: '0 0 12px',
  color: 'var(--lmn-ash-100)',
}

function shareLink(code: string) {
  return `${window.location.origin}/leagues?code=${code}`
}

// ------------------------------------------------------------- Invite code box
export function InviteCode({ code }: { code: string }) {
  const [copied, setCopied] = useState<'' | 'code' | 'link'>('')
  const copy = (text: string, what: 'code' | 'link') => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(what)
      setTimeout(() => setCopied(''), 1500)
    })
  }
  return (
    <div className="lmn-card" style={{ padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--lmn-ash-500)', marginBottom: 8 }}>
        Codice invito
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--lmn-font-mono)', fontSize: 22, color: 'var(--lmn-gold-400)', letterSpacing: '0.05em' }}>
          {code}
        </span>
        <Button variant="ghost" size="sm" onClick={() => copy(code, 'code')}>
          {copied === 'code' ? 'Copiato!' : 'Copia'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => copy(shareLink(code), 'link')}>
          {copied === 'link' ? 'Copiato!' : 'Copia link'}
        </Button>
      </div>
    </div>
  )
}

// ------------------------------------------------------------- Create / join
// onComplete: chiamato dopo un join riuscito o dopo "Continua" sul codice creato.
export function Onboarding({ onDone, onComplete }: { onDone: () => Promise<void>; onComplete?: () => void }) {
  const { setCurrent } = useLeagues()
  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [name, setName] = useState('')
  const [codeInput, setCodeInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [createdCode, setCreatedCode] = useState('')

  const doCreate = async () => {
    if (name.trim().length < 2) return
    setBusy(true)
    setErr('')
    try {
      const lg = await createLeague(name.trim())
      setCreatedCode(lg.invite_code)
      await onDone()
      setCurrent(lg)
    } catch {
      setErr('Errore nella creazione')
    } finally {
      setBusy(false)
    }
  }

  const doJoin = async () => {
    if (!codeInput.trim()) return
    setBusy(true)
    setErr('')
    try {
      const lg = await joinLeague(codeInput.trim())
      await onDone()
      setCurrent(lg)
      onComplete?.()
    } catch {
      setErr('Codice non valido')
    } finally {
      setBusy(false)
    }
  }

  if (createdCode) {
    return (
      <div>
        <h2 style={H2}>LEGA CREATA</h2>
        <p style={{ color: 'var(--lmn-ash-400)', fontSize: 14, marginTop: 0 }}>
          Condividi il codice con i tuoi amici per farli entrare.
        </p>
        <InviteCode code={createdCode} />
        {onComplete && (
          <Button onClick={onComplete} iconRight="lightning">
            Continua
          </Button>
        )}
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <Button variant={tab === 'create' ? 'primary' : 'ghost'} size="sm" onClick={() => setTab('create')}>
          Crea una lega
        </Button>
        <Button variant={tab === 'join' ? 'primary' : 'ghost'} size="sm" onClick={() => setTab('join')}>
          Unisciti con un codice
        </Button>
      </div>

      {tab === 'create' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <TextInput
            label="Nome della lega"
            value={name}
            onChange={(e) => setName(e.target.value)}
            state={err ? 'error' : undefined}
            hint={err || undefined}
          />
          <Button loading={busy} disabled={name.trim().length < 2} onClick={doCreate} iconRight="trophy">
            Crea lega
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <TextInput
            label="Codice invito (es. WC26-X7K2P)"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            state={err ? 'error' : undefined}
            hint={err || undefined}
          />
          <Button loading={busy} disabled={!codeInput.trim()} onClick={doJoin} iconRight="lightning">
            Unisciti
          </Button>
        </div>
      )}
    </div>
  )
}
