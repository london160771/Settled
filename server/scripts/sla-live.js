// Live SLA check, end to end, on the real code path (spends ~0.02 test USDC from the Gate 0 test
// user, HD index 1): add case → checkCase (2 paid asks, 2 miners) → decision → receipt-backed draft.
// Nothing is sent. Saves evidence/sla/live-check.json.
// Usage: node server/scripts/sla-live.js [vendor] [YYYY-MM] [monthlyFeeUsd]   (default vercel 2026-10 400)
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { loadConfig } from '../src/config/index.js';
import { User, Wallet, Receipt } from '../src/models/index.js';
import { deriveAddress } from '../src/services/wallet/hd.js';
import { addSlaCase } from '../src/services/cases.js';
import { checkCase } from '../src/services/flights/evidence.js';
import { createDraft } from '../src/services/claims/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [vendor = 'vercel', period = '2026-10', fee = '400'] = process.argv.slice(2);
const config = loadConfig({
  ...process.env,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://memory',
  JWT_SECRET: process.env.JWT_SECRET || 'script',
});
if (!config.masterMnemonic) throw new Error('MASTER_MNEMONIC is not set (guide 01)');
const mem = await MongoMemoryServer.create();
await mongoose.connect(mem.getUri());
const user = await User.create({
  displayName: 'Settled SLA live run',
  claimFromName: 'Settled demo',
  caps: { decisionCapUusdc: 60000, monthlyCapUusdc: 100000 },
});
await Wallet.create({
  userId: user._id,
  hdIndex: 1,
  address: deriveAddress(config.masterMnemonic, 1),
});
const c = await addSlaCase(user._id, { vendor, period, monthlyFeeUsd: fee });
const t0 = Date.now();
const out = { at: new Date().toISOString(), case: { vendor, period, monthlyFeeUsd: Number(fee) } };
try {
  const d = await checkCase(config, c._id, {
    onReceipt: (r) => console.log('receipt', r.minerId, r.receiptHash),
  });
  out.ms = Date.now() - t0;
  out.decision = {
    outcome: d.outcome,
    amountUsd: d.amountUsd,
    reasons: d.reasons,
    warnings: d.warnings,
    facts: d.facts,
    spentUusdc: d.spentUusdc,
  };
  if (d.outcome === 'Owed') {
    const claim = await createDraft(config, user._id, c._id);
    out.draft = { subject: claim.subject, text: claim.draftText };
  }
} catch (e) {
  out.error = e.code || e.message;
}
out.receipts = (await Receipt.find({ caseId: c._id }).lean()).map((r) => ({
  intent: r.intent,
  minerId: r.minerId,
  minerName: r.minerName,
  status: r.status,
  costUusdc: r.costUusdc,
  receiptHash: r.receiptHash,
  epochId: r.epochId,
  result: r.result,
}));
fs.mkdirSync(path.join(ROOT, 'evidence/sla'), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, 'evidence/sla/live-check.json'),
  JSON.stringify(out, null, 2) + '\n',
);
console.log(
  JSON.stringify({
    outcome: out.decision?.outcome,
    amountUsd: out.decision?.amountUsd,
    ms: out.ms,
    error: out.error,
  }),
);
await mongoose.disconnect();
await mem.stop();
