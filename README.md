# Blackjack

A web-based blackjack game. Laravel + Blade serve a thin shell; the whole game
engine runs client-side in TypeScript, built with Vite. Classic Vegas-felt look
with card/chip animations and sound.

## Modes

- **Pure Blackjack** — playable now. Chips + in-session bankroll, blackjack pays
  3:2, full action set (hit, stand, double, split, insurance, surrender), 6-deck
  shoe, dealer stands on soft 17.
- **Card Count** — planned (V2).
- **Perfect Strategy** — planned (V2).

## Requirements

PHP 8.5, Composer, Node 22+, Docker (optional but recommended).

## Run with Docker

```sh
docker compose up -d --build nginx php   # app at http://localhost:8080
npm install && npm run dev               # Vite dev server (HMR) — or `npm run build`
```

The `mysql` service is scaffolded for later persistence work; V1 uses no database.

## Run locally (no Docker)

```sh
composer install
npm install
npm run build            # or `npm run dev`
php artisan serve        # http://localhost:8000
```

## Tests

The game engine is developed test-first with Vitest; the UI has a jsdom
integration test that drives a full round.

```sh
npm run test             # all unit + integration tests
npx tsc --noEmit         # type-check
```

## Structure

```
resources/js/game/
  engine/        pure, DOM-free game logic (unit-tested)
    card, shoe, hand, rules, game, payout, bankroll, rng
  ui/            rendering, audio, table controller
  main.ts        bootstraps the game on the blackjack page
resources/css/   menu.css, game.css
resources/views/ menu.blade.php, blackjack.blade.php
public/assets/   cards (SVG), audio (OGG) — see public/assets/CREDITS.md
```

The engine is intentionally isolated from the DOM so the future Perfect Strategy
mode can reuse it. House rules live in `engine/rules.ts` as a config object,
ready for a V2 settings screen.
