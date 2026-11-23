// Cases: add, list, get. Invariant 5: one case (and so one claim) per flight + date per user.
import { randomBytes } from 'node:crypto';
import { Case } from '../models/index.js';
import { AppError } from '../errors.js';
import { parseFlightNumber } from './flights/carriers.js';
import { getAirport } from './flights/airports.js';
import { getVendor, parseTiers, VENDORS } from './sla/vendors.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function addFlightCase(userId, { flightNumber, date, from, to, bookingRef } = {}) {
  const f = parseFlightNumber(flightNumber);
  if (!f) throw new AppError('BAD_REQUEST', 'Flight number looks wrong (e.g. BA75).');
  if (!DATE.test(date || '') || Number.isNaN(Date.parse(date)))
    throw new AppError('BAD_REQUEST', 'Date must be YYYY-MM-DD.');
  for (const [k, v] of [
    ['from', from],
    ['to', to],
  ]) {
    if (v && !getAirport(v))
      throw new AppError('BAD_REQUEST', `Unknown airport code for ${k}: ${v}`);
  }
  const existing = await Case.findOne({
    userId,
    type: 'flight',
    flightNumber: f.flightNumber,
    date,
  });
  if (existing)
    throw new AppError(
      'DUPLICATE_CLAIM',
      `You already have a case for ${f.flightNumber} on ${date}.`,
      { caseId: existing._id.toString() },
    );
  try {
    return await Case.create({
      userId,
      type: 'flight',
      flightNumber: f.flightNumber,
      date,
      from: from ? from.toUpperCase() : undefined,
      to: to ? to.toUpperCase() : undefined,
      bookingRef: bookingRef || undefined,
      publicId: randomBytes(9).toString('base64url'),
    });
  } catch (e) {
    if (e.code === 11000)
      throw new AppError(
        'DUPLICATE_CLAIM',
        `You already have a case for ${f.flightNumber} on ${date}.`,
      );
    throw e;
  }
}

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

// SLA case: a vendor + a finished billing month (YYYY-MM) + the user's contract terms.
export async function addSlaCase(
  userId,
  { vendor, period, promisedPct, monthlyFeeUsd, tiers } = {},
  now = new Date(),
) {
  const v = getVendor(vendor);
  if (!v)
    throw new AppError('BAD_REQUEST', `Vendor must be one of: ${Object.keys(VENDORS).join(', ')}.`);
  if (!PERIOD.test(period || '')) throw new AppError('BAD_REQUEST', 'Month must be YYYY-MM.');
  if (period >= now.toISOString().slice(0, 7))
    throw new AppError('BAD_REQUEST', 'Pick a month that has ended.');
  const pct = promisedPct === '' || promisedPct == null ? undefined : Number(promisedPct);
  if (pct !== undefined && !(pct > 0 && pct <= 100))
    throw new AppError('BAD_REQUEST', 'Promised uptime must be a percentage like 99.9.');
  const fee = monthlyFeeUsd === '' || monthlyFeeUsd == null ? undefined : Number(monthlyFeeUsd);
  if (fee !== undefined && !(fee >= 0 && fee < 1e9))
    throw new AppError('BAD_REQUEST', 'Monthly fee must be a number in USD.');
  let parsedTiers;
  try {
    parsedTiers = parseTiers(tiers);
  } catch (e) {
    throw new AppError('BAD_REQUEST', e.message);
  }
  const key = String(vendor).toLowerCase();
  const dup = () =>
    new AppError('DUPLICATE_CLAIM', `You already have a case for ${v.name} in ${period}.`);
  const existing = await Case.findOne({ userId, type: 'sla', vendor: key, period });
  if (existing) throw dup();
  try {
    return await Case.create({
      userId,
      type: 'sla',
      vendor: key,
      period,
      promisedPct: pct,
      monthlyFeeUsd: fee,
      tiers: parsedTiers,
      publicId: randomBytes(9).toString('base64url'),
    });
  } catch (e) {
    if (e.code === 11000) throw dup();
    throw e;
  }
}

export const addCase = (userId, body = {}) =>
  body.type === 'sla' ? addSlaCase(userId, body) : addFlightCase(userId, body);

// Short label for lists and messages.
export const caseTitle = (c) =>
  c.type === 'sla'
    ? `${getVendor(c.vendor)?.name || c.vendor} SLA · ${c.period}`
    : `${c.flightNumber} · ${c.date}`;

export const listCases = (userId) => Case.find({ userId }).sort({ createdAt: -1 }).lean();

export async function getCase(userId, caseId) {
  const c = await Case.findOne({ _id: caseId, userId }).lean();
  if (!c) throw new AppError('NOT_FOUND', 'Case not found');
  return c;
}
