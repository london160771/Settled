import { Link } from 'react-router-dom';
import { api, usdc, caseTitle, caseSub } from '../api/client.js';
import { useLoad, ErrorBox, Badge, ReceiptsTable } from '../components/ui.jsx';

export default function Home() {
  const cases = useLoad(() => api('/cases'));
  const budget = useLoad(() => api('/budget'));
  const receipts = useLoad(() => api('/receipts'));
  const list = cases.data?.cases || [];
  const owedList = list.filter((c) => ['Owed', 'DraftReady', 'Sent'].includes(c.status));
  const owedEur = owedList.reduce((s, c) => s + (c.decision?.amountEur || 0), 0);
  const owedUsd = owedList.reduce((s, c) => s + (c.decision?.amountUsd || 0), 0);
  const owed = [owedUsd ? `${owedUsd} USD` : '', owedEur ? `${owedEur} EUR` : '']
    .filter(Boolean)
    .join(' + ');
  const open = list.filter((c) => !['Paid', 'Rejected', 'NotOwed'].includes(c.status));
  const b = budget.data;
  return (
    <>
      <div className="grid3">
        <div className="card stat">
          <div className="muted">You may be owed</div>
          <div className="big">{owed || '0'}</div>
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
          Add a case
        </Link>
      </div>
      <ErrorBox error={cases.error} />
      {open.length ? (
        <ul className="list">
          {open.map((c) => (
            <li key={c._id}>
              <Link to={`/cases/${c._id}`}>
                {caseTitle(c)} · {caseSub(c)}
              </Link>{' '}
              <Badge value={c.status} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">
          No open claims. Add a vendor that broke its uptime promise, or a late flight.
        </p>
      )}
      <h2>Recent receipts</h2>
      <ReceiptsTable receipts={(receipts.data?.receipts || []).slice(0, 5)} />
    </>
  );
}
