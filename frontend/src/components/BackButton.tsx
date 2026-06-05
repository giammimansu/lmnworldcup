import { useNavigate } from 'react-router-dom'

// Tasto "indietro" riutilizzabile: tap target ampio (≥44px), staccato dalla
// notch tramite safe-area-inset-top, stile coerente col design system LMN.
export default function BackButton({
  label = 'Indietro',
  to,
}: {
  label?: string
  to?: string | number
}) {
  const navigate = useNavigate()
  const onClick = () => {
    if (typeof to === 'string') navigate(to)
    else navigate((to as number) ?? -1)
  }

  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        // Distacca dalla status bar in modalità standalone (iOS notch).
        marginTop: 'env(safe-area-inset-top)',
        marginBottom: 20,
        padding: '8px 16px 8px 8px',
        minHeight: 44,
        background: 'var(--lmn-pitch-600, #1a2236)',
        border: '1px solid var(--lmn-ash-800, #283044)',
        borderRadius: 999,
        cursor: 'pointer',
        color: 'var(--lmn-ash-200)',
        fontFamily: 'var(--lmn-font-ui)',
        fontWeight: 600,
        fontSize: 14,
        transition: 'border-color 150ms, color 150ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--lmn-gold-600, #c28e1f)'
        e.currentTarget.style.color = 'var(--lmn-ash-100)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--lmn-ash-800, #283044)'
        e.currentTarget.style.color = 'var(--lmn-ash-200)'
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--lmn-pitch-700, #11182c)',
          color: 'var(--lmn-gold-400, #e0a82e)',
          fontSize: 16,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ‹
      </span>
      {label}
    </button>
  )
}
