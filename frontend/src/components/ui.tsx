// ============================================================================
// LMN WORLD CUP — UI components (port TSX dal design system)
// Richiede: styles/tokens.css + styles/components.css
// ============================================================================
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

// ----------------------------------------------------------------- Button
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  iconLeft?: IconName
  iconRight?: IconName
  iconOnly?: IconName
  loading?: boolean
  children?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  iconLeft,
  iconRight,
  iconOnly,
  loading,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  const cls = ['lmn-btn', `lmn-btn--${variant}`, `lmn-btn--${size}`, iconOnly ? 'lmn-btn--icon' : '']
    .filter(Boolean)
    .join(' ')
  const iconSize = size === 'sm' ? 15 : size === 'lg' ? 20 : 17
  const iconOnlySize = size === 'sm' ? 16 : size === 'lg' ? 22 : 19
  return (
    <button className={cls} disabled={disabled || loading} {...rest}>
      {loading && <span className="lmn-spinner" />}
      {!loading && iconLeft && <Icon name={iconLeft} size={iconSize} />}
      {!loading && iconOnly && <Icon name={iconOnly} size={iconOnlySize} />}
      {!iconOnly && children}
      {!loading && iconRight && <Icon name={iconRight} size={iconSize} />}
    </button>
  )
}

// ----------------------------------------------------------------- Badge
interface BadgeProps {
  variant?: 'finished' | 'timed' | 'live' | 'group' | 'points' | 'esatto' | 'parziale' | 'sbagliato'
  live?: boolean
  children?: ReactNode
}

export function Badge({ variant = 'finished', children, live }: BadgeProps) {
  return (
    <span className={`lmn-badge lmn-badge--${variant}`}>
      {(live || variant === 'live') && <span className="lmn-live-dot" />}
      {children}
    </span>
  )
}

// ----------------------------------------------------------------- Avatar
const AVATAR_PALETTE = ['#1E6BF0', '#22A85F', '#E96D1C', '#8B5CF6', '#E5484D', '#0EA5A5', '#C28E1F', '#D6457E']

export function avatarColor(name = ''): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}

export function initials(name = ''): string {
  // Separatori: spazi ma anche . _ - (es. display_name da email "nome.cognome")
  const p = name.trim().split(/[\s._-]+/).filter(Boolean)
  return ((p[0]?.[0] || '') + (p[1]?.[0] || p[0]?.[1] || '')).toUpperCase()
}

const AV_SIZE: Record<string, number> = { xs: 24, sm: 32, md: 40, lg: 56, xl: 80 }

interface AvatarProps {
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number
  position?: number
  ring?: boolean
  style?: React.CSSProperties
}

export function Avatar({ name, size = 'md', position, ring = true, style }: AvatarProps) {
  const px = typeof size === 'number' ? size : AV_SIZE[size]
  const fs = Math.round(px * 0.4)
  return (
    <span
      className={'lmn-avatar' + (ring ? ' lmn-avatar-ring' : '')}
      style={{ width: px, height: px, fontSize: fs, background: avatarColor(name), ...style }}
      title={name}
    >
      {initials(name)}
      {position != null && <span className="lmn-avatar-pos">{position}</span>}
    </span>
  )
}

// ----------------------------------------------------------------- TextInput
interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  state?: 'error' | 'success'
  hint?: string
}

export function TextInput({ label, state, hint, ...rest }: TextInputProps) {
  return (
    <div className={'lmn-field' + (state ? ` lmn-field--${state}` : '')}>
      <input className="lmn-input" placeholder={label} {...rest} />
      <label className="lmn-input-label">{label}</label>
      {hint && (
        <div
          className="lmn-field-hint"
          style={{
            color:
              state === 'error'
                ? 'var(--lmn-danger-400)'
                : state === 'success'
                  ? 'var(--lmn-success-400)'
                  : 'var(--lmn-ash-500)',
          }}
        >
          {hint}
        </div>
      )}
    </div>
  )
}
