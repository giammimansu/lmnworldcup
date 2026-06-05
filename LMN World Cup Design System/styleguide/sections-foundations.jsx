/* global React, LMN_DATA, Icon */
// ============================================================================
// LMN WORLD CUP — Styleguide sections: foundations
// ============================================================================
(function () {
  const { useState } = React;
  const { COLORS, SEMANTIC, TYPE_SCALE, SPACING, RADII } = LMN_DATA;

  // ---- shared bits ---------------------------------------------------------
  function SectionHead({ kicker, title, desc }) {
    return (
      <header style={{ marginBottom: 36, maxWidth: 720 }}>
        {kicker && <div style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--lmn-gold-500)', marginBottom: 10 }}>{kicker}</div>}
        <h1 style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 52, letterSpacing: '0.02em', color: 'var(--lmn-ash-100)', margin: 0, lineHeight: 1 }}>{title}</h1>
        {desc && <p style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 16, lineHeight: 1.55, color: 'var(--lmn-ash-300)', marginTop: 14 }}>{desc}</p>}
      </header>
    );
  }
  window.SectionHead = SectionHead;

  function Code({ children }) {
    return <code style={{ fontFamily: 'var(--lmn-font-mono)', fontSize: 12, background: 'var(--lmn-pitch-700)', color: 'var(--lmn-gold-300)', padding: '3px 8px', borderRadius: 6, border: '1px solid var(--lmn-ash-800)' }}>{children}</code>;
  }
  window.Code = Code;

  function Block({ title, code, children, columns }) {
    return (
      <div style={{ marginBottom: 40 }}>
        {title && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <h3 style={{ fontFamily: 'var(--lmn-font-ui)', fontWeight: 700, fontSize: 18, color: 'var(--lmn-ash-100)', margin: 0 }}>{title}</h3>
            {code && <Code>{code}</Code>}
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: columns ? 'stretch' : 'flex-start' }}>{children}</div>
      </div>
    );
  }
  window.Block = Block;

  // ---- OVERVIEW ------------------------------------------------------------
  function OverviewSection() {
    return (
      <div className="lmn-anim-fade-in-up">
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap', marginBottom: 40 }}>
          <img src="assets/logo-mark.svg" width="116" height="116" alt="LMN crest" />
          <div>
            <div style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 64, lineHeight: 0.85, color: 'var(--lmn-ash-100)', letterSpacing: '0.01em' }}>LMN</div>
            <div style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 20, fontWeight: 500, letterSpacing: '0.42em', color: 'var(--lmn-ash-300)', marginTop: 4 }}>WORLD CUP</div>
            <div style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 24, letterSpacing: '0.06em', color: 'var(--lmn-gold-500)', marginTop: 14 }}>INDOVINA. SCALA. DOMINA.</div>
          </div>
        </div>
        <p style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 18, lineHeight: 1.6, color: 'var(--lmn-ash-200)', maxWidth: 680 }}>
          LMN World Cup è il campionato di pronostici privato tra colleghi appassionati di calcio.
          Serio ma non istituzionale, competitivo ma amichevole, premium ma accessibile.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 36, maxWidth: 760 }}>
          {[
            { t: 'Tono', d: 'Diretto, sportivo, da spogliatoio. Mai aziendalese.', i: 'whistle' },
            { t: 'Estetica', d: 'Dark premium. Champions League × Sorare × FotMob.', i: 'shield' },
            { t: 'Energia', d: 'Oro per la vittoria, blu elettrico per il live.', i: 'lightning' },
          ].map((c) => (
            <div key={c.t} className="lmn-card" style={{ padding: 18 }}>
              <span style={{ color: 'var(--lmn-gold-500)' }}><Icon name={c.i} size={22} /></span>
              <div style={{ fontFamily: 'var(--lmn-font-ui)', fontWeight: 700, fontSize: 15, color: 'var(--lmn-ash-100)', marginTop: 12 }}>{c.t}</div>
              <div style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 13, lineHeight: 1.5, color: 'var(--lmn-ash-400)', marginTop: 4 }}>{c.d}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---- COLORS --------------------------------------------------------------
  function Swatch({ token, shade }) {
    const [copied, setCopied] = useState(false);
    const full = `--lmn-${token}-${shade.k}`;
    const light = shade.k <= 200;
    return (
      <button
        onClick={() => { navigator.clipboard?.writeText(shade.hex); setCopied(true); setTimeout(() => setCopied(false), 1100); }}
        style={{ all: 'unset', cursor: 'pointer', display: 'flex', flexDirection: 'column', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--lmn-ash-800)', minWidth: 92, flex: 1 }}
        title={`${full} · clicca per copiare ${shade.hex}`}
      >
        <div style={{ background: shade.hex, height: 64, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: 6 }}>
          {copied && <span style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 10, fontWeight: 700, color: light ? '#000' : '#fff', background: 'rgba(0,0,0,0.25)', padding: '2px 6px', borderRadius: 4 }}>copiato</span>}
        </div>
        <div style={{ padding: '8px 10px', background: 'var(--lmn-pitch-600)' }}>
          <div style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 16, color: 'var(--lmn-ash-200)', letterSpacing: '0.04em' }}>{shade.k}</div>
          <div style={{ fontFamily: 'var(--lmn-font-mono)', fontSize: 10, color: 'var(--lmn-ash-500)' }}>{shade.hex}</div>
          {shade.use && <div style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 10, color: 'var(--lmn-gold-400)', marginTop: 4, lineHeight: 1.3 }}>{shade.use}</div>}
          {shade.contrast && shade.contrast !== '—' && <div style={{ fontFamily: 'var(--lmn-font-mono)', fontSize: 9.5, color: 'var(--lmn-ash-500)', marginTop: 2 }}>{shade.contrast}</div>}
        </div>
      </button>
    );
  }

  function ColorsSection() {
    return (
      <div className="lmn-anim-fade-in-up">
        <SectionHead kicker="Foundations" title="COLORI" desc="Sei famiglie cromatiche, ognuna con 9 shade (100→900). Contrasto WCAG calcolato su Midnight-500 (#10172A). Clicca uno swatch per copiarne l'hex." />
        {COLORS.map((c) => (
          <div key={c.token} style={{ marginBottom: 34 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <h2 style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 28, letterSpacing: '0.04em', color: 'var(--lmn-ash-100)', margin: 0 }}>{c.name}</h2>
              <Code>--lmn-{c.token}-*</Code>
            </div>
            <p style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 13, color: 'var(--lmn-ash-400)', margin: '0 0 14px', maxWidth: 640 }}>{c.desc}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {c.shades.map((s) => <Swatch key={s.k} token={c.token} shade={s} />)}
            </div>
          </div>
        ))}
        <div style={{ marginTop: 8 }}>
          <h2 style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 28, letterSpacing: '0.04em', color: 'var(--lmn-ash-100)', margin: '0 0 14px' }}>Semantici</h2>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {SEMANTIC.map((s) => (
              <div key={s.token} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--lmn-pitch-600)', border: '1px solid var(--lmn-ash-800)', borderRadius: 10, padding: '10px 16px' }}>
                <span style={{ width: 36, height: 36, borderRadius: 8, background: s.hex }} />
                <div>
                  <div style={{ fontFamily: 'var(--lmn-font-ui)', fontWeight: 600, fontSize: 14, color: 'var(--lmn-ash-100)' }}>{s.name}</div>
                  <div style={{ fontFamily: 'var(--lmn-font-mono)', fontSize: 11, color: 'var(--lmn-ash-500)' }}>--lmn-{s.token}-500 · {s.use}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---- TYPOGRAPHY ----------------------------------------------------------
  function TypographySection() {
    const famVar = { display: 'var(--lmn-font-display)', ui: 'var(--lmn-font-ui)', mono: 'var(--lmn-font-mono)' };
    return (
      <div className="lmn-anim-fade-in-up">
        <SectionHead kicker="Foundations" title="TIPOGRAFIA" desc="Bebas Neue per score e titoli, DM Sans per UI, JetBrains Mono per dati tecnici e timestamp." />
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 36 }}>
          {[
            { n: 'Display', f: 'Bebas Neue', v: 'display', s: 'AaBb 0123', d: 'Score · titoli · numeri' },
            { n: 'UI', f: 'DM Sans', v: 'ui', s: 'AaBbCc', d: 'Testo · label · UI' },
            { n: 'Mono', f: 'JetBrains Mono', v: 'mono', s: '21:47', d: 'Timestamp · codici · dati' },
          ].map((f) => (
            <div key={f.n} className="lmn-card" style={{ padding: 20, flex: 1, minWidth: 200 }}>
              <div style={{ fontFamily: famVar[f.v], fontSize: 46, color: 'var(--lmn-gold-500)', lineHeight: 1 }}>{f.s}</div>
              <div style={{ fontFamily: 'var(--lmn-font-ui)', fontWeight: 700, fontSize: 15, color: 'var(--lmn-ash-100)', marginTop: 16 }}>{f.n} · {f.f}</div>
              <div style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 12, color: 'var(--lmn-ash-400)', marginTop: 2 }}>{f.d}</div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid var(--lmn-ash-800)' }}>
          {TYPE_SCALE.map((t) => (
            <div key={t.name} style={{ display: 'flex', gap: 24, padding: '22px 0', borderBottom: '1px solid var(--lmn-ash-800)', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <div style={{ width: 150, flex: 'none' }}>
                <Code>{t.name}</Code>
                <div style={{ fontFamily: 'var(--lmn-font-mono)', fontSize: 10.5, color: 'var(--lmn-ash-500)', marginTop: 8, lineHeight: 1.7 }}>
                  {t.px}px · lh {t.lh}<br />ls {t.ls} · {t.w}<br />{t.fam}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 240, fontFamily: famVar[t.family], fontSize: Math.min(t.px, 64), lineHeight: t.lh, letterSpacing: t.ls, fontWeight: t.w, color: 'var(--lmn-ash-100)', textTransform: t.upper ? 'uppercase' : 'none' }}>
                {t.sample}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---- SPACING -------------------------------------------------------------
  function SpacingSection() {
    return (
      <div className="lmn-anim-fade-in-up">
        <SectionHead kicker="Foundations" title="SPACING & RADIUS" desc="Sistema a multipli di 4px per spaziature coerenti. Scala di border-radius dal taglio netto al pill." />
        <Block title="Spacing scale" code="--lmn-space-*">
          <div style={{ width: '100%', maxWidth: 640 }}>
            {SPACING.map((s) => (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
                <span style={{ width: 96, fontFamily: 'var(--lmn-font-mono)', fontSize: 12, color: 'var(--lmn-ash-300)' }}>{s.name}</span>
                <span style={{ width: 44, fontFamily: 'var(--lmn-font-mono)', fontSize: 12, color: 'var(--lmn-ash-500)' }}>{s.px}px</span>
                <span style={{ height: 16, width: s.px, background: 'linear-gradient(90deg, var(--lmn-gold-600), var(--lmn-gold-400))', borderRadius: 3 }} />
              </div>
            ))}
          </div>
        </Block>
        <Block title="Border radius" code="--lmn-radius-*">
          {RADII.map((r) => (
            <div key={r.name} style={{ textAlign: 'center' }}>
              <div style={{ width: 88, height: 88, background: 'var(--lmn-pitch-400)', border: '1px solid var(--lmn-ash-700)', borderRadius: r.px, marginBottom: 10 }} />
              <Code>{r.name}</Code>
              <div style={{ fontFamily: 'var(--lmn-font-mono)', fontSize: 11, color: 'var(--lmn-ash-500)', marginTop: 6 }}>{r.label || r.px + 'px'}</div>
            </div>
          ))}
        </Block>
        <Block title="Elevation" code="--lmn-shadow-* · --lmn-glow-*">
          {[
            { n: 'shadow-sm', sh: 'var(--lmn-shadow-sm)' }, { n: 'shadow-md', sh: 'var(--lmn-shadow-md)' },
            { n: 'shadow-lg', sh: 'var(--lmn-shadow-lg)' }, { n: 'glow-gold', sh: 'var(--lmn-glow-gold)' },
          ].map((e) => (
            <div key={e.n} style={{ textAlign: 'center' }}>
              <div style={{ width: 120, height: 80, background: 'var(--lmn-pitch-400)', borderRadius: 12, boxShadow: e.sh, marginBottom: 12 }} />
              <Code>{e.n}</Code>
            </div>
          ))}
        </Block>
      </div>
    );
  }

  Object.assign(window, { OverviewSection, ColorsSection, TypographySection, SpacingSection });
})();
