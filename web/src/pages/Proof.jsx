import { useParams } from 'react-router-dom';
import { api, caseTitle, amountText } from '../api/client.js';
import { useLoad, ErrorBox, Badge, ReceiptsTable } from '../components/ui.jsx';

export default function Proof() {
  const { publicId } = useParams();
  const { data, error } = useLoad(() => api(`/proof/${publicId}`), [publicId]);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <p className="muted">Loading…</p>;
  const d = data.decision;
  return (
    <>
      <h1>
        Proof: {data.type === 'sla' ? `${data.vendor} SLA · ${data.period}` : caseTitle(data)}
      </h1>
      {data.replayed ? <p className="badge warn">Contains replayed demo data</p> : null}
      <p className="muted">
        {data.type === 'sla' ? 'Uptime vs promised SLA' : `${data.from} → ${data.to}`} ·{' '}
        {data.network}
      </p>
      {d ? (
        <section className="card">
          <h2>
            <Badge value={d.outcome} /> {amountText(d)}
          </h2>
          <ul>
            {d.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          {d.warnings?.map((w, i) => (
            <p key={i} className="warn-text">
              ⚠ {w}
            </p>
          ))}
          <p className="muted">
            Rules {d.rulesVersion}:{' '}
            {data.type === 'sla'
              ? "uptime from the vendor's public incident history vs the promised SLA, credit by the claimant's contract tiers"
              : 'simplified EU261/UK261'}
            , not legal advice.
          </p>
        </section>
      ) : (
        <p>No decision yet.</p>
      )}
      <h2>Facts</h2>
      <ul>
        {data.facts.map((f, i) => (
          <li key={i}>
            <strong>{f.fact}</strong>:{' '}
            {typeof f.value === 'object' ? JSON.stringify(f.value) : String(f.value)} — backed by{' '}
            {f.receiptHashes.length} receipt(s)
          </li>
        ))}
      </ul>
      <h2>Receipts</h2>
      <ReceiptsTable
        receipts={data.receipts.map((r) => ({ ...r, status: r.replayed ? 'replayed' : 'settled' }))}
      />
      <h2>How to verify a receipt</h2>
      <ol>
        <li>Each receipt_hash identifies one paid Telegraph call, permanently.</li>
        <li>
          Once its epoch is recorded (up to about an hour on testnet), open{' '}
          <code>
            https://devnode.telegraphprotocol.com/v1/blocks/&lt;epoch&gt;/deliveries/&lt;receipt_hash&gt;
          </code>{' '}
          to get the delivery and its Merkle proof.
        </li>
        <li>
          The miner's raw answer is recorded as a signal:{' '}
          <code>/engine/v1/signal/&lt;signal_hash&gt;</code>.
        </li>
      </ol>
      <ul>
        {data.receipts
          .filter((r) => r.verifyUrl)
          .map((r) => (
            <li key={r.receiptHash}>
              <a href={r.verifyUrl} target="_blank" rel="noreferrer" className="mono">
                verify {r.shortHash}
              </a>
              {r.signalUrl ? (
                <>
                  {' · '}
                  <a href={r.signalUrl} target="_blank" rel="noreferrer">
                    raw answer
                  </a>
                </>
              ) : null}
            </li>
          ))}
      </ul>
    </>
  );
}
