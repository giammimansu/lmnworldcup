---
name: lmn-world-cup-design
description: Use this skill to generate well-branded interfaces and assets for LMN World Cup, a private football-prediction app — either for production or throwaway prototypes/mocks. Contains the essential design guidelines, color & type tokens, fonts, logo, custom icons, and a full UI kit of components for prototyping.
user-invocable: true
---

# LMN World Cup — Design Skill

LMN World Cup is a private, premium football-prediction game played between colleagues.
Tone: serious but not corporate, competitive but friendly, premium but accessible.
Tagline: **Indovina. Scala. Domina.** Aesthetic: dark, gold-accented, scoreboard energy.

## How to use this skill

1. **Read `README.md` first** — it holds the full brand context, content/voice rules, visual
   foundations, and iconography guidance. Then explore the other files.
2. **Grab the tokens** from `colors_and_type.css` (all `--lmn-*` CSS variables: color scales,
   type scale, spacing, radius, shadow, motion). Import the file or copy the `:root` block.
3. **Reuse components** from `lib/` — `lib/icons.jsx` (the `<Icon>` set), `lib/components.jsx`
   + `lib/components.css` (Button, Card family, Badge, Avatar, Inputs, BottomNav, Progress).
4. **Reference the live system** in `LMN World Cup Styleguide.html` and the assembled product in
   `ui_kits/app/index.html`.

## When building

- **Visual artifacts** (slides, mocks, throwaway prototypes): copy the assets you need
  (`assets/logo-*.svg`, `lib/*`, `colors_and_type.css`) into your output folder and produce
  static/interactive HTML for the user to view. Don't hand-roll new colors, fonts, or icons —
  use the tokens and the icon set.
- **Production code**: read the rules here and treat the tokens + components as the contract.

## Non-negotiables

- Fonts: **Bebas Neue** (display/scores/numbers), **DM Sans** (UI), **JetBrains Mono** (data).
- Background is **Midnight** (`#10172A`), surfaces are **Pitch**, the hero accent is **Gold**.
  Use color sparingly and semantically (Gold=action/victory, Electric=live/info, Ember=warning,
  Success=exact, Danger=wrong/LIVE).
- Copy is **Italian**, informal **"tu"**, locker-room confident, **no decorative emoji**.
- Never gate content visibility on an entrance animation (use transform-only rises; keep
  opacity at 1 as the base state).

If the user invokes this skill without guidance, ask what they want to build, ask a few focused
questions, then act as an expert LMN World Cup designer producing HTML artifacts or production code.
