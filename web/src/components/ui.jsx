import { useEffect, useState, useCallback } from 'react';
import { shortHash, usdc4, when } from '../api/client.js';

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
export const Badge = ({ value }) => (
  <span className={`badge ${STATUS_TONE[value] || 'muted'}`}>{value}</span>
);

export function ReceiptsTable({ receipts, showCase = false }) {
  if (!receipts?.length) return <p className="muted">No receipts yet.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>Intent</th>
            <th>Miner</th>
            <th>Cost (test USDC)</th>
            <th>Time</th>
            <th>receipt_hash</th>
            <th>Epoch</th>
            {showCase ? <th>Case</th> : null}
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {receipts.map((r) => (
            <tr key={r._id || r.receiptHash}>
              <td>{when(r.createdAt || r.at)}</td>
              <td>{r.intent}</td>
              <td>{r.minerName || r.minerId || '—'}</td>
              <td>{usdc4(r.costUusdc)}</td>
              <td>{r.durationMs ? `${r.durationMs} ms` : '—'}</td>
              <td className="mono" title={r.receiptHash}>
                {shortHash(r.receiptHash)}
              </td>
              <td>{r.epochId ?? '—'}</td>
              {showCase ? (
                <td>{r.caseId ? <a href={`/cases/${r.caseId}`}>open</a> : 'ask'}</td>
              ) : null}
              <td>
                <Badge value={r.status} />{' '}
                {r.replayed ? <span className="badge warn">replayed</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
