import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { decideSla, creditFor } from '../src/services/sla/decide.js';
import { parseTiers, windowDaysCovering, DEFAULT_TIERS } from '../src/services/sla/vendors.js';
import { startDb, stopDb, clearDb, testConfig, TEST_MNEMONIC } from './helpers.js';
import { fakeTelegraph, okAnswer } from './fakeTelegraph.js';
import { createUser } from '../src/services/users.js';
import { addSlaCase } from '../src/services/cases.js';
import { checkCase } from '../src/services/flights/evidence.js';
import { createDraft } from '../src/services/claims/index.js';
import { clearIntentCache } from '../src/services/telegraph/intents.js';
import { deriveAccount } from '../src/services/wallet/hd.js';
import { Case, Receipt } from '../src/models/index.js';

const caseDoc = { vendor: 'vercel', period: '2026-10', tiers: DEFAULT_TIERS, monthlyFeeUsd: 400 };
const ans = (minerId, r) => ({ receiptId: `r-${minerId}`, minerId, result: r });
// Shapes copied from the live answers in evidence/sla/.
const month = (uptime, period = '2026-10') =>
  ans('2611217', {
    service: 'Vercel',
    uptime_pct: uptime,
    sla_target_pct: 99.99,
    compliant: uptime >= 99.99,
    period,
  });
const win = (uptime) =>
  ans('7410311', {
    service: 'Vercel',
    uptime_pct: uptime,
    sla_target_pct: 99.99,
    compliant: uptime >= 99.99,
    period: 'last 54 days',
  });

describe('SLA rules', () => {
  it('tiers parse and pick the largest credit that applies', () => {
    const t = parseTiers('99.9:10, 99:25, 95:50');
    expect(t[0]).toEqual({ belowPct: 99.9, creditPct: 10 });
    expect(creditFor(99.95, t)).toBe(0);
    expect(creditFor(99.5, t)).toBe(10);
    expect(creditFor(98, t)).toBe(25);
    expect(() => parseTiers('abc')).toThrow();
  });
  it('window days cover the whole month', () => {
    expect(windowDaysCovering('2026-10', new Date('2026-11-23T12:00:00Z'))).toBe(54);
  });
});

describe('decideSla (fixtures)', () => {
  it('breach seen by two different miners → Owed with credit', () => {
    const d = decideSla({ caseDoc, month: month(99.9645), window: win(99.5617) });
    expect(d.outcome).toBe('Owed');
    expect(d.facts.creditPct).toBe(10);
    expect(d.amountUsd).toBe(40);
    expect(d.factRefs.map((f) => f.fact)).toEqual(['uptimePct', 'targetPct', 'breachCorroborated']);
  });
  it('month meets the target → NotOwed', () => {
    expect(decideSla({ caseDoc, month: month(100) }).outcome).toBe('NotOwed');
  });
  it('answer for a different period → NeedsMoreProof', () => {
    expect(decideSla({ caseDoc, month: month(99.5, 'last 90 days') }).outcome).toBe(
      'NeedsMoreProof',
    );
  });
  it('breach but no second miner → NeedsMoreProof', () => {
    expect(decideSla({ caseDoc, month: month(99.5) }).outcome).toBe('NeedsMoreProof');
  });
  it('second miner sees no breach → EvidenceConflict', () => {
    expect(decideSla({ caseDoc, month: month(99.5), window: win(100) }).outcome).toBe(
      'EvidenceConflict',
    );
  });
  it('same miner twice → NeedsMoreProof', () => {
    const w = { ...win(99.1), minerId: '2611217' };
    expect(decideSla({ caseDoc, month: month(99.5), window: w }).outcome).toBe('NeedsMoreProof');
  });
  it("user's contract target overrides the vendor's", () => {
    const d = decideSla({ caseDoc: { ...caseDoc, promisedPct: 99.9 }, month: month(99.95) });
    expect(d.outcome).toBe('NotOwed');
  });
});

describe('SLA cases and checks (mocked Telegraph)', () => {
  const config = testConfig();
  const signer = deriveAccount(TEST_MNEMONIC, 9);
  const now = new Date('2026-11-23T12:00:00Z');
  beforeAll(startDb, 120000);
  afterAll(stopDb);
  beforeEach(async () => {
    await clearDb();
    clearIntentCache();
  });

  const fakeSla = (monthUptime, windowUptime) => {
    const fake = fakeTelegraph({
      known: ['SLA_COMPLIANCE_GENERAL'],
      handler: ({ body, path }) => {
        const minerId = path.split('/').pop();
        const r = minerId === '7410311' ? win(windowUptime).result : month(monthUptime).result;
        return okAnswer({ intent: body.intent, minerId, result: r });
      },
    });
    fake.miners = [{ id: '2611217' }, { id: '7410311' }, { id: '302' }];
    return fake;
  };

  it('validates input and blocks duplicates (one claim per vendor + month)', async () => {
    const u = await createUser(config);
    await expect(addSlaCase(u._id, { vendor: 'nope', period: '2026-10' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    await expect(addSlaCase(u._id, { vendor: 'vercel', period: '2099-01' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    await addSlaCase(u._id, { vendor: 'vercel', period: '2026-10' });
    await expect(addSlaCase(u._id, { vendor: 'Vercel', period: '2026-10' })).rejects.toMatchObject({
      code: 'DUPLICATE_CLAIM',
    });
  });

  it('breach: buys month + window from two miners, decides Owed, drafts a receipt-backed credit request', async () => {
    const u = await createUser(config);
    const c = await addSlaCase(u._id, { vendor: 'vercel', period: '2026-10', monthlyFeeUsd: 400 });
    const fake = fakeSla(99.9645, 99.5617);
    const d = await checkCase(config, c._id, { fetchImpl: fake.fetch, signer, now });
    expect(d.outcome).toBe('Owed');
    expect(d.amountUsd).toBe(40);
    const paid = fake.calls.filter((x) => x.paid);
    expect(paid.map((x) => x.path)).toEqual(['/engine/v1/ask/2611217', '/engine/v1/ask/7410311']);
    expect(paid[0].body.params).toEqual({ service: 'Vercel', period: '2026-10' });
    expect(paid[1].body.params).toEqual({ service: 'Vercel', period: '54d' });
    expect(await Receipt.countDocuments({ caseId: c._id })).toBe(2);
    const claim = await createDraft(config, u._id, c._id);
    expect(claim.subject).toMatch(/Vercel, 2026-10/);
    expect(claim.draftText).toMatch(/99.9645%/);
    expect(claim.draftText).toMatch(/40 USD/);
    expect((claim.draftText.match(/receipt 0x/g) || []).length).toBe(3); // uptime, target, corroboration
  });

  it('compliant month: only one ask is bought, NotOwed, no draft', async () => {
    const u = await createUser(config);
    const c = await addSlaCase(u._id, { vendor: 'vercel', period: '2026-10' });
    const fake = fakeSla(100, 100);
    const d = await checkCase(config, c._id, { fetchImpl: fake.fetch, signer, now });
    expect(d.outcome).toBe('NotOwed');
    expect(fake.calls.filter((x) => x.paid)).toHaveLength(1);
    await expect(createDraft(config, u._id, c._id)).rejects.toMatchObject({ code: 'NOT_ELIGIBLE' });
  });

  it('month older than the 90-day window → NeedsMoreProof, no second ask', async () => {
    const u = await createUser(config);
    const c = await addSlaCase(u._id, { vendor: 'vercel', period: '2026-06' });
    const fake = fakeTelegraph({
      known: ['SLA_COMPLIANCE_GENERAL'],
      handler: ({ body, path }) =>
        okAnswer({
          intent: body.intent,
          minerId: path.split('/').pop(),
          result: month(99.5, '2026-06').result,
        }),
    });
    fake.miners = [{ id: '2611217' }, { id: '7410311' }];
    const d = await checkCase(config, c._id, { fetchImpl: fake.fetch, signer, now });
    expect(d.outcome).toBe('NeedsMoreProof');
    expect(d.reasons.join(' ')).toMatch(/90 days/);
    expect(fake.calls.filter((x) => x.paid)).toHaveLength(1);
    expect((await Case.findById(c._id)).status).toBe('NeedsMoreProof');
  });
});
