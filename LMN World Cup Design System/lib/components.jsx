/* global React, Icon */
// ============================================================================
// LMN WORLD CUP — Component library (cosmetic / prototype-grade)
// Requires: React, lib/icons.jsx, colors_and_type.css, lib/components.css
// All components exported to window at the bottom.
// ============================================================================
(function () {
  const { useState, useRef, useEffect } = React;

  // ----------------------------------------------------------------- Button
  function Button({ variant = 'primary', size = 'md', iconLeft, iconRight, iconOnly, loading, disabled, children, ...rest }) {
    const cls = ['lmn-btn', `lmn-btn--${variant}`, `lmn-btn--${size}`, iconOnly ? 'lmn-btn--icon' : ''].join(' ');
    return (
      <button className={cls} disabled={disabled || loading} {...rest}>
        {loading && <span className="lmn-spinner" />}
        {!loading && iconLeft && <Icon name={iconLeft} size={size === 'sm' ? 15 : size === 'lg' ? 20 : 17} />}
        {!loading && iconOnly && <Icon name={iconOnly} size={size === 'sm' ? 16 : size === 'lg' ? 22 : 19} />}
        {!iconOnly && children}
        {!loading && iconRight && <Icon name={iconRight} size={size === 'sm' ? 15 : size === 'lg' ? 20 : 17} />}
      </button>
    );
  }

  // ----------------------------------------------------------------- Badge
  function Badge({ variant = 'finished', children, live }) {
    return (
      <span className={`lmn-badge lmn-badge--${variant}`}>
        {(live || variant === 'live') && <span className="lmn-live-dot" />}
        {children}
      </span>
    );
  }

  // ----------------------------------------------------------------- Avatar
  const AVATAR_PALETTE = ['#1E6BF0', '#22A85F', '#E96D1C', '#8B5CF6', '#E5484D', '#0EA5A5', '#C28E1F', '#D6457E'];
  function avatarColor(name = '') {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
  }
  function initials(name = '') {
    const p = name.trim().split(/\s+/);
    return ((p[0]?.[0] || '') + (p[1]?.[0] || p[0]?.[1] || '')).toUpperCase();
  }
  const AV_SIZE = { xs: 24, sm: 32, md: 40, lg: 56, xl: 80 };
  function Avatar({ name = '', size = 'md', position, ring = true, style }) {
    const px = AV_SIZE[size] || size;
    const fs = Math.round(px * 0.4);
    return (
      <span
        className={'lmn-avatar' + (ring ? ' lmn-avatar-ring' : '')}
        style={{ width: px, height: px, fontSize: fs, background: avatarColor(name), ...style }}
        title={name}
      >
        {initials(name)}
        {position != null && <span className="lmn-avatar-pos">{position}</span>}
      </span>
    );
  }
  function AvatarStack({ names = [], size = 'sm', max = 4 }) {
    const shown = names.slice(0, max);
    const extra = names.length - shown.length;
    const px = AV_SIZE[size] || size;
    return (
      <span className="lmn-avatar-stack">
        {shown.map((n, i) => <Avatar key={i} name={n} size={size} ring={false} />)}
        {extra > 0 && (
          <span className="lmn-avatar lmn-avatar-ring" style={{ width: px, height: px, fontSize: Math.round(px * 0.36), background: 'var(--lmn-pitch-300)', color: 'var(--lmn-ash-200)' }}>+{extra}</span>
        )}
      </span>
    );
  }

  // ----------------------------------------------------------------- Inputs
  function TextInput({ label, state, hint, disabled, defaultValue, value, onChange, ...rest }) {
    return (
      <div className={'lmn-field' + (state ? ` lmn-field--${state}` : '')}>
        <input className="lmn-input" placeholder={label} disabled={disabled} defaultValue={defaultValue} value={value} onChange={onChange} {...rest} />
        <label className="lmn-input-label">{label}</label>
        {hint && (
          <div className="lmn-field-hint" style={{ color: state === 'error' ? 'var(--lmn-danger-400)' : state === 'success' ? 'var(--lmn-success-400)' : 'var(--lmn-ash-500)' }}>{hint}</div>
        )}
      </div>
    );
  }

  function ScoreInput({ homeLabel = 'CASA', awayLabel = 'OSPITE', value, onChange }) {
    const [v, setV] = useState(value || { h: '', a: '' });
    const cur = value || v;
    const set = (k, val) => { const nv = { ...cur, [k]: val.replace(/[^0-9]/g, '').slice(0, 2) }; setV(nv); onChange && onChange(nv); };
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <input className="lmn-score-box" inputMode="numeric" value={cur.h} onChange={(e) => set('h', e.target.value)} placeholder="0" />
          <div style={{ marginTop: 8, fontFamily: 'var(--lmn-font-ui)', fontSize: 11, letterSpacing: '0.08em', color: 'var(--lmn-ash-500)' }}>{homeLabel}</div>
        </div>
        <span style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 40, color: 'var(--lmn-ash-600)' }}>—</span>
        <div style={{ textAlign: 'center' }}>
          <input className="lmn-score-box" inputMode="numeric" value={cur.a} onChange={(e) => set('a', e.target.value)} placeholder="0" />
          <div style={{ marginTop: 8, fontFamily: 'var(--lmn-font-ui)', fontSize: 11, letterSpacing: '0.08em', color: 'var(--lmn-ash-500)' }}>{awayLabel}</div>
        </div>
      </div>
    );
  }

  function Toggle({ checked, defaultChecked = false, disabled, onChange }) {
    const [on, setOn] = useState(defaultChecked);
    const val = checked != null ? checked : on;
    return (
      <button type="button" className="lmn-toggle" data-on={val} disabled={disabled}
        onClick={() => { const n = !val; setOn(n); onChange && onChange(n); }} aria-pressed={val} />
    );
  }

  function RadioPills({ options = ['1', 'X', '2'], value, defaultValue, onChange }) {
    const [v, setV] = useState(defaultValue);
    const cur = value != null ? value : v;
    return (
      <div className="lmn-pillgroup" role="radiogroup">
        {options.map((o) => (
          <button key={o} className="lmn-pill" data-active={cur === o} role="radio" aria-checked={cur === o}
            onClick={() => { setV(o); onChange && onChange(o); }}>{o}</button>
        ))}
      </div>
    );
  }

  // ----------------------------------------------------------------- Progress
  function ProgressLinear({ value = 0, max = 100, showLabel, label }) {
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    return (
      <div>
        {showLabel && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontFamily: 'var(--lmn-font-ui)', fontSize: 12, color: 'var(--lmn-ash-300)' }}>
            <span>{label || 'Pronostici inseriti'}</span>
            <span style={{ fontFamily: 'var(--lmn-font-mono)', color: 'var(--lmn-gold-400)' }}>{value}/{max}</span>
          </div>
        )}
        <div className="lmn-progress-track"><div className="lmn-progress-fill" style={{ width: pct + '%' }} /></div>
      </div>
    );
  }
  function ProgressSegmented({ segments = [] }) {
    return <div className="lmn-seg-track">{segments.map((s, i) => <div key={i} className="lmn-seg" data-state={s} />)}</div>;
  }
  function ProgressCircular({ value = 0, size = 96, stroke = 9, label = 'precisione' }) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const off = c - (value / 100) * c;
    return (
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--lmn-pitch-700)" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--lmn-gold-500)" strokeWidth={stroke}
            strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 800ms var(--lmn-ease-out)' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'var(--lmn-font-display)', fontSize: size * 0.32, color: 'var(--lmn-ash-100)', lineHeight: 1 }}>{Math.round(value)}<span style={{ fontSize: size * 0.16 }}>%</span></span>
          <span style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--lmn-ash-500)', marginTop: 2 }}>{label}</span>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------- Cards
  const FLAGS = { BRA: '🇧🇷', GER: '🇩🇪', ARG: '🇦🇷', FRA: '🇫🇷', ESP: '🇪🇸', ITA: '🇮🇹', POR: '🇵🇹', NED: '🇳🇱', ENG: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', BEL: '🇧🇪' };
  function TeamBadge({ code, size = 26 }) {
    return <span style={{ fontSize: size, lineHeight: 1 }} aria-hidden>{FLAGS[code] || '⚽'}</span>;
  }

  function MatchCard({ home, away, homeCode, awayCode, time, group, status = 'TIMED', score, hoverable = true, onClick }) {
    const statusBadge = status === 'LIVE' ? <Badge variant="live" live>LIVE 67'</Badge>
      : status === 'FINISHED' ? <Badge variant="finished">Finita</Badge>
      : <Badge variant="timed">{time}</Badge>;
    return (
      <div className={'lmn-card' + (hoverable ? ' lmn-card--hoverable' : '')} style={{ padding: 18, cursor: onClick ? 'pointer' : 'default', minWidth: 300 }} onClick={onClick}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span className="lmn-badge lmn-badge--group">{group}</span>
          {statusBadge}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <TeamBadge code={homeCode} /><span style={{ fontFamily: 'var(--lmn-font-ui)', fontWeight: 600, fontSize: 15, color: 'var(--lmn-ash-100)' }}>{home}</span>
          </div>
          <span style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 30, letterSpacing: '0.04em', color: status === 'TIMED' ? 'var(--lmn-ash-600)' : 'var(--lmn-ash-100)', padding: '0 14px', whiteSpace: 'nowrap' }}>
            {status === 'TIMED' ? 'vs' : `${score?.h ?? 0} : ${score?.a ?? 0}`}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'flex-end' }}>
            <span style={{ fontFamily: 'var(--lmn-font-ui)', fontWeight: 600, fontSize: 15, color: 'var(--lmn-ash-100)' }}>{away}</span><TeamBadge code={awayCode} />
          </div>
        </div>
      </div>
    );
  }

  function ScoreCard({ home = 'BRASILE', away = 'GERMANIA', score = { h: 3, a: 2 }, result = 'esatto', points = 5 }) {
    const map = { esatto: { label: 'Risultato esatto', variant: 'esatto', pts: '+5' }, segno: { label: 'Segno corretto', variant: 'parziale', pts: '+2' }, sbagliato: { label: 'Pronostico errato', variant: 'sbagliato', pts: '0' } };
    const r = map[result] || map.esatto;
    return (
      <div className="lmn-card" style={{ padding: 24, textAlign: 'center', minWidth: 280 }}>
        <div style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--lmn-ash-500)', marginBottom: 14 }}>{home} — {away}</div>
        <div style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 72, lineHeight: 0.9, color: 'var(--lmn-ash-100)', letterSpacing: '0.04em' }}>
          {score.h}<span style={{ color: 'var(--lmn-gold-500)', margin: '0 12px' }}>:</span>{score.a}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 16 }}>
          <Badge variant={r.variant}>{r.label}</Badge>
          <Badge variant="points">{r.pts} PT</Badge>
        </div>
      </div>
    );
  }

  function UserCard({ name = 'Marco Rossi', position = 1, points = 248, trend = 'up', delta = 2 }) {
    const tColor = trend === 'up' ? 'var(--lmn-success-400)' : trend === 'down' ? 'var(--lmn-danger-400)' : 'var(--lmn-ash-400)';
    const tArrow = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '–';
    return (
      <div className="lmn-card lmn-card--hoverable" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14, minWidth: 300 }}>
        <span style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 28, color: position <= 3 ? 'var(--lmn-gold-500)' : 'var(--lmn-ash-500)', width: 32, textAlign: 'center' }}>{position}</span>
        <Avatar name={name} size="md" />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--lmn-font-ui)', fontWeight: 600, fontSize: 15, color: 'var(--lmn-ash-100)' }}>{name}</div>
          <div style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 12, color: tColor }}>{tArrow} {delta} posizioni</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 26, color: 'var(--lmn-gold-400)', lineHeight: 1 }}>{points}</div>
          <div style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--lmn-ash-500)' }}>punti</div>
        </div>
      </div>
    );
  }

  function StatCard({ label = 'Precisione media', value = '68', unit = '%', delta = '+4.2%', positive = true, icon = 'prediction-arrow' }) {
    return (
      <div className="lmn-card lmn-card--hoverable" style={{ padding: 18, minWidth: 150 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 12, color: 'var(--lmn-ash-400)' }}>{label}</span>
          <span style={{ color: 'var(--lmn-gold-500)' }}><Icon name={icon} size={18} /></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 42, color: 'var(--lmn-ash-100)', lineHeight: 1 }}>{value}</span>
          <span style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 24, color: 'var(--lmn-ash-400)' }}>{unit}</span>
        </div>
        <div style={{ marginTop: 8, fontFamily: 'var(--lmn-font-ui)', fontSize: 12, fontWeight: 600, color: positive ? 'var(--lmn-success-400)' : 'var(--lmn-danger-400)' }}>
          {positive ? '▲' : '▼'} {delta} <span style={{ color: 'var(--lmn-ash-500)', fontWeight: 400 }}>vs giornata prec.</span>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------- Bottom Nav
  function BottomNav({ active = 0, onChange }) {
    const tabs = [
      { icon: 'shield', label: 'Home' },
      { icon: 'calendar', label: 'Calendario' },
      { icon: 'ball', label: 'Pronostica', cta: true },
      { icon: 'trophy', label: 'Classifica' },
      { icon: 'star', label: 'Profilo' },
    ];
    const ref = useRef(null);
    const [ind, setInd] = useState({ left: 0, width: 0 });
    useEffect(() => {
      const el = ref.current?.querySelectorAll('.lmn-navtab')[active];
      if (el) setInd({ left: el.offsetLeft + el.offsetWidth / 2 - 14, width: 28 });
    }, [active]);
    return (
      <div className="lmn-bottomnav" ref={ref}>
        <div className="lmn-nav-indicator" style={{ left: ind.left, width: ind.width }} />
        {tabs.map((t, i) => (
          <button key={i} className={'lmn-navtab' + (t.cta ? ' lmn-navtab--cta' : '')} data-active={active === i} onClick={() => onChange && onChange(i)}>
            {t.cta ? (
              <span className="lmn-nav-cta-circle"><Icon name={t.icon} size={24} filled /></span>
            ) : (
              <Icon name={t.icon} size={22} filled={active === i && (t.icon === 'star' || t.icon === 'trophy')} />
            )}
            <span className="lmn-navtab-label">{t.label}</span>
          </button>
        ))}
      </div>
    );
  }

  Object.assign(window, {
    Button, Badge, Avatar, AvatarStack, avatarColor, initials,
    TextInput, ScoreInput, Toggle, RadioPills,
    ProgressLinear, ProgressSegmented, ProgressCircular,
    MatchCard, ScoreCard, UserCard, StatCard, TeamBadge, BottomNav,
  });
})();
