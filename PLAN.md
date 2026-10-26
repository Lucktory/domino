# Build checklist - 1 vs 1 demo

Approved: architecture (engine / protocol / server / web), dependency list.
Scope of this phase: playable 1 vs 1 on two phones. No timer, no money, no accounts.

## Setup
- [x] Root workspace (pnpm via corepack), tsconfig base, .gitignore
- [x] ESLint (typescript-eslint strict + import boundaries via no-restricted-imports; eslint-plugin-boundaries removed), knip, jscpd, vitest
- [x] `pnpm check` script

## packages/engine (pure rules)
- [x] Tiles + double-six set
- [x] RuleSet type + validation (all client rules as settings)
- [x] Deal with injected RNG
- [x] Legal moves, play / draw / pass
- [x] End of hand: domino + blocked (tranque)
- [x] Match: single hand or to N points
- [x] viewFor(state, seat) - only place that builds a player's view
- [x] Tests incl. tile-conservation property test

## packages/protocol
- [x] zod schemas for client -> server events
- [x] Server -> client view types

## apps/server
- [x] env (zod), logger (error codes live in protocol)
- [x] sessions: signed guest token
- [x] tables: in-memory store behind interface, per-table action queue
- [x] create / join by code / action, resume on reconnect (resync dropped: server pushes full view on every change)
- [x] Socket.IO gateway (validate -> service -> emit)
- [x] Tests

## apps/web
- [x] Vite + React + PWA manifest
- [x] Socket client + stored guest token
- [x] Lobby: create / join by code
- [x] Table: board, hand, legal-end picking, draw/pass, result
- [x] Mobile layout (not yet checked on a real phone)

## Finish
- [x] `pnpm check` green
- [~] Live smoke script: two socket clients play full matches on the running server, incl. reconnect. Browser click-through NOT done yet
- [x] Project notes with module map (kept locally, not committed)

## Phase 2: app flow + UI redesign (approved 2026-10-22)
Decisions: animated-tiles hero; sign-up form shows name/phone/password/18+ but only the name is used;
1 vs 1 = quick match; leaving a live match = forfeit (opponent wins at once, 0 points).

Server / engine / protocol
- [x] engine: `forfeit` action (2 seats only), HandResult kind "forfeit"
- [x] tables: visibility public/private, seat `left`, table `closed`; store `listOpen`
- [x] service: quickMatch (global queue), leaveTable (waiting: free seat/close; live: forfeit; finished: mark left)
- [x] service: current table = latest not-left, not-closed; presence only on it; broadcast skips left seats
- [x] service: nickname refreshed when an idempotent create/join returns the same table
- [x] gateway: `match:quick`, `table:leave`, `table:current` (view or null) sent first on connect
- [x] Socket.IO heartbeat 10s/5s
- [x] tests for all of the above

Web
- [x] client adopts a table only from `table:current` or a create/join/quick ack; broadcasts only update it
- [x] `table:current` null while a table is shown -> lobby + "Esa mesa ya no existe"
- [x] screens: landing (animated hero), sign up / sign in, lobby (room cards), private room (code), searching, table, result
- [x] board: snake layout, both open ends marked, end choice by tapping the end (no reflow)
- [x] table: leave with confirm (forfeit), turn banner, opponent avatar, result with both hands, play again
- [x] toast at top, auto-dismiss, cleared on reconnect; connection-failed message on splash
- [x] a11y: dialog focus, live region for turns, toast semantics, valid aria
- [x] ASCII-only source restored + `check:ascii` in `pnpm check`
- [x] browser harness run at 320/390/430/landscape/desktop, full matches, reload/leave/restart

## Open: timeout rule for 3-4 seat tables (2 timeouts in a row only defined for 1 vs 1)

## Pending client answers (placeholders live in apps/server/src/features/tables/demo-rules.ts)
- Tiles per player in 1 vs 1; draw from boneyard or pass
- Who opens; blocked-game (tranque) resolution and ties
- Single hand or to points
- Timer length and timeout action (timer is phase 2)

## Rule assumptions baked into the engine (confirm with client)
- A player who can play may not draw; drawing is one tile per action until a tile fits.
- Blocked hand: lowest pip count wins; a tie means no winner (and, later, a pot rule is needed).
- Hand winner scores the pips left in the other hands.

## Next phase candidates (not started)
- Turn timer + auto-pass/penalty, reconnection window expiry (weeks 4-6 milestone)
- Redis table store, accounts, wallet ledger (PostgreSQL), Wompi, withdrawals, backoffice

## Phase 3: same table for everyone, game moments, English (approved 2026-10-22)
- [x] Board layout in fixed table units (no screen-dependent rounding); one scale per screen, constant all game
- [x] Test: a full 28-tile chain always fits the fixed table
- [x] game-moment.ts: deriveOutcome (win/loss/tie + reason) and deriveTurnMoment, tested
- [x] Outcome and turn components with stable design hooks + empty artwork slot
- [x] i18n: messages-es / messages-en (typed same shape) + key test, LanguageProvider, useCopy
- [x] Notices carry keys/codes, rendered in the current language
- [x] ES | EN toggle on every screen, remembered per device, default es; html lang follows
- [x] translate="no" so browser auto-translate cannot garble the page
- [x] Browser check: two window sizes see the same board; es + en screens; pnpm check

## Phase 4: visual redesign with the generated images (started 2026-10-22)
Character: new (East Asian) Valentina. Old-character images (2, 3/4, 6, 11, avatar 1 of 10) are not used.
13 and 16 have a painted checkerboard (no real transparency): not usable until re-exported.
- [x] Asset pipeline (scratchpad, headless Edge canvas): crop, defringe, trim, WebP into apps/web/src/assets
- [x] Icons 192/512/180 from 9 into apps/web/public; manifest + index.html
- [x] Welcome: 1 full-screen + real buttons
- [x] Sign up / lobby / private / waiting: club background 17/18, logo 20, gold panels; hostess 23 in lobby
- [x] Lobby room cards with table art 19
- [x] Table: felt 7 + rail 21, image tiles (8) with code-drawn pips, avatars (10), hostess hint bubble
- [x] Full-screen results: 22 win, 5 loss, 15 tie
- [x] Mockup styling: gold gradient pill buttons, serif gold titles, gold-trimmed panels
- [x] Remove demo labels (lobby badge, sign-up notice)
- [x] Browser check at 320/390/landscape/desktop, es + en; pnpm check

## Phase 5: turn timer + who-is-who (approved 2026-10-22)
Rules: 15 s per action (every accepted action restarts it); timeout passes the turn; 2 timeouts in a row
by the same seat lose the match (kind "timeout"); own action resets the count.
- [x] engine: RuleSet turnSeconds + timeoutStrikesToForfeit; timeoutStrikes in state; timeoutTurn(); tests
- [x] server: table.turnDeadline (server clock), expireTurn (stale-safe), turn clock scheduler; tests
- [x] protocol/view: turnDeadline + serverNow; client clock offset
- [x] UI: RIVAL / TU seat plates, timer ring (red last 5 s), strike warning, timeout result reasons
- [x] layout: wide screen board overflow fix (hand cut off at 1896x912)
- [x] browser check incl. letting the clock run out; pnpm check

## Phase 6: landscape table + zoom steps (approved 2026-10-23)
Only the game table is landscape on phones; other screens unchanged.
- [x] board-layout: wide landscape table (units), worst-case 28-tile test; zoom views derived from the board only
- [x] Board: pixels-per-unit from the view, animated zoom
- [x] Table screen: full-bleed felt; overlays per the user mockup (top: Salir, RIVAL plate, ES/EN with the pile under it; Valentina hint bottom-left; bottom: TU plate, hand tray, action)
- [x] Portrait phone: rotate prompt (Valentina); Android: button for full screen + landscape lock; unlock on leaving
- [x] PWA manifest orientation "any" (portrait lock would block the landscape table)
- [x] QA harness to landscape for table tests; browser check phone landscape / small landscape / desktop; pnpm check

## Phase 7: landscape layouts for every screen (approved 2026-10-23)
Portrait screens stay as they are; wide screens (>= 4:3) get two columns; near-square windows stay stacked (2026-10-23). Table prompt unchanged.
- [x] Club background visible in landscape
- [x] Welcome: Valentina cutout right (the portrait artwork has its logo baked in above her head), logo + tagline + buttons left
- [x] Sign up / sign in: Valentina + bubble left, form right
- [x] Lobby: compact top bar; room cards in one row (swipe sideways if needed)
- [x] Private table: create left, join right
- [x] Waiting / searching: Valentina + VS left; title, code, buttons right
- [x] Result: artwork left half; title, reason, points, hands, buttons right
- [x] QA every screen at 844x390, 667x375, 1366x768, 1920x1080 (no vertical scroll, nothing cut); portrait unchanged; pnpm check

## Phase 8: 2 vs 2 (pairs), simplest rules (approved 2026-10-23, no client input)
Rules: partners opposite (seats 0+2 vs 1+3); 7 tiles each, no pile (pass); double six opens; one hand per match;
domino -> that player's team wins; tranque -> lower team pip total wins, equal = tie; winning team scores the rivals'
pips; leaving or 2 timeouts in a row -> that player's team loses. Quick match only (private tables stay 1 vs 1).
- [x] engine: RuleSet.teams "none" | "pairs" (pairs needs 4 seats); deriveSide/countSides; winner + scores per side;
      tranque and points by side; leave/timeout = other side wins (any 2-side table); tests
- [x] protocol: GameMode "1v1" | "2v2"; match:quick takes mode; TableView.mode
- [x] server: rules per mode (demo-rules), Table.mode, quick match per mode, private = 1v1; tests
- [x] web: lobby 2v2 card playable; waiting "n of 4"; three top plates in turn order (rival, partner, rival); team result; copy ES/EN
- [x] QA: full 2v2 match with 4 browsers (phone, small phone, desktop) and leave; timeouts covered by engine tests only; 1v1 unchanged; pnpm check

## Phase 9: welcome video + upright rival panel (approved 2026-10-23)
- [x] welcome.mp4 on the landscape welcome (plays once, stays on the last frame; poster = first frame; reduced motion = poster only; portrait unchanged)
- [x] plate-side-rival.webp (28.png) for 2 vs 2 side seats, slot and text area measured; plate-side-partner.webp (29.png) converted, stored for later
- [x] QA landscape/portrait welcome and 2 vs 2 at phone/small/desktop; pnpm check

## Phase 10: 3 and 4 players, each for themselves (approved 2026-10-23)
Rules (most common Draw game, see Pagat Block / Jaques London): 5 tiles each, draw until a tile fits then pass,
highest double opens, tranque = lowest pips wins and scores all others (tie = nobody), one hand per match.
Leaving or 2 timeouts in a row (3+ sides): match ends, leaver loses, fewest pips among the others wins, no points;
tie for fewest = no winner.
- [x] engine: abandon rule for 3+ sides (winner = fewest pips among the others, tie = null); tests
- [x] protocol + server: modes "3p" | "4p", rules in demo-rules, quick match; tests
- [x] web: lobby cards playable; waiting "n de 3/4"; seating (3: left + right; 4: left + top + right); result boxes 2x2; copy
- [x] QA: full 3p and 4p matches + leave at phone / small / desktop; 1v1 and 2v2 unchanged; pnpm check

## Phase 11: host the demo from this computer (approved 2026-10-23)
Web on Vercel; server on this PC behind a free Cloudflare quick tunnel. `pnpm host` starts both and, when the tunnel
address changes, writes it to apps/web/.env.production, commits only that file and pushes (Vercel rebuilds).
Never pushes when main has other unpushed commits or is not the current branch.
- [x] .gitignore allows apps/web/.env.production
- [x] scripts/host.mjs + `pnpm host`
- [x] test: tunnel + health check against a test server; commit/push logic in a throwaway clone (no GitHub)
- [x] pnpm check; commit

## Phase 12: play against the computer (approved 2026-10-26)
Practice games run entirely in the browser (same engine), so they work when the server is down. Computer players
are labelled, see only their own seat's view, move after ~1 s; no turn timer; never connected to money.
- [x] engine: bot.ts chooseBotAction(view) (forced opening, doubles first, heaviest, else draw, else pass); tests incl.
      bot-only full games always finish
- [x] protocol: mode rules move from server demo-rules.ts to protocol (one copy for server and browser)
- [x] web: browser rng; features/practice (local match hook, bot turns, table view); TableScreen reused
- [x] web: lobby never blocked by the connection; offline banner; "En linea | Contra la computadora" switch
      (only the computer while the server is unreachable); waiting screen: button after 15 s
- [x] copy ES/EN; QA server off (every mode) / server on (waiting button) / online regression; pnpm check; commit
