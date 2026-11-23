import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ExternalLink } from 'lucide-react';
import { api, usdc4, caseTitle, caseSub } from '../api/client.js';
import { useLoad, ErrorBox, Badge, ReceiptsTable, Hash } from '../components/ui.jsx';

const FACT_LABEL = {
  uptimePct: 'Measured uptime',
  targetPct: 'Promised uptime',
  contractTerms: 'Terms from your contract',
  breachCorroborated: 'Second miner saw a breach',
  delayMinutes: 'Arrival delay',
};
const factValue = (v) => {
  if (v && typeof v === 'object') {
    if (v.uptimePct != null) return `${v.uptimePct}%${v.period ? ` · ${v.period}` : ''}`;
    return JSON.stringify(v);
  }
  if (typeof v === 'number' && v <= 100 && v >= 90) return `${v}%`;
  return String(v);
};

// The decision, printed like a receipt: one figure, the reasons, each fact with its hash.
export function DecisionReceipt({ decision, kicker, type, hashFor }) {
  const amount = decision.amountUsd
    ? { n: decision.amountUsd, unit: 'USD credit' }
    : decision.amountEur
      ? { n: decision.amountEur, unit: 'EUR' }
      : null;
  return (
    <section className="receipt">
      <div className="receipt-head">
        <div>
          <div className="receipt-kicker">{kicker}</div>
          <div className="receipt-figure">
            {amount ? (
              <>
                {amount.n}
                <span className="unit">{amount.unit}</span>
              </>
            ) : (
              <span style={{ fontSize: 28 }}>
                <Badge value={decision.outcome} />
              </span>
            )}
          </div>
        </div>
        {amount ? <Badge value={decision.outcome} /> : null}
      </div>
      <hr className="rule" />
      <ul className="reasons">
        {decision.reasons.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
      {decision.warnings?.map((w, i) => (
        <p key={i} className="note" style={{ marginTop: 16, marginBottom: 0 }}>
          <AlertTriangle strokeWidth={1.5} /> {w}
        </p>
      ))}
      {decision.factRefs?.length ? (
        <>
          <hr className="rule" />
          <div className="facts">
            {decision.factRefs.map((f, i) => (
              <FactRow key={i} f={f} hashes={hashFor(f)} />
            ))}
          </div>
        </>
      ) : null}
      <p className="fine">
        Rules {decision.rulesVersion} ·{' '}
        {type === 'sla' ? 'credit tiers from your contract' : 'simplified EU261/UK261'}, not legal
        advice
        {decision.spentUusdc != null
          ? ` · evidence cost ${usdc4(decision.spentUusdc)} test USDC`
          : ''}
      </p>
    </section>
  );
}
function FactRow({ f, hashes }) {
  return (
    <>
      <div className="k">{FACT_LABEL[f.fact] || f.fact}</div>
      <div className="v">{factValue(f.value)}</div>
      <div className="h">
        {hashes.map((h) => (
          <Hash key={h} value={h} />
        ))}
      </div>
    </>
  );
}

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
      <p className="muted">Nothing is sent until you press Send.</p>
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
      <Link to="/claims" className="muted back">
        <ArrowLeft strokeWidth={1.5} size={16} /> Claims
      </Link>
      <div className="page-head">
        <div>
          <h1>{caseTitle(c)}</h1>
          <p className="muted">{caseSub(c)}</p>
        </div>
        <div className="row-left">
          <Badge value={c.status} />
          <a className="button secondary" href={proofUrl} target="_blank" rel="noreferrer">
            Public proof page <ExternalLink strokeWidth={1.5} />
          </a>
        </div>
      </div>
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
        <DecisionReceipt
          decision={decision}
          type={c.type}
          kicker={`DECISION · ${new Date(decision.createdAt || Date.now()).toISOString().slice(0, 10)}`}
          hashFor={(f) => f.receiptIds.map((rid) => byId[rid]?.receiptHash).filter(Boolean)}
        />
      ) : (
        <p className="empty">No decision yet. Press Check now to buy proof.</p>
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
          <p className="mail-subject">
            Subject <strong>{claim.subject}</strong>
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
    </>
  );
}
