# LMN WORLD CUP — Design System

> **Indovina. Scala. Domina.**
> Living design system for **LMN World Cup**, a private football-prediction game played between colleagues.

LMN World Cup is a **private, internal prediction app** where colleagues forecast match
scores across a World-Cup-style tournament, earn points, and climb a shared leaderboard.
The tone is **serious but not corporate, competitive but friendly, premium but accessible** —
think the UEFA Champions League app crossed with Sorare and FotMob's dark mode.

This repository is the single source of truth for the brand's look, voice, components and motion.

## Sources

This system was authored **from a written creative brief** (no prior codebase, Figma file, or
brand assets were supplied). Everything here — palette, type scale, logo, icon set, components —
is an original interpretation of that brief. There are therefore **no external links or imported
files** to credit. If a canonical codebase or Figma later exists, link it here.

## What's in this repo

| File / folder | What it is |
|---|---|
| `LMN World Cup Styleguide.html` | **The living styleguide** — a navigable React app. Open this first. Sidebar sections: Overview, Colori, Tipografia, Spacing, Icone, Animazioni, and every Component rendered live & interactive. |
| `colors_and_type.css` | All design tokens as CSS custom properties (`--lmn-*`): full color scales, type scale, spacing, radius, shadow, motion. Plus `@import` of the three Google Fonts. Import this to inherit everything. |
| `lib/icons.jsx` | The 12 custom football icons (+ filled variants) as a React `<Icon>` component. Shared by styleguide and UI kit. |
| `lib/components.jsx` + `lib/components.css` | The full React component library (Button, Card family, Inputs, Badge, Avatar, Nav, Progress) and their CSS states/animations. |
| `styleguide/` | The styleguide app's data + section modules. |
| `assets/` | `logo-mark.svg` (crest) and `logo-full.svg` (crest + wordmark lockup). |
| `preview/` | Small HTML specimen cards that populate the Design System review tab. |
| `ui_kits/app/` | High-fidelity recreation of the LMN World Cup mobile app (core screens, click-through). |
| `SKILL.md` | Agent-Skill manifest so this system can be used as a downloadable skill. |

---

## CONTENT FUNDAMENTALS

How LMN World Cup writes.

- **Language:** Italian. UI copy, labels, and microcopy are all in Italian.
- **Voice:** Locker-room confident, never institutional. It speaks like a sharp, competitive
  friend — direct and a little cocky, but never aggressive or exclusionary.
- **The tagline** — *"Indovina. Scala. Domina."* — sets the cadence: three short imperatives.
  Reuse this staccato, verb-first rhythm in calls to action.
- **Person:** Second person, informal **"tu"** ("Pronostica la giornata", "Le tue partite di
  oggi", "Hai 6 pronostici da inserire"). The app talks *to* the player.
- **Casing:**
  - **Display / Bebas Neue** elements are effectively always **UPPERCASE** (the font is caps-only):
    team names in scorelines, section titles, big numbers — `BRASILE 3 — GERMANIA 2`.
  - **UI / DM Sans** uses **sentence case** for body and headings ("Pronostica la giornata").
  - **Captions / eyebrows** use **UPPERCASE with wide tracking** ("MATCHDAY 2", "GRUPPO A").
- **Numbers & data:** scores, points, positions and timestamps are first-class citizens.
  Timestamps and technical strings render in **JetBrains Mono** ("Pronostico confermato alle 21:47").
- **Emoji:** **Not used** as decoration or in copy. The only emoji-like glyphs are **flag emoji**
  used as lightweight team crests inside match cards — and even those are a placeholder for real
  team badges. Never use 🎉/🔥/⚽ etc. in sentences.
- **Vibe examples:**
  - CTA: *"Conferma pronostico"*, *"Pronostica"*, *"Salta"*
  - Status: *"Pronostico confermato alle 21:47"*, *"Chiusura pronostici 30′ prima del calcio d'inizio"*
  - Result: *"Risultato esatto · +5 PT"*, *"Segno corretto · +2 PT"*, *"Pronostico errato"*
  - Empty/onboarding: *"Indovina il risultato esatto per guadagnare 5 punti."*

---

## VISUAL FOUNDATIONS

- **Mood:** Dark, premium, sporting. The app lives at night under the floodlights.
- **Backgrounds:** Deep, near-black **Midnight** (`#10172A`) with a cool blue undertone — flat,
  never gradient-washed. No photographic hero backgrounds, no noise textures by default.
  Depth comes from **layering surfaces** (Midnight → Pitch → raised Pitch), not from imagery.
- **Surfaces / cards:** **Pitch** tones (`#182038`) one step above the background, with a hairline
  **Ash-800** border (`#283044`) and `radius-lg` (16px) corners. Cards are quiet by default;
  elevation is subtle (`shadow-md`).
- **Color usage:** **Gold** is the hero — reserved for primary actions, victory, points, the active
  state. **Electric** blue is the secondary accent for live/informational moments. **Ember** signals
  in-progress/warning, **Success** green = exact prediction, **Danger** red = wrong / the pulsing
  LIVE dot. Color is used **sparingly and meaningfully** — most of the UI is Midnight + Ash text.
- **Typography:** **Bebas Neue** (condensed display caps) for scores, big numbers and titles gives
  the scoreboard energy; **DM Sans** for all UI text keeps it clean and legible; **JetBrains Mono**
  for timestamps/codes/tokens.
- **Spacing:** strict **4px base** scale. Card padding typically `space-4`/`space-5` (16–20px),
  section rhythm `space-8`+ (32px+).
- **Corner radii:** `sm 4 / md 8 / lg 16 / xl 24 / full`. Buttons & inputs `md`, cards `lg`,
  badges & pills `full`, score boxes `md`.
- **Borders:** hairline 1px, **Ash-800** default, **Ash-700** for stronger separation, **Gold-600**
  on hover/focus emphasis.
- **Shadows / elevation:** soft, cool, low-opacity black shadows (`shadow-sm/md/lg`). The signature
  **glow-gold** ring (`0 0 0 1px gold + soft gold blur`) appears on hover for interactive cards and
  on the confirm-prediction CTA.
- **Hover states:** interactive cards lift `translateY(-2px)` and gain a **gold border + faint gold
  glow**. Buttons lighten one gold step (`gold-500 → gold-400`) and grow a soft gold shadow; ghost
  buttons fill with a Pitch tint.
- **Press / active states:** buttons compress — `translateY(1px) scale(0.985)`; the bottom-nav CTA
  circle scales to `0.92`. Tactile, quick.
- **Transparency & blur:** used lightly — semi-transparent color washes behind badges
  (e.g. `rgba(gold, 0.16)`), and subtle `rgba` glows. No heavy glassmorphism.
- **Imagery vibe:** when photography appears it should be **cool-toned, high-contrast night
  football** (floodlit pitches, crowds). Team identity is carried by **crest/flag marks**, not
  full-bleed photos. Avoid warm, sunny, or washed-out imagery.
- **Animation & motion:**
  - Easing: signature **`cubic-bezier(0.16, 1, 0.3, 1)`** (ease-out) for entrances & movement;
    standard `cubic-bezier(0.4,0,0.2,1)` for state changes.
  - Durations: `fast 150ms` (hover/press), `base 250ms` (toggles, slide-in), `slow 400ms` (reveals).
  - Patterns: **fade-in-up** (cards/screens), **pulse-gold** (confirm CTA, LIVE), **slide-in-right**
    (detail panels), **count-up** (points/leaderboard), **score-reveal** (vertical card flip).
  - No gratuitous looping decoration. Motion is purposeful and respects `prefers-reduced-motion`.
- **Layout rules:** the mobile app uses a fixed **bottom nav** (5 tabs, center CTA raised) and a
  scrolling content area. The styleguide uses a fixed left sidebar + scrolling content (collapses to
  a horizontal scrollable top-nav under 860px).

---

## ICONOGRAPHY

- **Primary set:** a **custom 12-icon football set**, drawn specifically for LMN World Cup:
  `ball · goal · whistle · trophy · bracket · calendar · clock · fire · lightning · shield · star ·
  prediction-arrow`. All are **24×24, stroke-based, stroke-width 1.5, round caps & joins,
  `currentColor`** so they inherit text color. **`ball`, `trophy` and `star` also ship filled
  variants** for active/emphasis states (e.g. the active bottom-nav tab, the center CTA).
- **Where they live:** `lib/icons.jsx` exposes a single `<Icon name="…" size filled />` component.
  This is the canonical source — copy it, don't redraw. Names are listed in `window.ICON_NAMES`.
- **Style rules:** keep the 1.5 stroke and round terminals; never mix filled and stroked weights in
  the same cluster except where a filled icon marks an *active* state. Icons inherit `currentColor`,
  so they're tinted via text color (Gold for active, Ash for inactive).
- **Emoji:** **not** part of the icon system. The one exception is **flag emoji used as stand-in team
  badges** inside match cards — a deliberate placeholder until real team crests are supplied.
- **No icon font / no PNG icons** — everything is inline SVG via the React component, which keeps
  icons crisp, recolorable and themable.
- **Logo:** `assets/logo-mark.svg` (hexagonal crest with a soccer-panel pentagon motif + "LMN") and
  `assets/logo-full.svg` (crest + two-line "LMN / WORLD CUP" wordmark). Gold-on-Midnight.

---

## Index / where to go next

1. **`LMN World Cup Styleguide.html`** — start here; it renders the entire system live.
2. **`colors_and_type.css`** — grab tokens for any new work.
3. **`lib/`** — reusable `<Icon>` and component library + their CSS.
4. **`ui_kits/app/`** — see the components assembled into the real product (`index.html`).
5. **`SKILL.md`** — use this system as an installable agent skill.

### Font substitution note
The three fonts in the brief — **Bebas Neue**, **DM Sans**, **JetBrains Mono** — are all genuine
Google Fonts and are loaded directly via `@import`. **No substitutions were necessary.** If you need
the system fully offline, download these families into a `fonts/` folder and swap the `@import` for
`@font-face` rules.
