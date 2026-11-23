import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { startDb, stopDb, clearDb, testConfig, TEST_MNEMONIC } from './helpers.js';
import { fakeTelegraph, okAnswer } from './fakeTelegraph.js';
import { createApp } from '../src/app.js';
import { clearIntentCache } from '../src/services/telegraph/intents.js';
import { deriveAccount } from '../src/services/wallet/hd.js';
import { createLinkCode } from '../src/services/auth.js';
import { LinkCode } from '../src/models/index.js';

const config = testConfig({ WEB_URL: 'https://settled.test' });
beforeAll(startDb, 120000);
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  clearIntentCache();
});

function node() {
  return fakeTelegraph({
    handler: ({ body, path }) => {
      if (body.intent === 'WEATHER_FORECAST_GENERAL')
        return okAnswer({ intent: body.intent, minerId: 'w9', result: { condition: 'Clear' } });
      const minerId = path.endsWith('/ask') ? 'm1' : path.split('/').pop();
      return okAnswer({
        intent: body.intent,
        minerId,
        minerName: `Miner ${minerId}`,
        result: { delay_minutes: minerId === 'm1' ? 220 : 226, status: 'delayed' },
      });
    },
  });
}

describe('auth routes', () => {
  it('sign up, me, sign out, sign in', async () => {
    const app = createApp(config);
    const agent = request.agent(app);
    const up = await agent
      .post('/api/auth/signup')
      .send({ email: 'Ada@Example.com', password: 'longpassword' });
    expect(up.status).toBe(201);
    expect(up.headers['set-cookie'][0]).toMatch(/settled_token=.*HttpOnly/);
    expect((await agent.get('/api/me')).body.user.email).toBe('ada@example.com');
    await agent.post('/api/auth/signout');
    expect((await agent.get('/api/me')).status).toBe(401);
    expect(
      (
        await agent
          .post('/api/auth/signin')
          .send({ email: 'ada@example.com', password: 'wrongpass' })
      ).body.error.code,
    ).toBe('UNAUTHORIZED');
    expect(
      (
        await agent
          .post('/api/auth/signin')
          .send({ email: 'ada@example.com', password: 'longpassword' })
      ).status,
    ).toBe(200);
  });
  it('rejects short passwords and duplicate emails', async () => {
    const app = createApp(config);
    expect(
      (await request(app).post('/api/auth/signup').send({ email: 'a@b.co', password: 'short' }))
        .status,
    ).toBe(400);
    await request(app).post('/api/auth/signup').send({ email: 'a@b.co', password: 'longpassword' });
    expect(
      (
        await request(app)
          .post('/api/auth/signup')
          .send({ email: 'a@b.co', password: 'longpassword' })
      ).status,
    ).toBe(400);
  });
  it('one-time web login link: single use', async () => {
    const app = createApp(config);
    const agent = request.agent(app);
    const up = await agent
      .post('/api/auth/signup')
      .send({ email: 'b@b.co', password: 'longpassword' });
    const code = await createLinkCode(up.body.user.id, 'weblogin');
    const fresh = request.agent(app);
    const first = await fresh.get(`/api/auth/link/${code}`);
    expect(first.status).toBe(302);
    expect((await fresh.get('/api/me')).status).toBe(200);
    expect((await request(app).get(`/api/auth/link/${code}`)).status).toBe(400);
    expect((await LinkCode.findOne({ code })).usedAt).toBeTruthy();
  });
  it('protected routes need a session', async () => {
    const app = createApp(config);
    for (const p of ['/api/cases', '/api/receipts', '/api/wallet', '/api/budget']) {
      expect((await request(app).get(p)).status).toBe(401);
    }
  });
});

describe('smoke: sign up → add case → check → decision → draft → send', () => {
  it('runs end to end on a mocked Telegraph node', async () => {
    const fake = node();
    const app = createApp(config, { telegraph: { fetchImpl: fake.fetch } });
    const agent = request.agent(app);
    await agent
      .post('/api/auth/signup')
      .send({ email: 'ada@example.com', password: 'longpassword', displayName: 'Ada' });
    const add = await agent
      .post('/api/cases')
      .send({ flightNumber: 'BA75', date: '2026-11-20', from: 'LHR', to: 'LOS' });
    expect(add.status).toBe(201);
    const id = add.body.case._id;
    expect(
      (await agent.post('/api/cases').send({ flightNumber: 'BA75', date: '2026-11-20' })).body.error
        .code,
    ).toBe('DUPLICATE_CLAIM');
    const check = await agent.post(`/api/cases/${id}/check`);
    expect(check.status).toBe(200);
    expect(check.body.decision.outcome).toBe('Owed');
    expect(check.body.decision.amountEur).toBe(600);
    const draft = await agent.post(`/api/cases/${id}/draft`);
    expect(draft.status).toBe(201);
    expect(draft.body.claim.draftText).toMatch(/Receipts \(Telegraph, testnet\)/);
    const claimId = draft.body.claim._id;
    expect((await agent.post(`/api/claims/${claimId}/send`).send({})).body.error.code).toBe(
      'RECIPIENT_NOT_CONFIRMED',
    );
    await agent.put(`/api/claims/${claimId}/recipient`).send({ email: 'claims@airline.example' });
    const send = await agent
      .post(`/api/claims/${claimId}/send`)
      .send({ confirmRecipient: 'claims@airline.example' });
    expect(send.body.via).toBe('mailto');
    expect((await agent.post(`/api/claims/${claimId}/mark-sent`)).body.claim.status).toBe('Sent');
    const detail = await agent.get(`/api/cases/${id}`);
    expect(detail.body.case.status).toBe('Sent');
    expect(detail.body.receipts).toHaveLength(3);
    const receipts = await agent.get('/api/receipts');
    expect(receipts.body.receipts.every((r) => r.receiptHash)).toBe(true);
    const proof = await request(app).get(`/api/proof/${detail.body.case.publicId}`);
    expect(proof.status).toBe(200);
    expect(JSON.stringify(proof.body)).not.toContain('ada@example.com');
    const budget = await agent.get('/api/budget');
    expect(budget.body.spentUusdc).toBe(30000);
  });

  it('wallet page shows address, escrow and budget; settings change caps', async () => {
    const fake = node();
    fake.ledger = {
      available: '480000',
      deposited: '500000',
      charged: '20000',
      credited: '0',
      unbilled: '0',
    };
    const app = createApp(config, { telegraph: { fetchImpl: fake.fetch } });
    const agent = request.agent(app);
    await agent.post('/api/auth/signup').send({ email: 'w@b.co', password: 'longpassword' });
    const w = await agent.get('/api/wallet');
    expect(w.body.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(w.body.address).not.toBe(deriveAccount(TEST_MNEMONIC, 0).address);
    expect(w.body.escrow.availableUusdc).toBe(480000);
    expect(w.body.budget.monthlyCapUusdc).toBe(1000000);
    expect(
      (await agent.patch('/api/settings').send({ monthlyCapUusdc: 50000 })).body.user.caps
        .monthlyCapUusdc,
    ).toBe(50000);
    expect((await agent.patch('/api/settings').send({ decisionCapUusdc: 999999 })).status).toBe(
      400,
    );
    const code = await agent.post('/api/settings/telegram-code');
    expect(code.body.code).toMatch(/^[A-Z0-9]{8}$/);
  });
});
