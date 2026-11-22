import { useState } from 'react';
import { api, shortHash, usdc4, when } from '../api/client.js';
import { useLoad, ErrorBox } from '../components/ui.jsx';

const KINDS = [
  { kind: 'price', label: 'Token price', placeholder: 'ETH' },
  { kind: 'weather', label: 'Weather', placeholder: 'Lagos' },
  { kind: 'search', label: 'Web search', placeholder: 'Latest news on EU261 rules' },
  { kind: 'ask', label: 'Question', placeholder: 'What does EU261 compensate for?' },
];

export default function Ask() {
  const [kind, setKind] = useState('price');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const history = useLoad(() => api('/asks'));
  const k = KINDS.find((x) => x.kind === kind);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/ask', { method: 'POST', body: { kind, input } });
      setInput('');
      await history.reload();
    } catch (err) {
      setError(err);
      await history.reload();
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <h1>Ask</h1>
      <p className="muted">
        Your assistant buys a fresh answer from a Telegraph miner, paid from your capped wallet
        (0.01 test USDC per ask). Every answer shows its receipt.
      </p>
      <form onSubmit={submit} className="card stack">
        <div className="row-left">
          {KINDS.map((x) => (
            <button
              type="button"
              key={x.kind}
              className={x.kind === kind ? '' : 'secondary'}
              onClick={() => setKind(x.kind)}
            >
              {x.label}
            </button>
          ))}
        </div>
        <input
          required
          value={input}
          placeholder={k.placeholder}
          onChange={(e) => setInput(e.target.value)}
        />
        <ErrorBox error={error} />
        <button disabled={busy}>{busy ? 'Buying the answer…' : 'Ask (paid)'}</button>
      </form>
      <h2>Your answers</h2>
      <ErrorBox error={history.error} />
      {(history.data?.asks || []).map((a) => (
        <div key={a._id} className="card">
          <div className="muted">
            {when(a.createdAt)} · {a.kind} · {a.question}
          </div>
          {a.errorCode ? (
            <p className="error">{a.errorCode}</p>
          ) : (
            <>
              <p>{a.answer}</p>
              <div className="muted">
                {a.intent} · {a.receiptId?.minerName || a.receiptId?.minerId} · {usdc4(a.costUusdc)}{' '}
                test USDC · <span className="mono">{shortHash(a.receiptId?.receiptHash)}</span>
              </div>
            </>
          )}
        </div>
      ))}
    </>
  );
}
