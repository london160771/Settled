// Due-case checker: past flights in "Watching" get checked once automatically.
// Spending still goes through askIntent(), so it can never pass the user's cap.
import { Case, User } from '../models/index.js';
import { checkCase } from '../services/flights/evidence.js';

export const INTERVAL_MS = 15 * 60 * 1000;

export async function runDueChecks(
  config,
  { telegraph = {}, notify = async () => {}, now = new Date(), limit = 10 } = {},
) {
  const today = now.toISOString().slice(0, 10);
  const due = await Case.find({
    status: 'Watching',
    lastCheckedAt: null,
    date: { $lt: today },
    from: { $ne: null },
    to: { $ne: null },
  })
    .sort({ createdAt: 1 })
    .limit(limit)
    .lean();
  const results = [];
  for (const c of due) {
    try {
      const d = await checkCase(config, c._id, telegraph);
      results.push({ caseId: String(c._id), outcome: d.outcome });
      const u = await User.findById(c.userId).lean();
      if (u?.telegramId) {
        await notify(
          u.telegramId,
          `Checked ${c.flightNumber} ${c.date}: ${d.outcome}${d.amountEur ? ` · ${d.amountEur} EUR` : ''}. Open /claims or the web app.`,
        );
      }
    } catch (e) {
      await Case.updateOne({ _id: c._id }, { $set: { lastCheckedAt: new Date() } });
      results.push({ caseId: String(c._id), error: e.code || e.message });
    }
  }
  return results;
}

export function startWorker(config, opts = {}) {
  const tick = () => runDueChecks(config, opts).catch((e) => console.error('[worker]', e.message));
  return setInterval(tick, INTERVAL_MS);
}
