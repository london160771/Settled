// Booking email / free text → flight data. The text is DATA ONLY (invariant 6):
// nothing in it can change recipients, caps or actions. Instruction-like text is detected,
// reported as UNTRUSTED_INSTRUCTION and ignored.
import { AppError } from '../errors.js';
import { getAirport } from './flights/airports.js';

const INSTRUCTION_PATTERNS = [
  /ignore (all |any |your |the )?(previous |prior |above )?(rules|instructions|prompts?)/i,
  /disregard (your|the|all) (rules|instructions)/i,
  /send (the |all |your )?(money|funds|usdc|compensation|payment)s? to/i,
  /transfer (the |all )?(money|funds|usdc|balance)/i,
  /(change|set|update) (the )?(recipient|cap|limit|email address)/i,
  /\b0x[0-9a-fA-F]{40}\b/,
  /you are now|act as|system prompt/i,
];

const MONTHS = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};
const pad = (n) => String(n).padStart(2, '0');

function findDate(text) {
  let m = /\b(20\d\d)-(\d\d)-(\d\d)\b/.exec(text);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(20\d\d)\b/i.exec(
    text,
  );
  if (m) return `${m[3]}-${pad(MONTHS[m[2].toLowerCase()])}-${pad(m[1])}`;
  m =
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(20\d\d)\b/i.exec(
      text,
    );
  if (m) return `${m[3]}-${pad(MONTHS[m[1].toLowerCase()])}-${pad(m[2])}`;
  return null;
}

export function detectInstructions(text) {
  return INSTRUCTION_PATTERNS.filter((re) => re.test(text)).map((re) => re.source);
}

export function parseBookingText(raw) {
  const text = String(raw || '').slice(0, 20000);
  const flight = /\b([A-Z][A-Z0-9]|[A-Z0-9][A-Z])\s?(\d{1,4})\b/.exec(text.toUpperCase());
  const date = findDate(text);
  let from = null;
  let to = null;
  const route = /\b([A-Z]{3})\s*(?:-|–|→|->|to)\s*([A-Z]{3})\b/.exec(text);
  if (route && getAirport(route[1]) && getAirport(route[2])) [from, to] = [route[1], route[2]];
  else {
    const codes = [...text.matchAll(/\(([A-Z]{3})\)/g)]
      .map((x) => x[1])
      .filter((c) => getAirport(c));
    if (codes.length >= 2) [from, to] = codes;
  }
  const flagged = detectInstructions(text);
  return {
    flightNumber: flight ? `${flight[1]}${flight[2]}` : null,
    date,
    from,
    to,
    untrusted: flagged.length
      ? new AppError(
          'UNTRUSTED_INSTRUCTION',
          'The text contains instructions. Settled treats it as data and ignored them.',
          { matched: flagged.length },
        ).toJSON()
      : null,
  };
}
