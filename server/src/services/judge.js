// Judge mode: a ready-made demo account inside the real product.
import { Case, Claim, Counter, Decision, User } from '../models/index.js';
import { AppError } from '../errors.js';
import { createUser } from './users.js';
import { afterCreate } from './auth.js';
import { addFlightCase } from './cases.js';
import { requestTopUp } from './account.js';
import { checkCase } from './flights/evidence.js';
import { createDraft } from './claims/index.js';

// The seeded real flight case. Confirmed after Gate 0 shows the miners can answer it.
export const JUDGE_SEED = { flightNumber: 'BA75', date: '2026-11-20', from: 'LHR', to: 'LOS' };
export const JUDGE_REUSE_MS = 60 * 60 * 1000;
export const DEMO_CAPS = { decisionCapUusdc: 200000, monthlyCapUusdc: 500000 };

async function takeDailyRun(config, now = new Date()) {
  const key = `judge:${now.toISOString().slice(0, 10)}`;
  const c = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  );
  if (c.seq > config.judgeDailyRunLimit) {
    await Counter.updateOne({ _id: key }, { $inc: { seq: -1 } });
    throw new AppError(
      'LIMIT_REACHED',
      'Judge demo limit for today is reached (protects the testnet operator wallet).',
    );
  }
}

// Reuse the browser's demo account for 1 hour, else create a fresh funded one.
export async function judgeSession(config, currentUser, deps = {}) {
  if (
    currentUser?.isDemo &&
    Date.now() - new Date(currentUser.createdAt).getTime() < JUDGE_REUSE_MS
  ) {
    return { user: currentUser, reused: true };
  }
  await takeDailyRun(config);
  const user = await afterCreate(
    config,
    await createUser(config, {
      isDemo: true,
      displayName: 'Judge demo',
      leaderboardOptIn: true,
      caps: DEMO_CAPS,
    }),
  );
  const seeded = await addFlightCase(user._id, JUDGE_SEED);
  let funding = null;
  try {
    funding = await requestTopUp(config, user._id, deps.wallet || {});
  } catch (e) {
    funding = { error: e.code || e.message };
  }
  return { user, reused: false, caseId: seeded._id, funding };
}

export async function seededCase(userId) {
  const c = await Case.findOne({
    userId,
    flightNumber: JUDGE_SEED.flightNumber,
    date: JUDGE_SEED.date,
  });
  if (!c) throw new AppError('NOT_FOUND', 'Seeded case missing; start a new judge session.');
  return c;
}

// Run the demo: real asks → decision → draft (sending still needs the judge's confirm tap).
export async function runDemo(config, user, deps = {}) {
  if (!user.isDemo) throw new AppError('BAD_REQUEST', 'Only demo accounts can run the judge demo.');
  const c = await seededCase(user._id);
  if (!['Watching', 'NeedsMoreProof', 'EvidenceConflict'].includes(c.status)) {
    // Fresh re-run for demo accounts only: clear the earlier result (receipts stay).
    await Claim.deleteMany({ caseId: c._id });
    await Decision.deleteMany({ caseId: c._id });
    await Case.updateOne({ _id: c._id }, { $set: { status: 'Watching' } });
  }
  const t0 = Date.now();
  const decision = await checkCase(config, c._id, deps.telegraph || {});
  let claim = null;
  if (decision.outcome === 'Owed') claim = await createDraft(config, user._id, c._id);
  return { caseId: c._id, decision, claim, ms: Date.now() - t0, reachedDraftReady: !!claim };
}

export const isJudgeUser = (u) => !!u?.isDemo;
export const countDemoUsers = () => User.countDocuments({ isDemo: true });
