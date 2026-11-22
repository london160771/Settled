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
