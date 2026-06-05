import { useEffect, useState } from 'react'

// Rilevamento piattaforma / stato installazione.
function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}
function isAndroid(): boolean {
  return /android/i.test(window.navigator.userAgent)
}
function isInStandalone(): boolean {
  return (
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

const DISMISS_KEY = 'a2hs-dismissed'

// L'evento beforeinstallprompt non è ancora tipizzato in lib.dom.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function AddToHome() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)
  const [iosHint, setIosHint] = useState(false)

  useEffect(() => {
    if (isInStandalone()) return // già installata: niente banner
    if (localStorage.getItem(DISMISS_KEY)) return
    // Mostra solo su mobile (Android/iOS): su desktop non serve.
    if (!isIos() && !isAndroid()) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // iOS non emette beforeinstallprompt: istruzioni manuali (solo Safari).
    if (isIos()) {
      setIosHint(true)
      setShow(true)
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (!deferred) return
    deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
    setShow(false)
  }
  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setShow(false)
  }

  if (!show) return null

  return (
    <div
      className="lmn-card"
      style={{
        position: 'fixed',
        // Sopra la BottomNav (alta ~70px + safe area).
        bottom: 'calc(78px + env(safe-area-inset-bottom))',
        left: 12,
        right: 12,
        zIndex: 60,
        maxWidth: 616,
        margin: '0 auto',
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        border: '1px solid var(--lmn-gold-600)',
        background: 'linear-gradient(180deg, rgba(212,168,67,0.12), var(--lmn-pitch-700, #11182c))',
        boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
      }}
    >
      <img src="/icon-192.png" alt="" style={{ width: 40, height: 40, borderRadius: 9, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {iosHint ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--lmn-ash-200)', lineHeight: 1.5 }}>
            Installa LMN sulla Home: tocca <b style={{ color: 'var(--lmn-ash-100)' }}>Condividi</b> (quadrato
            con freccia ↑) e poi <b style={{ color: 'var(--lmn-ash-100)' }}>“Aggiungi alla schermata Home”</b>.
          </p>
        ) : (
          <>
            <div style={{ fontFamily: 'var(--lmn-font-ui)', fontWeight: 600, fontSize: 14, color: 'var(--lmn-ash-100)' }}>
              Aggiungi LMN alla Home
            </div>
            <div style={{ fontSize: 12, color: 'var(--lmn-ash-400)', marginTop: 1 }}>
              Apri l'app a tutto schermo, come un'app vera.
            </div>
          </>
        )}
      </div>

      {!iosHint && (
        <button
          onClick={install}
          className="lmn-btn lmn-btn--primary lmn-btn--sm"
          style={{ flexShrink: 0 }}
        >
          Installa
        </button>
      )}
      <button
        onClick={dismiss}
        aria-label="Chiudi"
        style={{
          flexShrink: 0,
          background: 'none',
          border: 'none',
          color: 'var(--lmn-ash-500)',
          fontSize: 22,
          lineHeight: 1,
          cursor: 'pointer',
          padding: '0 2px',
        }}
      >
        ×
      </button>
    </div>
  )
}
