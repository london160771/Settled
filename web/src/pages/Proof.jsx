import { useParams } from 'react-router-dom';
import { api, caseTitle } from '../api/client.js';
import { useLoad, ErrorBox, ReceiptsTable, Hash } from '../components/ui.jsx';
import { DecisionReceipt } from './CaseDetail.jsx';

export default function Proof() {
  const { publicId } = useParams();
  const { data, error } = useLoad(() => api(`/proof/${publicId}`), [publicId]);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <p className="muted">Loading…</p>;
  const d = data.decision;
  return (
    <>
      <div className="page-head">
        <div>
          <div className="receipt-kicker">PUBLIC PROOF</div>
          <h1>{caseTitle(data)}</h1>
          <p className="muted">
            {data.type === 'sla' ? 'Uptime against the promised SLA' : `${data.from} → ${data.to}`}{' '}
            · {data.network}
          </p>
        </div>
        {data.replayed ? <span className="badge warn">Contains replayed demo data</span> : null}
      </div>
      {d ? (
        <DecisionReceipt
          decision={{ ...d, factRefs: data.facts }}
          type={data.type}
          kicker="DECISION"
          hashFor={(f) => f.receiptHashes}
        />
      ) : (
        <p className="empty">No decision yet.</p>
      )}
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
              <Hash value={r.receiptHash} href={r.verifyUrl} />
              {r.signalUrl ? (
                <>
                  {' · '}
                  <a href={r.signalUrl} target="_blank" rel="noreferrer">
                    Raw answer
                  </a>
                </>
              ) : null}
            </li>
          ))}
      </ul>
    </>
  );
}
