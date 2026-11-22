import { Link } from 'react-router-dom';
import { api, usdc } from '../api/client.js';
import { useLoad, ErrorBox, Badge, ReceiptsTable } from '../components/ui.jsx';

export default function Home() {
  const cases = useLoad(() => api('/cases'));
  const budget = useLoad(() => api('/budget'));
  const receipts = useLoad(() => api('/receipts'));
  const list = cases.data?.cases || [];
  const owed = list
    .filter((c) => ['Owed', 'DraftReady', 'Sent'].includes(c.status))
    .reduce((s, c) => s + (c.decision?.amountEur || 0), 0);
  const open = list.filter((c) => !['Paid', 'Rejected', 'NotOwed'].includes(c.status));
  const b = budget.data;
  return (
    <>
      <div className="grid3">
        <div className="card stat">
          <div className="muted">You may be owed</div>
          <div className="big">{owed} EUR</div>
        </div>
        <div className="card stat">
          <div className="muted">Open claims</div>
          <div className="big">{open.length}</div>
        </div>
        <div className="card stat">
          <div className="muted">Spent this month / cap</div>
          <div className="big">
            {usdc(b?.spentUusdc)} / {usdc(b?.monthlyCapUusdc)}
          </div>
          <div className="muted">test USDC · reserved {usdc(b?.reservedUusdc)}</div>
        </div>
      </div>
      <div className="row">
        <h2>Open claims</h2>
        <Link className="button" to="/add">
          Add a flight
        </Link>
      </div>
      <ErrorBox error={cases.error} />
      {open.length ? (
        <ul className="list">
          {open.map((c) => (
            <li key={c._id}>
              <Link to={`/cases/${c._id}`}>
                {c.flightNumber} · {c.date} {c.from && c.to ? `· ${c.from} → ${c.to}` : ''}
              </Link>{' '}
              <Badge value={c.status} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No open claims. Add a flight that was late or cancelled.</p>
      )}
      <h2>Recent receipts</h2>
      <ReceiptsTable receipts={(receipts.data?.receipts || []).slice(0, 5)} />
    </>
  );
}
