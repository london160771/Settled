// Opt-in live smoke test: LIVE_TELEGRAPH=1 (spends ~0.01 test USDC from the gate0 test user, HD index 1).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { startDb, stopDb } from './helpers.js';
import { loadConfig } from '../src/config/index.js';
import { User, Wallet } from '../src/models/index.js';
import { deriveAddress } from '../src/services/wallet/hd.js';
import { askIntent } from '../src/services/telegraph/askIntent.js';

const live = process.env.LIVE_TELEGRAPH === '1' && !!process.env.MASTER_MNEMONIC;

describe.skipIf(!live)('live Telegraph smoke (LIVE_TELEGRAPH=1)', () => {
  beforeAll(startDb, 120000);
  afterAll(stopDb);
  it('makes one real paid ask and stores the receipt', async () => {
    const config = loadConfig({
      ...process.env,
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://unused',
      JWT_SECRET: process.env.JWT_SECRET || 'x',
    });
    const user = await User.create({ caps: { decisionCapUusdc: 20000, monthlyCapUusdc: 50000 } });
    await Wallet.create({
      userId: user._id,
      hdIndex: 1,
      address: deriveAddress(config.masterMnemonic, 1),
    });
    const out = await askIntent({
      config,
      userId: user._id,
      intent: 'CRYPTO_PRICE_USD',
      params: { symbol: 'ETH' },
      budgetUusdc: 10000,
    });
    expect(out.receipt.receiptHash).toMatch(/^0x[0-9a-f]+$/);
    const dir = path.resolve(import.meta.dirname, '../../evidence/live');
    fs.mkdirSync(dir, { recursive: true });
    const r = out.receipt.toObject();
    fs.writeFileSync(
      path.join(dir, 'phase3-smoke.json'),
      JSON.stringify(
        {
          at: new Date().toISOString(),
          intent: r.intent,
          minerId: r.minerId,
          minerName: r.minerName,
          costUusdc: r.costUusdc,
          durationMs: r.durationMs,
          receiptHash: r.receiptHash,
          epochId: r.epochId,
          chain: r.chain,
          result: r.result,
        },
        null,
        2,
      ) + '\n',
    );
  }, 90000);
});
