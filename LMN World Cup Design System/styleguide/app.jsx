/* global React, ReactDOM, OverviewSection, ColorsSection, TypographySection, SpacingSection, ButtonsSection, CardsSection, InputsSection, BadgesSection, AvatarsSection, NavigationSection, ProgressSection, IconsSection, AnimationsSection */
// ============================================================================
// LMN WORLD CUP — Living styleguide shell (sidebar + router)
// ============================================================================
(function () {
  const { useState, useEffect } = React;

  const NAV = [
    { id: 'overview', label: 'Overview', render: () => <OverviewSection /> },
    { group: 'Foundations' },
    { id: 'colors', label: 'Colori', render: () => <ColorsSection /> },
    { id: 'type', label: 'Tipografia', render: () => <TypographySection /> },
    { id: 'spacing', label: 'Spacing', render: () => <SpacingSection /> },
    { id: 'icons', label: 'Icone', render: () => <IconsSection /> },
    { id: 'anim', label: 'Animazioni', render: () => <AnimationsSection /> },
    { group: 'Componenti' },
    { id: 'button', label: 'Button', render: () => <ButtonsSection /> },
    { id: 'card', label: 'Card', render: () => <CardsSection /> },
    { id: 'input', label: 'Input', render: () => <InputsSection /> },
    { id: 'badge', label: 'Badge', render: () => <BadgesSection /> },
    { id: 'avatar', label: 'Avatar', render: () => <AvatarsSection /> },
    { id: 'nav', label: 'Navigation', render: () => <NavigationSection /> },
    { id: 'progress', label: 'Progress', render: () => <ProgressSection /> },
  ];

  const items = NAV.filter((n) => n.id);

  function App() {
    const [cur, setCur] = useState(() => (location.hash.replace('#', '') || 'overview'));
    useEffect(() => {
      const onHash = () => setCur(location.hash.replace('#', '') || 'overview');
      window.addEventListener('hashchange', onHash);
      return () => window.removeEventListener('hashchange', onHash);
    }, []);
    const go = (id) => { location.hash = id; setCur(id); const main = document.getElementById('lmn-main'); if (main) main.scrollTop = 0; };
    const active = items.find((i) => i.id === cur) || items[0];

    return (
      <div className="lmn-shell">
        <aside className="lmn-sidebar">
          <a href="#overview" onClick={() => go('overview')} style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', padding: '4px 4px 0' }}>
            <img src="assets/logo-mark.svg" width="44" height="44" alt="" style={{ flex: 'none' }} />
            <span>
              <span style={{ display: 'block', fontFamily: 'var(--lmn-font-display)', fontSize: 26, lineHeight: 0.8, color: 'var(--lmn-ash-100)', letterSpacing: '0.02em' }}>LMN</span>
              <span style={{ display: 'block', fontFamily: 'var(--lmn-font-ui)', fontSize: 10, fontWeight: 500, letterSpacing: '0.28em', color: 'var(--lmn-ash-400)', marginTop: 3 }}>WORLD CUP</span>
            </span>
          </a>
          <div style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--lmn-gold-600)', padding: '2px 6px 18px' }}>Design System</div>
          <nav className="lmn-nav">
            {NAV.map((n, i) => n.group
              ? <div key={'g' + i} className="lmn-nav-group">{n.group}</div>
              : <a key={n.id} href={'#' + n.id} className={'lmn-navlink' + (cur === n.id ? ' is-active' : '')} onClick={(e) => { e.preventDefault(); go(n.id); }}>{n.label}</a>
            )}
          </nav>
          <div className="lmn-sidebar-foot">v1.0 · Indovina. Scala. Domina.</div>
        </aside>
        <main className="lmn-main" id="lmn-main">
          <div className="lmn-content">{active.render()}</div>
        </main>
      </div>
    );
  }

  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
})();
