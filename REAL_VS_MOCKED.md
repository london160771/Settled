# REAL vs MOCKED — Settled

What is real, what is testnet, and what is replayed or mocked. Kept honest and up to date by the agent (updated whenever this changes, and finalised in Phase 10).

| Part | Status | Notes |
| --- | --- | --- |
| Telegraph asks (TRAVEL_DISRUPTION, weather, WEB_SEARCH, QUESTION_ANSWERING, CRYPTO_PRICE) | Real, testnet | Paid with test USDC on Ethereum Sepolia. Receipts stored with receipt_hash. |
| Payments | Testnet | Test USDC, not real money. Not production usage. |
| Wallets | Real testnet addresses, custodial | Derived from a server seed; Settled holds the keys on testnet. Mainnet plan in ROADMAP. |
| Flight data | Real, from Telegraph miners | Not mocked. |
| Compensation rules | Simplified EU261 / UK261 | Not legal advice. Long-haul halving not computed. |
| Claim emails | Real email (SMTP) to the address the user confirms | Demo/judge accounts can only send to the demo inbox. If SMTP is not set, a mailto link is used instead. |
| Attack Lab: cap, duplicate, untrusted instruction, unconfirmed recipient | Real code paths | Run live. |
| Attack Lab: miners disagree, failed-but-charged ask | Replayed | Uses stored real receipts from earlier runs; labelled "replayed" in the UI. |
| Unit tests with mocked HTTP | Mocked (tests only) | Live smoke tests exist behind `LIVE_TELEGRAPH=1`. |

Known limits (filled in as the build goes):
- (none yet)
