/* global React, ReactDOM, Icon, BottomNav, HomeScreen, CalendarScreen, PredictScreen, LeaderboardScreen, ProfileScreen, PredictSheet */
// ============================================================================
// LMN World Cup app — interactive shell (phone frame + tab routing)
// ============================================================================
(function () {
  const { useState } = React;

  function StatusBar() {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 22px 6px', fontFamily: 'var(--lmn-font-ui)', fontWeight: 600, fontSize: 14, color: 'var(--lmn-ash-100)' }}>
        <span>21:47</span>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
          <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor"><rect x="0" y="6" width="3" height="5" rx="1"/><rect x="4.5" y="4" width="3" height="7" rx="1"/><rect x="9" y="2" width="3" height="9" rx="1"/><rect x="13.5" y="0" width="3" height="11" rx="1"/></svg>
          <svg width="22" height="11" viewBox="0 0 22 11" fill="none"><rect x="0.5" y="0.5" width="18" height="10" rx="2.5" stroke="currentColor" opacity="0.5"/><rect x="2" y="2" width="13" height="7" rx="1.2" fill="currentColor"/><rect x="20" y="3.5" width="1.5" height="4" rx="0.75" fill="currentColor" opacity="0.5"/></svg>
        </span>
      </div>
    );
  }

  function App() {
    const [tab, setTab] = useState(0);
    const [sheet, setSheet] = useState(null);
    const screens = [
      <HomeScreen onPredict={setSheet} onGoPredict={() => setTab(2)} />,
      <CalendarScreen onPredict={setSheet} />,
      <PredictScreen />,
      <LeaderboardScreen />,
      <ProfileScreen />,
    ];
    return (
      <div className="phone">
        <div className="phone-screen">
          <StatusBar />
          <div className="phone-content" key={tab}>{screens[tab]}</div>
          <div className="phone-nav"><BottomNav active={tab} onChange={setTab} /></div>
          {sheet && <PredictSheet match={sheet} onClose={() => setSheet(null)} />}
        </div>
        <div className="phone-home-indicator" />
      </div>
    );
  }

  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
})();
