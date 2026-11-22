// Cases: add, list, get. Invariant 5: one case (and so one claim) per flight + date per user.
import { randomBytes } from 'node:crypto';
import { Case } from '../models/index.js';
import { AppError } from '../errors.js';
import { parseFlightNumber } from './flights/carriers.js';
import { getAirport } from './flights/airports.js';

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

export const listCases = (userId) => Case.find({ userId }).sort({ createdAt: -1 }).lean();

export async function getCase(userId, caseId) {
  const c = await Case.findOne({ _id: caseId, userId }).lean();
  if (!c) throw new AppError('NOT_FOUND', 'Case not found');
  return c;
}
