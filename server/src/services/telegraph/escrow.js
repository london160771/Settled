// Telegraph escrow payment (scheme "escrow", Ethereum Sepolia). The node's live 402 does not
// offer x402 "exact" on eip155:11155111, so escrow is our only Ethereum Sepolia rail.
// Signs the node's template verbatim with EIP-191 personal_sign. Sent in X-PAYMENT.
import { randomUUID } from 'node:crypto';

export const ESCROW_NETWORK = 'eip155:11155111';

export function decodeChallenge(headerValue) {
  if (!headerValue) return null;
  return JSON.parse(Buffer.from(headerValue, 'base64').toString('utf8'));
}

export function findEscrowEntry(challenge) {
  const accepts = challenge?.accepts || [];
  return accepts.find((a) => a.scheme === 'escrow' && a.network === ESCROW_NETWORK) || null;
}

export function amountFromTemplate(template) {
  const m = /Amount:\s*(\d+)\s*uUSDC/.exec(template || '');
  return m ? Number(m[1]) : null;
}

export async function buildEscrowPayment(account, entry, { now = Date.now(), nonce } = {}) {
  const template = entry.extra.message;
  const t = Math.floor(now / 1000);
  const authorization = {
    from: account.address.toLowerCase(),
    to: entry.payTo,
    value: String(amountFromTemplate(template)),
    validAfter: String(t - 5),
    validBefore: String(t + 100),
    nonce: nonce || randomUUID(),
  };
  const message = template
    .replace('{from}', authorization.from)
    .replace('{nonce}', authorization.nonce)
    .replace('{validAfter}', authorization.validAfter)
    .replace('{validBefore}', authorization.validBefore);
  const signature = await account.signMessage({ message });
  const payload = {
    x402Version: 2,
    scheme: 'escrow',
    network: entry.network,
    payload: { signature, authorization },
  };
  return { header: Buffer.from(JSON.stringify(payload)).toString('base64'), authorization };
}

export function decodeReceiptHeader(value) {
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}
