// Gate 0: prove Telegraph works for Settled.
// Usage: node server/scripts/gate0.js [--free-only] [--flight "BA75 2026-11-20"] [--weather London]
// Free part (no wallet): lists Intents, saves schemas and 402 challenges to evidence/gate0/.
// Paid part (needs MASTER_MNEMONIC, Sepolia ETH on the operator): funds a test user's escrow
// and makes 3 small asks (~0.03-0.04 test USDC). Never prints keys or the mnemonic.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveAccount, OPERATOR_INDEX } from '../src/services/wallet/hd.js';
import { getBalances, fundEscrowFor } from '../src/services/wallet/chain.js';
import { paidAsk, getJson } from '../src/services/telegraph/http.js';
import { decodeChallenge } from '../src/services/telegraph/escrow.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'evidence/gate0');
const BASE = (process.env.TELEGRAPH_BASE_URL || 'https://devnode.telegraphprotocol.com').replace(
  /\/$/,
  '',
);
const RPC = process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
const USDC = process.env.TEST_USDC_ADDRESS || '0xcc194e1a843B658526D0D5C431f670028582Ae17';
const TEST_USER_INDEX = 1;

const args = process.argv.slice(2);
const arg = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const FREE_ONLY = args.includes('--free-only');
const FLIGHT = arg('--flight', 'BA75 2026-11-20');
const WEATHER = arg('--weather', 'London');

const INTENTS = [
  'TRAVEL_DISRUPTION',
  'TRAVEL_DISRUPTION_GENERAL',
  'WEATHER_CHECK_TEMPERATURE',
  'WEATHER_FORECAST_GENERAL',
  'WEB_SEARCH_GENERAL',
  'QUESTION_ANSWERING_GENERAL',
  'CHAT_COMPLETION_GENERAL',
  'CRYPTO_PRICE_USD',
  'SERVER_UPTIME_MONITOR_GENERAL',
  'SLA_COMPLIANCE_GENERAL',
  'CONTRACT_OBLIGATION_AUDIT_GENERAL',
  'FLIGHT_AVAILABILITY_GENERAL',
];

const save = (rel, data) => {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
  return path.relative(ROOT, p);
};

async function freePart() {
  const list = await getJson(`${BASE}/engine/v1/intents`);
  const names = (list.body.intents || []).map((i) => ({
    name: i.intent_name,
    miner_count: i.miner_count,
    lifecycle_state: i.lifecycle_state,
  }));
  save('intents.json', {
    fetched_at: new Date().toISOString(),
    count: names.length,
    intents: names,
  });
  const summary = {};
  for (const name of INTENTS) {
    const s = await getJson(`${BASE}/engine/v1/intents/${name}`);
    save(`schemas/${name}.json`, s.body);
    summary[name] = {
      miner_count: s.body.miner_count,
      unknown: s.body.miner_count === 0 && !s.body.request,
      params: (s.body.request?.params || []).map((p) => p.name + (p.required ? '*' : '')),
      fields: (s.body.response?.fields || []).map((f) => f.name),
      miners: (s.body.miners || []).map((m) => `${m.id} ${m.name}`),
    };
  }
  // Which payment rails does the node offer? (free: the 402 is returned before payment)
  const rails = {};
  for (const [label, p, body] of [
    [
      'routed',
      '/engine/v1/ask',
      {
        intent: 'TRAVEL_DISRUPTION_GENERAL',
        params: { route_or_flight: FLIGHT },
        max_budget_usdc: 20000,
      },
    ],
    [
      'direct',
      '/engine/v1/ask/7602',
      { intent: 'TRAVEL_DISRUPTION_GENERAL', params: { route_or_flight: FLIGHT } },
    ],
  ]) {
    const res = await fetch(`${BASE}${p}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const ch = decodeChallenge(res.headers.get('payment-required'));
    rails[label] = {
      status: res.status,
      accepts: (ch?.accepts || []).map((a) => ({
        scheme: a.scheme,
        network: a.network,
        amount: a.amount,
        asset: a.asset,
        payTo: a.payTo,
      })),
    };
  }
  save('payment-rails.json', { fetched_at: new Date().toISOString(), rails });
  save('summary-free.json', summary);
  console.log('Free part done: intents, schemas, payment rails saved to evidence/gate0/');
  for (const [k, v] of Object.entries(summary))
    console.log(
      `  ${k}: miners=${v.miner_count} params=${v.params.join(',')} fields=${v.fields.join(',')}`,
    );
  for (const [k, v] of Object.entries(rails))
    console.log(`  rails ${k}: ${v.accepts.map((a) => `${a.scheme}@${a.network}`).join(' | ')}`);
  return { summary, rails };
}

function receiptLine(r) {
  const b = r.body || {};
  return {
    http_status: r.status,
    miner_id: b.miner_id,
    miner_name: b.miner_name,
    intent: b.intent,
    cost_usd: b.cost_usd,
    duration_ms: b.duration_ms,
    receipt_hash: r.receipt?.receipt_hash || null,
    epoch_id: r.receipt?.epoch_id ?? null,
    result: b.result,
  };
}

async function paidPart({ rails }) {
  const mnemonic = process.env.MASTER_MNEMONIC;
  if (!mnemonic) {
    console.log(
      '\nPaid part skipped: MASTER_MNEMONIC is not set. See docs/manual/01-gate0-wallet-and-network.md',
    );
    return null;
  }
  const operator = deriveAccount(mnemonic, OPERATOR_INDEX);
  const user = deriveAccount(mnemonic, TEST_USER_INDEX);
  const ob = await getBalances({ rpcUrl: RPC, usdc: USDC, address: operator.address });
  const ledger = async (a) => (await getJson(`${BASE}/v1/ledger/account/${a}`)).body;
  let ul = await ledger(user.address);
  console.log(
    `\nOperator ${operator.address}: ${Number(ob.ethWei) / 1e18} ETH, ${Number(ob.usdcUusdc) / 1e6} test USDC`,
  );
  console.log(
    `Test user ${user.address}: escrow available ${Number(ul.available) / 1e6} test USDC`,
  );
  if (BigInt(ul.available) < 100000n) {
    if (ob.ethWei < 2000000000000000n) {
      console.log(
        'Operator needs Sepolia ETH for gas (>= 0.002). See docs/manual/01-gate0-wallet-and-network.md',
      );
      return null;
    }
    const diamond = rails.routed.accepts.find((a) => a.scheme === 'escrow').payTo; // from the 402, never hardcoded
    console.log(
      'Funding test user escrow with 0.50 test USDC (mint + approve + depositUSDCFor)...',
    );
    const txs = await fundEscrowFor({
      rpcUrl: RPC,
      usdc: USDC,
      diamond,
      operator,
      beneficiary: user.address,
      amountUusdc: 500000,
    });
    save('funding.json', {
      at: new Date().toISOString(),
      beneficiary: user.address,
      amount_uusdc: 500000,
      txs,
    });
    for (let i = 0; i < 20 && BigInt(ul.available) < 100000n; i++) {
      await new Promise((r) => setTimeout(r, 6000));
      ul = await ledger(user.address);
    }
    console.log(`Escrow available now ${Number(ul.available) / 1e6}`);
  }
  const asks = [
    [
      'travel-routed',
      '/engine/v1/ask',
      {
        intent: 'TRAVEL_DISRUPTION_GENERAL',
        params: { route_or_flight: FLIGHT },
        max_budget_usdc: 10000,
      },
    ],
    [
      'weather-routed',
      '/engine/v1/ask',
      {
        intent: 'WEATHER_CHECK_TEMPERATURE',
        params: { location: WEATHER },
        max_budget_usdc: 10000,
      },
    ],
  ];
  const results = {};
  for (const [label, p, body] of asks) {
    const r = await paidAsk({
      baseUrl: BASE,
      path: p,
      body,
      account: user,
      maxPaymentUusdc: 20000,
    });
    save(`ask-${label}.json`, {
      at: new Date().toISOString(),
      request: body,
      status: r.status,
      body: r.body,
      receipt: r.receipt,
    });
    results[label] = receiptLine(r);
    console.log(`  ${label}:`, JSON.stringify(results[label]));
  }
  // Miner selection: direct ask to a different TRAVEL_DISRUPTION miner than the routed one.
  const first = results['travel-routed']?.miner_id;
  const schema = JSON.parse(
    fs.readFileSync(path.join(OUT, 'schemas/TRAVEL_DISRUPTION_GENERAL.json'), 'utf8'),
  );
  const other = (schema.miners || []).find((m) => m.id !== first && m.compatible);
  if (other) {
    const body = { intent: 'TRAVEL_DISRUPTION_GENERAL', params: { route_or_flight: FLIGHT } };
    const r = await paidAsk({
      baseUrl: BASE,
      path: `/engine/v1/ask/${other.id}`,
      body,
      account: user,
      maxPaymentUusdc: 20000,
    });
    save('ask-travel-direct.json', {
      at: new Date().toISOString(),
      miner: other.id,
      request: body,
      status: r.status,
      body: r.body,
      receipt: r.receipt,
    });
    results['travel-direct'] = receiptLine(r);
    console.log('  travel-direct:', JSON.stringify(results['travel-direct']));
  }
  save('summary-paid.json', {
    at: new Date().toISOString(),
    payer: user.address,
    flight: FLIGHT,
    results,
  });
  return results;
}

const free = await freePart();
if (!FREE_ONLY) await paidPart(free);
if (!free) process.exit(1);
