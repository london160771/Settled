import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startDb, stopDb, clearDb, testConfig } from './helpers.js';
import { createUser } from '../src/services/users.js';
import { ensureWallet } from '../src/services/wallet/index.js';
import { reconcileWallet } from '../src/services/telegraph/reconcile.js';
import { Receipt, User } from '../src/models/index.js';
import { monthKey } from '../src/services/budget/index.js';

const config = testConfig();
beforeAll(startDb, 120000);
afterAll(stopDb);
beforeEach(clearDb);

const ledgerFetch = (charged, unbilled) => async () =>
  new Response(
    JSON.stringify({
      available: '0',
      deposited: '500000',
      charged: String(charged),
      unbilled: String(unbilled),
      credited: '0',
    }),
    { status: 200 },
  );

describe('reconcile', () => {
  it('reports differences and reconciles unbilled failures', async () => {
    const u = await createUser(config);
    await User.updateOne(
      { _id: u._id },
      { $set: { budget: { month: monthKey(), spentUusdc: 30000, reservedUusdc: 0 } } },
    );
    const w = await ensureWallet(config, u._id);
    await Receipt.create([
      { userId: u._id, askId: 'a', costUusdc: 10000, status: 'settled', receiptHash: '0x1' },
      { userId: u._id, askId: 'b', costUusdc: 10000, status: 'settled', receiptHash: '0x2' },
      { userId: u._id, askId: 'c', costUusdc: 10000, status: 'charged_on_failure' },
    ]);
    const dry = await reconcileWallet(config, w, { fetchImpl: ledgerFetch(10000, 10000) });
    expect(dry.differenceUusdc).toBe(10000);
    expect(dry.reconciled).toHaveLength(0);
    const applied = await reconcileWallet(config, w, {
      apply: true,
      fetchImpl: ledgerFetch(10000, 10000),
    });
    expect(applied.reconciled).toHaveLength(1);
    expect(await Receipt.countDocuments({ status: 'reconciled' })).toBe(1);
    expect((await User.findById(u._id)).budget.spentUusdc).toBe(20000);
  });
  it('keeps failures counted when the ledger billed them', async () => {
    const u = await createUser(config);
    const w = await ensureWallet(config, u._id);
    await Receipt.create({
      userId: u._id,
      askId: 'c',
      costUusdc: 10000,
      status: 'charged_on_failure',
    });
    const r = await reconcileWallet(config, w, { apply: true, fetchImpl: ledgerFetch(10000, 0) });
    expect(r.differenceUusdc).toBe(0);
    expect(r.reconciled).toHaveLength(0);
  });
});
