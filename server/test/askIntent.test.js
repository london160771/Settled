import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startDb, stopDb, clearDb, testConfig, TEST_MNEMONIC } from './helpers.js';
import { fakeTelegraph, okAnswer } from './fakeTelegraph.js';
import { createUser } from '../src/services/users.js';
import { askIntent } from '../src/services/telegraph/askIntent.js';
import { clearIntentCache } from '../src/services/telegraph/intents.js';
import { getBudget } from '../src/services/budget/index.js';
import { deriveAccount } from '../src/services/wallet/hd.js';
import { Receipt, User } from '../src/models/index.js';

const config = testConfig();
const signer = deriveAccount(TEST_MNEMONIC, 7);
beforeAll(startDb, 120000);
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  clearIntentCache();
});

const ask = (user, fake, extra = {}) =>
  askIntent({
    config,
    userId: user._id,
    intent: 'TRAVEL_DISRUPTION_GENERAL',
    params: { route_or_flight: 'BA75' },
    budgetUusdc: 20000,
    deps: { fetchImpl: fake.fetch, signer },
    ...extra,
  });

describe('askIntent (mocked HTTP)', () => {
  it('402 → signed escrow payment → 200, stores receipt, settles cost, releases the rest', async () => {
    const u = await createUser(config);
    const fake = fakeTelegraph({
      handler: ({ body }) => okAnswer({ intent: body.intent, result: { delay_minutes: 220 } }),
    });
    const out = await ask(u, fake);
    expect(out.result.delay_minutes).toBe(220);
    expect(out.receipt.receiptHash).toMatch(/^0x/);
    expect(out.receipt.status).toBe('settled');
    expect(out.receipt.minerId).toBe('m1');
    expect(fake.calls[0].body.max_budget_usdc).toBe(20000);
    const b = await getBudget(u._id);
    expect(b.spentUusdc).toBe(10000);
    expect(b.reservedUusdc).toBe(0);
  });

  it('multi-miner ask stores one receipt per paid row', async () => {
    const u = await createUser(config);
    const fake = fakeTelegraph({
      handler: ({ body }) =>
        okAnswer({
          intent: body.intent,
          amount: 10000,
          payments: [
            { miner: 'm1', intent: body.intent, amount_uusdc: 10000, receipt_hash: '0xrow1' },
            { miner: 'm2', intent: body.intent, amount_uusdc: 10000, receipt_hash: '0xrow2' },
          ],
        }),
    });
    const out = await ask(u, fake);
    expect(out.extraReceipts).toHaveLength(1);
    expect((await getBudget(u._id)).spentUusdc).toBe(20000);
    expect(await Receipt.countDocuments({ askId: out.askId })).toBe(2);
  });

  it('direct ask to a chosen miner sends no budget', async () => {
    const u = await createUser(config);
    const fake = fakeTelegraph({
      handler: ({ body }) => okAnswer({ intent: body.intent, minerId: 'm9' }),
    });
    const out = await ask(u, fake, { minerId: 'm9', budgetUusdc: 10000 });
    expect(fake.calls[0].path).toBe('/engine/v1/ask/m9');
    expect(fake.calls[0].body.max_budget_usdc).toBeUndefined();
    expect(out.receipt.minerId).toBe('m9');
  });

  it('500 after payment (bug #228): charged_on_failure, counted as spent, retried once, never loops', async () => {
    const u = await createUser(config);
    const fake = fakeTelegraph({
      handler: () => ({ status: 500, body: { error: 'miner down', miner_id: 'm1' } }),
    });
    await expect(ask(u, fake)).rejects.toMatchObject({ code: 'CHARGED_ON_FAILURE' });
    expect(fake.paid).toBe(2); // first try + one retry
    const rs = await Receipt.find({ userId: u._id });
    expect(rs).toHaveLength(2);
    expect(rs.every((r) => r.status === 'charged_on_failure')).toBe(true);
    expect((await getBudget(u._id)).spentUusdc).toBe(40000);
  });

  it('500 then 200: one charged_on_failure + one settled receipt', async () => {
    const u = await createUser(config);
    const fake = fakeTelegraph({
      handler: ({ body, n }) =>
        n === 1 ? { status: 500, body: {} } : okAnswer({ intent: body.intent }),
    });
    const out = await ask(u, fake);
    expect(out.receipt.status).toBe('settled');
    expect(await Receipt.countDocuments({ status: 'charged_on_failure' })).toBe(1);
  });

  it('retry stops at the cap: a charged failure counts against the cap', async () => {
    const u = await createUser(config);
    await User.updateOne({ _id: u._id }, { $set: { 'caps.monthlyCapUusdc': 30000 } });
    const fake = fakeTelegraph({ handler: () => ({ status: 500, body: {} }) });
    await expect(ask(u, fake)).rejects.toMatchObject({ code: 'CAP_EXCEEDED' });
    expect(fake.paid).toBe(1);
    expect((await getBudget(u._id)).spentUusdc).toBe(20000);
  });

  it('unknown Intent → INTENT_UNKNOWN before any payment or reservation', async () => {
    const u = await createUser(config);
    const fake = fakeTelegraph({ handler: () => okAnswer() });
    await expect(ask(u, fake, { intent: 'NOPE_FOO' })).rejects.toMatchObject({
      code: 'INTENT_UNKNOWN',
    });
    expect(fake.calls).toHaveLength(0);
    expect((await getBudget(u._id)).reservedUusdc).toBe(0);
  });

  it('budget too high or too low is refused before anything happens', async () => {
    const u = await createUser(config);
    const fake = fakeTelegraph({ handler: () => okAnswer() });
    await expect(ask(u, fake, { budgetUusdc: 300000 })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    await expect(ask(u, fake, { budgetUusdc: 5000 })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(fake.calls).toHaveLength(0);
  });

  it('budget above the per-decision cap → DECISION_CAP_EXCEEDED, nothing sent', async () => {
    const u = await createUser(config);
    const fake = fakeTelegraph({ handler: () => okAnswer() });
    await expect(ask(u, fake, { budgetUusdc: 250000 })).rejects.toMatchObject({
      code: 'DECISION_CAP_EXCEEDED',
    });
    expect(fake.calls).toHaveLength(0);
  });

  it('refused before payment (400 invalid_params) → released, not charged', async () => {
    const u = await createUser(config);
    const fake = fakeTelegraph({
      handler: () => okAnswer(),
      preHandler: () => ({
        status: 400,
        body: { error: 'invalid_params', message: 'route_or_flight is required' },
      }),
    });
    await expect(ask(u, fake)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    const b = await getBudget(u._id);
    expect(b.spentUusdc + b.reservedUusdc).toBe(0);
  });

  it('escrow refused (insufficient balance) → WALLET_UNFUNDED, not charged', async () => {
    const u = await createUser(config);
    const fake = fakeTelegraph({
      handler: () => ({ status: 402, body: { reason: 'insufficient escrow for delivery' } }),
    });
    await expect(ask(u, fake)).rejects.toMatchObject({ code: 'WALLET_UNFUNDED' });
    expect((await getBudget(u._id)).spentUusdc).toBe(0);
  });
});
