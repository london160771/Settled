// Pure decision from purchased evidence (PRD §9). No I/O.
import { evaluate, RULES_VERSION } from './rules.js';
import { parseFlightNumber } from './carriers.js';

export const AGREEMENT_MINUTES = 15;
const WEATHER_WORDS =
  /storm|thunder|snow|blizzard|fog|hurricane|typhoon|cyclone|ice|freezing|gale|volcan|ash|weather|wind/i;
const CANCEL_WORDS = /cancel/i;

const num = (v) =>
  typeof v === 'number' && Number.isFinite(v)
    ? v
    : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))
      ? Number(v)
      : null;

/**
 * @param caseDoc { flightNumber, date, from, to }
 * @param travel [{ receiptId, minerId, result: { delay_minutes, status, disrupted, reason } }] (0-2 items)
 * @param weather { receiptId, result } | null
 */
export function decide({ caseDoc, travel = [], weather = null }) {
  const base = {
    rulesVersion: RULES_VERSION,
    reasons: [],
    warnings: [],
    factRefs: [],
    amountEur: null,
    facts: {},
  };
  const ok = travel.filter((t) => t && t.result);
  if (ok.length < 2) {
    return {
      ...base,
      outcome: 'NeedsMoreProof',
      reasons: ['Need two answers from two different miners; got ' + ok.length + '.'],
    };
  }
  const [a, b] = ok;
  if (String(a.minerId) === String(b.minerId)) {
    return {
      ...base,
      outcome: 'NeedsMoreProof',
      reasons: ['Both answers came from the same miner; a second, independent miner is required.'],
    };
  }
  const cancelled = [a, b].every((t) => CANCEL_WORDS.test(String(t.result.status || '')));
  const da = num(a.result.delay_minutes);
  const db = num(b.result.delay_minutes);
  const travelIds = [a.receiptId, b.receiptId];

  if (!cancelled) {
    if (da == null || db == null) {
      return {
        ...base,
        outcome: 'NeedsMoreProof',
        reasons: ['A miner did not report the delay in minutes.'],
        facts: { delayMinutes: [da, db] },
      };
    }
    if (Math.abs(da - db) > AGREEMENT_MINUTES) {
      return {
        ...base,
        outcome: 'EvidenceConflict',
        reasons: [
          `Miners disagree: ${da} min vs ${db} min (allowed gap ${AGREEMENT_MINUTES} min).`,
        ],
        facts: { delayMinutes: [da, db] },
        factRefs: [{ fact: 'delayMinutes', value: [da, db], receiptIds: travelIds }],
      };
    }
  }
  const delayMinutes = cancelled ? null : Math.min(da, db); // conservative: the smaller agreed value
  const facts = { delayMinutes, cancelled, status: a.result.status || b.result.status || null };
  const factRefs = [
    cancelled
      ? { fact: 'cancelled', value: true, receiptIds: travelIds }
      : { fact: 'delayMinutes', value: delayMinutes, receiptIds: travelIds },
  ];
  const warnings = [];
  const reasonText = [a.result.reason, b.result.reason].filter(Boolean).join(' ');
  const wx = weather?.result || null;
  const wxText = wx ? [wx.condition, wx.summary].filter(Boolean).join(' ') : '';
  if (WEATHER_WORDS.test(reasonText) || (wxText && WEATHER_WORDS.test(wxText))) {
    warnings.push(
      'Weather may have caused this disruption. The airline may call it "extraordinary circumstances" and refuse.',
    );
  }
  if (weather?.receiptId) {
    facts.weather = wx;
    factRefs.push({ fact: 'weather', value: wx, receiptIds: [weather.receiptId] });
  }

  const flight = parseFlightNumber(caseDoc.flightNumber);
  const rule = evaluate({
    from: caseDoc.from,
    to: caseDoc.to,
    carrier: flight?.carrier,
    delayMinutes,
    cancelled,
  });
  facts.distanceKm = rule.distanceKm;
  if (!rule.known)
    return { ...base, outcome: 'NeedsMoreProof', reasons: rule.reasons, facts, factRefs, warnings };
  return {
    ...base,
    outcome: rule.owed ? 'Owed' : 'NotOwed',
    amountEur: rule.amountEur,
    reasons: rule.reasons,
    warnings,
    facts,
    factRefs,
  };
}
