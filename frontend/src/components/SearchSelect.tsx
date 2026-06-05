import { useEffect, useMemo, useRef, useState } from 'react'

// Dropdown cercabile riutilizzabile: ricerca, navigazione da tastiera, scroll
// fluido su mobile, icona (crest/bandiera) per opzione. Usato dai pronostici di
// torneo (squadre/giocatori) e dai marcatori delle partite.
export interface Option {
  value: string
  label: string
  hint?: string
  icon?: string | null // URL crest/bandiera
}

function OptionIcon({ url }: { url?: string | null }) {
  if (!url) return null
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      style={{ width: 22, height: 22, objectFit: 'contain', flexShrink: 0 }}
    />
  )
}

export function SearchSelect({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  exclude,
}: {
  options: Option[]
  value: string | null
  onChange: (v: string) => void
  placeholder: string
  disabled?: boolean
  exclude?: Set<string>
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  // Blocca lo scroll della pagina mentre il dropdown è aperto: su mobile lo
  // scroll della lista "sforava" sull'app (scroll chaining / momentum iOS).
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const all = useMemo(() => {
    const q = query.trim().toLowerCase()
    return options
      .filter((o) => !exclude || !exclude.has(o.value) || o.value === value)
      .filter(
        (o) =>
          !q ||
          o.label.toLowerCase().includes(q) ||
          o.value.toLowerCase().includes(q) ||
          (o.hint?.toLowerCase().includes(q) ?? false),
      )
  }, [options, query, exclude, value])
  // Nessun cap: lista completa scrollabile (lo scroll-container ha maxHeight).
  const filtered = all

  // Reset evidenza quando cambia la ricerca / apertura.
  useEffect(() => setActive(0), [query, open])

  // Mantieni la riga attiva visibile durante la navigazione da tastiera.
  useEffect(() => {
    const el = listRef.current?.children[active] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const choose = (v: string) => {
    onChange(v)
    setOpen(false)
    setQuery('')
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[active]) choose(filtered[active].value)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  if (disabled) {
    return (
      <div
        className="lmn-card"
        style={{ padding: '12px 14px', fontSize: 14, color: 'var(--lmn-ash-200)', display: 'flex', alignItems: 'center', gap: 10 }}
      >
        {selected ? (
          <>
            <OptionIcon url={selected.icon} />
            <span>{selected.label}</span>
          </>
        ) : (
          <span style={{ color: 'var(--lmn-ash-500)' }}>—</span>
        )}
      </div>
    )
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="lmn-card lmn-card--hoverable"
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '12px 14px',
          minHeight: 48,
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: selected ? 'var(--lmn-ash-100)' : 'var(--lmn-ash-500)',
          cursor: 'pointer',
        }}
      >
        {selected && <OptionIcon url={selected.icon} />}
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : placeholder}
        </span>
        <span
          style={{
            color: 'var(--lmn-ash-500)',
            flexShrink: 0,
            transition: 'transform 150ms',
            transform: open ? 'rotate(180deg)' : undefined,
          }}
        >
          ▾
        </span>
      </button>
      {open && (
        <>
          {/* Backdrop: chiude al tap fuori */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)' }}
          />
          {/* Bottom-sheet: sempre dentro il viewport, lista scrollabile internamente */}
          <div
            className="lmn-card"
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1001,
              maxHeight: '80vh',
              borderRadius: '16px 16px 0 0',
              padding: '10px 12px calc(12px + env(safe-area-inset-bottom))',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              boxShadow: '0 -12px 32px rgba(0,0,0,0.5)',
            }}
          >
            {/* Maniglia + chiudi */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', paddingBottom: 2 }}>
              <span style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--lmn-ash-700, #3a4257)' }} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Chiudi"
                style={{ position: 'absolute', right: 0, top: -2, background: 'none', border: 'none', color: 'var(--lmn-ash-500)', fontSize: 22, lineHeight: 1, cursor: 'pointer', padding: 4 }}
              >
                ×
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                className="lmn-input"
                placeholder="Cerca…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKey}
                style={{ padding: '10px 32px 10px 12px', width: '100%', boxSizing: 'border-box' }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Cancella"
                  style={{
                    position: 'absolute',
                    right: 6,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--lmn-ash-500)',
                    fontSize: 18,
                    cursor: 'pointer',
                    padding: 4,
                  }}
                >
                  ×
                </button>
              )}
            </div>
            <div
              ref={listRef}
              style={{
                overflowY: 'auto',
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain',
              }}
            >
            {filtered.length === 0 && (
              <div style={{ padding: 12, fontSize: 13, color: 'var(--lmn-ash-500)' }}>
                Nessun risultato.
              </div>
            )}
            {filtered.map((o, i) => {
              const isSel = o.value === value
              const isActive = i === active
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => choose(o.value)}
                  onMouseEnter={() => setActive(i)}
                  style={{
                    textAlign: 'left',
                    background: isActive
                      ? 'var(--lmn-pitch-600, #1a2236)'
                      : isSel
                        ? 'rgba(212,168,67,0.10)'
                        : 'none',
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px 10px',
                    minHeight: 44,
                    cursor: 'pointer',
                    color: 'var(--lmn-ash-100)',
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <OptionIcon url={o.icon} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {o.label}
                  </span>
                  {o.hint && (
                    <span style={{ color: 'var(--lmn-ash-500)', fontSize: 12, flexShrink: 0, fontFamily: 'var(--lmn-font-mono)' }}>
                      {o.hint}
                    </span>
                  )}
                  {isSel && <span style={{ color: 'var(--lmn-gold-400)', flexShrink: 0 }}>✓</span>}
                </button>
              )
            })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
