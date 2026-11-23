import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { api, caseTitle, caseSub, amountText } from '../api/client.js';
import { useLoad, ErrorBox, Badge } from '../components/ui.jsx';

export default function Claims() {
  const { data, error } = useLoad(() => api('/cases'));
  const list = data?.cases || [];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Claims</h1>
          <p className="muted">Every case you filed and where it stands</p>
        </div>
        <Link className="button" to="/add">
          <Plus strokeWidth={1.5} /> Add a case
        </Link>
      </div>
      <ErrorBox error={error} />
      {list.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Case</th>
                <th>Details</th>
                <th>Status</th>
                <th className="n">Amount</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c._id}>
                  <td>
                    <Link to={`/cases/${c._id}`}>{caseTitle(c)}</Link>
                  </td>
                  <td className="muted">{caseSub(c)}</td>
                  <td>
                    <Badge value={c.status} />
                  </td>
                  <td className="n">{amountText(c.decision) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty">No claims yet. Add a case to start.</p>
      )}
    </>
  );
}
