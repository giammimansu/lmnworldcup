import { Badge } from './ui'
import { Icon, type IconName } from './Icon'

// ------------------------------------------------------------- Section
function Section({ title, icon, children }: { title: string; icon: IconName; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--lmn-font-display)', fontSize: 22, letterSpacing: '0.04em', margin: '0 0 12px', color: 'var(--lmn-ash-100)' }}>
        <span style={{ color: 'var(--lmn-gold-500)' }}>
          <Icon name={icon} size={20} />
        </span>
        {title}
      </h2>
      {children}
    </section>
  )
}

// ------------------------------------------------------------- Scoring row
function ScoreRow({ badge, label, desc }: { badge: React.ReactNode; label: string; desc: string }) {
  return (
    <div className="lmn-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
      <div style={{ flexShrink: 0 }}>{badge}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--lmn-font-ui)', fontWeight: 600, fontSize: 14, color: 'var(--lmn-ash-100)' }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--lmn-ash-500)', marginTop: 2 }}>{desc}</div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------- Multiplier row
function MultRow({ stage, mult }: { stage: string; mult: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--lmn-ash-800, #283044)' }}>
      <span style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 14, color: 'var(--lmn-ash-200)' }}>{stage}</span>
      <span style={{ fontFamily: 'var(--lmn-font-mono)', fontSize: 15, fontWeight: 600, color: 'var(--lmn-gold-400)' }}>{mult}</span>
    </div>
  )
}

// ------------------------------------------------------------- Rules body (riusabile)
export function RegoleContent() {
  return (
    <>
      {/* Punteggio risultato */}
      <Section title="PUNTI RISULTATO" icon="goal">
        <ScoreRow
          badge={<Badge variant="esatto">3 PT</Badge>}
          label="Risultato esatto"
          desc="Entrambi i gol indovinati (es. pronostico 2–1, reale 2–1)."
        />
        <ScoreRow
          badge={<Badge variant="parziale">1 PT</Badge>}
          label="Segno giusto"
          desc="1 / X / 2 corretto ma risultato sbagliato."
        />
        <ScoreRow
          badge={<Badge variant="sbagliato">0 PT</Badge>}
          label="Sbagliato"
          desc="Né risultato né segno azzeccati."
        />
      </Section>

      {/* Bonus marcatore */}
      <Section title="BONUS MARCATORE" icon="ball">
        <ScoreRow
          badge={<Badge variant="esatto">+2 PT</Badge>}
          label="Marcatore indovinato"
          desc="+2 per ogni marcatore previsto che segna. Doppietta indovinata = +4. Il bonus NON è moltiplicato per la fase."
        />
      </Section>

      {/* Moltiplicatori di fase */}
      <Section title="MOLTIPLICATORI DI FASE" icon="bracket">
        <div className="lmn-card" style={{ padding: '4px 16px 8px' }}>
          <MultRow stage="Fase a gironi" mult="×1" />
          <MultRow stage="Sedicesimi · Ottavi · Quarti" mult="×2" />
          <MultRow stage="Semifinali · Finale 3°/4° · Finale" mult="×3" />
        </div>
        <p style={{ fontSize: 12, color: 'var(--lmn-ash-500)', marginTop: 8 }}>
          Il moltiplicatore si applica ai punti del risultato (esatto o segno), non al bonus marcatore.
        </p>
      </Section>

      {/* Deadline */}
      <Section title="QUANDO PRONOSTICARE" icon="clock">
        <div className="lmn-card" style={{ padding: '14px 16px' }}>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--lmn-ash-200)', lineHeight: 1.6 }}>
            I pronostici si chiudono al <strong style={{ color: 'var(--lmn-ash-100)' }}>fischio d'inizio</strong> di
            ogni partita. Dopo il calcio d'inizio non puoi più inserire né modificare il pronostico, e diventano
            visibili quelli degli altri giocatori.
          </p>
        </div>
      </Section>

      {/* Knockout */}
      <Section title="FASE A ELIMINAZIONE" icon="whistle">
        <div className="lmn-card" style={{ padding: '14px 16px' }}>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--lmn-ash-200)', lineHeight: 1.6 }}>
            Nelle partite a eliminazione il risultato vale per i <strong style={{ color: 'var(--lmn-ash-100)' }}>90' più eventuali supplementari</strong>.
            I calci di rigore <strong style={{ color: 'var(--lmn-ash-100)' }}>non</strong> contano per il pronostico.
          </p>
        </div>
      </Section>
    </>
  )
}
