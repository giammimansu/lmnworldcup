/* global window */
// ============================================================================
// LMN WORLD CUP — Styleguide data (palette, type scale, spacing, sections)
// ============================================================================
(function () {
  const COLORS = [
    {
      name: 'Midnight', token: 'midnight', desc: 'Background primari. Quasi-nero con sottotono blu freddo.',
      shades: [
        { k: 100, hex: '#2A3654' }, { k: 200, hex: '#222D49' }, { k: 300, hex: '#1B2440' },
        { k: 400, hex: '#151D34' }, { k: 500, hex: '#10172A', use: 'Sfondo app', contrast: '—' },
        { k: 600, hex: '#0C1222' }, { k: 700, hex: '#090E1B' }, { k: 800, hex: '#060A14' }, { k: 900, hex: '#03060D' },
      ],
    },
    {
      name: 'Pitch', token: 'pitch', desc: 'Superfici e card. Livello intermedio tra midnight e contenuto.',
      shades: [
        { k: 100, hex: '#2E3A57' }, { k: 200, hex: '#283350' }, { k: 300, hex: '#222C46' },
        { k: 400, hex: '#1D2640' }, { k: 500, hex: '#182038', use: 'Superficie card', contrast: '—' },
        { k: 600, hex: '#141B30' }, { k: 700, hex: '#111728' }, { k: 800, hex: '#0D121F' }, { k: 900, hex: '#090D17' },
      ],
    },
    {
      name: 'Gold', token: 'gold', desc: 'Accent primario, azioni, vittoria. Oro caldo e premium.',
      shades: [
        { k: 100, hex: '#FBF0D2' }, { k: 200, hex: '#F6E0A6' }, { k: 300, hex: '#F0CD74', use: 'Testo accent su scuro', contrast: '11.8:1 · AAA' },
        { k: 400, hex: '#E9BC50', use: 'Hover azioni', contrast: '9.7:1 · AAA' }, { k: 500, hex: '#E0A82E', use: 'Accent primario / fill', contrast: '8.3:1 · AAA' },
        { k: 600, hex: '#C28E1F', use: 'Bordi gold' }, { k: 700, hex: '#9A6F18' }, { k: 800, hex: '#6E4F12' }, { k: 900, hex: '#43300B' },
      ],
    },
    {
      name: 'Electric', token: 'electric', desc: 'Accent secondario, live, alert informativi. Blu elettrico freddo.',
      shades: [
        { k: 100, hex: '#D6E6FF' }, { k: 200, hex: '#A8CBFF' }, { k: 300, hex: '#6FA8FF', use: 'Testo info su scuro', contrast: '7.6:1 · AAA' },
        { k: 400, hex: '#3D86FB', use: 'Icone / link', contrast: '5.1:1 · AA' }, { k: 500, hex: '#1E6BF0', use: 'Accent secondario', contrast: '3.9:1 · AA Large' },
        { k: 600, hex: '#1553C4' }, { k: 700, hex: '#103F95' }, { k: 800, hex: '#0B2C68' }, { k: 900, hex: '#071B3F' },
      ],
    },
    {
      name: 'Ember', token: 'ember', desc: 'Warning, partite in corso, pronostico parziale. Arancio ambrato.',
      shades: [
        { k: 100, hex: '#FDE4CE' }, { k: 200, hex: '#FAC79C' }, { k: 300, hex: '#F6A465', use: 'Testo warning', contrast: '8.6:1 · AAA' },
        { k: 400, hex: '#F2853A', use: 'Icone in-progress', contrast: '7.0:1 · AAA' }, { k: 500, hex: '#E96D1C', use: 'Warning', contrast: '5.4:1 · AA' },
        { k: 600, hex: '#C5550F' }, { k: 700, hex: '#97400B' }, { k: 800, hex: '#6A2D08' }, { k: 900, hex: '#3F1B05' },
      ],
    },
    {
      name: 'Ash', token: 'ash', desc: 'Testi secondari, bordi, stati neutri. Grigio freddo, sottotono blu.',
      shades: [
        { k: 100, hex: '#E8ECF4', use: 'Testo primario', contrast: '15.1:1 · AAA' }, { k: 200, hex: '#CBD3E1', use: 'Testo forte' },
        { k: 300, hex: '#A7B2C6', use: 'Testo secondario', contrast: '8.3:1 · AAA' }, { k: 400, hex: '#8390A8', use: 'Testo terziario', contrast: '5.6:1 · AA' },
        { k: 500, hex: '#657089', use: 'Testo subtle / placeholder' }, { k: 600, hex: '#4C5670' }, { k: 700, hex: '#38415A', use: 'Bordi forti' },
        { k: 800, hex: '#283044', use: 'Bordi default' }, { k: 900, hex: '#1B2233' },
      ],
    },
  ];

  const SEMANTIC = [
    { name: 'Success', token: 'success', hex: '#22A85F', use: 'Pronostico esatto' },
    { name: 'Danger', token: 'danger', hex: '#E5484D', use: 'Errore / LIVE dot' },
  ];

  const TYPE_SCALE = [
    { name: 'display-2xl', px: 72, lh: 0.92, ls: '0.02em', w: 400, fam: 'Bebas Neue', sample: 'BRASILE 3 — GERMANIA 2', family: 'display' },
    { name: 'display-xl', px: 48, lh: 0.95, ls: '0.02em', w: 400, fam: 'Bebas Neue', sample: '3 : 2', family: 'display' },
    { name: 'display-lg', px: 36, lh: 1.0, ls: '0.03em', w: 400, fam: 'Bebas Neue', sample: 'CLASSIFICA GENERALE', family: 'display' },
    { name: 'h1', px: 28, lh: 1.15, ls: '-0.01em', w: 700, fam: 'DM Sans', sample: 'Pronostica la giornata', family: 'ui' },
    { name: 'h2', px: 22, lh: 1.2, ls: '-0.005em', w: 700, fam: 'DM Sans', sample: 'Gruppo A · Matchday 2', family: 'ui' },
    { name: 'h3', px: 18, lh: 1.3, ls: '0', w: 600, fam: 'DM Sans', sample: 'Le tue partite di oggi', family: 'ui' },
    { name: 'body-lg', px: 16, lh: 1.5, ls: '0', w: 400, fam: 'DM Sans', sample: 'Hai 6 pronostici ancora da inserire prima del fischio d\u2019inizio.', family: 'ui' },
    { name: 'body', px: 14, lh: 1.5, ls: '0', w: 400, fam: 'DM Sans', sample: 'Indovina il risultato esatto per guadagnare 5 punti.', family: 'ui' },
    { name: 'body-sm', px: 12, lh: 1.45, ls: '0.01em', w: 400, fam: 'DM Sans', sample: 'Chiusura pronostici 30\u2032 prima del calcio d\u2019inizio.', family: 'ui' },
    { name: 'caption', px: 11, lh: 1.4, ls: '0.04em', w: 500, fam: 'DM Sans', sample: 'MATCHDAY 2', family: 'ui', upper: true },
    { name: 'mono', px: 13, lh: 1.4, ls: '0', w: 500, fam: 'JetBrains Mono', sample: 'Pronostico confermato alle 21:47', family: 'mono' },
  ];

  const SPACING = [
    { name: 'space-1', px: 4 }, { name: 'space-2', px: 8 }, { name: 'space-3', px: 12 }, { name: 'space-4', px: 16 },
    { name: 'space-5', px: 20 }, { name: 'space-6', px: 24 }, { name: 'space-8', px: 32 }, { name: 'space-10', px: 40 },
    { name: 'space-12', px: 48 }, { name: 'space-16', px: 64 },
  ];

  const RADII = [
    { name: 'radius-sm', px: 4 }, { name: 'radius-md', px: 8 }, { name: 'radius-lg', px: 16 },
    { name: 'radius-xl', px: 24 }, { name: 'radius-full', px: 9999, label: '9999' },
  ];

  window.LMN_DATA = { COLORS, SEMANTIC, TYPE_SCALE, SPACING, RADII };
})();
