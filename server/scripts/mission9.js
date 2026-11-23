// Live Mission 9 run (spends 0.04 test USDC from the Gate 0 test user, HD index 1):
// 4 paid asks → 4 receipts; a 5th is refused by the cap (CAP_EXCEEDED). Saves evidence/mission9/run.json.
// Usage: node server/scripts/mission9.js   (needs MASTER_MNEMONIC and a funded test user, see guide 01)
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { loadConfig } from '../src/config/index.js';
import { User, Wallet } from '../src/models/index.js';
import { deriveAddress } from '../src/services/wallet/hd.js';
import { paidAsk } from '../src/services/ask/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const config = loadConfig({
  ...process.env,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://memory',
  JWT_SECRET: process.env.JWT_SECRET || 'script',
});
if (!config.masterMnemonic) throw new Error('MASTER_MNEMONIC is not set (guide 01)');
const mem = await MongoMemoryServer.create();
await mongoose.connect(mem.getUri());
const user = await User.create({
  displayName: 'Settled mission 9 run',
  leaderboardOptIn: true,
  caps: { decisionCapUusdc: 10000, monthlyCapUusdc: 40000 },
});
await Wallet.create({
  userId: user._id,
  hdIndex: 1,
  address: deriveAddress(config.masterMnemonic, 1),
});
const asks = [
  ['price', 'ETH'],
  ['weather', 'Lagos'],
  ['search', 'What is the Telegraph protocol?'],
  ['ask', 'What does EU261 compensate for?'],
  ['price', 'BTC'], // 5th: must be refused by the cap
];
const out = [];
for (const [kind, input] of asks) {
  try {
    const r = await paidAsk(config, user._id, kind, input);
    out.push({
      kind,
      input,
      intent: r.intent,
      answer: r.answer,
      minerId: r.receipt.minerId,
      minerName: r.receipt.minerName,
      costUusdc: r.receipt.costUusdc,
      durationMs: r.receipt.durationMs,
      receiptHash: r.receipt.receiptHash,
      epochId: r.receipt.epochId,
    });
  } catch (e) {
    out.push({ kind, input, error: e.code || e.message });
  }
  console.log(JSON.stringify(out.at(-1)));
}
const dir = path.join(ROOT, 'evidence/mission9');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(
  path.join(dir, 'run.json'),
  JSON.stringify(
    {
      at: new Date().toISOString(),
      payer: deriveAddress(config.masterMnemonic, 1),
      capUusdc: 40000,
      asks: out,
    },
    null,
    2,
  ) + '\n',
);
await mongoose.disconnect();
await mem.stop();
