# PROJECT_STATE — Settled

Progress log. Updated in every phase commit. Newest notes at the top of the log.

## Now

- Current phase: P0 complete with SLA as the main path (Gate 0 Option B). Live-verified: Gate 0, Telegraph client, Mission 9, SLA check (script + bot), bot /start. Left for the agent: video script + submission draft. Left for Adesope: deploy (guide 04), optional SMTP (guide 02), video, submission, P1 go/no-go.
- Branch: `claude/project-thread-00viqq` (session's push branch; PR to `main`)
- Blocked on: nothing hard. Token set (guide 03 done); live `/start` passed 2026-11-23. Bot `/topup` + `sla vercel 2026-10 400` live check passed 2026-11-23 (Owed, 40 USD). Waiting (non-blocking): SMTP (guide 02, optional).
- Deadline: Dec 1, 2026, 23:59 UTC (internal cutoff 12:00 UTC)

## Phases

| Phase | Name | Status | Commit | Notes |
| --- | --- | --- | --- | --- |
| 0 | Repo setup | Passed | (see log) | Workspaces, ESLint+Prettier, Vitest, config validation, CI, /api/health |
| 1 | Gate 0: prove Telegraph works | Passed — Option B chosen (SLA main path) | (see log) | Real receipts saved; no miner answers a past flight's delay |
| 2 | Data, wallets and the cap | Passed | (see log) | Models, HD wallets, escrow top-up, atomic budget, monthly reset |
| 3 | Telegraph client | Passed (live smoke done) | (see log) | askIntent (escrow rail), #228 handling, reconcile. Live smoke needs guide 01 |
| 4 | Flight evidence and decision | Passed offline; live: miners can't report past delays (secondary path) | (see log) | airports.json (3,245), EU261-simple, 2 distinct miners + weather, agreement check. Live run needs guide 01 + Gate 0 Option A |
| 5 | Claims and proof page | Passed (mailto path); SMTP live send pending | (see log) | Draft from backed facts only, 2-step confirm, SMTP/mailto, Paid/Rejected, proof data. SMTP: guide 02 (optional) |
| 6 | Web app | Passed | (see log) | Auth (cookie JWT), API, all §4.1 pages except Judge/Ask/Leaderboard |
| 7 | Telegram bot | Passed (live /start 2026-11-23) | (see log) | grammY bot in-process, all §4.2 commands, due-case worker. Token: guide 03 |
| 8 | Mission 9: Ask and leaderboard | Passed (live: 4 receipts, 5th CAP_EXCEEDED) | (see log) | Router, /ask /price /weather /search (web + bot), opt-in leaderboard. Live: `node server/scripts/mission9.js` after guide 01 |
| 9 | Judge mode and Attack Lab | Passed (live timed run 8.9 s, 2026-11-23) | (see log) | /judge, seed-judge.js, Run the demo, 6 attacks, daily limit. Real timing needs guide 01 |
| 10 | Release readiness (no deploy) | Passed (refresh numbers after live runs) | (see log) | README, REAL_VS_MOCKED, tutorial draft, deploy guide 04, clean clone verified |
| 11 | SLA / uptime claims (moved into P0, Option B) | Passed (live: Vercel 2026-10 → Owed, 2 receipts) | | `evidence/sla/live-check.json` |
| 12 | P1: Contract reading + OpenClaw skill | Contract reading passed (live); OpenClaw skipped (Adesope's go covered contract reading only) | | `evidence/contract/` |

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

Paid part (2026-11-23, operator `0x6029…7AC5`, test user HD index 1 `0xF308…Dfb8`, escrow funded 0.50 test USDC via mint + `depositUSDCFor`, `evidence/gate0/funding.json`):

- **First receipt_hash:** `0x1225169aa60e9461918e68d3984390367b43838c8ae2c3d40722a1ef66a91f9c` (TRAVEL_DISRUPTION_GENERAL, TxLens, 0.01, 626 ms, epoch 43).
- **Weather:** WEATHER_CHECK_TEMPERATURE London → 7 °C (PREFLIGHT, receipt `0xa4ce76b8…81ac`).
- **Travel answers for BA75 LHR–LOS 2026-11-20** (`evidence/gate0/ask-travel-*.json`, `probe-*.json`): no miner returned `delay_minutes`. TxLens: "route operating normally" (disrupted false, delay missing). ChainSight (302): "On time", delay missing. PREFLIGHT: "LHR and LOS is not a US airport this miner covers… unknown". FAA miner 82001: HTTP 500 (FAA site 403). ReferenceForge: HTTP 500 (Boston transit only). A routed ask with a 0.04 budget did not recover the missing field either.
- **Verdict: Option A fails for this case** (miners can't give a past flight's delay; the generalist answers look like generic text, not flight data). Option B (SLA path) is recommended; waiting for Adesope's go because it brings Phase 11 into P0.
- **Billing seen:** ledger `unbilled` 150000 μUSDC after 15 attempted paid asks. QUESTION_ANSWERING_GENERAL answered with miner "openai", cost 0 and **no receipt header**, so `/ask` now routes to CHAT_COMPLETION_GENERAL (receipted). `askIntent()` now counts the quoted price when a 200 has no receipt (was 0). Whether one of the two HTTP 500s was charged (#228) will show once the epoch root lands: run `node server/scripts/reconcile.js` later.
- Live Phase 3 smoke: `evidence/live/phase3-smoke.json` (CRYPTO_PRICE_USD, receipt `0x6c882320…6ee6f`).
- Live Mission 9: `evidence/mission9/run.json` — 4 paid asks, 4 receipts (price, weather, search, ask), 5th refused `CAP_EXCEEDED`. Earlier runs kept for honesty: `run-1-cap-bug.json` (QA ask counted 0 so the 5th slipped through; fixed), `run-2-qa-no-receipt.json`.

## Evidence index

- `evidence/sla/probe-*.json` — live SLA miner probes (2026-11-23); `evidence/sla/live-check.json` — live end-to-end SLA check → Owed + draft.

- `evidence/gate0/ask-*.json`, `probe-*.json`, `summary-paid.json`, `funding.json` — paid Gate 0 asks and escrow funding (2026-11-23).
- `evidence/live/phase3-smoke.json` — Phase 3 live smoke ask.
- `evidence/mission9/run.json` — live Mission 9 run (4 receipts + CAP_EXCEEDED); `run-1-*.json`, `run-2-*.json` earlier runs.

- `evidence/gate0/intents.json` — all live Intents with miner counts.
- `evidence/gate0/schemas/*.json` — schemas for every Intent in PRD §7.
- `evidence/gate0/summary-free.json` — params, fields and miners per Intent.
- `evidence/gate0/payment-rails.json` — schemes/networks offered by the 402 (routed and direct).
- `evidence/gate0/escrow-signature-check.json` — signature accepted, deposit missing, nothing charged.

## Log

- 2026-11-23: Deployed by Adesope: web on Vercel (https://settled-orpin.vercel.app, `web/vercel.json` rewrites `/api` to Render), API + bot on Render free (https://settled-5mmc.onrender.com), MongoDB Atlas. Agent check against the deployed web URL (headless Chromium): `/api/health` ok; `/judge` → Start → Run the demo → **Owed, 40 USD credit, 14.4 s**; 6/6 attacks blocked; no page errors (`evidence/deploy/*.png`). Not verified by the agent: bot webhook on Render (needs a `/start` from Adesope), proof links using the Vercel `WEB_URL`.
- 2026-11-23: Phase 12 part 1 (contract reading), on Adesope's "go". Live probes (`evidence/contract/probe-*.json`) of CONTRACT_OBLIGATION_AUDIT_GENERAL with a **synthetic** sample SLA (`server/data/samples/sla-sample.txt`): ZK Contract Literal Evidence Index (731437) returned all 8 paragraphs verbatim; TelegraphIntent (83159274) cited 3 clauses (missed tiers b, c); VulnRank (7310099) listed 3 obligations; FactWire (7436) 503. Built: `services/sla/terms.js` (ask 731437, fall back to 83159274; keep only clauses that occur word for word in the paste; parse promise/tiers/claim window with plain rules), `POST /api/sla/read-terms`, "Paste your SLA" on Add a case (fills the fields; the receipt backs the case only if the user keeps the values), case stores `termsReceiptId` + `claimWindowDays`, decision adds a `contractTerms` fact and the claim-window warning. Checks: lint pass; `npm test` 94 pass / 1 skipped (5 new, using the live answer shape); build pass; **live** headless Chromium on a demo account: paste → read (0.01) → fields filled 99.99 / `99.99:10, 99:25, 95:50` / 30 days → add GitHub 2026-10 (bill 250) → Check now → Owed 25 USD with `contractTerms` backed by its receipt (screenshots `evidence/contract/*.png`). Note: the sample contract is synthetic, so that Owed is a flow test, not a real GitHub claim (GitHub's published target is 99.9%).
- 2026-11-23: Live `/judge` run in headless Chromium against a local server (in-memory Mongo, real Telegraph + Sepolia): Start → Run the demo → **Owed, 40 USD credit, 8.9 s wall clock** (9.4 s on the first run), 2 receipts; Run the attacks → 6/6 blocked; case page + Add-a-case (SLA) page render, no page errors. Screenshots in `evidence/judge/`. Fix: the judge top-up no longer shows `BAD_REQUEST` when the reused HD address already has funds (`requestTopUp(..., { ifNeeded: true })`). README sample request and tutorial switched to the SLA path. Checks: lint pass, `npm test` 89 pass / 1 skipped, build pass.
- 2026-11-23: Live bot check. `TELEGRAM_BOT_TOKEN` visible in the cloud session; Telegram getMe → @GetSettledBot. Server started with an in-memory MongoDB (no MONGODB_URI set; launcher in ignored `server/.tmp/`), long polling. Adesope sent `/start` in Telegram → bot replied "Welcome to Settled. Proof first. Then the claim. …". **Passed.** Then `/topup` → "Topped up with test USDC"; `sla vercel 2026-10 400` → Case added → Check now (cap 0.20) → 2 receipts: MONEY OWED Contract SLA Check `0xfb12e9f4…842d03` (0.01) and Statuspage SLA Auditor `0x0a2e6077…f9b36a28` (0.01) → Decision Owed, 40 USD credit (99.9645% vs 99.99%; second miner 99.1224% over 54 days) → Draft ready with receipts. **Passed** (seen in Adesope's Telegram screenshots). Note: the draft's proof link uses `WEB_URL` (unset here, so `http://localhost:5173/proof/…`); it becomes public once `WEB_URL` is set at deploy (guide 04).
- 2026-11-23: Phase 11 (SLA path) passed, now the main path. Live probes (`evidence/sla/probe-*.json`): MONEY OWED Contract SLA Check (2611217) answers calendar months (Vercel 2026-10: 99.9645% vs 99.99% target, not compliant; GitHub Enterprise Cloud, DigitalOcean, Twilio compliant); Statuspage SLA Auditor (7410311) answers rolling windows only (`30d`, `54d`; ignores calendar dates); one free-text query to 7410311 failed with HTTP 500 (`unknown_component`, may be charged per #228). Built: SLA cases (vendor + finished month + optional promised %, bill, tiers), evidence (month miner, then a different window miner only if the month shows a breach), `decideSla` (`sla-credit-1`), credit-request draft, proof page, web Add/Detail/Claims/Home, bot `sla vercel 2026-10 400` + `/sla`, judge demo now runs Vercel 2026-10 (flight case kept, honest Needs more proof). Checks: `npm run lint` pass; `npm test` 89 pass / 1 skipped (13 new SLA tests + 1 bot test); `npm run build` pass; **live** `node server/scripts/sla-live.js` → Owed, 40 USD credit (10% of 400), 2 receipts from 2 miners (`0xefdeee88…3253`, `0xf9da4321…5380`), 9.8 s, 0.02 test USDC. Web pages built but not clicked through in a browser yet.
- 2026-11-23: Wallet set (guide 01 done). Paid Gate 0, Phase 3 live smoke and Mission 9 live run done; see Gate 0 results. Fixes found live: 200-without-receipt counted as quoted price; `/ask` → CHAT_COMPLETION_GENERAL. Checks: `npm test` 75 pass / 1 skipped; live smoke 1/1. Option A fails for BA75; asking Adesope about Option B.
- 2026-11-22: Phase 10 passed. README (what, status, sponsor-to-file table, run, env, sample request, costs, limits, troubleshooting, mainnet switch, commercial summary), REAL_VS_MOCKED final for this point, `docs/tutorial.md` draft, `docs/manual/04-deploy.md` (Render + Vercel + Atlas), CONCEPT-BRIEF.md removed (PRD carries it). Root `npm run dev` now starts API and web together. Checks: fresh clone of the branch → `npm ci`, `npm run lint` pass, `npm test` 75 pass / 1 skipped, `npm run build` pass; `npm run dev` served `/api/health` on :4000 and the web on :5173 (proxy OK). README states no live numbers yet; every number it gives is a constant from code or the mocked example, labelled as such. **After the live runs, refresh README/REAL_VS_MOCKED with evidence numbers.**

## Next steps (now)

1. Timed `/judge` Run the demo on a running server → record seconds here.
2. Optional guide 02 (SMTP): one email to the demo inbox.
3. `node server/scripts/reconcile.js` after the next epoch root (check #228 charges for the two HTTP 500s).

## Earlier next steps (after guide 01, mostly done)

1. `node server/scripts/gate0.js` → record Option A/B, first receipt_hash, in "Gate 0 results"; pick the judge seed flight (update `JUDGE_SEED` in `server/src/services/judge.js` and `PREFERRED_TRAVEL_MINERS` in `server/src/services/flights/evidence.js`). If Option B: log it in the PRD and move Phase 11 into P0.
2. `LIVE_TELEGRAPH=1 npm test -w server` (Phase 3 live smoke) → `evidence/live/phase3-smoke.json`.
3. Phase 4 live run on the seeded flight → evidence; replace `server/data/replay/conflict.json` with a real conflicting pair if one is captured.
4. `node server/scripts/mission9.js` → `evidence/mission9/run.json`.
5. Timed `/judge` Run the demo → record seconds here.
6. With guide 03: live `/start`. With guide 02: one email to the demo inbox.

- 2026-11-22: Phase 9 built. `/judge` creates (or reuses for 1 h per browser) a demo account funded 0.50 test USDC with the seeded case (BA75 2026-11-20 LHR→LOS, to be confirmed by Gate 0), Run the demo (real asks → decision → draft; send only to the demo inbox after confirm), Run the attacks (6, each blocked with its code; #3 and #5 use replayed **synthetic** fixtures in `server/data/replay/` until real captured receipts replace them), `JUDGE_DAILY_RUN_LIMIT` on new demo accounts, `server/scripts/seed-judge.js`. Checks: lint pass; `npm test` → 75 pass, 1 skipped (session/reuse, daily limit, demo → DraftReady, demo inbox lock, all six attack codes with zero payments); build pass; headless click-through of /judge on a mocked node (demo → DraftReady in 0.2 s **mocked**, all six blocked). **Real timed run not verified** (needs guide 01).
- 2026-11-22: Phase 8 built. `services/ask` routes price→CRYPTO_PRICE_USD, weather→WEATHER_CHECK_TEMPERATURE, search→WEB_SEARCH_GENERAL, ask→QUESTION_ANSWERING_GENERAL (free-form query; free fallback to CHAT_COMPLETION_GENERAL if refused before payment). Web Ask + Leaderboard pages, bot commands. Checks: lint pass; `npm test` → 70 pass, 1 skipped (routing; 4 paid asks → 4 receipts, 5th → CAP_EXCEEDED with no payment; leaderboard opt-in + anonymous; fallback; bot /price); `npm run build` pass. **Live 4-ask run not verified** (`node server/scripts/mission9.js`, needs guide 01).
- 2026-11-22: Phase 7 built. grammY bot runs inside the server process (long polling in dev, webhook in production). Handlers in `server/src/bot/handlers.js` call services only. `/start` (+ link code), add case by message, forwarded booking email parsed as data (`services/booking.js`, instructions → UNTRUSTED_INSTRUCTION, ignored), live receipt lines, alerts, Send/Edit/Not now with recipient confirm (callback carries an address tag, so a changed address is refused), `/claims`, `/wallet`, `/cap`, `/web`. Worker (`server/src/worker`) checks past Watching flights once every 15 min. Checks: lint pass; `npm test` → 65 pass, 1 skipped (bot handlers with a fake context, full check→draft→confirm→send flow, untrusted email, web link code → bot case visible on web, real grammY Bot routing an update with a stubbed API, worker incl. cap). **Live /start not verified** (needs guide 03).
- 2026-11-22: Phase 6 passed. Express API (`server/src/routes/index.js`, routes call services) + React pages: sign up/in, Home, Add a case, Claims, Claim detail (check now, decision with fact→receipt links, draft, edit, recipient confirm, send/mailto, paid/rejected), Receipts, Wallet (address, escrow balance, cap, testnet top-up), Settings (caps, names, leaderboard opt-in, Telegram link code), public Proof page. Checks: lint pass; `npm test` → 58 pass, 1 skipped (API: auth, one-time login link, protected routes, supertest smoke sign up → add case → check → Owed → draft → recipient confirm → mailto → mark sent, wallet/settings); `npm run build` → pass. Extra: headless-browser click-through of the same flow against a mocked node (scratch script, not committed) — no page errors.
- 2026-11-22: Phase 5 built. Checks: lint pass; `npm test` → claims 11/11 (invariant 2: unbacked fact blocks draft; invariant 4: no send without a confirm naming the stored address, SMTP send via nodemailer JSON transport with Reply-To, mailto fallback + mark sent, demo accounts locked to demo inbox; invariant 5: duplicate flight refused, parallel drafts → 1 claim; proof data hides email and booking ref). Mailto path verified in tests. **Real SMTP send not verified** (guide 02, optional; SMTP provider is Adesope's choice).
- 2026-11-22: Phase 4 built. `server/data/airports.json` from OurAirports (3,245 large/medium airports with scheduled service). Rules `eu261-simple-1`; evidence: routed TRAVEL_DISRUPTION_GENERAL ask + direct ask to a different miner (`/engine/v1/ask/{minerId}`) + WEATHER_FORECAST_GENERAL at departure; delay = smaller of two agreeing answers. Checks: lint pass; `npm test` → 41 pass, 1 skipped. Fixtures: 3h40m LHR–LOS → Owed 600; 2h10m → NotOwed; disagree → EvidenceConflict; same miner → NeedsMoreProof; JFK–LOS on DL → NotOwed (not covered); cancellation; weather warning; checkCase end-to-end with mocked node. **Not verified live** (needs guide 01, and Gate 0 must show the miners can answer past flights).
- 2026-11-22: Phase 3 built. `askIntent()` in `server/src/services/telegraph/askIntent.js` is the only caller of Telegraph in app code (Gate 0 script uses the low-level client by design). Checks: lint pass; `npm test` → 29 pass, 1 skipped (live). Mocked-HTTP tests: 402→escrow-signed→200 (signature verified by the fake node with viem), multi-miner rows, direct miner ask without budget, 500-but-charged → `charged_on_failure` + one retry only, retry blocked by cap, unknown Intent refused before paying, budget out of range, decision cap, refused-before-payment released, escrow refusal → WALLET_UNFUNDED. `server/scripts/reconcile.js` + tests. **Not verified live:** `LIVE_TELEGRAPH=1 npm test -w server` needs guide 01.
- 2026-11-22: Phase 2 passed. Checks: `npm run lint` → pass; `npm test` → 16/16 (budget: 20 parallel reservations vs cap of 5 → exactly 5 granted; 20 parallel in one decision vs decision cap of 3 → 3; release on failure; charged_on_failure counts as spent; double settle refused; month rollover). Mongo via mongodb-memory-server (download works in the cloud env). Top-up is unit-tested with a fake funder; live top-up waits for guide 01.
- 2026-11-22: Phase 1 free part done; paid part blocked on MASTER_MNEMONIC + operator Sepolia ETH (guide 01). Found: no x402 exact on Ethereum Sepolia → escrow rail. Continuing with Phases 2–3 (do not need funds).
- 2026-11-22: Phase 0 passed. Checks: `npm install` ok; `npm run lint` → pass; `npm test` → 4/4 pass; `npm run build` → pass; `node server/src/index.js` (NODE_ENV=test, dummy vars) → `/api/health` 200; missing vars → clear error, exit 1.
- 2026-11-22: Docs written (PRD, CLAUDE.md, PROJECT_STATE, ROADMAP, README, REAL_VS_MOCKED, CONCEPT-BRIEF). No code yet.
