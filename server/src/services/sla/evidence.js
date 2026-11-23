// Buy SLA evidence: one calendar-month answer + one rolling-window answer from a different miner.
import { getIntentSchema } from '../telegraph/intents.js';
import {
  SLA_INTENT,
  MONTH_MINER,
  WINDOW_MINER,
  MAX_WINDOW_DAYS,
  getVendor,
  windowDaysCovering,
} from './vendors.js';

const pick = (out) =>
  out ? { receiptId: out.receipt._id, minerId: out.receipt.minerId, result: out.result } : null;

/** tryAsk(args) → askIntent result or null (errors noted by the caller). */
export async function slaEvidence({ config, c, tryAsk, fetchImpl, now = new Date() }) {
  const v = getVendor(c.vendor);
  const schema = await getIntentSchema(config.telegraphBaseUrl, SLA_INTENT, fetchImpl);
  const listed = new Set((schema.miners || []).map((m) => String(m.id)));
  const notes = [];

  // 1) Month answer: the contract-scoped miner if listed, else a routed ask.
  const monthParams = { service: v.monthName, period: c.period };
  const month = pick(
    await tryAsk({
      intent: SLA_INTENT,
      params: monthParams,
      minerId: listed.has(MONTH_MINER) ? MONTH_MINER : null,
    }),
  );

  // 2) Second, independent miner over a window that covers the whole month.
  // Only bought when the month answer shows a breach (a compliant month needs no second opinion).
  let window = null;
  const days = windowDaysCovering(c.period, now);
  const r = month?.result || {};
  const target = Number(c.promisedPct ?? r.sla_target_pct);
  const breach =
    String(r.period) === c.period &&
    Number.isFinite(Number(r.uptime_pct)) &&
    Number(r.uptime_pct) < target;
  if (!breach) {
    // nothing more to buy
  } else if (days > MAX_WINDOW_DAYS) {
    notes.push(`The month is more than ${MAX_WINDOW_DAYS} days ago; no second miner covers it.`);
  } else if (listed.has(WINDOW_MINER) && String(month.minerId) !== WINDOW_MINER) {
    window = pick(
      await tryAsk({
        intent: SLA_INTENT,
        params: { service: v.windowName, period: `${days}d` },
        minerId: WINDOW_MINER,
      }),
    );
  } else {
    notes.push('No second SLA miner is available right now.');
  }
  return { month, window, notes };
}
