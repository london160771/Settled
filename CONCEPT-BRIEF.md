# Concept Brief: Settled (temporary)

The full concept brief lives in the Claude Doc "Concept Brief: Settled" (Telegraph II, missions 15 + 9), written Nov 22, 2026. PRD.md now carries every requirement and decision from it, so PRD.md wins wherever the two differ. Delete this file once Phase 10 is done.

## In one breath

- **What:** Settled, a personal claims assistant. Web app + Telegram bot, one account, one capped wallet, one claims list.
- **Tagline:** Proof first. Then the claim.
- **Problem:** refunds go unclaimed because proving a disruption is tedious (mission 15's own words). A 3h40m-late London → Lagos flight may be owed 600 EUR under EU/UK rules; most people never claim.
- **Insight:** you cannot make a company pay, but you can guarantee every claim is backed by paid, independent proof anyone can check, and that the agent never spends more than you allowed.
- **Core guarantee:** no claim without a paid receipt behind every fact in it, and spent + reserved ≤ the cap.
- **Why Telegraph:** it sells verified answers from independent miners, paid per call, each with a receipt. The receipts are the product.
- **Territory:** no app builder on mission 15's public thread (Nov 22). Mission 9 has one wallet tool (telegraph-purse). No winner on other chains files refund/SLA claims. Close non-winners: Reclaimo (no spending cap, auto-sends), ReRoute (fake flight data, files nothing).
- **Lessons built in:** tie every claim to a paid receipt; show the cap and receipt log; user's yes before money moves or a claim goes out; live flight data; many small real testnet purchases.
- **Flow:** ADD FLIGHT → BUY PROOF → DECIDE → DRAFT CLAIM → YOU APPROVE → BLOCK THE BAD STUFF.
- **Judge path:** `/judge` demo account, Run the demo (≤ 90 s to a drafted claim), Run the attacks (each blocked with a reason code).
- **Scoring:** technical + mainnet readiness 35 (min 24), commercial 25, independent adoption 10, Telegraph usage 5, reproducibility 5, growth/education 20.
