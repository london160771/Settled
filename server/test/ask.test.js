import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { startDb, stopDb, clearDb, testConfig } from './helpers.js';
import { fakeTelegraph, okAnswer } from './fakeTelegraph.js';
import { createApp } from '../src/app.js';
import { createHandlers } from '../src/bot/handlers.js';
import { route, summarize } from '../src/services/ask/index.js';
import { clearIntentCache } from '../src/services/telegraph/intents.js';
import { User, Receipt, AskLog } from '../src/models/index.js';

const config = testConfig();
beforeAll(startDb, 120000);
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  clearIntentCache();
});

const RESULTS = {
  CRYPTO_PRICE_USD: { price_usd: 3120.55 },
  WEATHER_CHECK_TEMPERATURE: { temperature_c: 29 },
  WEB_SEARCH_GENERAL: { answer: 'Telegraph is a network of paid miners.', sources: [] },
  QUESTION_ANSWERING_GENERAL: { answer: 'Paris.' },
  CHAT_COMPLETION_GENERAL: { reply: 'Paris.' },
};
const node = (opts = {}) =>
  fakeTelegraph({
    handler: ({ body }) =>
      okAnswer({ intent: body.intent, minerId: 'm1', result: RESULTS[body.intent] }),
    ...opts,
  });

describe('ask router', () => {
  it('routes the four kinds to Intents', () => {
    expect(route('price', 'eth').intent).toBe('CRYPTO_PRICE_USD');
    expect(route('price', 'eth').build('e t h!')).toEqual({ params: { symbol: 'ETH' } });
    expect(route('weather', 'Lagos').intent).toBe('WEATHER_CHECK_TEMPERATURE');
    expect(route('search', 'x').intent).toBe('WEB_SEARCH_GENERAL');
    expect(route('ask', 'x').build('What is 2+2?')).toEqual({
      params: { message: 'What is 2+2?' },
    });
    expect(() => route('nope', 'x')).toThrow(/Unknown ask type/);
    expect(() => route('price', ' ')).toThrow(/Say what/);
    expect(summarize('CRYPTO_PRICE_USD', { price_usd: 3120.55 })).toBe('$3,120.55');
  });
});

describe('mission 9: 4 paid asks, 4 receipts, 5th blocked by the cap', () => {
  it('runs through the API and shows on the opt-in leaderboard', async () => {
    const fake = node();
    const app = createApp(config, { telegraph: { fetchImpl: fake.fetch } });
    const agent = request.agent(app);
    await agent
      .post('/api/auth/signup')
      .send({ email: 'm9@example.com', password: 'longpassword', displayName: 'Ada’s assistant' });
    await agent.patch('/api/settings').send({ monthlyCapUusdc: 40000, leaderboardOptIn: true });
    const asks = [
      ['price', 'ETH', '$3,120.55'],
      ['weather', 'Lagos', '29 °C'],
      ['search', 'what is Telegraph protocol', 'Telegraph is a network of paid miners.'],
      ['ask', 'Capital of France?', 'Paris.'],
    ];
    for (const [kind, input, answer] of asks) {
      const res = await agent.post('/api/ask').send({ kind, input });
      expect(res.status).toBe(200);
      expect(res.body.answer).toBe(answer);
      expect(res.body.receipt.receiptHash).toMatch(/^0x/);
    }
    const fifth = await agent.post('/api/ask').send({ kind: 'price', input: 'BTC' });
    expect(fifth.status).toBe(402);
    expect(fifth.body.error.code).toBe('CAP_EXCEEDED');
    expect(fake.paid).toBe(4);
    expect(await Receipt.countDocuments()).toBe(4);
    expect(await AskLog.countDocuments({ errorCode: 'CAP_EXCEEDED' })).toBe(1);
    const lb = await request(app).get('/api/leaderboard');
    expect(lb.body.rows[0]).toMatchObject({
      rank: 1,
      name: 'Ada’s assistant',
      paidAsks: 4,
      spentUusdc: 40000,
    });
    expect((await agent.get('/api/asks')).body.asks).toHaveLength(5);
  });

  it('users who did not opt in are not listed; no display name shows as anonymous', async () => {
    const fake = node();
    const app = createApp(config, { telegraph: { fetchImpl: fake.fetch } });
    const a = request.agent(app);
    await a.post('/api/auth/signup').send({ email: 'x@example.com', password: 'longpassword' });
    await a.post('/api/ask').send({ kind: 'price', input: 'ETH' });
    expect((await request(app).get('/api/leaderboard')).body.rows).toHaveLength(0);
    await User.updateOne({ email: 'x@example.com' }, { $set: { leaderboardOptIn: true } });
    expect((await request(app).get('/api/leaderboard')).body.rows[0].name).toBe('anonymous');
  });

  it('bot /price answers with its receipt line', async () => {
    const fake = node();
    const h = createHandlers(config, { telegraph: { fetchImpl: fake.fetch } });
    const io = { telegramId: 9, replies: [], reply: async (t) => io.replies.push(t) };
    await h.start(io);
    await h.ask(io, 'price', 'eth');
    expect(io.replies.at(-1)).toMatch(/^\$3,120.55\n\n🧾 CRYPTO_PRICE_USD/);
  });
});
