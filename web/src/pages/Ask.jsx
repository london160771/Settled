import { useState } from 'react';
import { api, usdc4, when } from '../api/client.js';
import { useLoad, ErrorBox, Hash } from '../components/ui.jsx';

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
      <p className="lede">
        Your assistant buys a fresh answer from a Telegraph miner, paid from your capped wallet
        (0.01 test USDC per ask). Every answer shows its receipt.
      </p>
      <form onSubmit={submit} className="card stack">
        <div className="seg" role="tablist">
          {KINDS.map((x) => (
            <button
              type="button"
              role="tab"
              aria-selected={x.kind === kind}
              key={x.kind}
              className={x.kind === kind ? 'on' : ''}
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
        <div>
          <button disabled={busy}>{busy ? 'Buying the answer…' : 'Ask · 0.01 test USDC'}</button>
        </div>
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
              <div className="row-left muted">
                <span className="mono">{a.intent}</span> ·{' '}
                {a.receiptId?.minerName || a.receiptId?.minerId} · {usdc4(a.costUusdc)} test USDC
                {a.receiptId?.receiptHash ? <Hash value={a.receiptId.receiptHash} /> : null}
              </div>
            </>
          )}
        </div>
      ))}
    </>
  );
}
