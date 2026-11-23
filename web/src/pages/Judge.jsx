import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, usdc, amountText } from '../api/client.js';
import { useAuth } from '../auth.jsx';
import { ErrorBox, Badge, ReceiptsTable } from '../components/ui.jsx';

export default function Judge() {
  const { user, setUser } = useAuth();
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const [demo, setDemo] = useState(null);
  const [running, setRunning] = useState(false);
  const [receipts, setReceipts] = useState([]);
  const [attacks, setAttacks] = useState(null);
  const [attacking, setAttacking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef(null);

  const start = async () => {
    setError(null);
    try {
      const d = await api('/judge/session', { method: 'POST' });
      setSession(d);
      setUser(d.user);
    } catch (e) {
      setError(e);
    }
  };
  useEffect(() => () => clearInterval(timer.current), []);

  const runDemo = async () => {
    setRunning(true);
    setError(null);
    setDemo(null);
    const t0 = Date.now();
    const since = new Date().toISOString();
    timer.current = setInterval(async () => {
      setElapsed(Math.round((Date.now() - t0) / 1000));
      try {
        const r = await api('/receipts');
        setReceipts(r.receipts.filter((x) => x.createdAt >= since));
      } catch {
        /* polling only */
      }
    }, 1500);
    try {
      setDemo(await api('/judge/demo', { method: 'POST' }));
      const r = await api('/receipts');
      setReceipts(r.receipts.filter((x) => x.createdAt >= since));
    } catch (e) {
      setError(e);
    } finally {
      clearInterval(timer.current);
      setRunning(false);
    }
  };
  const runAttacks = async () => {
    setAttacking(true);
    setError(null);
    try {
      setAttacks(await api('/judge/attacks', { method: 'POST' }));
    } catch (e) {
      setError(e);
    } finally {
      setAttacking(false);
    }
  };

  const isDemo = user?.isDemo;
  return (
    <>
      <h1>Judge mode</h1>
      <p>
        A fresh demo account inside the real product: a testnet wallet funded with 0.50 test USDC
        and two seeded real cases: Vercel's uptime in October 2026, and a late flight.{' '}
        <strong>REAL:</strong> Telegraph asks, receipts, cap, decision, draft.{' '}
        <strong>DEMO:</strong> the account, and claims can only go to the demo inbox.
      </p>
      {!isDemo ? (
        <button onClick={start}>Start the demo account</button>
      ) : (
        <p className="muted">
          You are in a demo account{session?.reused ? ' (reused for up to 1 hour)' : ''}.
          {session?.funding?.error ? ` Wallet funding: ${session.funding.error}.` : ''}{' '}
          <Link to="/wallet">Wallet</Link> · <Link to="/claims">Claims</Link>
        </p>
      )}
      <ErrorBox error={error} />
      {isDemo ? (
        <>
          <section className="card stack">
            <h2>1. Run the demo</h2>
            <p className="muted">
              Buys Vercel's October 2026 uptime from one SLA miner and a second opinion from a
              different miner, compares it with the 99.99% promise, works out the service credit and
              drafts the request. Target: under 90 seconds. (The flight case is there too: live
              miners can't report past flight delays yet, so it honestly ends in Needs more proof.)
            </p>
            <button disabled={running} onClick={runDemo}>
              {running ? `Running… ${elapsed}s` : 'Run the demo'}
            </button>
            {receipts.length ? <ReceiptsTable receipts={receipts} /> : null}
            {demo ? (
              <div className="stack">
                <div>
                  Decision: <Badge value={demo.decision.outcome} /> {amountText(demo.decision)} ·{' '}
                  {(demo.ms / 1000).toFixed(1)} s · evidence cost {usdc(demo.decision.spentUusdc)}{' '}
                  test USDC
                </div>
                <ul>
                  {demo.decision.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
                {demo.claim ? (
                  <p>
                    Draft ready.{' '}
                    <Link to={`/cases/${demo.caseId}`}>Open it to send to the demo inbox</Link> (you
                    confirm the address first).
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>
          <section className="card stack">
            <h2>2. Run the attacks</h2>
            <p className="muted">
              Six ways to break it. Each runs the real code path and must be blocked with its reason
              code. No attack spends money.
            </p>
            <button disabled={attacking} onClick={runAttacks}>
              {attacking ? 'Running attacks…' : 'Run the attacks'}
            </button>
            {attacks ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Attack</th>
                      <th>Result</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attacks.results.map((a) => (
                      <tr key={a.id}>
                        <td>{a.id}</td>
                        <td>
                          {a.name}{' '}
                          {a.replayed ? (
                            <span className="badge warn">
                              {a.synthetic ? 'replayed (synthetic fixture)' : 'replayed'}
                            </span>
                          ) : (
                            <span className="badge info">live code path</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${a.passed ? 'good' : 'bad'}`}>
                            {a.passed ? 'blocked' : 'NOT blocked'} · {a.code}
                          </span>
                        </td>
                        <td className="muted">{a.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </>
  );
}
