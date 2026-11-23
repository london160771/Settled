import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, FlaskConical, Play, ShieldCheck } from 'lucide-react';
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
      <p className="lede">
        A fresh demo account inside the real product, with a testnet wallet funded with 0.50 test
        USDC and two seeded cases: Vercel's uptime in October 2026, and a late flight.
      </p>
      <div className="realmock">
        <div>
          <strong>
            <Check strokeWidth={1.5} size={16} /> Real
          </strong>
          Telegraph asks on Ethereum Sepolia, receipts, the spending cap, the decision and the draft
        </div>
        <div>
          <strong>
            <FlaskConical strokeWidth={1.5} size={16} /> Demo
          </strong>
          The account itself. Claims from it can only go to the demo inbox
        </div>
      </div>
      {!isDemo ? (
        <button className="big-btn" onClick={start}>
          Start the demo account
        </button>
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
            <h2>
              <span className="step-n">1</span>Run the demo
            </h2>
            <p className="muted">
              Buys Vercel's October 2026 uptime from one SLA miner and a second opinion from a
              different miner, compares it with the 99.99% promise, works out the service credit and
              drafts the request. Target: under 90 seconds. The flight case is there too. Live
              miners can't report past flight delays yet, so it honestly ends in Needs more proof.
            </p>
            <div>
              <button disabled={running} onClick={runDemo}>
                <Play strokeWidth={1.5} /> {running ? `Running… ${elapsed}s` : 'Run the demo'}
              </button>
            </div>
            {receipts.length ? <ReceiptsTable receipts={receipts} /> : null}
            {demo ? (
              <div className="receipt" style={{ margin: '0 0 12px' }}>
                <div className="receipt-head">
                  <div>
                    <div className="receipt-kicker">
                      DECISION · {(demo.ms / 1000).toFixed(1)} s · {usdc(demo.decision.spentUusdc)}{' '}
                      test USDC
                    </div>
                    <div className="receipt-figure">{amountText(demo.decision) || '—'}</div>
                  </div>
                  <Badge value={demo.decision.outcome} />
                </div>
                <hr className="rule" />
                <ul className="reasons">
                  {demo.decision.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
                {demo.claim ? (
                  <p className="fine">
                    Draft ready.{' '}
                    <Link to={`/cases/${demo.caseId}`}>
                      Open the case to send it to the demo inbox
                    </Link>
                    . You confirm the address first.
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>
          <section className="card stack">
            <h2>
              <span className="step-n">2</span>Run the attacks
            </h2>
            <p className="muted">
              Six ways to break it. Each runs the real code path and must be blocked with its reason
              code. No attack spends money.
            </p>
            <div>
              <button disabled={attacking} onClick={runAttacks}>
                <ShieldCheck strokeWidth={1.5} />{' '}
                {attacking ? 'Running attacks…' : 'Run the attacks'}
              </button>
            </div>
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
                        <td className="n meta">{a.id}</td>
                        <td>
                          {a.name}{' '}
                          {a.replayed ? (
                            <span className="badge warn">
                              {a.synthetic ? 'Replayed, synthetic fixture' : 'Replayed'}
                            </span>
                          ) : (
                            <span className="badge info">Live code path</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${a.passed ? 'good' : 'bad'}`}>
                            {a.passed ? 'Blocked' : 'Not blocked'} · {a.code}
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
