// A fake Telegraph node for unit tests (mocked HTTP; labelled as such in REAL_VS_MOCKED.md).
import { verifyMessage } from 'viem';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64');
export const DIAMOND = '0x72a70e949362670bf8bcead24efc5b8f950aa08b';

function challenge(amount, resource) {
  return {
    x402Version: 2,
    accepts: [
      { scheme: 'exact', network: 'eip155:84532', amount: String(amount) },
      {
        scheme: 'escrow',
        network: 'eip155:11155111',
        payTo: DIAMOND,
        extra: {
          message: `Telegraph Escrow Payment\n\nWallet: {from}\nPay To: ${DIAMOND}\nNetwork: eip155:11155111\nAmount: ${amount} uUSDC\nResource: ${resource}\nNonce: {nonce}\nValid After: {validAfter}\nValid Before: {validBefore}`,
        },
      },
    ],
  };
}

const res = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

let seq = 0;
export function okAnswer({
  intent,
  minerId = 'm1',
  minerName = 'Miner One',
  result = {},
  amount = 10000,
  payments,
} = {}) {
  seq += 1;
  const receipt = {
    receipt_hash: `0x${String(seq).padStart(64, 'a')}`,
    rail: 'escrow',
    miner: minerId,
    intent,
    amount_uusdc: String(amount),
    epoch_id: 40,
    settlement: 'epoch',
    chain: 'telegraph',
  };
  const body = {
    miner_id: minerId,
    miner_name: minerName,
    intent,
    result,
    result_shape: 'intent',
    field_status: {},
    cost_usd: amount / 1e6,
    duration_ms: 321,
    signal_hash: '0xsig',
  };
  if (payments) body.fulfillment = { status: 'complete', payments };
  return { status: 200, body, headers: { 'X-PAYMENT-RESPONSE': b64(receipt) } };
}

/**
 * handler(ctx) → { status, body, headers } for a PAID request. ctx = { body, path, call }.
 * Records calls in fake.calls. Verifies the escrow signature like the node does.
 */
export function fakeTelegraph({
  handler,
  known = [
    'TRAVEL_DISRUPTION_GENERAL',
    'WEATHER_CHECK_TEMPERATURE',
    'WEATHER_FORECAST_GENERAL',
    'CRYPTO_PRICE_USD',
    'WEB_SEARCH_GENERAL',
    'QUESTION_ANSWERING_GENERAL',
  ],
  preHandler,
} = {}) {
  const fake = {
    calls: [],
    paid: 0,
    miners: [
      { id: 'm1', compatible: true },
      { id: 'm2', compatible: true },
      { id: 'm3', compatible: true },
    ],
  };
  fake.fetch = async (url, opts = {}) => {
    const u = new URL(url);
    if (!opts.method || opts.method === 'GET') {
      const m = /\/engine\/v1\/intents\/(.+)$/.exec(u.pathname);
      if (m) {
        const name = decodeURIComponent(m[1]);
        return known.includes(name)
          ? res(200, {
              intent_name: name,
              miner_count: 3,
              request: { params: [] },
              miners: fake.miners,
            })
          : res(200, {
              intent_name: name,
              miner_count: 0,
              miners: [],
              request: null,
              response: null,
            });
      }
      if (u.pathname.startsWith('/v1/ledger/account/'))
        return res(200, fake.ledger || { available: '0' });
      return res(404, { error: 'not found' });
    }
    const body = JSON.parse(opts.body);
    const call = { path: u.pathname, body, paid: false };
    fake.calls.push(call);
    if (preHandler) {
      const pre = preHandler({ body, path: u.pathname });
      if (pre) return res(pre.status, pre.body);
    }
    const amount = body.max_budget_usdc || 10000;
    const resource = u.pathname.replace('/engine', '');
    const payment = opts.headers?.['X-PAYMENT'];
    if (!payment)
      return res(
        402,
        { error: 'payment required' },
        { 'PAYMENT-REQUIRED': b64(challenge(amount, resource)) },
      );
    const p = JSON.parse(Buffer.from(payment, 'base64').toString());
    const a = p.payload.authorization;
    const message = challenge(amount, resource)
      .accepts[1].extra.message.replace('{from}', a.from)
      .replace('{nonce}', a.nonce)
      .replace('{validAfter}', a.validAfter)
      .replace('{validBefore}', a.validBefore);
    const valid =
      p.scheme === 'escrow' &&
      a.value === String(amount) &&
      (await verifyMessage({ address: a.from, message, signature: p.payload.signature }));
    if (!valid) return res(402, { error: 'payment required', reason: 'bad signature' });
    call.paid = true;
    fake.paid += 1;
    const out = handler({ body, path: u.pathname, call, n: fake.paid });
    if (out.throw) throw new Error(out.throw);
    return res(out.status, out.body, out.headers);
  };
  return fake;
}
