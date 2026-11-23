import { Link } from 'react-router-dom';
import { api, caseTitle, caseSub, amountText } from '../api/client.js';
import { useLoad, ErrorBox, Badge } from '../components/ui.jsx';

export default function Claims() {
  const { data, error } = useLoad(() => api('/cases'));
  const list = data?.cases || [];
  return (
    <>
      <div className="row">
        <h1>Claims</h1>
        <Link className="button" to="/add">
          Add a case
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
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c._id}>
                  <td>
                    <Link to={`/cases/${c._id}`}>{caseTitle(c)}</Link>
                  </td>
                  <td>{caseSub(c)}</td>
                  <td>
                    <Badge value={c.status} />
                  </td>
                  <td>{amountText(c.decision) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">No claims yet.</p>
      )}
    </>
  );
}
