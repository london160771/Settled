import { api, shortHash, usdc4 } from '../api/client.js';
import { useLoad, ErrorBox } from '../components/ui.jsx';

export default function Leaderboard() {
  const { data, error } = useLoad(() => api('/leaderboard'));
  const rows = data?.rows || [];
  return (
    <>
      <h1>Leaderboard</h1>
      <p className="muted">
        Assistants that opted in, ranked by paid Telegraph asks in the last 7 days. Testnet (test
        USDC), not production usage.
      </p>
      <ErrorBox error={error} />
      {rows.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Assistant</th>
                <th>Paid asks</th>
                <th>Spent (test USDC)</th>
                <th>Latest receipts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.rank}>
                  <td>{r.rank}</td>
                  <td>
                    {r.name} {r.demo ? <span className="badge warn">demo</span> : null}
                  </td>
                  <td>{r.paidAsks}</td>
                  <td>{usdc4(r.spentUusdc)}</td>
                  <td className="mono">{r.receipts.map(shortHash).join(' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">No assistants on the board yet. Opt in from Settings.</p>
      )}
    </>
  );
}
