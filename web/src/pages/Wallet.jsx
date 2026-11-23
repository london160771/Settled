import { useState } from 'react';
import { api, usdc, usdc4 } from '../api/client.js';
import { useLoad, ErrorBox } from '../components/ui.jsx';

export default function Wallet() {
  const { data, error, reload } = useLoad(() => api('/wallet'));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);
  const topUp = async () => {
    setBusy(true);
    setErr(null);
    try {
      const d = await api('/wallet/topup', { method: 'POST' });
      setMsg(`Added ${usdc(d.amountUusdc)} test USDC. It shows in a minute.`);
      reload();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };
  if (error) return <ErrorBox error={error} />;
  if (!data) return <p className="muted">Loading…</p>;
  const b = data.budget;
  return (
    <>
      <h1>Wallet</h1>
      <div className="card stack">
        <div>
          <div className="label muted">Your Settled wallet on {data.network}</div>
          <a className="mono" href={data.explorerUrl} target="_blank" rel="noreferrer">
            {data.address}
          </a>
        </div>
        <div>
          <div className="muted">Telegraph escrow balance (what asks can spend)</div>
          <div className="big">
            {data.escrow ? `${usdc4(data.escrow.availableUusdc)} test USDC` : 'unavailable'}
          </div>
          {data.escrowError ? <div className="muted">Ledger: {data.escrowError}</div> : null}
        </div>
        <div>
          <button disabled={busy} onClick={topUp}>
            {busy ? 'Minting test USDC…' : 'Top up with test USDC'}
          </button>
        </div>
        {msg ? <p>{msg}</p> : null}
        <ErrorBox error={err} />
        <p className="muted">
          Testnet: Settled holds this wallet's keys (custodial). On mainnet the plan is a wallet you
          own with a spending key Settled can use only within your cap.
        </p>
      </div>
      <h2>Your cap</h2>
      <div className="grid3">
        <div className="card stat">
          <div className="label">Per decision</div>
          <div className="big">{usdc(b.decisionCapUusdc)}</div>
        </div>
        <div className="card stat">
          <div className="label">Per month</div>
          <div className="big">{usdc(b.monthlyCapUusdc)}</div>
        </div>
        <div className="card stat">
          <div className="label">Spent / reserved in {b.month}</div>
          <div className="big">
            {usdc4(b.spentUusdc)} / {usdc4(b.reservedUusdc)}
          </div>
        </div>
      </div>
      <p className="muted">
        Spent + reserved can never go over your monthly cap, even with many asks at once. Change
        caps in Settings.
      </p>
    </>
  );
}
