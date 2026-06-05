/* global React, Icon, Button, Badge, Avatar, AvatarStack, MatchCard, UserCard, StatCard, ScoreInput, RadioPills, ProgressLinear, ProgressSegmented, ProgressCircular, TeamBadge, LMN_APP */
// ============================================================================
// LMN World Cup app — screens (cosmetic recreation)
// ============================================================================
(function () {
  const { useState, useRef, useEffect } = React;
  const S = { padding: '20px 16px 24px' };

  function ScreenHeader({ title, sub, right }) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          {sub && <div style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--lmn-gold-500)', marginBottom: 4 }}>{sub}</div>}
          <h1 style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 38, letterSpacing: '0.02em', color: 'var(--lmn-ash-100)', margin: 0, lineHeight: 0.9 }}>{title}</h1>
        </div>
        {right}
      </div>
    );
  }

  // ---- HOME ----------------------------------------------------------------
  function HomeScreen({ onPredict, onGoPredict }) {
    const today = LMN_APP.matches.filter((m) => m.status !== 'FINISHED');
    return (
      <div className="lmn-anim-fade-in-up" style={S}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <div style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 13, color: 'var(--lmn-ash-400)' }}>Buonasera</div>
            <div style={{ fontFamily: 'var(--lmn-font-ui)', fontWeight: 700, fontSize: 20, color: 'var(--lmn-ash-100)' }}>Ufficio Champions</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ color: 'var(--lmn-ash-400)', position: 'relative' }}><Icon name="lightning" size={22} /><span style={{ position: 'absolute', top: -1, right: -1, width: 7, height: 7, borderRadius: '50%', background: 'var(--lmn-gold-500)' }} /></span>
            <Avatar name="Tu Player" size="md" />
          </div>
        </div>

        <div className="lmn-card" style={{ padding: 18, marginBottom: 16, background: 'linear-gradient(135deg, var(--lmn-pitch-400), var(--lmn-pitch-600))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--lmn-ash-400)' }}>La tua posizione</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <span style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 46, color: 'var(--lmn-gold-500)', lineHeight: 1 }}>4°</span>
                <span style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 13, color: 'var(--lmn-success-400)' }}>▲ 3</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <CountUp value={211} style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 40, color: 'var(--lmn-ash-100)', lineHeight: 1 }} />
              <div style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--lmn-ash-500)' }}>punti</div>
            </div>
          </div>
          <div style={{ marginTop: 16 }}><ProgressLinear value={2} max={5} showLabel label="Pronostici giornata 2" /></div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '6px 2px 12px' }}>
          <h3 style={{ fontFamily: 'var(--lmn-font-ui)', fontWeight: 700, fontSize: 16, color: 'var(--lmn-ash-100)', margin: 0, whiteSpace: 'nowrap' }}>Partite di oggi</h3>
          <span style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 12, color: 'var(--lmn-ash-400)' }}>{today.length} match</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {today.map((m) => (
            <MatchCard key={m.id} {...m} hoverable onClick={() => onPredict(m)} score={m.score} />
          ))}
        </div>

        <div style={{ marginTop: 20 }}>
          <Button variant="primary" size="lg" iconLeft="ball" className="lmn-anim-pulse-gold" style={{ width: '100%' }} onClick={onGoPredict}>Pronostica la giornata</Button>
        </div>
      </div>
    );
  }

  // ---- CALENDAR ------------------------------------------------------------
  function CalendarScreen({ onPredict }) {
    const [md, setMd] = useState(2);
    return (
      <div className="lmn-anim-fade-in-up" style={S}>
        <ScreenHeader sub="World Cup 2026" title="Calendario" />
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 8 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setMd(n)} style={{ flex: 'none', border: '1px solid ' + (md === n ? 'var(--lmn-gold-500)' : 'var(--lmn-ash-700)'), background: md === n ? 'rgba(224,168,46,0.12)' : 'transparent', color: md === n ? 'var(--lmn-gold-400)' : 'var(--lmn-ash-300)', borderRadius: 'var(--lmn-radius-full)', padding: '8px 16px', fontFamily: 'var(--lmn-font-ui)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Giornata {n}</button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {LMN_APP.matches.map((m) => <MatchCard key={m.id} {...m} hoverable onClick={() => onPredict(m)} score={m.score} />)}
        </div>
      </div>
    );
  }

  // ---- PREDICT (full screen flow) ------------------------------------------
  function PredictScreen({ onConfirmDone }) {
    const open = LMN_APP.matches.filter((m) => m.status === 'TIMED');
    const [i, setI] = useState(0);
    const m = open[i];
    const [sc, setSc] = useState({ h: '', a: '' });
    const [sign, setSign] = useState(null);
    const [done, setDone] = useState(false);
    const next = () => { setDone(false); setSc({ h: '', a: '' }); setSign(null); setI((x) => (x + 1) % open.length); };

    const deriveSign = (s) => { if (s.h === '' || s.a === '') return null; return +s.h > +s.a ? '1' : +s.h < +s.a ? '2' : 'X'; };
    const onScore = (s) => { setSc(s); const ds = deriveSign(s); if (ds) setSign(ds); };

    return (
      <div className="lmn-anim-fade-in-up" style={S}>
        <ScreenHeader sub={`Giornata 2 · ${i + 1}/${open.length}`} title="Pronostica" />
        <div className="lmn-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Badge variant="group">{m.group}</Badge>
            <Badge variant="timed">{m.time}</Badge>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0' }}>
            <div style={{ textAlign: 'center', flex: 1 }}><TeamBadge code={m.homeCode} size={34} /><div style={{ fontFamily: 'var(--lmn-font-ui)', fontWeight: 600, fontSize: 13, color: 'var(--lmn-ash-100)', marginTop: 6 }}>{m.home}</div></div>
            <span style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 22, color: 'var(--lmn-ash-600)' }}>vs</span>
            <div style={{ textAlign: 'center', flex: 1 }}><TeamBadge code={m.awayCode} size={34} /><div style={{ fontFamily: 'var(--lmn-font-ui)', fontWeight: 600, fontSize: 13, color: 'var(--lmn-ash-100)', marginTop: 6 }}>{m.away}</div></div>
          </div>

          {!done ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}><ScoreInput value={sc} onChange={onScore} homeLabel={m.homeCode} awayLabel={m.awayCode} /></div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><RadioPills options={['1', 'X', '2']} value={sign} onChange={setSign} /></div>
            </>
          ) : (
            <div style={{ textAlign: 'center', margin: '18px 0' }}>
              <div className="lmn-anim-score-flip" style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 56, color: 'var(--lmn-gold-500)', letterSpacing: '0.04em' }}>{sc.h || 0} : {sc.a || 0}</div>
              <div style={{ marginTop: 10 }}><Badge variant="esatto">Pronostico confermato</Badge></div>
              <div style={{ fontFamily: 'var(--lmn-font-mono)', fontSize: 12, color: 'var(--lmn-ash-500)', marginTop: 10 }}>Confermato alle 21:47</div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
          {!done ? (
            <Button variant="primary" size="lg" className={sc.h !== '' && sc.a !== '' ? 'lmn-anim-pulse-gold' : ''} disabled={sc.h === '' || sc.a === ''} style={{ flex: 1 }} onClick={() => setDone(true)} iconLeft="prediction-arrow">Conferma pronostico</Button>
          ) : (
            <Button variant="secondary" size="lg" style={{ flex: 1 }} onClick={next} iconRight="prediction-arrow">Prossima partita</Button>
          )}
        </div>
      </div>
    );
  }

  // ---- LEADERBOARD ---------------------------------------------------------
  function LeaderboardScreen() {
    return (
      <div className="lmn-anim-fade-in-up" style={S}>
        <ScreenHeader sub="Ufficio Champions" title="Classifica" right={<Badge variant="points">Giornata 2</Badge>} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {LMN_APP.leaderboard.map((u, idx) => (
            <div key={u.name} style={u.me ? { boxShadow: 'var(--lmn-glow-gold)', borderRadius: 'var(--lmn-radius-lg)' } : null}>
              <UserCard name={u.name} position={idx + 1} points={u.points} trend={u.trend} delta={u.delta} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---- PROFILE -------------------------------------------------------------
  function ProfileScreen() {
    const [p, setP] = useState(0);
    useEffect(() => { const t = setTimeout(() => setP(68), 250); return () => clearTimeout(t); }, []);
    return (
      <div className="lmn-anim-fade-in-up" style={S}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
          <Avatar name="Tu Player" size="xl" />
          <div style={{ fontFamily: 'var(--lmn-font-ui)', fontWeight: 700, fontSize: 20, color: 'var(--lmn-ash-100)', marginTop: 12 }}>Tu</div>
          <div style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 13, color: 'var(--lmn-ash-400)' }}>4° su 12 · 211 punti</div>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 18 }}>
          <ProgressCircular value={p} size={104} label="precisione" />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 13, color: 'var(--lmn-ash-300)', marginBottom: 8 }}>Accuracy ultime 8 partite</div>
            <ProgressSegmented segments={['hit', 'hit', 'partial', 'miss', 'hit', 'hit', 'partial', 'hit']} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <StatCard label="Risultati esatti" value="12" unit="" delta="+3" positive icon="star" />
          <StatCard label="Segni corretti" value="31" unit="" delta="+5" positive icon="prediction-arrow" />
          <StatCard label="Striscia" value="4" unit="" delta="best 7" positive icon="fire" />
          <StatCard label="Trofei" value="2" unit="" delta="+1" positive icon="trophy" />
        </div>
      </div>
    );
  }

  // ---- helpers -------------------------------------------------------------
  function CountUp({ value, style }) {
    const [v, setV] = useState(value);
    useEffect(() => {
      // timer-based (rAF can be throttled to 0 in preview/background iframes)
      const steps = 26, dur = 760; let i = 0;
      setV(0);
      const id = setInterval(() => {
        i++; const p = i / steps;
        setV(Math.round((1 - Math.pow(1 - p, 3)) * value));
        if (i >= steps) { setV(value); clearInterval(id); }
      }, dur / steps);
      return () => clearInterval(id);
    }, [value]);
    return <span style={style}>{v}</span>;
  }

  // ---- Predict bottom sheet ------------------------------------------------
  function PredictSheet({ match, onClose }) {
    const [sc, setSc] = useState(match.predicted || { h: '', a: '' });
    const [done, setDone] = useState(false);
    if (!match) return null;
    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 30, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(3,6,13,0.6)', backdropFilter: 'blur(2px)' }} />
        <div className="lmn-anim-slide-up" style={{ position: 'relative', background: 'var(--lmn-pitch-600)', borderRadius: '20px 20px 0 0', borderTop: '1px solid var(--lmn-ash-700)', padding: '16px 18px 24px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 4, background: 'var(--lmn-ash-700)', margin: '0 auto 16px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Badge variant="group">{match.group}</Badge><Badge variant="timed">{match.time}</Badge>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ textAlign: 'center', flex: 1 }}><TeamBadge code={match.homeCode} size={30} /><div style={{ fontSize: 13, fontWeight: 600, marginTop: 4, color: 'var(--lmn-ash-100)' }}>{match.home}</div></div>
            <span style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 20, color: 'var(--lmn-ash-600)' }}>vs</span>
            <div style={{ textAlign: 'center', flex: 1 }}><TeamBadge code={match.awayCode} size={30} /><div style={{ fontSize: 13, fontWeight: 600, marginTop: 4, color: 'var(--lmn-ash-100)' }}>{match.away}</div></div>
          </div>
          {!done ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 18px' }}><ScoreInput value={sc} onChange={setSc} homeLabel={match.homeCode} awayLabel={match.awayCode} /></div>
              <Button variant="primary" size="lg" disabled={sc.h === '' || sc.a === ''} className={sc.h !== '' && sc.a !== '' ? 'lmn-anim-pulse-gold' : ''} style={{ width: '100%' }} onClick={() => setDone(true)}>Conferma pronostico</Button>
            </>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div className="lmn-anim-score-flip" style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 48, color: 'var(--lmn-gold-500)' }}>{sc.h || 0} : {sc.a || 0}</div>
              <div style={{ margin: '10px 0 16px' }}><Badge variant="esatto">Pronostico confermato</Badge></div>
              <Button variant="secondary" size="md" style={{ width: '100%' }} onClick={onClose}>Chiudi</Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  Object.assign(window, { HomeScreen, CalendarScreen, PredictScreen, LeaderboardScreen, ProfileScreen, PredictSheet });
})();
