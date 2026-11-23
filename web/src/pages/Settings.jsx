import { useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../auth.jsx';
import { ErrorBox } from '../components/ui.jsx';

export default function Settings() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({
    displayName: user.displayName || '',
    claimFromName: user.claimFromName || '',
    leaderboardOptIn: !!user.leaderboardOptIn,
    decisionCap: (user.caps.decisionCapUusdc / 1e6).toFixed(2),
    monthlyCap: (user.caps.monthlyCapUusdc / 1e6).toFixed(2),
  });
  const [code, setCode] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const set = (k) => (e) =>
    setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const save = async (e) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      const d = await api('/settings', {
        method: 'PATCH',
        body: {
          displayName: form.displayName,
          claimFromName: form.claimFromName,
          leaderboardOptIn: form.leaderboardOptIn,
          decisionCapUusdc: Math.round(Number(form.decisionCap) * 1e6),
          monthlyCapUusdc: Math.round(Number(form.monthlyCap) * 1e6),
        },
      });
      setUser(d.user);
      setSaved(true);
    } catch (err) {
      setError(err);
    }
  };
  const linkTelegram = async () => {
    try {
      setCode((await api('/settings/telegram-code', { method: 'POST' })).code);
    } catch (err) {
      setError(err);
    }
  };
  return (
    <div className="narrow">
      <h1>Settings</h1>
      <form onSubmit={save} className="card stack">
        <label>
          Display name (leaderboard)
          <input value={form.displayName} onChange={set('displayName')} />
        </label>
        <label>
          Name used to sign claim emails
          <input value={form.claimFromName} onChange={set('claimFromName')} />
        </label>
        <div className="grid2">
          <label>
            Cap per decision (test USDC, max 0.26)
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="0.26"
              value={form.decisionCap}
              onChange={set('decisionCap')}
            />
          </label>
          <label>
            Cap per month (test USDC)
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={form.monthlyCap}
              onChange={set('monthlyCap')}
            />
          </label>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={form.leaderboardOptIn}
            onChange={set('leaderboardOptIn')}
          />{' '}
          Show my assistant on the public leaderboard
        </label>
        <ErrorBox error={error} />
        {saved ? <p>Saved.</p> : null}
        <button>Save</button>
      </form>
      <h2>Telegram</h2>
      <div className="card stack">
        {user.telegramLinked ? (
          <p>Telegram is linked.</p>
        ) : code ? (
          <p>
            Send <code>/start {code}</code> to the Settled bot within 10 minutes.
          </p>
        ) : (
          <button onClick={linkTelegram}>Get a link code</button>
        )}
      </div>
    </div>
  );
}
