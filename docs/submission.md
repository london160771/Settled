# Submission kit (drafts for Adesope)

Everything here is a draft. You record, post and submit. Replace `<APP_URL>` after deploy (guide 04).

## 2–5 minute video script (about 3:30)

**0:00 – 0:20 · The problem.** Screen: Vercel status page with an October incident.
> "Cloud vendors promise 99.99% uptime. When they miss it, you're owed a credit, but only if you prove it and ask in time. Almost nobody does. Settled does it for you, and it proves every fact with a paid Telegraph receipt."

**0:20 – 1:30 · Real input, live result (web).** Screen: `<APP_URL>/judge` → Start the demo account → Run the demo.
> "This is a fresh testnet account with a capped wallet. The case is Vercel, October 2026. Settled pays one Telegraph miner for the month's uptime from Vercel's own incident history: 99.96%, below the 99.99% promise. Because that's a breach, it pays a second, different miner for a second opinion. It agrees. Two receipts, two cents of test USDC, about nine seconds. Decision: Owed, a 10% credit, 40 dollars on a 400-dollar bill."

**1:30 – 2:10 · The receipts.** Screen: open the draft → scroll to the receipts appendix → open the public proof page → click a "verify" link.
> "Every number in the email points to a receipt hash. Anyone can verify it on Telegraph. Nothing is sent until I confirm the exact address."

**2:10 – 2:50 · Same account in Telegram.** Screen: @GetSettledBot → `sla vercel 2026-10 400` → Check now → live receipt lines → draft with Send / Edit / Not now.
> "The bot shares the same account, wallet and cap."

**2:50 – 3:20 · Safety.** Screen: Run the attacks → six rows blocked.
> "Six ways to break it: over the cap, duplicate claim, miners disagreeing, a booking email with hidden instructions, a failed paid ask that still charges, sending without a confirmed address. All blocked, each with its reason code."

**3:20 – 3:30 · Close.**
> "Settled: proof first, then the claim. Testnet only; the repo and evidence are linked below."

Be honest on camera: it's testnet; flight claims exist but live miners can't report past flight delays yet.

## Submission fields

- **Project:** Settled — proof first, then the claim.
- **Track / missions:** Apps & Agents · Mission 15 (Consumer Automation, main) · Mission 9 (Personal Agent, bonus).
- **Working link:** `<APP_URL>` (judges: `<APP_URL>/judge`) · Telegram: @GetSettledBot
- **Repo:** https://github.com/london160771/Settled
- **How to run:** README → "Run it locally" (`npm install`, `npm test`, `npm run dev`).
- **Evidence:** `evidence/sla/live-check.json` (SLA Owed, 2 receipts), `evidence/judge/` (live judge run 8.9 s + attacks), `evidence/mission9/run.json` (4 receipts + 5th blocked), `evidence/gate0/` (first receipts, payment rails), PROJECT_STATE.md log.
- **Public summary (≈60 words):** Settled checks whether your cloud vendor kept its uptime promise last month. It buys the uptime from one Telegraph miner, gets a second opinion from another, works out your service credit and drafts the request with every receipt attached. Web app and Telegram bot share one capped wallet. Nothing is sent without your tap. Testnet (Ethereum Sepolia).
- **Commercial summary:** README → "Commercial summary" (five answers).
- **Adoption (honest):** testnet only; no paying users; demo account + bot available for anyone to try.

## Public updates (post on different dates)

1. *(bounties issue + X)* "Building Settled for Telegraph S2: an agent that buys proof before it files a claim. First real receipt on Ethereum Sepolia today via the escrow rail."
2. *(after deploy)* "Settled's main path is now SLA credits: Vercel's Oct 2026 uptime was 99.96% vs a 99.99% promise. Two Telegraph miners agree → 40 USD credit drafted in ~9 s for 0.02 test USDC. Try /judge: <APP_URL>/judge"
3. *(with the tutorial)* "How an agent pays Telegraph for proof with a hard cap (reserve → 402 → escrow signature → receipt, and what to do when a failed ask still charges): <link to docs/tutorial.md>"
