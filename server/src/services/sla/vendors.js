// SLA vendors Settled can check. Names are what the live SLA_COMPLIANCE miners understand
// (probed live 2026-11-23, evidence/sla/). A vendor needs both a calendar-month source and a
// second, independent source to reach "Owed".
export const SLA_INTENT = 'SLA_COMPLIANCE_GENERAL';
// Calendar-month, contract-scoped uptime (MONEY OWED Contract SLA Check).
export const MONTH_MINER = '2611217';
// Rolling-window uptime from the vendor's own status page (Statuspage SLA Auditor), 1-90 days.
export const WINDOW_MINER = '7410311';
export const MAX_WINDOW_DAYS = 90;

export const VENDORS = {
  vercel: { name: 'Vercel', monthName: 'Vercel', windowName: 'Vercel' },
  github: { name: 'GitHub', monthName: 'GitHub Enterprise Cloud', windowName: 'GitHub' },
  digitalocean: { name: 'DigitalOcean', monthName: 'DigitalOcean', windowName: 'DigitalOcean' },
  twilio: { name: 'Twilio', monthName: 'Twilio', windowName: 'Twilio' },
};

// Example credit tiers (the user should copy theirs from the contract): uptime below X% → Y% credit.
export const DEFAULT_TIERS = [
  { belowPct: 99.99, creditPct: 10 },
  { belowPct: 99.0, creditPct: 25 },
  { belowPct: 95.0, creditPct: 50 },
];

export const getVendor = (key) => VENDORS[String(key || '').toLowerCase()] || null;

// "99.99:10, 99:25" → [{ belowPct, creditPct }] sorted high to low. Throws on bad input.
export function parseTiers(text) {
  if (Array.isArray(text)) return normTiers(text);
  if (!text || !String(text).trim()) return DEFAULT_TIERS;
  const tiers = String(text)
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = s.match(/^(\d{1,3}(?:\.\d+)?)\s*%?\s*[:=→>-]+\s*(\d{1,3}(?:\.\d+)?)\s*%?$/);
      if (!m) throw new Error(`Tier "${s}" should look like 99.9:10`);
      return { belowPct: Number(m[1]), creditPct: Number(m[2]) };
    });
  return normTiers(tiers);
}

function normTiers(tiers) {
  const out = tiers.map((t) => ({ belowPct: Number(t.belowPct), creditPct: Number(t.creditPct) }));
  for (const t of out) {
    if (!(t.belowPct > 0 && t.belowPct <= 100 && t.creditPct > 0 && t.creditPct <= 100))
      throw new Error('Tiers need uptime 0-100 and credit 1-100.');
  }
  return out.sort((a, b) => b.belowPct - a.belowPct);
}

// Days from the first day of the period (YYYY-MM) to now, so a rolling window covers it.
export function windowDaysCovering(period, now = new Date()) {
  const start = Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)) - 1, 1);
  return Math.ceil((now.getTime() - start) / 86400000);
}
