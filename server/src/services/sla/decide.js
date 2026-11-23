// Pure SLA decision from purchased evidence. No I/O.
// month: calendar-month answer (must match the case period). window: a second, different
// miner's rolling window that covers the period, used to corroborate a breach.
export const SLA_RULES_VERSION = 'sla-credit-1';

const num = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
const bool = (v) =>
  v === true || v === 'true' ? true : v === false || v === 'false' ? false : null;

export function creditFor(uptimePct, tiers) {
  let pct = 0;
  for (const t of tiers) if (uptimePct < t.belowPct) pct = Math.max(pct, t.creditPct);
  return pct;
}

/**
 * @param caseDoc { vendor, period, promisedPct?, monthlyFeeUsd?, tiers }
 * @param month { receiptId, minerId, result: { uptime_pct, sla_target_pct, compliant, period } } | null
 * @param window same shape | null
 */
export function decideSla({ caseDoc, month = null, window = null }) {
  const base = {
    rulesVersion: SLA_RULES_VERSION,
    reasons: [],
    warnings: [],
    factRefs: [],
    amountEur: null,
    facts: {},
  };
  const uptime = num(month?.result?.uptime_pct);
  if (!month?.result || uptime == null) {
    return {
      ...base,
      outcome: 'NeedsMoreProof',
      reasons: ['No miner reported the uptime for this month.'],
    };
  }
  if (String(month.result.period || '') !== caseDoc.period) {
    return {
      ...base,
      outcome: 'NeedsMoreProof',
      reasons: [`The miner answered for "${month.result.period}", not ${caseDoc.period}.`],
    };
  }
  const minerTarget = num(month.result.sla_target_pct);
  const target = num(caseDoc.promisedPct) ?? minerTarget;
  if (target == null) {
    return {
      ...base,
      outcome: 'NeedsMoreProof',
      reasons: ['No promised uptime known. Add it from your contract.'],
    };
  }
  const facts = { uptimePct: uptime, targetPct: target, period: caseDoc.period };
  const factRefs = [{ fact: 'uptimePct', value: uptime, receiptIds: [month.receiptId] }];
  const warnings = [];
  if (num(caseDoc.promisedPct) == null) {
    factRefs.push({ fact: 'targetPct', value: target, receiptIds: [month.receiptId] });
  } else if (minerTarget != null && minerTarget !== target) {
    warnings.push(
      `The vendor's published target is ${minerTarget}%; you entered ${target}% from your contract.`,
    );
  }
  if (uptime >= target) {
    return {
      ...base,
      outcome: 'NotOwed',
      reasons: [`Uptime in ${caseDoc.period} was ${uptime}%, which meets the promised ${target}%.`],
      facts,
      factRefs,
      warnings,
    };
  }
  // Breach on the month source. Require a second, different miner to agree there was a breach.
  if (!window?.result) {
    return {
      ...base,
      outcome: 'NeedsMoreProof',
      reasons: [
        `One miner says ${uptime}% (below ${target}%). A second, independent miner is needed.`,
      ],
      facts,
      factRefs,
    };
  }
  if (String(window.minerId) === String(month.minerId)) {
    return {
      ...base,
      outcome: 'NeedsMoreProof',
      reasons: ['Both answers came from the same miner; a second, independent miner is required.'],
      facts,
      factRefs,
    };
  }
  const wUptime = num(window.result.uptime_pct);
  const wTarget = num(window.result.sla_target_pct) ?? target;
  const wBreach = bool(window.result.compliant) === false || (wUptime != null && wUptime < wTarget);
  facts.windowUptimePct = wUptime;
  facts.windowPeriod = window.result.period || null;
  if (!wBreach) {
    return {
      ...base,
      outcome: 'EvidenceConflict',
      reasons: [
        `Miners disagree: ${uptime}% in ${caseDoc.period} (breach) vs ${wUptime}% over ${facts.windowPeriod} (no breach).`,
      ],
      facts,
      factRefs: [
        ...factRefs,
        { fact: 'windowUptimePct', value: wUptime, receiptIds: [window.receiptId] },
      ],
    };
  }
  if (caseDoc.termsReceiptId) {
    factRefs.push({
      fact: 'contractTerms',
      value: { promisedPct: caseDoc.promisedPct ?? null, tiers: caseDoc.tiers || [] },
      receiptIds: [caseDoc.termsReceiptId],
    });
  }
  factRefs.push({
    fact: 'breachCorroborated',
    value: { uptimePct: wUptime, period: facts.windowPeriod },
    receiptIds: [window.receiptId],
  });
  const creditPct = creditFor(uptime, caseDoc.tiers || []);
  const fee = num(caseDoc.monthlyFeeUsd);
  const creditUsd = fee != null && creditPct ? Math.round(fee * creditPct) / 100 : null;
  Object.assign(facts, { creditPct, creditUsd, monthlyFeeUsd: fee });
  base.amountUsd = creditUsd;
  if (!creditPct) {
    return {
      ...base,
      outcome: 'NotOwed',
      reasons: [`Uptime ${uptime}% is below ${target}%, but none of your credit tiers applies.`],
      facts,
      factRefs,
      warnings,
    };
  }
  return {
    ...base,
    outcome: 'Owed',
    reasons: [
      `Uptime in ${caseDoc.period} was ${uptime}%, below the promised ${target}%.`,
      `A second miner also saw a breach (${wUptime}% over ${facts.windowPeriod}).`,
      `Your tiers give a ${creditPct}% service credit${creditUsd != null ? ` = ${creditUsd} USD of ${fee} USD` : ''}.`,
    ],
    warnings: [
      ...warnings,
      caseDoc.claimWindowDays
        ? `Your contract says to claim within ${caseDoc.claimWindowDays} days after the month ends.`
        : 'Most vendors only pay credits you request in time (often within 30 days after the month). Check your contract.',
    ],
    facts,
    factRefs,
  };
}
