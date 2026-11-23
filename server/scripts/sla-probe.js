// Live probe of one SLA_COMPLIANCE_GENERAL miner (paid, ~0.01 test USDC). Saves to evidence/sla/.
// Usage: node server/scripts/sla-probe.js <minerId|routed> <label> [free-text query]
//        P='{"service":"Vercel","period":"2026-10"}' node server/scripts/sla-probe.js 2611217 vercel-oct
// Pays from the Gate 0 test user (HD index 1). Never prints keys or the mnemonic.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveAccount } from '../src/services/wallet/hd.js';
import { paidAsk } from '../src/services/telegraph/http.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BASE = process.env.TELEGRAPH_BASE_URL || 'https://devnode.telegraphprotocol.com';
const user = deriveAccount(process.env.MASTER_MNEMONIC, 1);
const [miner, label, ...q] = process.argv.slice(2);
const body = process.env.P
  ? { intent: process.env.INTENT || 'SLA_COMPLIANCE_GENERAL', params: JSON.parse(process.env.P) }
  : { intent: process.env.INTENT || 'SLA_COMPLIANCE_GENERAL', query: q.join(' ') };
const p = miner === 'routed' ? '/engine/v1/ask' : `/engine/v1/ask/${miner}`;
if (miner === 'routed') body.max_budget_usdc = 20000;
const out = path.join(ROOT, `evidence/${process.env.OUTDIR || 'sla'}/probe-${label}.json`);
fs.mkdirSync(path.dirname(out), { recursive: true });
try {
  const r = await paidAsk({ baseUrl: BASE, path: p, body, account: user, maxPaymentUusdc: 20000 });
  const rec = {
    at: new Date().toISOString(),
    miner,
    request: body,
    status: r.status,
    body: r.body,
    receipt: r.receipt,
  };
  fs.writeFileSync(out, JSON.stringify(rec, null, 2) + '\n');
  console.log(r.status, JSON.stringify(r.body?.result ?? r.body).slice(0, 1500));
  console.log('receipt', r.receipt?.receipt_hash);
} catch (e) {
  const rec = {
    at: new Date().toISOString(),
    miner,
    request: body,
    error: e.status,
    message: String(e.message).slice(0, 800),
  };
  fs.writeFileSync(out, JSON.stringify(rec, null, 2) + '\n');
  console.log('ERR', e.status, String(e.message).slice(0, 400));
}
