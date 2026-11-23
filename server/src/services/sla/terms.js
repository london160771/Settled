// Contract reading (P1): buy a CONTRACT_OBLIGATION_AUDIT answer for a pasted SLA, keep only the
// clauses that occur verbatim in the text the user pasted, and parse the promised uptime, credit
// tiers and claim window from those clauses with plain rules. The result is a suggestion the user
// confirms; the pasted text and the miner's answer are data, never instructions.
import { AppError } from '../../errors.js';
import { askIntent } from '../telegraph/askIntent.js';
import { getIntentSchema } from '../telegraph/intents.js';

export const TERMS_INTENT = 'CONTRACT_OBLIGATION_AUDIT_GENERAL';
// Tried in order (live probes 2026-11-23, evidence/contract/): a deterministic verbatim indexer
// that returns every paragraph, then a deterministic reader that cites verbatim clauses.
export const TERMS_MINERS = ['731437', '83159274'];
export const MAX_TERMS_CHARS = 20000;
const CAP_CODES = new Set(['CAP_EXCEEDED', 'DECISION_CAP_EXCEEDED', 'WALLET_UNFUNDED']);

const norm = (s) =>
  String(s || '')
    .replace(/\s+/g, ' ')
    .trim();
const NUM = '(\\d{1,3}(?:\\.\\d+)?)';

// Every quoted clause the miner returned, as plain strings.
export function quotesFrom(result) {
  const out = [];
  const add = (v) => {
    if (typeof v === 'string') out.push(v);
    else if (v && typeof v === 'object') add(v.quote || v.text);
  };
  for (const k of ['clauses', 'obligations']) for (const v of result?.[k] || []) add(v);
  return [...new Set(out.map(norm).filter((q) => q.length >= 10))];
}

// Pure: parse terms from verified clauses only.
export function parseTerms(quotes) {
  let promisedPct = null;
  let claimWindowDays = null;
  const tiers = [];
  const used = [];
  for (const q of quotes) {
    const promise = q.match(new RegExp(`at least ${NUM}\\s*%`, 'i'));
    if (promisedPct == null && promise && /uptime|availab/i.test(q) && !/credit\b.*%/i.test(q)) {
      promisedPct = Number(promise[1]);
      used.push({ fact: 'promisedPct', quote: q });
    }
    const below = q.match(new RegExp(`less than ${NUM}\\s*%`, 'i'));
    const credit = q.match(new RegExp(`${NUM}\\s*%\\s*(?:service\\s+)?credit`, 'i'));
    if (below && credit) {
      tiers.push({ belowPct: Number(below[1]), creditPct: Number(credit[1]) });
      used.push({ fact: 'tier', quote: q });
    }
    const days = q.match(
      /within\s+(?:[a-z-]+\s+)?\(?(\d{1,3})\)?\s+(?:calendar\s+|business\s+)?days/i,
    );
    if (claimWindowDays == null && days && /claim|credit|request/i.test(q)) {
      claimWindowDays = Number(days[1]);
      used.push({ fact: 'claimWindowDays', quote: q });
    }
  }
  const ok = tiers.filter(
    (t) => t.belowPct > 0 && t.belowPct <= 100 && t.creditPct > 0 && t.creditPct <= 100,
  );
  ok.sort((a, b) => b.belowPct - a.belowPct);
  return { promisedPct, tiers: ok, claimWindowDays, used };
}

export async function readTerms(config, userId, text, deps = {}) {
  const pasted = String(text || '');
  if (norm(pasted).length < 40)
    throw new AppError(
      'BAD_REQUEST',
      'Paste the SLA text (the uptime and service credit sections).',
    );
  if (pasted.length > MAX_TERMS_CHARS)
    throw new AppError(
      'BAD_REQUEST',
      `Paste at most ${MAX_TERMS_CHARS} characters (the SLA part only).`,
    );
  const schema = await getIntentSchema(config.telegraphBaseUrl, TERMS_INTENT, deps.fetchImpl);
  const listed = new Set((schema.miners || []).map((m) => String(m.id)));
  const haystack = norm(pasted);
  const notes = [];
  for (const minerId of TERMS_MINERS.filter((id) => listed.has(id))) {
    let out;
    try {
      out = await askIntent({
        config,
        userId,
        intent: TERMS_INTENT,
        params: { contract: pasted },
        minerId,
        deps,
      });
    } catch (err) {
      if (CAP_CODES.has(err.code)) throw err;
      notes.push(`${minerId}: ${err.code || err.message}`);
      continue;
    }
    const all = quotesFrom(out.result);
    const verified = all.filter((q) => haystack.includes(q));
    const parsed = parseTerms(verified);
    const found = parsed.promisedPct != null || parsed.tiers.length > 0;
    if (!found && minerId !== TERMS_MINERS.at(-1)) {
      notes.push(`${out.receipt.minerName || minerId}: no uptime terms in its answer`);
      continue;
    }
    return {
      suggestion: {
        promisedPct: parsed.promisedPct,
        tiers: parsed.tiers,
        claimWindowDays: parsed.claimWindowDays,
      },
      used: parsed.used,
      quotesReturned: all.length,
      quotesVerified: verified.length,
      receipt: {
        _id: out.receipt._id,
        receiptHash: out.receipt.receiptHash,
        minerId: out.receipt.minerId,
        minerName: out.receipt.minerName,
        costUusdc: out.receipt.costUusdc,
      },
      notes,
    };
  }
  throw new AppError(
    'NEEDS_MORE_PROOF',
    `No contract miner could read it right now (${notes.join('; ') || 'none listed'}).`,
  );
}
