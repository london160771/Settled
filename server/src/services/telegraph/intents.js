// Free Intent schema lookup with a small cache. Unknown names → INTENT_UNKNOWN before paying.
import { AppError } from '../../errors.js';

const cache = new Map();
const TTL_MS = 10 * 60 * 1000;

export async function getIntentSchema(baseUrl, intent, fetchImpl = fetch) {
  const hit = cache.get(intent);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.schema;
  const res = await fetchImpl(`${baseUrl}/engine/v1/intents/${encodeURIComponent(intent)}`);
  if (!res.ok) throw new AppError('MINER_UNAVAILABLE', `Intent lookup failed (${res.status})`);
  const schema = await res.json();
  if (!schema.miner_count && !schema.request) {
    throw new AppError('INTENT_UNKNOWN', `Intent ${intent} is not served by this node`);
  }
  cache.set(intent, { at: Date.now(), schema });
  return schema;
}

export function clearIntentCache() {
  cache.clear();
}
