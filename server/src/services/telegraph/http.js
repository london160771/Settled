// Low-level paid ask: POST → 402 challenge → sign escrow → retry with X-PAYMENT.
// Only askIntent() (services/telegraph/askIntent.js) and the Gate 0 script call this.
import {
  buildEscrowPayment,
  decodeChallenge,
  findEscrowEntry,
  decodeReceiptHeader,
  amountFromTemplate,
} from './escrow.js';

export class TelegraphHttpError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.code = code;
    Object.assign(this, extra);
  }
}

async function readJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 2000) };
  }
}

// Returns { status, body, receipt, quotedUusdc, paid }.
export async function paidAsk({
  baseUrl,
  path,
  body,
  account,
  fetchImpl = fetch,
  maxPaymentUusdc,
}) {
  const url = `${baseUrl}${path}`;
  const headers = { 'Content-Type': 'application/json' };
  const json = JSON.stringify(body);
  const first = await fetchImpl(url, { method: 'POST', headers, body: json });
  if (first.status !== 402) {
    return {
      status: first.status,
      body: await readJson(first),
      receipt: null,
      quotedUusdc: 0,
      paid: false,
    };
  }
  const challenge =
    decodeChallenge(first.headers.get('payment-required')) || (await readJson(first));
  const entry = findEscrowEntry(challenge);
  if (!entry)
    throw new TelegraphHttpError('NO_ESCROW_RAIL', 'Node did not offer escrow on Ethereum Sepolia');
  const quoted = amountFromTemplate(entry.extra?.message);
  if (quoted == null)
    throw new TelegraphHttpError('BAD_CHALLENGE', 'Could not read amount from challenge');
  if (maxPaymentUusdc != null && quoted > maxPaymentUusdc) {
    throw new TelegraphHttpError(
      'QUOTE_ABOVE_LIMIT',
      `Quoted ${quoted} uusdc above limit ${maxPaymentUusdc}`,
      { quotedUusdc: quoted },
    );
  }
  const { header } = await buildEscrowPayment(account, entry);
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { ...headers, 'X-PAYMENT': header },
    body: json,
  });
  const receipt =
    decodeReceiptHeader(res.headers.get('x-payment-response')) ||
    decodeReceiptHeader(res.headers.get('x-telegraph-receipt'));
  return {
    status: res.status,
    body: await readJson(res),
    receipt,
    quotedUusdc: quoted,
    paid: true,
  };
}

export async function getJson(url, fetchImpl = fetch) {
  const res = await fetchImpl(url);
  return { status: res.status, body: await readJson(res) };
}
