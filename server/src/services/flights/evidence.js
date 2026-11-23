// Buy the evidence for one case (flight or SLA) and record a Decision (several purchases, one decision).
import { randomUUID } from 'node:crypto';
import { Case, Decision, Receipt } from '../../models/index.js';
import { AppError } from '../../errors.js';
import { askIntent } from '../telegraph/askIntent.js';
import { getIntentSchema } from '../telegraph/intents.js';
import { getAirport } from './airports.js';
import { decide } from './decide.js';
import { slaEvidence } from '../sla/evidence.js';
import { decideSla } from '../sla/decide.js';

export const TRAVEL_INTENT = 'TRAVEL_DISRUPTION_GENERAL';
export const WEATHER_INTENT = 'WEATHER_FORECAST_GENERAL';
export const ASK_BUDGET_UUSDC = 10000;
// Miners tried first for the second, independent answer (filled in from Gate 0 results).
export const PREFERRED_TRAVEL_MINERS = [];
const CAP_CODES = new Set(['CAP_EXCEEDED', 'DECISION_CAP_EXCEEDED', 'WALLET_UNFUNDED']);

export function flightQuery(c) {
  const route = c.from && c.to ? ` ${c.from}-${c.to}` : '';
  return `${c.flightNumber} ${c.date}${route}`;
}

async function secondMinerCandidates(config, exclude, fetchImpl) {
  const schema = await getIntentSchema(config.telegraphBaseUrl, TRAVEL_INTENT, fetchImpl);
  const ids = (schema.miners || []).filter((m) => m.compatible !== false).map((m) => String(m.id));
  const ranked = [...PREFERRED_TRAVEL_MINERS.filter((id) => ids.includes(id)), ...ids];
  return [...new Set(ranked)].filter((id) => id !== String(exclude));
}

export async function checkCase(config, caseId, deps = {}) {
  const onReceipt = deps.onReceipt || (() => {});
  const c = await Case.findOneAndUpdate(
    { _id: caseId, status: { $in: ['Watching', 'NeedsMoreProof', 'EvidenceConflict'] } },
    { $set: { status: 'CheckingProof', lastCheckedAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!c) throw new AppError('BAD_REQUEST', 'This case is not waiting for a check');
  const decisionKey = `case:${c._id}:${randomUUID()}`;
  const common = {
    config,
    userId: c.userId,
    caseId: c._id,
    decisionKey,
    budgetUusdc: ASK_BUDGET_UUSDC,
    deps,
  };
  const travel = [];
  const notes = [];
  const restore = async (status) => Case.updateOne({ _id: c._id }, { $set: { status } });

  const tryAsk = async (args) => {
    try {
      const out = await askIntent({ ...common, ...args });
      onReceipt(out.receipt);
      return out;
    } catch (err) {
      if (CAP_CODES.has(err.code)) throw err;
      notes.push(
        `${args.intent}${args.minerId ? ` @${args.minerId}` : ''}: ${err.code || err.message}`,
      );
      return null;
    }
  };

  try {
    if (c.type === 'sla') {
      const ev = await slaEvidence({ config, c, tryAsk, fetchImpl: deps.fetchImpl, now: deps.now });
      const d = decideSla({ caseDoc: c, month: ev.month, window: ev.window });
      notes.push(...ev.notes);
      return await finish(d);
    }
    const query = flightQuery(c);
    const first = await tryAsk({ intent: TRAVEL_INTENT, params: { route_or_flight: query } });
    if (first)
      travel.push({
        receiptId: first.receipt._id,
        minerId: first.receipt.minerId,
        result: first.result,
      });
    if (first) {
      const candidates = await secondMinerCandidates(config, first.receipt.minerId, deps.fetchImpl);
      for (const minerId of candidates.slice(0, 2)) {
        const second = await tryAsk({
          intent: TRAVEL_INTENT,
          params: { route_or_flight: query },
          minerId,
        });
        if (second) {
          travel.push({
            receiptId: second.receipt._id,
            minerId: second.receipt.minerId,
            result: second.result,
          });
          break;
        }
      }
    }
    let weather = null;
    const dep = getAirport(c.from);
    if (travel.length === 2 && dep) {
      const w = await tryAsk({
        intent: WEATHER_INTENT,
        params: { location: `${dep.city || dep.name}, ${dep.country}` },
      });
      if (w) weather = { receiptId: w.receipt._id, result: w.result };
    }
    return await finish(decide({ caseDoc: c, travel, weather }));
  } catch (err) {
    await restore('Watching');
    throw err;
  }

  async function finish(d) {
    if (notes.length) d.reasons.push(`Evidence notes: ${notes.join('; ')}`);
    const spent = await Receipt.aggregate([
      { $match: { caseId: c._id, askId: { $exists: true } } },
      { $group: { _id: null, s: { $sum: '$costUusdc' } } },
    ]);
    const decision = await Decision.create({ caseId: c._id, ...d, spentUusdc: spent[0]?.s || 0 });
    await Case.updateOne({ _id: c._id }, { $set: { status: d.outcome } });
    return decision;
  }
}
