import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../auth.jsx';
import { ErrorBox } from '../components/ui.jsx';

export default function AuthPage({ mode }) {
  const signup = mode === 'signup';
  const [form, setForm] = useState({ email: '', password: '', displayName: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const { setUser } = useAuth();
  const nav = useNavigate();
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const d = await api(signup ? '/auth/signup' : '/auth/signin', { method: 'POST', body: form });
      setUser(d.user);
      nav('/');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <div className="narrow auth">
      <h1>{signup ? 'Create your account' : 'Sign in'}</h1>
      <p className="muted">Proof first, then the claim</p>
      <form onSubmit={submit} className="card stack">
        {signup ? (
          <label>
            Your name (used to sign claims)
            <input value={form.displayName} onChange={set('displayName')} autoComplete="name" />
          </label>
        ) : null}
        <label>
          Email
          <input
            type="email"
            required
            value={form.email}
            onChange={set('email')}
            autoComplete="email"
          />
        </label>
        <label>
          Password {signup ? <span className="muted">(8+ characters)</span> : null}
          <input
            type="password"
            required
            minLength={signup ? 8 : 1}
            value={form.password}
            onChange={set('password')}
            autoComplete={signup ? 'new-password' : 'current-password'}
          />
        </label>
        <ErrorBox error={error} />
        <button className="big-btn" disabled={busy}>
          {busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}
        </button>
      </form>
      <p>
        {signup ? (
          <Link to="/signin">I have an account</Link>
        ) : (
          <Link to="/signup">Create an account</Link>
        )}{' '}
        · <Link to="/judge">Judges: try the demo</Link>
      </p>
    </div>
  );
}
