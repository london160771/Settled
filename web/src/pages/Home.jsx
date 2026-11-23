import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
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
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <p className="muted">Credits you may be owed, and what the proof cost</p>
        </div>
        <Link className="button" to="/add">
          <Plus strokeWidth={1.5} /> Add a case
        </Link>
      </div>
      <div className="grid3">
        <div className="card stat lead">
          <div className="label">You may be owed</div>
          <div className="big">{owed || '0'}</div>
          <div className="sub">From cases marked Owed or drafted</div>
        </div>
        <div className="card stat">
          <div className="label">Open cases</div>
          <div className="big">{open.length}</div>
          <div className="sub">{list.length} in total</div>
        </div>
        <div className="card stat">
          <div className="label">Spent this month</div>
          <div className="big">
            {usdc(b?.spentUusdc)}
            <span className="muted"> / {usdc(b?.monthlyCapUusdc)}</span>
          </div>
          <div className="sub">test USDC · {usdc(b?.reservedUusdc)} reserved</div>
        </div>
      </div>
      <h2>Open cases</h2>
      <ErrorBox error={cases.error} />
      {open.length ? (
        <ul className="list">
          {open.map((c) => (
            <li key={c._id}>
              <Link to={`/cases/${c._id}`}>
                {caseTitle(c)}
                <span className="sub">{caseSub(c)}</span>
              </Link>
              <Badge value={c.status} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">
          No open cases. Add a vendor that broke its uptime promise, or a late flight.
        </p>
      )}
      <h2>Recent receipts</h2>
      <ReceiptsTable receipts={(receipts.data?.receipts || []).slice(0, 5)} />
    </>
  );
}
