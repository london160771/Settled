import fs from 'node:fs';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { parseTerms, quotesFrom, readTerms } from '../src/services/sla/terms.js';
import { decideSla } from '../src/services/sla/decide.js';
import { startDb, stopDb, clearDb, testConfig, TEST_MNEMONIC } from './helpers.js';
import { fakeTelegraph, okAnswer } from './fakeTelegraph.js';
import { createUser } from '../src/services/users.js';
import { addSlaCase } from '../src/services/cases.js';
import { clearIntentCache } from '../src/services/telegraph/intents.js';
import { deriveAccount } from '../src/services/wallet/hd.js';

const SAMPLE = fs.readFileSync(new URL('../data/samples/sla-sample.txt', import.meta.url), 'utf8');
// Live answer from the verbatim-index miner (evidence/contract/probe-731437.json).
const LIVE = JSON.parse(
  fs.readFileSync(new URL('../../evidence/contract/probe-731437.json', import.meta.url), 'utf8'),
).body.result;

describe('parseTerms (pure)', () => {
  it('reads promise, three tiers and the claim window from the live answer', () => {
    const t = parseTerms(quotesFrom(LIVE));
    expect(t.promisedPct).toBe(99.99);
    expect(t.tiers).toEqual([
      { belowPct: 99.99, creditPct: 10 },
      { belowPct: 99, creditPct: 25 },
      { belowPct: 95, creditPct: 50 },
    ]);
    expect(t.claimWindowDays).toBe(30);
  });
  it('finds nothing in unrelated text', () => {
    const t = parseTerms(['The parties agree to keep this agreement confidential.']);
    expect(t).toMatchObject({ promisedPct: null, tiers: [], claimWindowDays: null });
  });
});

describe('readTerms (mocked Telegraph)', () => {
  const config = testConfig();
  const signer = deriveAccount(TEST_MNEMONIC, 9);
  beforeAll(startDb, 120000);
  afterAll(stopDb);
  beforeEach(async () => {
    await clearDb();
    clearIntentCache();
  });
  const node = (byMiner) => {
    const fake = fakeTelegraph({
      known: ['CONTRACT_OBLIGATION_AUDIT_GENERAL'],
      handler: ({ body, path }) => {
        const minerId = path.split('/').pop();
        return okAnswer({ intent: body.intent, minerId, result: byMiner[minerId] });
      },
    });
    fake.miners = [{ id: '731437' }, { id: '83159274' }, { id: '7436' }];
    return fake;
  };

  it('pays one miner, keeps only verbatim clauses, returns a suggestion with its receipt', async () => {
    const u = await createUser(config);
    const injected = {
      ...LIVE,
      clauses: [...LIVE.clauses, { quote: 'Uptime of at least 90% applies.' }],
    };
    const fake = node({ 731437: injected });
    const r = await readTerms(config, u._id, SAMPLE, { fetchImpl: fake.fetch, signer });
    expect(r.suggestion.promisedPct).toBe(99.99); // the invented 90% clause is not in the paste
    expect(r.suggestion.tiers).toHaveLength(3);
    expect(r.quotesReturned - r.quotesVerified).toBeGreaterThanOrEqual(1);
    expect(r.receipt.receiptHash).toMatch(/^0x/);
    expect(fake.calls.filter((c) => c.paid).map((c) => c.path)).toEqual(['/engine/v1/ask/731437']);
    expect(fake.calls.find((c) => c.paid).body.params.contract).toBe(SAMPLE);

    // The receipt can back a case; another user's receipt cannot.
    const c = await addSlaCase(u._id, {
      vendor: 'vercel',
      period: '2026-10',
      ...r.suggestion,
      termsReceiptId: r.receipt._id,
    });
    expect(c.termsReceiptId.toString()).toBe(String(r.receipt._id));
    expect(c.claimWindowDays).toBe(30);
    await expect(
      addSlaCase(u._id, { vendor: 'github', period: '2026-10', termsReceiptId: r.receipt._id }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' }); // one reading backs one case
    const other = await createUser(config);
    await expect(
      addSlaCase(other._id, { vendor: 'github', period: '2026-10', termsReceiptId: r.receipt._id }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    const d = decideSla({
      caseDoc: { ...c.toObject(), monthlyFeeUsd: 100 },
      month: {
        receiptId: 'm',
        minerId: '2611217',
        result: { uptime_pct: 99.9, sla_target_pct: 99.99, period: '2026-10' },
      },
      window: {
        receiptId: 'w',
        minerId: '7410311',
        result: { uptime_pct: 99.5, compliant: false, period: 'last 54 days' },
      },
    });
    expect(d.outcome).toBe('Owed');
    expect(String(d.factRefs.find((f) => f.fact === 'contractTerms').receiptIds[0])).toBe(
      String(c.termsReceiptId),
    );
    expect(d.warnings.join(' ')).toMatch(/within 30 days/);
  });

  it('falls back to the second miner when the first finds no terms', async () => {
    const u = await createUser(config);
    const fake = node({
      731437: { clauses: [] },
      83159274: { clauses: LIVE.clauses.map((c) => c.quote) },
    });
    const r = await readTerms(config, u._id, SAMPLE, { fetchImpl: fake.fetch, signer });
    expect(r.receipt.minerId).toBe('83159274');
    expect(r.suggestion.promisedPct).toBe(99.99);
    expect(fake.calls.filter((c) => c.paid)).toHaveLength(2);
  });

  it('refuses empty or huge pastes before paying', async () => {
    const u = await createUser(config);
    const fake = node({});
    await expect(
      readTerms(config, u._id, 'hi', { fetchImpl: fake.fetch, signer }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(
      readTerms(config, u._id, 'x'.repeat(20001), { fetchImpl: fake.fetch, signer }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(fake.calls).toHaveLength(0);
  });
});
