export class ApiError extends Error {
  constructor(err, status) {
    super(err?.message || `HTTP ${status}`);
    this.code = err?.code || 'ERROR';
    this.nextAction = err?.nextAction || '';
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error, res.status);
  return data;
}

export const usdc = (uusdc) => (uusdc == null ? '—' : (Number(uusdc) / 1e6).toFixed(2));
export const usdc4 = (uusdc) => (uusdc == null ? '—' : (Number(uusdc) / 1e6).toFixed(4));
export const shortHash = (h) => (h ? `${h.slice(0, 10)}…${h.slice(-6)}` : '—');
export const when = (d) => (d ? new Date(d).toLocaleString() : '—');

const VENDOR_NAMES = {
  vercel: 'Vercel',
  github: 'GitHub',
  digitalocean: 'DigitalOcean',
  twilio: 'Twilio',
};
// Case labels shared by lists and detail pages (flight or SLA).
export const caseTitle = (c) =>
  c.type === 'sla'
    ? `${VENDOR_NAMES[c.vendor] || c.vendor} SLA · ${c.period}`
    : `${c.flightNumber} · ${c.date}`;
export const caseSub = (c) =>
  c.type === 'sla'
    ? `Promised ${c.promisedPct != null ? `${c.promisedPct}%` : "vendor's published"} uptime${c.monthlyFeeUsd != null ? ` · bill ${c.monthlyFeeUsd} USD/month` : ''}`
    : c.from && c.to
      ? `${c.from} → ${c.to}`
      : 'Route not set';
export const amountText = (d) =>
  d?.amountEur ? `${d.amountEur} EUR` : d?.amountUsd ? `${d.amountUsd} USD credit` : '';
