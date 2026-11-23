import { api, usdc4 } from '../api/client.js';
import { useLoad, ErrorBox, Hash } from '../components/ui.jsx';

export default function Leaderboard() {
  const { data, error } = useLoad(() => api('/leaderboard'));
  const rows = data?.rows || [];
  return (
    <>
      <h1>Leaderboard</h1>
      <p className="lede">
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
                <th className="n">Paid asks</th>
                <th className="n">Spent</th>
                <th>Latest receipts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.rank}>
                  <td className="n meta">{r.rank}</td>
                  <td>
                    {r.name} {r.demo ? <span className="badge warn">Demo</span> : null}
                  </td>
                  <td className="n">{r.paidAsks}</td>
                  <td className="n">{usdc4(r.spentUusdc)}</td>
                  <td>
                    <div className="row-left">
                      {r.receipts.map((h) => (
                        <Hash key={h} value={h} />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty">No assistants on the board yet. Opt in from Settings.</p>
      )}
    </>
  );
}
