import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { ErrorBox, useLoad } from '../components/ui.jsx';

function lastMonth() {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}

function AddSla() {
  const vendors = useLoad(() => api('/sla/vendors'));
  const [form, setForm] = useState({
    vendor: 'vercel',
    period: lastMonth(),
    promisedPct: '',
    monthlyFeeUsd: '',
    tiers: '99.99:10, 99:25, 95:50',
  });
  const [error, setError] = useState(null);
  const nav = useNavigate();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const d = await api('/cases', { method: 'POST', body: { type: 'sla', ...form } });
      nav(`/cases/${d.case._id}`);
    } catch (err) {
      setError(err);
    }
  };
  return (
    <form onSubmit={submit} className="card stack">
      <label>
        Vendor
        <select value={form.vendor} onChange={set('vendor')}>
          {(vendors.data?.vendors || [{ key: 'vercel', name: 'Vercel' }]).map((v) => (
            <option key={v.key} value={v.key}>
              {v.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Billing month (must have ended)
        <input required type="month" value={form.period} onChange={set('period')} />
      </label>
      <div className="grid2">
        <label>
          Promised uptime % <span className="muted">(blank = vendor's published SLA)</span>
          <input
            inputMode="decimal"
            placeholder="99.99"
            value={form.promisedPct}
            onChange={set('promisedPct')}
          />
        </label>
        <label>
          Your monthly bill (USD) <span className="muted">(optional)</span>
          <input
            inputMode="decimal"
            placeholder="400"
            value={form.monthlyFeeUsd}
            onChange={set('monthlyFeeUsd')}
          />
        </label>
      </div>
      <label>
        Credit tiers{' '}
        <span className="muted">(uptime below X% → Y% credit; copy them from your contract)</span>
        <input value={form.tiers} onChange={set('tiers')} />
      </label>
      <p className="muted">
        Settled buys the month's uptime from one Telegraph miner and a second opinion from another.
        It only drafts a credit request if both see a breach. Checks work for months up to 90 days
        ago.
      </p>
      <ErrorBox error={error} />
      <button>Add case</button>
    </form>
  );
}

export default function AddCase() {
  const [kind, setKind] = useState('sla');
  return (
    <div className="narrow">
      <h1>Add a case</h1>
      <div className="row-left">
        <button className={kind === 'sla' ? '' : 'secondary'} onClick={() => setKind('sla')}>
          Cloud uptime (SLA)
        </button>
        <button className={kind === 'flight' ? '' : 'secondary'} onClick={() => setKind('flight')}>
          Late flight
        </button>
      </div>
      {kind === 'sla' ? <AddSla /> : <AddFlight />}
    </div>
  );
}

function AddFlight() {
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
    <>
      <p className="muted">
        Note: in our live tests, Telegraph miners could not yet report the delay of a past flight,
        so flight checks usually end in “Needs more proof”.
      </p>
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
    </>
  );
}
