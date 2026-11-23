import { useEffect, useState, useCallback } from 'react';
import { Check } from 'lucide-react';
import { shortHash, usdc4, when } from '../api/client.js';

// Settled mark: a paper receipt with a check. Flat, one colour.
export function Logo({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#1f5f4a" />
      <path d="M9 6.5h14v19l-2.33-1.6-2.34 1.6-2.33-1.6-2.33 1.6-2.34-1.6L9 25.5z" fill="#f6f5f1" />
      <path
        d="M12.2 15.2l2.6 2.6 5-5.4"
        fill="none"
        stroke="#1f5f4a"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Signature detail: a receipt hash, mono, with a check when it is a settled receipt.
export function Hash({ value, href, settled = true }) {
  const inner = (
    <>
      {settled ? <Check aria-hidden="true" /> : null}
      {shortHash(value)}
    </>
  );
  return href ? (
    <a className="hash" href={href} title={value} target="_blank" rel="noreferrer">
      {inner}
    </a>
  ) : (
    <span className="hash" title={value}>
      {inner}
    </span>
  );
}

export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    return fn()
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => setState({ data: null, error, loading: false }));
  }, deps);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, reload: load };
}

export function ErrorBox({ error }) {
  if (!error) return null;
  return (
    <div className="error" role="alert">
      <strong>{error.code}</strong> {error.message}
      {error.nextAction ? <div className="muted">{error.nextAction}</div> : null}
    </div>
  );
}

const STATUS_TONE = {
  Owed: 'good',
  DraftReady: 'good',
  Sent: 'info',
  Paid: 'good',
  NotOwed: 'muted',
  Rejected: 'bad',
  NeedsMoreProof: 'warn',
  EvidenceConflict: 'warn',
  CheckingProof: 'info',
  Watching: 'muted',
  settled: 'good',
  charged_on_failure: 'warn',
  reconciled: 'muted',
};
const STATUS_LABEL = {
  DraftReady: 'Draft ready',
  NotOwed: 'Not owed',
  NeedsMoreProof: 'Needs more proof',
  EvidenceConflict: 'Evidence conflict',
  CheckingProof: 'Checking proof',
  settled: 'Settled',
  charged_on_failure: 'Charged on failure',
  reconciled: 'Reconciled',
  replayed: 'Replayed',
};
export const statusLabel = (v) => STATUS_LABEL[v] || v;
export const Badge = ({ value }) => (
  <span className={`badge ${STATUS_TONE[value] || 'muted'}`} title={value}>
    {statusLabel(value)}
  </span>
);

export function ReceiptsTable({ receipts, showCase = false }) {
  if (!receipts?.length)
    return <p className="empty">No receipts yet. Every paid check shows up here.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>Intent</th>
            <th>Miner</th>
            <th className="n">Cost</th>
            <th className="n">Time</th>
            <th>Receipt</th>
            <th className="n">Epoch</th>
            {showCase ? <th>Case</th> : null}
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {receipts.map((r) => (
            <tr key={r._id || r.receiptHash}>
              <td className="meta">{when(r.createdAt || r.at)}</td>
              <td className="mono">{r.intent}</td>
              <td>{r.minerName || r.minerId || '—'}</td>
              <td className="n">{usdc4(r.costUusdc)}</td>
              <td className="n">{r.durationMs ? `${r.durationMs} ms` : '—'}</td>
              <td>
                {r.receiptHash ? (
                  <Hash value={r.receiptHash} settled={r.status === 'settled'} />
                ) : (
                  '—'
                )}
              </td>
              <td className="n">{r.epochId ?? '—'}</td>
              {showCase ? (
                <td>{r.caseId ? <a href={`/cases/${r.caseId}`}>open</a> : 'ask'}</td>
              ) : null}
              <td>
                <Badge value={r.status} />{' '}
                {r.replayed ? <span className="badge warn">Replayed</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
