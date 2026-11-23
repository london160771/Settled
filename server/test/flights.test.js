import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { decide } from '../src/services/flights/decide.js';
import { evaluate, amountForDistance } from '../src/services/flights/rules.js';
import { getAirport, distanceKm } from '../src/services/flights/airports.js';
import { startDb, stopDb, clearDb, testConfig, TEST_MNEMONIC } from './helpers.js';
import { fakeTelegraph, okAnswer } from './fakeTelegraph.js';
import { createUser } from '../src/services/users.js';
import { addFlightCase } from '../src/services/cases.js';
import { checkCase } from '../src/services/flights/evidence.js';
import { clearIntentCache } from '../src/services/telegraph/intents.js';
import { deriveAccount } from '../src/services/wallet/hd.js';
import { Case, Receipt } from '../src/models/index.js';

const lhrLos = { flightNumber: 'BA75', date: '2026-11-20', from: 'LHR', to: 'LOS' };
const t = (minerId, delay, extra = {}) => ({
  receiptId: `r-${minerId}`,
  minerId,
  result: { delay_minutes: delay, status: 'delayed', disrupted: true, ...extra },
});

describe('rules and distance', () => {
  it('distance bands', () => {
    expect(amountForDistance(1500)).toBe(250);
    expect(amountForDistance(1501)).toBe(400);
    expect(amountForDistance(3500)).toBe(400);
    expect(amountForDistance(3501)).toBe(600);
    const km = distanceKm(getAirport('LHR'), getAirport('LOS'));
    expect(km).toBeGreaterThan(4900);
    expect(km).toBeLessThan(5100);
  });
  it('arrives in the EU/UK on an EU/UK airline is covered; on a non-EU airline it is not', () => {
    expect(evaluate({ from: 'LOS', to: 'LHR', carrier: 'BA', delayMinutes: 200 }).owed).toBe(true);
    expect(evaluate({ from: 'LOS', to: 'LHR', carrier: 'P4', delayMinutes: 200 }).owed).toBe(false);
    expect(evaluate({ from: 'LOS', to: 'LHR', carrier: 'ZZ', delayMinutes: 200 }).known).toBe(
      false,
    );
  });
});

describe('decide (fixtures)', () => {
  it('3h40m long-haul → Owed 600 EUR', () => {
    const d = decide({ caseDoc: lhrLos, travel: [t('m1', 220), t('m2', 225)] });
    expect(d.outcome).toBe('Owed');
    expect(d.amountEur).toBe(600);
    expect(d.facts.delayMinutes).toBe(220);
    expect(d.factRefs[0]).toMatchObject({ fact: 'delayMinutes', receiptIds: ['r-m1', 'r-m2'] });
    expect(d.reasons.join(' ')).toMatch(/half/);
  });
  it('2h10m → NotOwed', () => {
    const d = decide({ caseDoc: lhrLos, travel: [t('m1', 130), t('m2', 128)] });
    expect(d.outcome).toBe('NotOwed');
    expect(d.reasons.join(' ')).toMatch(/under 180/);
  });
  it('miners disagree by more than 15 min → EvidenceConflict', () => {
    const d = decide({ caseDoc: lhrLos, travel: [t('m1', 220), t('m2', 120)] });
    expect(d.outcome).toBe('EvidenceConflict');
  });
  it('same miner twice → NeedsMoreProof', () => {
    expect(decide({ caseDoc: lhrLos, travel: [t('m1', 220), t('m1', 220)] }).outcome).toBe(
      'NeedsMoreProof',
    );
  });
  it('only one answer → NeedsMoreProof', () => {
    expect(decide({ caseDoc: lhrLos, travel: [t('m1', 220)] }).outcome).toBe('NeedsMoreProof');
  });
  it('non-EU route on a non-EU carrier → NotOwed (not covered)', () => {
    const d = decide({
      caseDoc: { flightNumber: 'DL100', date: '2026-11-20', from: 'JFK', to: 'LOS' },
      travel: [t('m1', 300), t('m2', 300)],
    });
    expect(d.outcome).toBe('NotOwed');
    expect(d.reasons.join(' ')).toMatch(/not covered/);
  });
  it('cancellation reported by both → Owed', () => {
    const c = (m) => ({
      receiptId: m,
      minerId: m,
      result: { status: 'cancelled', delay_minutes: null },
    });
    expect(decide({ caseDoc: lhrLos, travel: [c('m1'), c('m2')] }).outcome).toBe('Owed');
  });
  it('bad weather → still Owed, with a warning and a weather fact', () => {
    const d = decide({
      caseDoc: lhrLos,
      travel: [t('m1', 220, { reason: 'thunderstorms' }), t('m2', 222)],
      weather: { receiptId: 'w1', result: { condition: 'Thunderstorm' } },
    });
    expect(d.outcome).toBe('Owed');
    expect(d.warnings[0]).toMatch(/extraordinary/);
    expect(d.factRefs.find((f) => f.fact === 'weather').receiptIds).toEqual(['w1']);
  });
});

describe('checkCase with mocked Telegraph', () => {
  const config = testConfig();
  const signer = deriveAccount(TEST_MNEMONIC, 9);
  beforeAll(startDb, 120000);
  afterAll(stopDb);
  beforeEach(async () => {
    await clearDb();
    clearIntentCache();
  });

  it('buys 2 travel answers from different miners + weather, decides Owed', async () => {
    const u = await createUser(config);
    const c = await addFlightCase(u._id, lhrLos);
    const fake = fakeTelegraph({
      handler: ({ body, path }) => {
        if (body.intent === 'WEATHER_FORECAST_GENERAL')
          return okAnswer({ intent: body.intent, minerId: 'w9', result: { condition: 'Clear' } });
        const minerId = path.endsWith('/ask') ? 'm1' : path.split('/').pop();
        return okAnswer({
          intent: body.intent,
          minerId,
          result: { delay_minutes: minerId === 'm1' ? 220 : 224, status: 'delayed' },
        });
      },
    });
    const seen = [];
    const d = await checkCase(config, c._id, {
      fetchImpl: fake.fetch,
      signer,
      onReceipt: (r) => seen.push(r.minerId),
    });
    expect(d.outcome).toBe('Owed');
    expect(d.amountEur).toBe(600);
    expect(seen).toEqual(['m1', 'm2', 'w9']);
    expect(fake.calls.filter((x) => x.paid).map((x) => x.path)[1]).toBe('/engine/v1/ask/m2');
    expect(await Receipt.countDocuments({ caseId: c._id })).toBe(3);
    expect(d.spentUusdc).toBe(30000);
    expect((await Case.findById(c._id)).status).toBe('Owed');
  });

  it('second miner down twice → NeedsMoreProof, no draft path', async () => {
    const u = await createUser(config);
    const c = await addFlightCase(u._id, lhrLos);
    const fake = fakeTelegraph({
      handler: ({ body }) =>
        okAnswer({ intent: body.intent, minerId: 'm1', result: { delay_minutes: 220 } }),
      preHandler: ({ path }) =>
        path.endsWith('/ask') ? null : { status: 503, body: { error: 'no_compatible_miner' } },
    });
    const d = await checkCase(config, c._id, { fetchImpl: fake.fetch, signer });
    expect(d.outcome).toBe('NeedsMoreProof');
    expect((await Case.findById(c._id)).status).toBe('NeedsMoreProof');
  });
});
