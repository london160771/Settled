# Settled

**Proof first. Then the claim.**

Settled is a personal claims assistant: a web app plus a Telegram bot that share one account, one capped wallet and one list of claims. When a cloud vendor (Vercel, GitHub, DigitalOcean, Twilio) misses its uptime promise for a month, Settled pays Telegraph miners for proof from two independent sources, works out the service credit from your contract tiers, and drafts the credit request with every paid receipt attached. Late flights (simplified EU261/UK261) are a second path. Nothing is sent without your yes.

Built for the Telegraph Protocol Hackathon Season II, Apps & Agents track: **mission 15** (Consumer Automation, main) and **mission 9** (Personal Agent, bonus).

> **Network: testnet only.** Ethereum Sepolia (chain 11155111), test USDC `0xcc194e1a843B658526D0D5C431f670028582Ae17`, Telegraph devnode. Nothing here is production usage or real money.

Core guarantee: **no claim without a paid receipt behind every fact in it, and spent + reserved ≤ the cap you set.**

## Status (honest)

| Part | State |
| --- | --- |
| Code for P0 (web, API, bot, cap, Telegraph client, SLA + flight decisions, claims, Ask, leaderboard, judge mode, Attack Lab) | Built, 94 automated tests pass (Telegraph mocked in tests) |
| Real paid Telegraph asks | **Run live on 2026-11-23** with real receipts: Gate 0 ([evidence/gate0](evidence/gate0)), smoke ask ([evidence/live](evidence/live)), Mission 9 4 asks + 5th blocked ([evidence/mission9](evidence/mission9)) |
| Main path | **SLA credits** (Gate 0 Option B). Live: Vercel Oct 2026 99.9645% vs 99.99% → Owed, 10% credit, 2 receipts from 2 miners, 9.8 s ([evidence/sla/live-check.json](evidence/sla/live-check.json)). Flights stay as a second path, but live miners can't report a past flight's delay yet, so they end in Needs more proof |
| Telegram bot live | Waiting for `TELEGRAM_BOT_TOKEN` ([guide 03](docs/manual/03-telegram-bot.md)) |
| Real email sending | Optional SMTP ([guide 02](docs/manual/02-email-sending.md)); `mailto:` fallback works today |
| Deploy | **Live (testnet):** web https://settled-orpin.vercel.app · API https://settled-5mmc.onrender.com · bot @GetSettledBot. Deployed by Adesope ([guide 04](docs/manual/04-deploy.md)) |

See [PROJECT_STATE.md](PROJECT_STATE.md) for the phase log and [REAL_VS_MOCKED.md](REAL_VS_MOCKED.md) for what is real.

## What it does

1. Add a flight in the web app or the bot (`BA75 2026-11-20 LHR LOS`, or forward the booking email).
2. Settled buys proof: one routed `TRAVEL_DISRUPTION_GENERAL` ask, a second one sent directly to a **different miner**, and `WEATHER_FORECAST_GENERAL` at the departure airport. Each purchase is reserved against your cap first.
3. It decides: **Owed** (with amount), **Not owed** (with reason), **Needs more proof**, or **Evidence conflict** (miners disagree by more than 15 minutes).
4. If owed, it drafts the claim email with a receipts appendix and a public proof page link. A draft cannot be created if any fact lacks a paid receipt.
5. You tap Send and confirm the exact address ("Send to …"). Track it to Paid or Rejected.

Mission 9: ask the assistant things that need fresh data (`/price`, `/weather`, `/search`, `/ask` in the bot, or the Ask page). It pays from the same capped wallet and shows the receipt. An opt-in leaderboard shows paid asks per assistant.

### SLA credits (main path)

1. Add a case: vendor + a finished month (web: Add a case → Cloud uptime; bot: `sla vercel 2026-10 400`). Optional: your promised uptime, monthly bill, credit tiers.
2. Settled buys `SLA_COMPLIANCE_GENERAL` for that calendar month from a contract-scoped miner. If it shows a breach, it buys a second opinion from a **different** miner over a rolling window that covers the month (works up to 90 days back).
3. **Owed** only if both see a breach; credit = your tier × your bill. One says breach and the other doesn't → **Evidence conflict**.
4. Draft credit request with the receipts appendix and proof page; you confirm the address and send.

Optional: paste your SLA in the form and Settled pays a Telegraph miner (`CONTRACT_OBLIGATION_AUDIT_GENERAL`) to quote its clauses, keeps only the ones found word for word in your text, and fills in the promised uptime, credit tiers and claim window for you to check ([`server/src/services/sla/terms.js`](server/src/services/sla/terms.js)).

Judges: open `/judge` → **Start the demo account** → **Run the demo** (Vercel, October 2026) → **Run the attacks**.

## How Telegraph is used (sponsor-to-file table)

| What | File |
| --- | --- |
| The only function that calls Telegraph: reserve → 402 → sign → ask → receipt → settle/charged → release | [`server/src/services/telegraph/askIntent.js`](server/src/services/telegraph/askIntent.js) |
| Escrow payment on Ethereum Sepolia (EIP-191 signature of the node's template, `X-PAYMENT` header) | [`server/src/services/telegraph/escrow.js`](server/src/services/telegraph/escrow.js), [`http.js`](server/src/services/telegraph/http.js) |
| Free Intent schema check (unknown Intent refused before paying) | [`server/src/services/telegraph/intents.js`](server/src/services/telegraph/intents.js) |
| Receipts stored (receipt_hash is the proof ID) | `Receipt` model in [`server/src/models/index.js`](server/src/models/index.js) |
| Hard cap, atomic under parallel asks | [`server/src/services/budget/index.js`](server/src/services/budget/index.js) |
| Bug #228 (failed paid ask may still charge): counted as spent, retried once, never loops | `askIntent.js` + [`reconcile.js`](server/src/services/telegraph/reconcile.js) |
| Ledger reconciliation | [`server/scripts/reconcile.js`](server/scripts/reconcile.js) (`GET /v1/ledger/account/{address}`) |
| Per-user wallets (HD-derived) and escrow top-up (`depositUSDCFor`) | [`server/src/services/wallet/`](server/src/services/wallet/) |
| SLA evidence → one decision (month miner + a different window miner) | [`server/src/services/sla/evidence.js`](server/src/services/sla/evidence.js), [`decide.js`](server/src/services/sla/decide.js) |
| Several purchases → one decision (2 distinct miners + weather) | [`server/src/services/flights/evidence.js`](server/src/services/flights/evidence.js), [`decide.js`](server/src/services/flights/decide.js) |
| Mission 9 paid asks | [`server/src/services/ask/index.js`](server/src/services/ask/index.js) |
| Gate 0 (prove the network works for us) | [`server/scripts/gate0.js`](server/scripts/gate0.js) |

Why escrow and not x402 "exact": on Nov 22, 2026 the live node's 402 offered `exact` only on Base Sepolia and Solana Devnet; on Ethereum Sepolia it offered `escrow` (see [evidence/gate0/payment-rails.json](evidence/gate0/payment-rails.json)). Ethereum Sepolia is the network that settles on the Telegraph Diamond, so Settled uses escrow there. The operator funds each user's escrow with `depositUSDCFor(user, amount)`; user wallets never need ETH.

## Run it locally

Prerequisites: Node 20+ (22 tested), npm 10, internet access to `devnode.telegraphprotocol.com` and a Sepolia RPC. MongoDB: a local `mongod` or a free MongoDB Atlas cluster. Tests do not need MongoDB (they download an in-memory one).

```
git clone https://github.com/london160771/Settled.git
cd Settled
npm install
npm test          # 94 tests, Telegraph mocked; no secrets needed
npm run lint
npm run build
```

To run the app, copy `.env.example` to `.env` and fill in at least:

| Variable | What |
| --- | --- |
| `MONGODB_URI` | e.g. `mongodb://127.0.0.1:27017/settled` or your Atlas URI |
| `JWT_SECRET` | any long random string |
| `MASTER_MNEMONIC` | a **testnet-only** 12-word seed; index 0 is the operator (needs ~0.05 Sepolia ETH), users get index 2+ |
| `APP_URL`, `WEB_URL` | `http://localhost:4000` and `http://localhost:5173` in dev |
| `DEMO_INBOX_EMAIL` | inbox for judge/demo claim emails |
| optional | `SEPOLIA_RPC_URL`, `TELEGRAM_BOT_TOKEN`, `SMTP_*`, caps, `JUDGE_DAILY_RUN_LIMIT` (see `.env.example`) |

```
npm run dev       # API on :4000 (+ bot if TELEGRAM_BOT_TOKEN is set), web on :5173
```

Other commands:

```
node server/scripts/gate0.js --free-only   # free: Intents, schemas, payment rails → evidence/gate0/
node server/scripts/gate0.js               # paid Gate 0 (~0.03 test USDC), needs MASTER_MNEMONIC + operator ETH
node server/scripts/mission9.js            # live mission 9 run: 4 paid asks + a 5th blocked by the cap
node server/scripts/sla-live.js            # live SLA check (vercel 2026-10): decision + draft, ~0.02 test USDC
node server/scripts/reconcile.js [--apply] # our receipts vs the Telegraph ledger
node server/scripts/seed-judge.js          # create a funded demo account and print a login link
LIVE_TELEGRAPH=1 npm test -w server        # adds 1 real paid smoke ask (0.01 test USDC)
```

### Sample request and expected result

After signing up (cookie session), add an SLA case and check it:

```
curl -b jar -c jar -X POST localhost:4000/api/cases -H 'content-type: application/json' \
  -d '{"type":"sla","vendor":"vercel","period":"2026-10","monthlyFeeUsd":400}'
curl -b jar -X POST localhost:4000/api/cases/<caseId>/check
```

Live result (2026-11-23, [evidence/sla/live-check.json](evidence/sla/live-check.json)):

```
{ "decision": { "outcome": "Owed", "amountUsd": 40,
  "reasons": ["Uptime in 2026-10 was 99.9645%, below the promised 99.99%.",
              "A second miner also saw a breach (99.1224% over last 54 days).",
              "Your tiers give a 10% service credit = 40 USD of 400 USD."],
  "spentUusdc": 20000 } }
```

Live judge demo in a real browser: Owed in 8.9 s, all six attacks blocked ([evidence/judge/](evidence/judge/)).

## Costs and limits (testnet)

- One Telegraph call: 0.01 test USDC floor (dynamic pricing can raise it; the 402 quote is checked against the reservation).
- One SLA decision: 1 ask if the month met the SLA, 2 if it didn't (~0.01–0.02 test USDC).
- One flight decision: 3 asks, expected ~0.03 test USDC. Default per-decision cap 0.20, monthly cap 1.00.
- Mission 9 ask: 0.01 each.
- Judge account: funded 0.50 test USDC; new judge accounts limited by `JUDGE_DAILY_RUN_LIMIT` (default 20/day).
- Node limits: `max_budget_usdc` 10000–260000 μUSDC; direct (chosen-miner) asks take no budget.
- Rules are simplified EU261/UK261 (`eu261-simple-1`), not legal advice; long-haul 50% reduction is mentioned, not computed.

## Troubleshooting

- `Missing required env vars` on boot → fill `.env` (names in `.env.example`).
- `WALLET_UNFUNDED` → the user's escrow is empty: Wallet page → Top up (operator needs Sepolia ETH).
- `INTENT_UNKNOWN` → the node no longer serves that Intent name; check `GET /engine/v1/intents`.
- `CHARGED_ON_FAILURE` → a paid ask failed (bug #228). It counts as spent; run `node server/scripts/reconcile.js --apply` after the next ledger root to release it if the ledger shows it was not billed.
- Tests can't download MongoDB → set `MONGODB_URI_TEST` to a test database.

## Mainnet switch (not done; plan)

1. Change `CHAIN_ID`/RPC/USDC to mainnet values (the config refuses anything but 11155111 today, on purpose).
2. Replace custodial HD wallets with a user-owned smart account and a session key limited to the user's cap (ROADMAP).
3. Remove the testnet mint top-up; users fund escrow themselves.
4. Keep `askIntent()` unchanged: the cap, receipts and #228 handling are rail-independent.

## Commercial summary

1. **Who it's for:** small teams and solo developers who pay for cloud services with uptime promises (Vercel, GitHub, DigitalOcean, Twilio) and never claim the service credits they are owed; travellers with late flights are a second audience.
2. **What it improves:** proving the outage is the tedious part. Settled buys the month's uptime from one Telegraph miner, asks a different miner for a second opinion, works out the credit from your contract tiers, and writes the request with every receipt attached, so you only tap Send.
3. **What it does today (testnet):** web + Telegram, per-user capped wallet, two-miner SLA evidence with agreement check, credit calculation, receipt-backed drafts, confirmed sending, public proof pages, mission 9 paid asks, judge mode with six blocked attacks. Live: Vercel Oct 2026 → Owed, 40 USD credit on a 400 USD bill, 0.02 test USDC of evidence, under 10 s.
4. **Why adopt:** credits go unclaimed because checking is a chore; a claim backed by verifiable receipts from two independent sources is hard to brush off; the user stays in control (hard cap, nothing sent without a tap); evidence costs cents.
5. **How to try it:** open https://settled-orpin.vercel.app/judge, or message @GetSettledBot, or run it locally with the steps above. Pricing idea (ROADMAP): user pays only the evidence cost, plus an optional success fee on credits received.

## Docs

- [PRD.md](PRD.md) — requirements and phases (source of truth)
- [PROJECT_STATE.md](PROJECT_STATE.md) — progress log, Gate 0 results, evidence index
- [REAL_VS_MOCKED.md](REAL_VS_MOCKED.md) — what is real, testnet, replayed or mocked
- [docs/tutorial.md](docs/tutorial.md) — how an agent pays Telegraph for proof
- [docs/submission.md](docs/submission.md) — video script and submission text (drafts for Adesope)
- [docs/manual/](docs/manual/) — step-by-step guides for the manual tasks
- [ROADMAP.md](ROADMAP.md) — ideas not in this build
- [CLAUDE.md](CLAUDE.md) — rules for the coding agent
