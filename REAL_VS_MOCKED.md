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
