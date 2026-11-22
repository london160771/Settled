import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import '../src/models/index.js';
import { startDb, stopDb, clearDb, testConfig } from './helpers.js';
import { createUser } from '../src/services/users.js';
import { reserve, settle, release, getBudget } from '../src/services/budget/index.js';
import { User, Reservation } from '../src/models/index.js';

const config = testConfig();
beforeAll(startDb, 120000);
afterAll(stopDb);
beforeEach(clearDb);

async function userWithCaps(monthly, decision = 1000000) {
  const u = await createUser(config);
  await User.updateOne(
    { _id: u._id },
    { $set: { 'caps.monthlyCapUusdc': monthly, 'caps.decisionCapUusdc': decision } },
  );
  return u;
}

describe('budget invariant 1 (cap)', () => {
  it('20 parallel reservations never exceed a small monthly cap', async () => {
    const u = await userWithCaps(55000); // room for 5 asks of 10000
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => reserve({ userId: u._id, amountUusdc: 10000 })),
    );
    const ok = results.filter((r) => r.status === 'fulfilled');
    const refused = results.filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(5);
    expect(refused.every((r) => r.reason.code === 'CAP_EXCEEDED')).toBe(true);
    const b = await getBudget(u._id);
    expect(b.spentUusdc + b.reservedUusdc).toBeLessThanOrEqual(55000);
    expect(b.reservedUusdc).toBe(50000);
  });

  it('20 parallel reservations in one decision never exceed the decision cap', async () => {
    const u = await userWithCaps(1000000, 30000);
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        reserve({ userId: u._id, amountUusdc: 10000, decisionKey: 'd1' }),
      ),
    );
    const ok = results.filter((r) => r.status === 'fulfilled');
    expect(ok).toHaveLength(3);
    expect(
      results
        .filter((r) => r.status === 'rejected')
        .every((r) => r.reason.code === 'DECISION_CAP_EXCEEDED'),
    ).toBe(true);
    expect((await getBudget(u._id)).reservedUusdc).toBe(30000);
  });

  it('one ask above the decision cap is refused', async () => {
    const u = await userWithCaps(1000000, 20000);
    await expect(reserve({ userId: u._id, amountUusdc: 30000 })).rejects.toMatchObject({
      code: 'DECISION_CAP_EXCEEDED',
    });
  });

  it('release on failure gives the room back', async () => {
    const u = await userWithCaps(20000);
    const r1 = await reserve({ userId: u._id, amountUusdc: 20000 });
    await expect(reserve({ userId: u._id, amountUusdc: 10000 })).rejects.toMatchObject({
      code: 'CAP_EXCEEDED',
    });
    await release(r1._id);
    expect((await getBudget(u._id)).reservedUusdc).toBe(0);
    await expect(reserve({ userId: u._id, amountUusdc: 10000 })).resolves.toBeTruthy();
    expect((await Reservation.findById(r1._id)).state).toBe('released');
  });

  it('settle moves reserved to spent, refunds the unused part', async () => {
    const u = await userWithCaps(100000);
    const r = await reserve({ userId: u._id, amountUusdc: 30000 });
    await settle(r._id, 10000);
    const b = await getBudget(u._id);
    expect(b.spentUusdc).toBe(10000);
    expect(b.reservedUusdc).toBe(0);
  });

  it('charged_on_failure counts as spent (bug #228)', async () => {
    const u = await userWithCaps(20000);
    const r = await reserve({ userId: u._id, amountUusdc: 10000 });
    await settle(r._id, 10000); // failed ask, but charged
    const b = await getBudget(u._id);
    expect(b.spentUusdc).toBe(10000);
    await reserve({ userId: u._id, amountUusdc: 10000 });
    await expect(reserve({ userId: u._id, amountUusdc: 10000 })).rejects.toMatchObject({
      code: 'CAP_EXCEEDED',
    });
  });

  it('a reservation cannot be settled or released twice', async () => {
    const u = await userWithCaps(100000);
    const r = await reserve({ userId: u._id, amountUusdc: 10000 });
    await settle(r._id, 10000);
    await expect(settle(r._id, 10000)).rejects.toThrow();
    expect(await release(r._id)).toBeNull();
    expect((await getBudget(u._id)).spentUusdc).toBe(10000);
  });

  it('monthly reset zeroes spent at a new month, keeps held reservations', async () => {
    const u = await userWithCaps(20000);
    const nov = new Date('2026-11-30T23:00:00Z');
    const r = await reserve({ userId: u._id, amountUusdc: 10000, now: nov });
    await settle(r._id, 10000);
    await reserve({ userId: u._id, amountUusdc: 10000, now: nov });
    const dec = new Date('2026-12-01T01:00:00Z');
    const b = await getBudget(u._id, dec);
    expect(b.month).toBe('2026-12');
    expect(b.spentUusdc).toBe(0);
    expect(b.reservedUusdc).toBe(10000);
  });
});
