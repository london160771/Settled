import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, shortHash, usdc4, caseTitle, caseSub, amountText } from '../api/client.js';
import { useLoad, ErrorBox, Badge, ReceiptsTable } from '../components/ui.jsx';

function SendBox({ claim, onDone, isSla }) {
  const [email, setEmail] = useState(claim.recipientEmail || '');
  const [pending, setPending] = useState(claim.recipientEmail || null);
  const [mailto, setMailto] = useState(null);
  const [error, setError] = useState(null);
  const run = async (fn) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e);
    }
  };
  const save = () =>
    run(async () => {
      const d = await api(`/claims/${claim._id}/recipient`, { method: 'PUT', body: { email } });
      setPending(d.claim.recipientEmail);
    });
  const send = () =>
    run(async () => {
      const d = await api(`/claims/${claim._id}/send`, {
        method: 'POST',
        body: { confirmRecipient: pending },
      });
      if (d.via === 'mailto') setMailto(d.mailto);
      else onDone();
    });
  const markSent = () =>
    run(async () => (await api(`/claims/${claim._id}/mark-sent`, { method: 'POST' }), onDone()));
  if (mailto) {
    return (
      <div className="card stack">
        <p>
          Email sending is not set up on this server. Open the email in your mail app, send it, then
          mark it sent.
        </p>
        <div className="row-left">
          <a className="button" href={mailto}>
            Open in my mail app
          </a>
          <button
            className="secondary"
            onClick={() => navigator.clipboard?.writeText(claim.draftText)}
          >
            Copy text
          </button>
          <button onClick={markSent}>I sent it</button>
        </div>
        <ErrorBox error={error} />
      </div>
    );
  }
  return (
    <div className="card stack">
      <label>
        {isSla ? 'Vendor billing / support email address' : 'Airline claims email address'}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={isSla ? 'billing@vendor.com' : 'customer.relations@airline.com'}
        />
      </label>
      <div className="row-left">
        <button className="secondary" onClick={save}>
          Use this address
        </button>
        {pending ? <button onClick={send}>Send to {pending}</button> : null}
      </div>
      <p className="muted">Nothing is sent until you press “Send to …”.</p>
      <ErrorBox error={error} />
    </div>
  );
}

export default function CaseDetail() {
  const { id } = useParams();
  const { data, error, reload } = useLoad(() => api(`/cases/${id}`), [id]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [editing, setEditing] = useState(null);
  const act = async (fn) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(false);
    }
  };
  if (error) return <ErrorBox error={error} />;
  if (!data) return <p className="muted">Loading…</p>;
  const { case: c, decision, receipts, claim, proofUrl } = data;
  const byId = Object.fromEntries(receipts.map((r) => [r._id, r]));
  const canCheck = ['Watching', 'NeedsMoreProof', 'EvidenceConflict'].includes(c.status);
  return (
    <>
      <div className="row">
        <h1>{caseTitle(c)}</h1>
        <Badge value={c.status} />
      </div>
      <p className="muted">
        {caseSub(c)} · <a href={proofUrl}>public proof page</a>
      </p>
      {canCheck ? (
        <button
          disabled={busy}
          onClick={() => act(() => api(`/cases/${id}/check`, { method: 'POST' }))}
        >
          {busy ? 'Buying proof from Telegraph miners…' : 'Check now'}
        </button>
      ) : null}
      <ErrorBox error={actionError} />

      {decision ? (
        <section className="card">
          <h2>
            Decision: <Badge value={decision.outcome} /> {amountText(decision)}
          </h2>
          <ul>
            {decision.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          {decision.warnings?.map((w, i) => (
            <p key={i} className="warn-text">
              ⚠ {w}
            </p>
          ))}
          <h3>Facts and their receipts</h3>
          <ul>
            {decision.factRefs.map((f, i) => (
              <li key={i}>
                <strong>{f.fact}</strong>:{' '}
                {typeof f.value === 'object' ? JSON.stringify(f.value) : String(f.value)} —{' '}
                {f.receiptIds.map((rid) => (
                  <span key={rid} className="mono">
                    {shortHash(byId[rid]?.receiptHash)}{' '}
                  </span>
                ))}
              </li>
            ))}
          </ul>
          <p className="muted">
            Rules: {decision.rulesVersion} (
            {c.type === 'sla' ? 'credit tiers from your contract' : 'simplified'}, not legal
            advice). Evidence cost {usdc4(decision.spentUusdc)} test USDC.
          </p>
        </section>
      ) : (
        <p className="muted">No decision yet. Press “Check now” to buy proof.</p>
      )}

      {decision?.outcome === 'Owed' && !claim ? (
        <button
          disabled={busy}
          onClick={() => act(() => api(`/cases/${id}/draft`, { method: 'POST' }))}
        >
          Draft the claim
        </button>
      ) : null}

      {claim ? (
        <section>
          <div className="row">
            <h2>Claim email</h2>
            <Badge value={claim.status} />
          </div>
          <p>
            <strong>Subject:</strong> {claim.subject}
          </p>
          {editing != null ? (
            <div className="stack">
              <textarea rows={16} value={editing} onChange={(e) => setEditing(e.target.value)} />
              <div className="row-left">
                <button
                  onClick={() =>
                    act(
                      async () => (
                        await api(`/claims/${claim._id}`, {
                          method: 'PATCH',
                          body: { draftText: editing },
                        }),
                        setEditing(null)
                      ),
                    )
                  }
                >
                  Save
                </button>
                <button className="secondary" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <pre className="draft">{claim.draftText}</pre>
          )}
          {claim.status === 'DraftReady' && editing == null ? (
            <>
              <button className="secondary" onClick={() => setEditing(claim.draftText)}>
                Edit
              </button>
              <SendBox claim={claim} onDone={reload} isSla={c.type === 'sla'} />
            </>
          ) : null}
          {claim.status === 'Sent' ? (
            <div className="row-left">
              <span className="muted">Sent to {claim.recipientEmail}.</span>
              <button
                onClick={() =>
                  act(() =>
                    api(`/claims/${claim._id}/outcome`, {
                      method: 'POST',
                      body: { outcome: 'Paid', amountEur: decision?.amountEur ?? undefined },
                    }),
                  )
                }
              >
                Mark paid
              </button>
              <button
                className="secondary"
                onClick={() =>
                  act(() =>
                    api(`/claims/${claim._id}/outcome`, {
                      method: 'POST',
                      body: { outcome: 'Rejected' },
                    }),
                  )
                }
              >
                Mark rejected
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      <h2>Receipts for this case</h2>
      <ReceiptsTable receipts={receipts} />
      <p>
        <Link to="/claims">← All claims</Link>
      </p>
    </>
  );
}
