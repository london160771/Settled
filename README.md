# Settled

**Proof first. Then the claim.**

Settled is a personal claims assistant: a web app plus a Telegram bot, sharing one account, one capped wallet and one list of claims. When your flight is late, it pays Telegraph miners for proof, decides if you are owed money, and drafts the refund claim with every paid receipt attached. Nothing is sent without your yes.

Built for the Telegraph Protocol Hackathon Season II (Apps & Agents track, missions 15 and 9).

> Status: in development. This README is a skeleton; the agent completes it in Phase 10 (see PRD.md §14). Network: **testnet (Ethereum Sepolia, test USDC)**.

## What it does

1. Add a flight in the web app or the bot.
2. Settled buys proof: two TRAVEL_DISRUPTION answers from different miners, plus weather at departure.
3. It decides: Owed (with amount), Not owed (with reason), or Needs more proof.
4. If owed, it drafts the claim with the receipts and a public proof page link.
5. You tap Send and confirm the address. Track it to Paid or Rejected.

Mission 9: ask the assistant things that need fresh data (`/price`, `/weather`, `/search`, `/ask`); it pays from the same capped wallet and shows the receipt.

## Try it

- Web app: (link added at deploy)
- Telegram: (bot handle added in Phase 7)
- Judges: `/judge` — no signup, one click to run the demo, one click to run the attacks.

## Run it locally

(Phase 10 fills in: prerequisites, `.env` setup, `npm install`, `npm run dev`, sample request, expected result, costs, limits, troubleshooting.)

## How Telegraph is used

(Phase 10 fills in the sponsor-to-file table: which file makes the ask, stores receipts, enforces the cap, reconciles with the ledger.)

## Commercial summary

1. Who it's for: (Phase 10)
2. What it improves: (Phase 10)
3. What it does today: (Phase 10)
4. Why adopt: (Phase 10)
5. How to try it: (Phase 10)

## Real vs mocked

See [REAL_VS_MOCKED.md](REAL_VS_MOCKED.md).

## Docs

- [PRD.md](PRD.md) — requirements and phases (source of truth)
- [CLAUDE.md](CLAUDE.md) — rules for the coding agent
- [PROJECT_STATE.md](PROJECT_STATE.md) — progress log
- [ROADMAP.md](ROADMAP.md) — ideas not in this build
