import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { startDb, stopDb, clearDb, testConfig } from './helpers.js';
import { fakeTelegraph, okAnswer } from './fakeTelegraph.js';
import { createApp } from '../src/app.js';
import { clearIntentCache } from '../src/services/telegraph/intents.js';
import { Receipt } from '../src/models/index.js';

const config = testConfig({
  DEMO_INBOX_EMAIL: 'demo-inbox@example.com',
  JUDGE_DAILY_RUN_LIMIT: '2',
});
beforeAll(startDb, 120000);
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  clearIntentCache();
});

function setup() {
  const fake = fakeTelegraph({
    handler: ({ body, path }) => {
      if (body.intent === 'WEATHER_FORECAST_GENERAL')
        return okAnswer({ intent: body.intent, minerId: 'w9', result: { condition: 'Clear' } });
      const minerId = path.endsWith('/ask') ? 'm1' : path.split('/').pop();
      return okAnswer({
        intent: body.intent,
        minerId,
        result: { delay_minutes: 220, status: 'delayed' },
      });
    },
  });
  fake.ledger = { available: '0', deposited: '0', charged: '0', credited: '0', unbilled: '0' };
  const funded = [];
  const app = createApp(config, {
    telegraph: { fetchImpl: fake.fetch },
    wallet: {
      fetchImpl: fake.fetch,
      diamond: '0xdiamond',
      fund: async (a) => (funded.push(a), { deposit: '0xtx' }),
    },
  });
  return { app, fake, funded };
}

describe('judge mode', () => {
  it('creates a funded demo account with the seeded case, reuses it for the same browser', async () => {
    const { app, funded } = setup();
    const agent = request.agent(app);
    const s1 = await agent.post('/api/judge/session');
    expect(s1.body.user.isDemo).toBe(true);
    expect(s1.body.reused).toBe(false);
    expect(funded[0].amountUusdc).toBe(500000);
    const s2 = await agent.post('/api/judge/session');
    expect(s2.body.reused).toBe(true);
    expect(s2.body.user.id).toBe(s1.body.user.id);
    const cases = await agent.get('/api/cases');
    expect(cases.body.cases[0]).toMatchObject({
      flightNumber: 'BA75',
      date: '2026-11-20',
      status: 'Watching',
    });
  });

  it('daily judge limit protects the operator wallet', async () => {
    const { app } = setup();
    expect((await request(app).post('/api/judge/session')).status).toBe(200);
    expect((await request(app).post('/api/judge/session')).status).toBe(200);
    const third = await request(app).post('/api/judge/session');
    expect(third.status).toBe(429);
    expect(third.body.error.code).toBe('LIMIT_REACHED');
  });

  it('Run the demo reaches DraftReady (mocked node) and only sends to the demo inbox after confirm', async () => {
    const { app } = setup();
    const agent = request.agent(app);
    await agent.post('/api/judge/session');
    const run = await agent.post('/api/judge/demo');
    expect(run.status).toBe(200);
    expect(run.body.reachedDraftReady).toBe(true);
    expect(run.body.claim.recipientEmail).toBe('demo-inbox@example.com');
    expect(run.body.ms).toBeLessThan(90000);
    const claimId = run.body.claim._id;
    expect(
      (await agent.put(`/api/claims/${claimId}/recipient`).send({ email: 'ceo@airline.example' }))
        .status,
    ).toBe(400);
    expect((await agent.post(`/api/claims/${claimId}/send`).send({})).body.error.code).toBe(
      'RECIPIENT_NOT_CONFIRMED',
    );
    const again = await agent.post('/api/judge/demo');
    expect(again.body.reachedDraftReady).toBe(true);
  });

  it('demo endpoints refuse normal accounts', async () => {
    const { app } = setup();
    const agent = request.agent(app);
    await agent.post('/api/auth/signup').send({ email: 'n@example.com', password: 'longpassword' });
    expect((await agent.post('/api/judge/demo')).status).toBe(400);
  });
});

describe('Attack Lab: each attack is blocked with its reason code', () => {
  it('runs all six on real code paths', async () => {
    const { app, fake } = setup();
    const agent = request.agent(app);
    await agent.post('/api/judge/session');
    const out = await agent.post('/api/judge/attacks');
    expect(out.status).toBe(200);
    const codes = Object.fromEntries(out.body.results.map((r) => [r.id, r.code]));
    expect(codes).toEqual({
      1: 'CAP_EXCEEDED',
      2: 'DUPLICATE_CLAIM',
      3: 'EVIDENCE_CONFLICT',
      4: 'UNTRUSTED_INSTRUCTION',
      5: 'CHARGED_ON_FAILURE',
      6: 'RECIPIENT_NOT_CONFIRMED',
    });
    expect(out.body.allBlocked).toBe(true);
    expect(out.body.results.filter((r) => r.replayed).map((r) => r.id)).toEqual([3, 5]);
    expect(fake.paid).toBe(0); // no attack spent money
    expect(await Receipt.countDocuments({ replayed: true })).toBe(3);
  });
});
