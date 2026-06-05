import { useLocation, useNavigate } from 'react-router-dom'
import { Icon, type IconName } from './Icon'

const TABS: { icon: IconName; label: string; path: string; cta?: boolean }[] = [
  { icon: 'home', label: 'Home', path: '/' },
  { icon: 'calendar', label: 'Partite', path: '/matches' },
  { icon: 'ball', label: 'Pronostica', path: '/predict', cta: true },
  { icon: 'bracket', label: 'Tabellone', path: '/bracket' },
  { icon: 'user', label: 'Profilo', path: '/profile' },
]

export function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'flex-end',
        background: 'var(--lmn-pitch-700, #11182c)',
        borderTop: '1px solid var(--lmn-ash-800, #283044)',
        padding: '8px 0 calc(8px + env(safe-area-inset-bottom))',
        zIndex: 50,
      }}
    >
      {TABS.map((t) => {
        const active = pathname === t.path
        if (t.cta) {
          return (
            <button
              key={t.path}
              onClick={() => navigate(t.path)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0 10px',
                marginTop: -22,
              }}
            >
              <span
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--lmn-gold-500, #d4a843)',
                  color: 'var(--lmn-midnight-700, #090E1B)',
                  boxShadow: '0 4px 16px rgba(212,168,67,0.4)',
                  transform: active ? 'scale(1.05)' : undefined,
                  transition: 'transform 150ms',
                }}
              >
                <Icon name="ball" size={26} filled />
              </span>
              <span
                style={{
                  fontFamily: 'var(--lmn-font-ui)',
                  fontSize: 10,
                  letterSpacing: '0.04em',
                  color: active ? 'var(--lmn-gold-400)' : 'var(--lmn-ash-500)',
                }}
              >
                {t.label}
              </span>
            </button>
          )
        }
        return (
          <button
            key={t.path}
            onClick={() => navigate(t.path)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: active ? 'var(--lmn-gold-400)' : 'var(--lmn-ash-500)',
              padding: '4px 10px',
            }}
          >
            <Icon name={t.icon} size={22} filled={active && (t.icon === 'user' || t.icon === 'home' || t.icon === 'trophy')} />
            <span style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 10, letterSpacing: '0.04em' }}>
              {t.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
