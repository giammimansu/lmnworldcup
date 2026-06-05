# LMN World Cup — App UI Kit

A high-fidelity, click-through recreation of the **LMN World Cup** mobile app, assembled from
the design-system components. It is cosmetic (mocked data, no backend) but pixel-faithful to the
intended product.

## Run it

Open `index.html`. It renders an iPhone-style frame with five working tabs.

## Screens (`screens.jsx`)

| Screen | What it shows |
|---|---|
| **Home** | Greeting, league name, position/points hero card (animated count-up + progress), today's matches (tap a card → prediction sheet), pulse-gold "Pronostica la giornata" CTA. |
| **Calendario** | Matchday selector pills + the full match list. Tap any match to predict. |
| **Pronostica** | The core flow: pick score on the Bebas-Neue scoreboard, choose the 1X2 sign (auto-derived from the score), confirm (pulse-gold), and watch the score-reveal flip + confirmation badge. Step through every open match. |
| **Classifica** | Leaderboard of `UserCard`s; the current player's row gets a gold glow. |
| **Profilo** | XL avatar, circular precision gauge, segmented accuracy bar, and a 2×2 grid of stat cards. |

## Interactions

- **Bottom nav** — 5 tabs; active tab turns gold with its label sliding in and the indicator
  gliding underneath. The center "Pronostica" tab is a raised gold CTA.
- **Prediction sheet** (`PredictSheet`) — slides up from the bottom when you tap a match card,
  with the scoreboard input and a confirm CTA that pulses once a score is entered.

## Structure

- `data.jsx` — mock matches & leaderboard.
- `screens.jsx` — the five screens + the prediction sheet.
- `app.jsx` — phone frame, status bar, tab routing.
- Everything else (Button, Card family, Badge, Avatar, Inputs, Progress, BottomNav, Icon) comes
  straight from the shared library at `../../lib/`.

## Notes / known stand-ins

- **Team badges** use flag emoji as placeholders. On Linux/headless they fall back to two-letter
  country codes (e.g. `BR`, `DE`); on macOS/iOS they render as flags. Swap for real team crests
  when available.
- Animations (count-up, pulse, slide, reveal) are timer/transition-based so they survive throttled
  preview iframes; entrance uses a transform-only rise so content is never gated on the animation
  clock.
