import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { ErrorBox } from '../components/ui.jsx';

export default function AddCase() {
  const [form, setForm] = useState({
    flightNumber: '',
    date: '',
    from: '',
    to: '',
    bookingRef: '',
  });
  const [error, setError] = useState(null);
  const nav = useNavigate();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const d = await api('/cases', { method: 'POST', body: form });
      nav(`/cases/${d.case._id}`);
    } catch (err) {
      setError(err);
    }
  };
  return (
    <div className="narrow">
      <h1>Add a flight</h1>
      <form onSubmit={submit} className="card stack">
        <label>
          Flight number
          <input
            required
            placeholder="BA75"
            value={form.flightNumber}
            onChange={set('flightNumber')}
          />
        </label>
        <label>
          Date of the flight
          <input required type="date" value={form.date} onChange={set('date')} />
        </label>
        <div className="grid2">
          <label>
            From (airport code)
            <input placeholder="LHR" maxLength={3} value={form.from} onChange={set('from')} />
          </label>
          <label>
            To (airport code)
            <input placeholder="LOS" maxLength={3} value={form.to} onChange={set('to')} />
          </label>
        </div>
        <label>
          Booking reference <span className="muted">(optional, only goes in your claim email)</span>
          <input value={form.bookingRef} onChange={set('bookingRef')} />
        </label>
        <p className="muted">
          The airports are needed to work out the distance and which rules apply.
        </p>
        <ErrorBox error={error} />
        <button>Add case</button>
      </form>
    </div>
  );
}
