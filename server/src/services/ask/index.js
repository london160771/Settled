// Mission 9: the assistant buys fresh answers from its own capped wallet.
// Rule-based router (no LLM in P0). Every answer comes with its receipt.
import { randomUUID } from 'node:crypto';
import { AskLog, Receipt, User } from '../../models/index.js';
import { AppError } from '../../errors.js';
import { askIntent } from '../telegraph/askIntent.js';

export const ASK_BUDGET_UUSDC = 10000;
export const ROUTES = {
  price: {
    intent: 'CRYPTO_PRICE_USD',
    build: (x) => ({
      params: {
        symbol: x
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .slice(0, 12),
      },
    }),
  },
  weather: {
    intent: 'WEATHER_CHECK_TEMPERATURE',
    build: (x) => ({ params: { location: x.trim().slice(0, 120) } }),
  },
  search: {
    intent: 'WEB_SEARCH_GENERAL',
    build: (x) => ({ params: { query: x.trim().slice(0, 500) } }),
  },
  ask: {
    intent: 'QUESTION_ANSWERING_GENERAL',
    build: (x) => ({ query: x.trim().slice(0, 1000) }),
    // Free fallback (refused before payment) if the node no longer serves the first Intent.
    fallback: {
      intent: 'CHAT_COMPLETION_GENERAL',
      build: (x) => ({ params: { message: x.trim().slice(0, 1000) } }),
    },
  },
};

export function route(kind, input) {
  const r = ROUTES[kind];
  if (!r)
    throw new AppError(
      'BAD_REQUEST',
      `Unknown ask type "${kind}". Use price, weather, search or ask.`,
    );
  if (!String(input || '').trim()) throw new AppError('BAD_REQUEST', 'Say what you want to know.');
  return r;
}

// Short human answer from a shaped result.
export function summarize(intent, result) {
  if (!result || typeof result !== 'object')
    return result == null ? 'No answer.' : String(result).slice(0, 1500);
  if (result.price_usd != null)
    return `$${Number(result.price_usd).toLocaleString('en-US', { maximumFractionDigits: 6 })}`;
  if (result.temperature_c != null) return `${result.temperature_c} °C`;
  for (const k of ['answer', 'reply', 'brief', 'summary'])
    if (result[k]) return String(result[k]).slice(0, 1500);
  return JSON.stringify(result).slice(0, 1500);
}

export async function paidAsk(config, userId, kind, input, deps = {}) {
  const r = route(kind, input);
  const decisionKey = `ask:${randomUUID()}`;
  const call = (rt) =>
    askIntent({
      config,
      userId,
      intent: rt.intent,
      ...rt.build(String(input)),
      budgetUusdc: ASK_BUDGET_UUSDC,
      decisionKey,
      deps,
    });
  let out;
  let intent = r.intent;
  try {
    out = await call(r);
  } catch (e) {
    const freeRefusal = ['INTENT_UNKNOWN', 'BAD_REQUEST'].includes(e.code);
    if (!(r.fallback && freeRefusal)) {
      await AskLog.create({
        userId,
        kind,
        question: String(input).slice(0, 500),
        intent,
        errorCode: e.code || 'ERROR',
      });
      throw e;
    }
    intent = r.fallback.intent;
    out = await call(r.fallback);
  }
  const answer = summarize(intent, out.result);
  const log = await AskLog.create({
    userId,
    kind,
    question: String(input).slice(0, 500),
    intent,
    answer,
    receiptId: out.receipt._id,
    costUusdc: out.receipt.costUusdc,
  });
  return { answer, intent, receipt: out.receipt, askLogId: log._id };
}

export const myAsks = (userId) =>
  AskLog.find({ userId }).sort({ createdAt: -1 }).limit(50).populate('receiptId').lean();

// Opt-in leaderboard: paid asks (all Telegraph receipts) in the last 7 days.
export async function leaderboard({ now = new Date(), limit = 20 } = {}) {
  const since = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const optIn = await User.find(
    { leaderboardOptIn: true },
    { _id: 1, displayName: 1, isDemo: 1 },
  ).lean();
  if (!optIn.length) return [];
  const rows = await Receipt.aggregate([
    {
      $match: {
        userId: { $in: optIn.map((u) => u._id) },
        createdAt: { $gte: since },
        status: { $in: ['settled', 'charged_on_failure', 'reconciled'] },
        replayed: { $ne: true },
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$userId',
        paidAsks: { $sum: 1 },
        spentUusdc: { $sum: '$costUusdc' },
        hashes: { $push: '$receiptHash' },
      },
    },
    { $sort: { paidAsks: -1, spentUusdc: -1 } },
    { $limit: limit },
  ]);
  const byId = new Map(optIn.map((u) => [String(u._id), u]));
  return rows.map((r, i) => {
    const u = byId.get(String(r._id));
    return {
      rank: i + 1,
      name: u?.displayName ? u.displayName : 'anonymous',
      demo: !!u?.isDemo,
      paidAsks: r.paidAsks,
      spentUusdc: r.spentUusdc,
      receipts: r.hashes.filter(Boolean).slice(0, 3),
    };
  });
}
