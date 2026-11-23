# How an agent pays Telegraph for proof

This is how Settled, a personal claims assistant, buys verified answers from Telegraph miners with a hard spending cap. Every snippet is from the repo (`server/src/services/telegraph/`). Testnet only.

## 1. Find the Intent and its schema (free)

```
curl https://devnode.telegraphprotocol.com/engine/v1/intents/SLA_COMPLIANCE_GENERAL
```

It lists the live miners and what each one covers. Settled uses two of them: one that answers a vendor's uptime for a **calendar month** from its public incident history, and one that answers over a **rolling window** (`30d`, `54d`…). Both return `service, uptime_pct, sla_target_pct, compliant, period`. An unknown name returns `miner_count: 0` and `request: null`, so check here before paying: a POST with an unknown name still gets a 402 first.

## 2. Reserve the budget before you ask

An agent should never be able to spend more than its owner allowed, even with many asks at once. Settled reserves first with one conditional MongoDB update:

```js
User.updateOne(
  { _id: userId, $expr: { $lte: [{ $add: ['$budget.spentUusdc', '$budget.reservedUusdc', amount] }, '$caps.monthlyCapUusdc'] } },
  { $inc: { 'budget.reservedUusdc': amount } },
);
```

If nothing was modified, the ask is refused with `CAP_EXCEEDED` and nothing is sent to Telegraph. A test fires 20 reservations in parallel against a cap that fits 5; exactly 5 succeed.

## 3. Ask, get the 402, pay from escrow on Ethereum Sepolia

```js
const first = await fetch(`${NODE}/engine/v1/ask`, { method: 'POST', headers, body });
// 402 → base64 PAYMENT-REQUIRED header; pick the escrow entry on eip155:11155111
const entry = challenge.accepts.find((a) => a.scheme === 'escrow' && a.network === 'eip155:11155111');
const message = entry.extra.message
  .replace('{from}', account.address.toLowerCase())
  .replace('{nonce}', nonce).replace('{validAfter}', after).replace('{validBefore}', before);
const signature = await account.signMessage({ message }); // EIP-191, template signed verbatim
const res = await fetch(url, { method: 'POST', headers: { ...headers, 'X-PAYMENT': base64(payload) }, body });
```

Escrow is funded once per user (`depositUSDCFor(user, amount)` from an operator), so the user's wallet needs no ETH and each ask needs no on-chain transaction.

## 4. Keep the receipt, not the transaction

The receipt comes back in `X-PAYMENT-RESPONSE` (escrow) or `X-TELEGRAPH-RECEIPT` (x402). `receipt_hash` identifies the call permanently; `tx_hash` is batched across calls (and absent on escrow), so never key on it. Settled stores one Receipt per paid row, including the extra rows of a multi-miner ask (`fulfillment.payments`).

## 5. Handle failed paid asks honestly (bug #228)

A paid ask that fails (HTTP 500, miner down) may still be charged. Settled settles the reservation as spent, stores a `charged_on_failure` receipt, retries at most once and never loops. A reconcile script later compares our totals with `GET /v1/ledger/account/{address}` and releases the amount only if the ledger shows it was not billed.

## 6. Combine purchases into one decision

For an SLA credit: one direct ask (`POST /engine/v1/ask/{minerId}`) for the billing month. If that month missed the promise, a second direct ask to a *different* miner over a window that covers the month. Only if both see a breach is the case `Owed`; if they disagree it is `EvidenceConflict` and no claim is drafted. A live run on Vercel's October 2026 uptime (99.9645% vs 99.99%) took about 9 seconds and 0.02 test USDC. Every fact in the claim points to the receipts that back it, and the claim email links a public proof page where anyone can check them.

## Try it

Run `/judge` on the Settled app, or clone the repo and run `npm test`. Next step for your own agent: copy `askIntent()` and its budget service; they have no Settled-specific logic.
