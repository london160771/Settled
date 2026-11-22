# PROJECT_STATE — Settled

Progress log. Updated in every phase commit. Newest notes at the top of the log.

## Now

- Current phase: Phase 1 — Gate 0 (paid part blocked); building later phases meanwhile (live checks pending)
- Branch: `claude/project-thread-00viqq` (session's push branch; PR to `main`)
- Blocked on: `MASTER_MNEMONIC` + Sepolia ETH for the operator — see docs/manual/01-gate0-wallet-and-network.md
- Deadline: Dec 1, 2026, 23:59 UTC (internal cutoff 12:00 UTC)

## Phases

| Phase | Name | Status | Commit | Notes |
| --- | --- | --- | --- | --- |
| 0 | Repo setup | Passed | (see log) | Workspaces, ESLint+Prettier, Vitest, config validation, CI, /api/health |
| 1 | Gate 0: prove Telegraph works | Blocked | | Free part done (schemas, rails, escrow signature check). Paid asks need guide 01 |
| 2 | Data, wallets and the cap | Passed | (see log) | Models, HD wallets, escrow top-up, atomic budget, monthly reset |
| 3 | Telegraph client | Passed offline; live smoke pending | (see log) | askIntent (escrow rail), #228 handling, reconcile. Live smoke needs guide 01 |
| 4 | Flight evidence and decision | Passed offline; live run pending | (see log) | airports.json (3,245), EU261-simple, 2 distinct miners + weather, agreement check. Live run needs guide 01 + Gate 0 Option A |
| 5 | Claims and proof page | Passed (mailto path); SMTP live send pending | (see log) | Draft from backed facts only, 2-step confirm, SMTP/mailto, Paid/Rejected, proof data. SMTP: guide 02 (optional) |
| 6 | Web app | Not started | | |
| 7 | Telegram bot | Not started | | Manual stop for BotFather token |
| 8 | Mission 9: Ask and leaderboard | Not started | | |
| 9 | Judge mode and Attack Lab | Not started | | |
| 10 | Release readiness (no deploy) | Not started | | Stops here; Adesope deploys |
| 11 | P1: SLA / uptime claims | Waiting for go | | Only when Adesope says |
| 12 | P1: Contract audit + OpenClaw skill | Waiting for go | | Only when Adesope says |

Status values: Not started, In progress, Passed, Blocked, Waiting for go.

## Gate 0 results

Free part (2026-11-22, run `node server/scripts/gate0.js --free-only`):

- **Payment rail:** the live node's 402 offers `exact` only on Base Sepolia and Solana Devnet, and `escrow` on Ethereum Sepolia (`evidence/gate0/payment-rails.json`). x402 `exact` on Ethereum Sepolia is **not offered**. Decision: pay via the **escrow** scheme on Ethereum Sepolia (see PRD Decisions Log). Operator funds each user's escrow with `depositUSDCFor`; user wallets need no ETH.
- **Escrow signing works:** node accepted our signature and refused only for missing deposit (`evidence/gate0/escrow-signature-check.json`).
- **Intent names (exact):** `TRAVEL_DISRUPTION_GENERAL` (18 miners; plain `TRAVEL_DISRUPTION` has 0), `WEATHER_CHECK_TEMPERATURE` (32), `WEATHER_FORECAST_GENERAL` (26), `WEB_SEARCH_GENERAL` (29), `CRYPTO_PRICE_USD` (56), `CHAT_COMPLETION_GENERAL` (17), `QUESTION_ANSWERING_GENERAL` (17, no input schema → free-form `query`), `SLA_COMPLIANCE_GENERAL` (22), `SERVER_UPTIME_MONITOR_GENERAL` (19, no schema), `CONTRACT_OBLIGATION_AUDIT_GENERAL` (13).
- **TRAVEL_DISRUPTION schema:** param `route_or_flight` only; fields `disrupted, status, delay_minutes, reason`. No scheduled/actual times, no date param.
- **Miner selection:** yes. `POST /engine/v1/ask/{minerId}` with intent+params picks one miner (no budget, no fallback). Escrow is offered there too.
- **Test USDC mint:** public `mint(address,uint256)` on `0xcc19…Ae17` (simulated OK). Needs gas only.
- **Unknown intent:** `GET /engine/v1/intents/X` → 200 with `miner_count: 0`, `request: null`. A POST with an unknown name returns 402 first (payment gate runs first), so we check the free GET before paying.
- **Risk for Option A:** most TRAVEL_DISRUPTION miners are US airport-level, *current* status (FAA, METAR, NWS). Only generalists (TxLens, ChainSight, ReferenceForge, PREFLIGHT) might answer a past individual flight. The paid asks decide A vs B.
- Still open (paid part): Option A or B, first receipt_hash, weather answer.

## Evidence index

- `evidence/gate0/intents.json` — all live Intents with miner counts.
- `evidence/gate0/schemas/*.json` — schemas for every Intent in PRD §7.
- `evidence/gate0/summary-free.json` — params, fields and miners per Intent.
- `evidence/gate0/payment-rails.json` — schemes/networks offered by the 402 (routed and direct).
- `evidence/gate0/escrow-signature-check.json` — signature accepted, deposit missing, nothing charged.

## Log

- 2026-11-22: Phase 5 built. Checks: lint pass; `npm test` → claims 11/11 (invariant 2: unbacked fact blocks draft; invariant 4: no send without a confirm naming the stored address, SMTP send via nodemailer JSON transport with Reply-To, mailto fallback + mark sent, demo accounts locked to demo inbox; invariant 5: duplicate flight refused, parallel drafts → 1 claim; proof data hides email and booking ref). Mailto path verified in tests. **Real SMTP send not verified** (guide 02, optional; SMTP provider is Adesope's choice).
- 2026-11-22: Phase 4 built. `server/data/airports.json` from OurAirports (3,245 large/medium airports with scheduled service). Rules `eu261-simple-1`; evidence: routed TRAVEL_DISRUPTION_GENERAL ask + direct ask to a different miner (`/engine/v1/ask/{minerId}`) + WEATHER_FORECAST_GENERAL at departure; delay = smaller of two agreeing answers. Checks: lint pass; `npm test` → 41 pass, 1 skipped. Fixtures: 3h40m LHR–LOS → Owed 600; 2h10m → NotOwed; disagree → EvidenceConflict; same miner → NeedsMoreProof; JFK–LOS on DL → NotOwed (not covered); cancellation; weather warning; checkCase end-to-end with mocked node. **Not verified live** (needs guide 01, and Gate 0 must show the miners can answer past flights).
- 2026-11-22: Phase 3 built. `askIntent()` in `server/src/services/telegraph/askIntent.js` is the only caller of Telegraph in app code (Gate 0 script uses the low-level client by design). Checks: lint pass; `npm test` → 29 pass, 1 skipped (live). Mocked-HTTP tests: 402→escrow-signed→200 (signature verified by the fake node with viem), multi-miner rows, direct miner ask without budget, 500-but-charged → `charged_on_failure` + one retry only, retry blocked by cap, unknown Intent refused before paying, budget out of range, decision cap, refused-before-payment released, escrow refusal → WALLET_UNFUNDED. `server/scripts/reconcile.js` + tests. **Not verified live:** `LIVE_TELEGRAPH=1 npm test -w server` needs guide 01.
- 2026-11-22: Phase 2 passed. Checks: `npm run lint` → pass; `npm test` → 16/16 (budget: 20 parallel reservations vs cap of 5 → exactly 5 granted; 20 parallel in one decision vs decision cap of 3 → 3; release on failure; charged_on_failure counts as spent; double settle refused; month rollover). Mongo via mongodb-memory-server (download works in the cloud env). Top-up is unit-tested with a fake funder; live top-up waits for guide 01.
- 2026-11-22: Phase 1 free part done; paid part blocked on MASTER_MNEMONIC + operator Sepolia ETH (guide 01). Found: no x402 exact on Ethereum Sepolia → escrow rail. Continuing with Phases 2–3 (do not need funds).
- 2026-11-22: Phase 0 passed. Checks: `npm install` ok; `npm run lint` → pass; `npm test` → 4/4 pass; `npm run build` → pass; `node server/src/index.js` (NODE_ENV=test, dummy vars) → `/api/health` 200; missing vars → clear error, exit 1.
- 2026-11-22: Docs written (PRD, CLAUDE.md, PROJECT_STATE, ROADMAP, README, REAL_VS_MOCKED, CONCEPT-BRIEF). No code yet.
