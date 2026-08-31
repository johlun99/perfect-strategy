# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A web-based blackjack trainer. Laravel + Blade serve a thin shell (`routes/web.php`
is just `Route::view` calls — no controllers, models, or database). **The entire
application is the client-side TypeScript game engine** in `resources/js/game/`,
built with Vite. Treat the PHP side as a static host; almost all work happens in TS.

There are three pages/modes, each a page-scoped `<title>route</title>` served from
`resources/views/` and bootstrapped by its own Vite entry:

- **`/blackjack`** — playable blackjack (chips, bankroll, full action set, 6-deck shoe).
- **`/strategy`** — the same table wrapped by a blocking basic-strategy coach.
- **`/hand-value`** — a standalone "call the total" timed quiz.

## Commands

```sh
npm run dev              # Vite dev server with HMR
npm run build            # production build
npm run test             # all Vitest unit + integration tests (vitest run)
npm run test:watch       # watch mode
npx vitest run resources/js/game/engine/hand.test.ts   # a single test file
npx tsc --noEmit         # type-check (no CI does this for you — run it)
php artisan serve        # serve the Blade shell at http://localhost:8000
```

The engine is developed test-first with Vitest (jsdom for the UI integration tests).
There is no meaningful PHP test suite — `tests/` holds only Laravel's example stubs.

## Architecture

### Engine / UI split (the core rule)

`resources/js/game/engine/` is **pure, DOM-free logic** and is exhaustively unit-tested.
`resources/js/game/ui/` does all rendering, audio, and DOM wiring. Keep this boundary:
engine modules must never touch `document`/`window`, so the same engine can back every
mode. Determinism comes from injectable `Rng` (`engine/rng.ts`) and `CardSource`
(`engine/shoe.ts`) — tests pass stubs; production uses the real shuffled shoe.

- `engine/game.ts` — the `Game` state machine (phases: betting → insurance → playerTurn →
  dealerTurn → settled), emitting `GameEvent`s. `ui/table.ts` subscribes and renders.
- `card`, `hand`, `shoe`, `payout`, `bankroll` — the supporting value logic.

### Rulesets

House rules are config objects, not branches. `engine/rules.ts` defines `Ruleset`
(`STANDARD_RULES` = International, `CHERRY_RULES` = Swedish). `ruleset-store.ts` persists
the player's choice in `localStorage` (`bj:ruleset`) and is shared across all modes — read
it via `getSelectedRuleset()`. To change or add house rules, edit the config object; do not
special-case rule differences in engine logic.

### Computed strategy (why `ev.ts` exists)

Cherry's "dealer wins pushes on 17/18/19" rule has no published basic-strategy chart, so
`engine/ev.ts` is an infinite-deck EV solver that *generates* the strategy tables for a
ruleset. `engine/strategy.ts` turns a hand + dealer upcard into a `Recommendation`; don't
hand-code strategy charts — let `ev.ts` derive them.

### Coaching overlay

`ui/coach.ts` (`StrategyCoach`) layers over an existing `Table` + `Game`. It intercepts
action clicks in the **capture phase** so a move that deviates from basic strategy never
reaches the engine — the wrong action is blocked and coached. `ui/hand-value.ts` is the
same block-until-correct idea for the standalone quiz.

## Gotchas

- **New Vite entry = edit `vite.config.js`.** Every mode's CSS+TS pair is listed in the
  `input` array. A new page won't load its assets until added there.
- Match existing engine style: injectable `Rng`/`CardSource`, no DOM in `engine/`, config
  over conditionals for rules.
- The stock `AGENTS.md` still contains the Laravel Boost bootstrap; Boost is not installed
  and running its setup is not required to work here.
