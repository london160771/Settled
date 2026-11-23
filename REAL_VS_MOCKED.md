# REAL vs MOCKED — Settled

What is real, what is testnet, and what is replayed or mocked. Kept honest by the agent. Last updated 2026-11-22 (end of P0 build, before the paid Gate 0 run).

| Part | Status | Notes |
| --- | --- | --- |
| Telegraph asks (TRAVEL_DISRUPTION_GENERAL, WEATHER_FORECAST_GENERAL, WEATHER_CHECK_TEMPERATURE, WEB_SEARCH_GENERAL, CHAT_COMPLETION_GENERAL, CRYPTO_PRICE_USD) | Real, testnet. Live paid asks ran on 2026-11-23 (evidence/gate0, evidence/live, evidence/mission9) | Paid from per-user escrow on Ethereum Sepolia once guide 01 is done. Receipts stored with receipt_hash. |
| Payment rail | Escrow scheme on Ethereum Sepolia | The node did not offer x402 `exact` on Ethereum Sepolia (evidence/gate0/payment-rails.json). Our escrow signature was accepted by the live node (refused only for missing deposit; evidence/gate0/escrow-signature-check.json). |
| Payments | Testnet | Test USDC, not real money. Not production usage. |
| Wallets | Real testnet addresses, custodial | Derived from a server seed; Settled holds the keys on testnet. Mainnet plan in ROADMAP. |
| Flight data | From Telegraph miners | Gate 0 (live): no miner returned a delay for a past non-US flight (BA75 LHR–LOS). Flight decisions will mostly end in Needs more proof until miners cover it; Option B pending. |
| Compensation rules | Simplified EU261 / UK261 | Not legal advice. Long-haul halving not computed. |
| Claim emails | Real SMTP when configured, else `mailto:` | Only after the user confirms the exact address. Demo accounts can only send to the demo inbox. SMTP not configured yet (guide 02). |
| Telegram bot | Real grammY bot | Not live until `TELEGRAM_BOT_TOKEN` is set (guide 03). Tested with a fake Telegram context and a stubbed Bot API. |
| Attack Lab: over the cap, duplicate, untrusted instruction, unconfirmed recipient | Real code paths | Run live; no money moves. |
| Attack Lab: miners disagree, failed-but-charged ask | **Replayed, synthetic fixtures** | `server/data/replay/*.json` are synthetic until real captured receipts replace them. Labelled "replayed (synthetic fixture)" in the UI and excluded from the leaderboard. |
| Unit/API tests | Mocked Telegraph node (tests only) | `server/test/fakeTelegraph.js` imitates the 402 → escrow → 200 flow and verifies signatures. Live smoke test exists behind `LIVE_TELEGRAPH=1`. |
| Judge demo timing | Mocked only so far | 0.2 s on the mocked node; real timing pending the live run. |

Known limits:
- TRAVEL_DISRUPTION returns `delay_minutes` and `status` but no scheduled/actual times; the delay used is the smaller of two agreeing answers.
- Most TRAVEL_DISRUPTION miners report current US airport status; past non-US flights may not be answerable (Gate 0 decides).
- The weather check is a current/forecast reading at the departure airport, not historical weather on the flight date; it only adds a warning.
- Airline country comes from a small built-in carrier map; unknown carriers arriving into the EU/UK give "Needs more proof".
- The worker auto-checks each past flight once; later checks are manual ("Check now").

## SLA path (added 2026-11-23, main path)

| Part | Status |
| --- | --- |
| SLA uptime numbers | Real, from Telegraph miners (SLA_COMPLIANCE_GENERAL), testnet payments. Live run: `evidence/sla/live-check.json`. The miners compute uptime from the vendor's public status-page incidents, not from the user's own traffic. |
| Credit tiers | Defaults (`99.99:10, 99:25, 95:50`) are an **example**, labelled in the form; the user should enter their contract's tiers. |
| Vendor list | Fixed to vendors both live SLA miners understand (Vercel, GitHub, DigitalOcean, Twilio). |
| SLA tests | Telegraph mocked in `server/test/sla.test.js`, answer shapes copied from the live evidence. |
| Contract reading (P1) | Real Telegraph asks (CONTRACT_OBLIGATION_AUDIT_GENERAL). The miner only quotes clauses; Settled keeps quotes found word for word in the paste and parses numbers with plain rules. The sample SLA in `server/data/samples/` is **synthetic** (labelled in its first line). |

## Landing page (added 2026-11-23)

| Part | Status |
| --- | --- |
| Figures on the landing page receipt | **Real**, copied from the deployed judge run on 2026-11-23 (Vercel 2026-10, 99.9645% vs 99.99%, Owed 40 USD, 2 receipts, 14.4 s; `evidence/deploy/`). They are static text on the page, not a live query. |
| Claim email excerpt on the landing page | Shortened from a real draft of the same run. |
| Photos | Stock photos from Unsplash (Unsplash License), stored in `web/public/img/`. They are illustration, not product data. |
