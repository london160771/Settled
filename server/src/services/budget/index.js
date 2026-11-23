// Atomic budget: reserve → settle | release. Invariant 1:
//   spentThisMonth + reservedNow ≤ monthlyCap, and each decision's spend ≤ decisionCap.
// Every change is a single conditional update, so parallel asks can never overshoot.
import { User, Reservation, DecisionBudget } from '../../models/index.js';
import { AppError } from '../../errors.js';

export const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);

// Monthly reset: when the month changes, spent goes to 0; held reservations carry over.
export async function rollMonth(userId, now = new Date()) {
  const m = monthKey(now);
  await User.updateOne(
    { _id: userId, 'budget.month': { $ne: m } },
    { $set: { 'budget.month': m, 'budget.spentUusdc': 0 } },
  );
}

async function takeDecision(userId, decisionKey, amount, cap) {
  await DecisionBudget.updateOne(
    { _id: decisionKey },
    { $setOnInsert: { userId, capUusdc: cap, usedUusdc: 0 } },
    { upsert: true },
  ).catch((e) => {
    if (e.code !== 11000) throw e; // parallel upsert race: doc exists, fine
  });
  const r = await DecisionBudget.updateOne(
    { _id: decisionKey, $expr: { $lte: [{ $add: ['$usedUusdc', amount] }, '$capUusdc'] } },
    { $inc: { usedUusdc: amount } },
  );
  return r.modifiedCount === 1;
}

export async function reserve({
  userId,
  amountUusdc,
  decisionKey = null,
  askId = null,
  now = new Date(),
}) {
  const amount = amountUusdc;
  if (!Number.isInteger(amount) || amount <= 0)
    throw new AppError('BAD_REQUEST', 'amount must be a positive integer (uusdc)');
  const user = await User.findById(userId, { caps: 1 }).lean();
  if (!user) throw new AppError('NOT_FOUND', 'user not found');
  if (amount > user.caps.decisionCapUusdc) {
    throw new AppError(
      'DECISION_CAP_EXCEEDED',
      `Ask of ${amount} uusdc is above your per-decision cap`,
    );
  }
  if (
    decisionKey &&
    !(await takeDecision(userId, decisionKey, amount, user.caps.decisionCapUusdc))
  ) {
    throw new AppError(
      'DECISION_CAP_EXCEEDED',
      'This decision would go over your per-decision cap',
    );
  }
  await rollMonth(userId, now);
  const r = await User.updateOne(
    {
      _id: userId,
      $expr: {
        $lte: [
          { $add: ['$budget.spentUusdc', '$budget.reservedUusdc', amount] },
          '$caps.monthlyCapUusdc',
        ],
      },
    },
    { $inc: { 'budget.reservedUusdc': amount } },
  );
  if (r.modifiedCount !== 1) {
    if (decisionKey)
      await DecisionBudget.updateOne({ _id: decisionKey }, { $inc: { usedUusdc: -amount } });
    throw new AppError('CAP_EXCEEDED', 'This ask would go over your monthly cap');
  }
  return Reservation.create({ userId, decisionKey, amountUusdc: amount, askId, state: 'held' });
}

// Settle with the amount actually charged (≤ reserved). Also used for charged_on_failure.
export async function settle(reservationId, chargedUusdc) {
  const res = await Reservation.findOneAndUpdate(
    { _id: reservationId, state: 'held' },
    { $set: { state: 'settled', settledUusdc: chargedUusdc } },
    { returnDocument: 'after' },
  );
  if (!res) throw new Error('reservation is not held');
  const charged = Math.min(chargedUusdc, res.amountUusdc);
  await User.updateOne(
    { _id: res.userId },
    { $inc: { 'budget.reservedUusdc': -res.amountUusdc, 'budget.spentUusdc': charged } },
  );
  if (res.decisionKey) {
    await DecisionBudget.updateOne(
      { _id: res.decisionKey },
      { $inc: { usedUusdc: charged - res.amountUusdc } },
    );
  }
  return res;
}

export async function release(reservationId) {
  const res = await Reservation.findOneAndUpdate(
    { _id: reservationId, state: 'held' },
    { $set: { state: 'released' } },
    { returnDocument: 'after' },
  );
  if (!res) return null;
  await User.updateOne({ _id: res.userId }, { $inc: { 'budget.reservedUusdc': -res.amountUusdc } });
  if (res.decisionKey) {
    await DecisionBudget.updateOne(
      { _id: res.decisionKey },
      { $inc: { usedUusdc: -res.amountUusdc } },
    );
  }
  return res;
}

export async function getBudget(userId, now = new Date()) {
  await rollMonth(userId, now);
  const u = await User.findById(userId, { caps: 1, budget: 1 }).lean();
  return {
    month: u.budget.month,
    spentUusdc: u.budget.spentUusdc,
    reservedUusdc: u.budget.reservedUusdc,
    monthlyCapUusdc: u.caps.monthlyCapUusdc,
    decisionCapUusdc: u.caps.decisionCapUusdc,
    remainingUusdc: u.caps.monthlyCapUusdc - u.budget.spentUusdc - u.budget.reservedUusdc,
  };
}
