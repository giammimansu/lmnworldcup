/* global React, Icon, ICON_NAMES, FILLED_ICONS, Button, Badge, Avatar, AvatarStack, TextInput, ScoreInput, Toggle, RadioPills, ProgressLinear, ProgressSegmented, ProgressCircular, MatchCard, ScoreCard, UserCard, StatCard, BottomNav, SectionHead, Block, Code */
// ============================================================================
// LMN WORLD CUP — Styleguide sections: components, icons, animations
// ============================================================================
(function () {
  const { useState, useRef } = React;

  const Demo = ({ children, label, col }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: col ? 'stretch' : 'center', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>{children}</div>
      {label && <span style={{ fontFamily: 'var(--lmn-font-mono)', fontSize: 11, color: 'var(--lmn-ash-500)' }}>{label}</span>}
    </div>
  );

  // ---- BUTTONS -------------------------------------------------------------
  function ButtonsSection() {
    const [loading, setLoading] = useState(false);
    return (
      <div className="lmn-anim-fade-in-up">
        <SectionHead kicker="Components" title="BUTTON" desc="Quattro varianti, tre taglie, tutti gli stati. Hover/active animati; loading con spinner." />
        <Block title="Varianti" code="<Button variant='primary' />">
          <Demo label="primary"><Button variant="primary">Conferma pronostico</Button></Demo>
          <Demo label="secondary"><Button variant="secondary">Modifica</Button></Demo>
          <Demo label="ghost"><Button variant="ghost">Salta</Button></Demo>
          <Demo label="danger"><Button variant="danger">Elimina lega</Button></Demo>
        </Block>
        <Block title="Taglie" code="size='sm' | 'md' | 'lg'">
          <Demo label="sm"><Button size="sm">Small</Button></Demo>
          <Demo label="md"><Button size="md">Medium</Button></Demo>
          <Demo label="lg"><Button size="lg">Large</Button></Demo>
        </Block>
        <Block title="Stati">
          <Demo label="default"><Button>Default</Button></Demo>
          <Demo label="disabled"><Button disabled>Disabled</Button></Demo>
          <Demo label="loading"><Button loading>Invio…</Button></Demo>
          <Demo label="click → loading"><Button onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 1600); }} loading={loading}>Conferma</Button></Demo>
        </Block>
        <Block title="Con icona" code="iconLeft / iconRight / iconOnly">
          <Demo label="icon left"><Button iconLeft="ball">Pronostica</Button></Demo>
          <Demo label="icon right"><Button variant="secondary" iconRight="prediction-arrow">Classifica</Button></Demo>
          <Demo label="icon only"><Button iconOnly="whistle" aria-label="Regole" /></Demo>
          <Demo label="ghost icon"><Button variant="ghost" iconOnly="calendar" aria-label="Calendario" /></Demo>
        </Block>
      </div>
    );
  }

  // ---- CARDS ---------------------------------------------------------------
  function CardsSection() {
    return (
      <div className="lmn-anim-fade-in-up">
        <SectionHead kicker="Components" title="CARD" desc="Quattro tipi di card per i contesti chiave del prodotto. Hover: glow oro leggero + translateY(-2px)." />
        <Block title="match-card" code="<MatchCard status='TIMED|LIVE|FINISHED' />">
          <MatchCard home="Brasile" away="Germania" homeCode="BRA" awayCode="GER" group="Gruppo A" time="21:00" status="TIMED" />
          <MatchCard home="Francia" away="Spagna" homeCode="FRA" awayCode="ESP" group="Gruppo C" status="LIVE" score={{ h: 1, a: 1 }} />
          <MatchCard home="Italia" away="Olanda" homeCode="ITA" awayCode="NED" group="Gruppo B" status="FINISHED" score={{ h: 2, a: 0 }} />
        </Block>
        <Block title="score-card" code="<ScoreCard result='esatto|segno|sbagliato' />">
          <ScoreCard home="BRASILE" away="GERMANIA" score={{ h: 3, a: 2 }} result="esatto" />
          <ScoreCard home="FRANCIA" away="SPAGNA" score={{ h: 1, a: 1 }} result="segno" />
          <ScoreCard home="ITALIA" away="OLANDA" score={{ h: 2, a: 0 }} result="sbagliato" />
        </Block>
        <Block title="user-card" code="<UserCard position points trend />">
          <UserCard name="Marco Rossi" position={1} points={248} trend="up" delta={2} />
          <UserCard name="Giulia Conte" position={4} points={211} trend="down" delta={1} />
        </Block>
        <Block title="stat-card" code="<StatCard value unit delta />">
          <StatCard label="Precisione media" value="68" unit="%" delta="+4.2%" positive icon="prediction-arrow" />
          <StatCard label="Risultati esatti" value="12" unit="" delta="+3" positive icon="star" />
          <StatCard label="Posizione lega" value="4" unit="°" delta="-1" positive={false} icon="trophy" />
        </Block>
      </div>
    );
  }

  // ---- INPUTS --------------------------------------------------------------
  function InputsSection() {
    const [pred, setPred] = useState('1');
    return (
      <div className="lmn-anim-fade-in-up">
        <SectionHead kicker="Components" title="INPUT" desc="Dal tabellone score in Bebas Neue ai campi con label flottante, toggle e pill 1X2." />
        <Block title="Score input" code="<ScoreInput />">
          <ScoreInput />
        </Block>
        <Block title="Text input · floating label" code="state='error|success'">
          <div style={{ width: 260 }}><TextInput label="Nome lega" defaultValue="Ufficio Champions" /></div>
          <div style={{ width: 260 }}><TextInput label="Email" state="error" hint="Email non valida" defaultValue="marco@" /></div>
          <div style={{ width: 260 }}><TextInput label="Codice invito" state="success" hint="Lega trovata" defaultValue="LMN-2026" /></div>
          <div style={{ width: 260 }}><TextInput label="Telefono (disabilitato)" disabled /></div>
        </Block>
        <Block title="Toggle" code="<Toggle />">
          <Demo label="off"><Toggle /></Demo>
          <Demo label="on"><Toggle defaultChecked /></Demo>
          <Demo label="disabled"><Toggle disabled /></Demo>
          <Demo label="notifiche"><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 14, color: 'var(--lmn-ash-200)' }}>Avvisi pre-partita</span><Toggle defaultChecked /></div></Demo>
        </Block>
        <Block title="Radio pill · pronostico 1X2" code="<RadioPills options={['1','X','2']} />">
          <RadioPills options={['1', 'X', '2']} value={pred} onChange={setPred} />
          <span style={{ fontFamily: 'var(--lmn-font-mono)', fontSize: 12, color: 'var(--lmn-ash-400)' }}>segno selezionato: <span style={{ color: 'var(--lmn-gold-400)' }}>{pred}</span></span>
        </Block>
      </div>
    );
  }

  // ---- BADGES --------------------------------------------------------------
  function BadgesSection() {
    const groups = ['A', 'B', 'C', 'D', 'E', 'F'];
    return (
      <div className="lmn-anim-fade-in-up">
        <SectionHead kicker="Components" title="BADGE" desc="Badge semantici per stato partita, esito pronostico e gironi. Il badge LIVE pulsa." />
        <Block title="Stato partita">
          <Badge variant="live" live>LIVE 67'</Badge>
          <Badge variant="timed">21:00</Badge>
          <Badge variant="finished">Finita</Badge>
        </Block>
        <Block title="Esito pronostico">
          <Badge variant="esatto">Esatto</Badge>
          <Badge variant="parziale">Parziale</Badge>
          <Badge variant="sbagliato">Sbagliato</Badge>
          <Badge variant="points">+5 PT</Badge>
        </Block>
        <Block title="Gironi" code="variant='group'">
          {groups.map((g) => <Badge key={g} variant="group">Gruppo {g}</Badge>)}
        </Block>
      </div>
    );
  }

  // ---- AVATARS -------------------------------------------------------------
  function AvatarsSection() {
    const names = ['Marco Rossi', 'Giulia Conte', 'Luca Bianchi', 'Sara Verdi', 'Paolo Neri', 'Elena Russo'];
    return (
      <div className="lmn-anim-fade-in-up">
        <SectionHead kicker="Components" title="AVATAR" desc="Iniziali con colore generato deterministicamente dal nome. Cinque taglie, badge posizione e stack." />
        <Block title="Taglie" code="size='xs|sm|md|lg|xl'">
          <Demo label="xs · 24"><Avatar name="Marco Rossi" size="xs" /></Demo>
          <Demo label="sm · 32"><Avatar name="Giulia Conte" size="sm" /></Demo>
          <Demo label="md · 40"><Avatar name="Luca Bianchi" size="md" /></Demo>
          <Demo label="lg · 56"><Avatar name="Sara Verdi" size="lg" /></Demo>
          <Demo label="xl · 80"><Avatar name="Paolo Neri" size="xl" /></Demo>
        </Block>
        <Block title="Colore deterministico dal nome">
          {names.map((n) => <Demo key={n} label={n.split(' ')[0]}><Avatar name={n} size="lg" /></Demo>)}
        </Block>
        <Block title="Con badge posizione" code="position={n}">
          <Demo label="1°"><Avatar name="Marco Rossi" size="lg" position={1} /></Demo>
          <Demo label="2°"><Avatar name="Giulia Conte" size="lg" position={2} /></Demo>
          <Demo label="3°"><Avatar name="Luca Bianchi" size="lg" position={3} /></Demo>
        </Block>
        <Block title="Stack" code="<AvatarStack names max={4} />">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <AvatarStack names={names} size="md" max={4} />
            <span style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 13, color: 'var(--lmn-ash-300)' }}>6 colleghi hanno pronosticato</span>
          </div>
        </Block>
      </div>
    );
  }

  // ---- NAVIGATION ----------------------------------------------------------
  function NavigationSection() {
    const [active, setActive] = useState(0);
    return (
      <div className="lmn-anim-fade-in-up">
        <SectionHead kicker="Components" title="NAVIGATION" desc="Bottom nav a 5 tab con icone custom. La tab attiva è oro con label visibile; un indicatore scorre sotto." />
        <Block title="Bottom nav bar" code="<BottomNav active onChange />">
          <div style={{ width: 380, maxWidth: '100%', background: 'var(--lmn-midnight-700)', borderRadius: 'var(--lmn-radius-lg)', padding: '12px 0 0', boxShadow: 'var(--lmn-shadow-lg)' }}>
            <div style={{ padding: '0 20px 16px', fontFamily: 'var(--lmn-font-ui)', fontSize: 13, color: 'var(--lmn-ash-500)' }}>Tocca le tab per vedere indicatore e label animarsi →</div>
            <BottomNav active={active} onChange={setActive} />
          </div>
        </Block>
      </div>
    );
  }

  // ---- PROGRESS ------------------------------------------------------------
  function ProgressSection() {
    const [circ, setCirc] = useState(0);
    React.useEffect(() => { const t = setTimeout(() => setCirc(72), 250); return () => clearTimeout(t); }, []);
    return (
      <div className="lmn-anim-fade-in-up">
        <SectionHead kicker="Components" title="PROGRESS" desc="Lineare per i pronostici inseriti, segmentata per l'accuracy per giornata, circolare per la precisione nel profilo." />
        <Block title="Lineare" code="<ProgressLinear value max showLabel />">
          <div style={{ width: 360, maxWidth: '100%' }}><ProgressLinear value={7} max={10} showLabel label="Pronostici inseriti" /></div>
        </Block>
        <Block title="Segmentata · accuracy giornata" code="<ProgressSegmented segments />">
          <div style={{ width: 360, maxWidth: '100%' }}>
            <ProgressSegmented segments={['hit', 'hit', 'partial', 'miss', 'hit', 'partial', 'hit', 'hit']} />
            <div style={{ display: 'flex', gap: 16, marginTop: 12, fontFamily: 'var(--lmn-font-ui)', fontSize: 11, color: 'var(--lmn-ash-400)' }}>
              <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: 'var(--lmn-success-500)', marginRight: 5 }} />Esatto</span>
              <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: 'var(--lmn-ember-500)', marginRight: 5 }} />Parziale</span>
              <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: 'var(--lmn-danger-600)', marginRight: 5 }} />Sbagliato</span>
            </div>
          </div>
        </Block>
        <Block title="Circolare" code="<ProgressCircular value />">
          <ProgressCircular value={circ} size={120} />
          <Button variant="secondary" size="sm" onClick={() => { setCirc(0); setTimeout(() => setCirc(40 + Math.round(Math.random() * 55)), 60); }}>Rigioca</Button>
        </Block>
      </div>
    );
  }

  // ---- ICONS ---------------------------------------------------------------
  function IconsSection() {
    return (
      <div className="lmn-anim-fade-in-up">
        <SectionHead kicker="Foundations" title="ICONE" desc="12 icone custom a tema calcistico. 24×24, stroke 1.5, round linecap, currentColor. Ball, trophy e star hanno anche la variante filled." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))', gap: 14 }}>
          {ICON_NAMES.map((n) => (
            <div key={n} style={{ background: 'var(--lmn-pitch-500)', border: '1px solid var(--lmn-ash-800)', borderRadius: 12, padding: '20px 8px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: 'var(--lmn-ash-100)' }}>
              <Icon name={n} size={28} />
              <span style={{ fontFamily: 'var(--lmn-font-mono)', fontSize: 10.5, color: 'var(--lmn-ash-400)' }}>{n}</span>
            </div>
          ))}
        </div>
        <h2 style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 28, letterSpacing: '0.04em', color: 'var(--lmn-ash-100)', margin: '36px 0 16px' }}>Filled</h2>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {FILLED_ICONS.map((n) => (
            <div key={n} style={{ background: 'var(--lmn-pitch-500)', border: '1px solid var(--lmn-ash-800)', borderRadius: 12, padding: '20px 24px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: 'var(--lmn-gold-500)' }}>
              <Icon name={n} size={30} filled />
              <span style={{ fontFamily: 'var(--lmn-font-mono)', fontSize: 10.5, color: 'var(--lmn-ash-400)' }}>{n} · filled</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---- ANIMATIONS ----------------------------------------------------------
  function AnimRow({ name, desc, usage, render }) {
    const [k, setK] = useState(0);
    return (
      <div className="lmn-card" style={{ padding: 20, display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ width: 150, height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--lmn-midnight-700)', borderRadius: 10, overflow: 'hidden', flex: 'none' }}>
          {render(k)}
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <Code>{name}</Code>
          <div style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 14, color: 'var(--lmn-ash-200)', marginTop: 10 }}>{desc}</div>
          <div style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 12, color: 'var(--lmn-ash-500)', marginTop: 4 }}>Usato per: {usage}</div>
        </div>
        <Button variant="secondary" size="sm" iconLeft="prediction-arrow" onClick={() => setK((x) => x + 1)}>Riproduci</Button>
      </div>
    );
  }

  function AnimationsSection() {
    return (
      <div className="lmn-anim-fade-in-up">
        <SectionHead kicker="Foundations" title="ANIMAZIONI" desc="Pattern di motion del prodotto. Premi “Riproduci” per triggerare ogni animazione live." />
        <AnimRow name="fade-in-up · 300ms ease-out" desc="opacity 0→1 + translateY(12px→0)" usage="card al mount, cambio schermata"
          render={(k) => <div key={k} className="lmn-anim-fade-demo" style={{ width: 80, height: 50, borderRadius: 8, background: 'var(--lmn-pitch-300)', border: '1px solid var(--lmn-ash-700)' }} />} />
        <AnimRow name="pulse-gold · 1.5s infinite" desc="scala 1→1.04→1 + glow oro che si espande" usage="bottone conferma, badge LIVE"
          render={() => <div className="lmn-anim-pulse-gold" style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--lmn-gold-500)' }} />} />
        <AnimRow name="slide-in-right · 250ms" desc="translateX(100%→0), cubic-bezier(.16,1,.3,1)" usage="apertura pannello dettaglio"
          render={(k) => <div key={k} className="lmn-anim-slide-in-right" style={{ width: 90, height: 56, borderRadius: 8, background: 'var(--lmn-electric-600)' }} />} />
        <CountUpRow />
        <AnimRow name="score-reveal · 400ms flip" desc="flip verticale carta che rivela il risultato" usage="risultato partita confermato"
          render={(k) => <div key={k} className="lmn-anim-score-flip" style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 40, color: 'var(--lmn-gold-500)', letterSpacing: '0.04em' }}>3:2</div>} />
      </div>
    );
  }

  function CountUpRow() {
    const [val, setVal] = useState(0);
    const raf = useRef(null);
    const run = () => {
      cancelAnimationFrame(raf.current);
      const target = 248, dur = 800, start = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        setVal(Math.round(eased * target));
        if (p < 1) raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    };
    React.useEffect(() => { run(); return () => cancelAnimationFrame(raf.current); }, []);
    return (
      <div className="lmn-card" style={{ padding: 20, display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ width: 150, height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--lmn-midnight-700)', borderRadius: 10, flex: 'none' }}>
          <span style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 44, color: 'var(--lmn-gold-400)' }}>{val}</span>
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <Code>count-up · 800ms ease-out</Code>
          <div style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 14, color: 'var(--lmn-ash-200)', marginTop: 10 }}>numero che incrementa da 0 al valore finale</div>
          <div style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 12, color: 'var(--lmn-ash-500)', marginTop: 4 }}>Usato per: punteggi nel profilo, classifica</div>
        </div>
        <Button variant="secondary" size="sm" iconLeft="prediction-arrow" onClick={run}>Riproduci</Button>
      </div>
    );
  }

  Object.assign(window, {
    ButtonsSection, CardsSection, InputsSection, BadgesSection, AvatarsSection,
    NavigationSection, ProgressSection, IconsSection, AnimationsSection,
  });
})();
