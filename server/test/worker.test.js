import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startDb, stopDb, clearDb, testConfig } from './helpers.js';
import { fakeTelegraph, okAnswer } from './fakeTelegraph.js';
import { createUser } from '../src/services/users.js';
import { addFlightCase } from '../src/services/cases.js';
import { runDueChecks } from '../src/worker/index.js';
import { clearIntentCache } from '../src/services/telegraph/intents.js';
import { User } from '../src/models/index.js';

const config = testConfig();
beforeAll(startDb, 120000);
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  clearIntentCache();
});

describe('worker', () => {
  it('checks past flights once, notifies Telegram users, skips future flights, respects the cap', async () => {
    const fake = fakeTelegraph({
      handler: ({ body, path }) =>
        okAnswer({
          intent: body.intent,
          minerId: path.endsWith('/ask') ? 'm1' : path.split('/').pop(),
          result: { delay_minutes: 200, condition: 'Clear' },
        }),
    });
    const u = await createUser(config, { telegramId: '42' });
    await addFlightCase(u._id, {
      flightNumber: 'BA75',
      date: '2026-11-20',
      from: 'LHR',
      to: 'LOS',
    });
    await addFlightCase(u._id, {
      flightNumber: 'BA76',
      date: '2026-12-20',
      from: 'LOS',
      to: 'LHR',
    });
    const broke = await createUser(config);
    await User.updateOne({ _id: broke._id }, { $set: { 'caps.monthlyCapUusdc': 10000 } });
    await addFlightCase(broke._id, {
      flightNumber: 'AF1',
      date: '2026-11-19',
      from: 'CDG',
      to: 'LHR',
    });
    const sent = [];
    const now = new Date('2026-11-22T12:00:00Z');
    const out = await runDueChecks(config, {
      telegraph: { fetchImpl: fake.fetch },
      notify: async (id, text) => sent.push({ id, text }),
      now,
    });
    expect(out.find((r) => r.outcome)?.outcome).toBe('Owed');
    expect(out.find((r) => r.error)?.error).toBe('CAP_EXCEEDED');
    expect(sent).toHaveLength(1);
    expect(sent[0].text).toMatch(/BA75 2026-11-20: Owed/);
    expect(await runDueChecks(config, { telegraph: { fetchImpl: fake.fetch }, now })).toHaveLength(
      0,
    );
  });
});
