// The Diamond (escrow) address comes from the node's 402 challenge, never hardcoded.
import { decodeChallenge, findEscrowEntry } from '../telegraph/escrow.js';

let cached = null;
export async function getDiamondAddress(config, fetchImpl = fetch) {
  if (cached) return cached;
  const res = await fetchImpl(`${config.telegraphBaseUrl}/engine/v1/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intent: 'CRYPTO_PRICE_USD', params: { symbol: 'BTC' } }),
  });
  const entry = findEscrowEntry(decodeChallenge(res.headers.get('payment-required')));
  if (!entry) throw new Error('Node did not offer escrow on Ethereum Sepolia');
  cached = entry.payTo;
  return cached;
}
