import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useLoad, ErrorBox, Badge } from '../components/ui.jsx';

export default function Claims() {
  const { data, error } = useLoad(() => api('/cases'));
  const list = data?.cases || [];
  return (
    <>
      <div className="row">
        <h1>Claims</h1>
        <Link className="button" to="/add">
          Add a flight
        </Link>
      </div>
      <ErrorBox error={error} />
      {list.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Flight</th>
                <th>Date</th>
                <th>Route</th>
                <th>Status</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c._id}>
                  <td>
                    <Link to={`/cases/${c._id}`}>{c.flightNumber}</Link>
                  </td>
                  <td>{c.date}</td>
                  <td>{c.from && c.to ? `${c.from} → ${c.to}` : '—'}</td>
                  <td>
                    <Badge value={c.status} />
                  </td>
                  <td>{c.decision?.amountEur ? `${c.decision.amountEur} EUR` : '—'}</td>
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
