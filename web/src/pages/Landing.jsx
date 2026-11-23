import { Link } from 'react-router-dom';
import { FileSearch, Scale, Send, ShieldCheck, Gauge, RotateCcw } from 'lucide-react';
import { Logo, Hash } from '../components/ui.jsx';

// Figures below come from the deployed judge run on 2026-11-23
// (evidence/deploy/case-page.png and run-demo.png). Nothing here is invented.
const RUN = {
  month: '99.9645',
  promised: '99.99',
  window: '99.1224',
  windowDays: 54,
  fee: 400,
  credit: 40,
  tier: 10,
  receipts: [
    '0x2d74a4c998010183da728e60fb085c8556b55a60f247800cccc9c880041705bf',
    '0x04c63f7d5c832f044a5428bb0f0e615f0c2b0eabd4d082efcfd86405143c8a4c',
  ],
};

function HeroReceipt() {
  return (
    <div className="hero-receipt" aria-label="Example decision from a live testnet run">
      <div className="receipt-kicker">SETTLED · DECISION</div>
      <div className="hr-title">Vercel · October 2026</div>
      <hr className="rule" />
      <div className="hr-line">
        <span>Measured uptime</span>
        <span className="mono">{RUN.month}%</span>
      </div>
      <div className="hr-line">
        <span>Promised in the SLA</span>
        <span className="mono">{RUN.promised}%</span>
      </div>
      <div className="hr-line">
        <span>Second miner, last {RUN.windowDays} days</span>
        <span className="mono">{RUN.window}%</span>
      </div>
      <div className="hr-line">
        <span>Your tier</span>
        <span className="mono">
          {RUN.tier}% of {RUN.fee} USD
        </span>
      </div>
      <hr className="rule" />
      <div className="hr-total">
        <span>Owed</span>
        <span>{RUN.credit} USD</span>
      </div>
      <div className="hr-hashes">
        {RUN.receipts.map((h) => (
          <Hash key={h} value={h} />
        ))}
      </div>
      <div className="hr-foot mono">2 receipts · 0.02 test USDC · 14.4 s</div>
    </div>
  );
}

const STEPS = [
  {
    icon: FileSearch,
    title: 'Read your SLA',
    text: 'Paste the contract. A Telegraph miner quotes the uptime promise, the credit tiers and the claim window. Settled keeps only quotes it finds word for word in your text.',
  },
  {
    icon: Scale,
    title: 'Buy the uptime record, twice',
    text: 'One miner reports the calendar month. If it shows a breach, a different miner checks a second window. Settled says Owed only when both agree.',
  },
  {
    icon: Send,
    title: 'Draft the claim, you send it',
    text: 'The credit is your tier times your monthly bill. The email lists every fact with its receipt. Nothing is sent and no money moves until you confirm.',
  },
];

const GUARDS = [
  {
    icon: Gauge,
    title: 'Spending cap',
    text: 'Each check reserves its budget first. Spent plus reserved can never pass your monthly cap.',
  },
  {
    icon: ShieldCheck,
    title: 'Six attacks, six blocks',
    text: 'Going over the cap, claiming the same case twice, miners that disagree, hidden instructions in an email, a failed paid ask, sending to an unconfirmed address. Judge mode runs all six.',
  },
  {
    icon: RotateCcw,
    title: 'Honest about failures',
    text: 'A failed paid ask is counted as spent, retried once at most, and reconciled with the Telegraph ledger later.',
  },
];

export default function Landing() {
  return (
    <div className="landing">
      <section className="hero">
        <img
          className="hero-bg"
          src="/img/racks.webp"
          alt=""
          width="2000"
          height="1122"
          fetchPriority="high"
        />
        <div className="hero-shade" />
        <header className="hero-bar">
          <Link to="/" className="brand on-dark">
            <Logo /> Settled
          </Link>
          <nav>
            <a href="#how" className="hide-sm">
              How it works
            </a>
            <a href="#proof" className="hide-sm">
              Proof
            </a>
            <Link to="/signin">Sign in</Link>
            <Link to="/judge" className="button light">
              Try the demo
            </Link>
          </nav>
        </header>
        <div className="hero-body">
          <div className="hero-copy">
            <h1>Your cloud vendor missed its uptime promise. Get the credit back.</h1>
            <p>
              Settled buys the uptime record from independent Telegraph miners, checks it against
              your SLA and drafts the service credit request. Every fact in the email comes with a
              paid receipt anyone can verify.
            </p>
            <div className="hero-cta">
              <Link to="/judge" className="button light big-btn">
                Run the judge demo
              </Link>
              <Link to="/signup" className="hero-link">
                Create an account
              </Link>
            </div>
            <div className="hero-meta">Live on Ethereum Sepolia testnet · paid in test USDC</div>
          </div>
          <HeroReceipt />
        </div>
      </section>

      <section className="l-section" id="how">
        <div className="l-head">
          <h2>How Settled decides</h2>
          <p>
            Teams pay for 99.99% uptime and rarely claim the credit when a month falls short,
            because proving it takes an afternoon. Settled does it in about fifteen seconds for two
            cents of test USDC.
          </p>
        </div>
        <ol className="steps">
          {STEPS.map((st, i) => (
            <li key={st.title}>
              <div className="step-top">
                <span className="step-n">{i + 1}</span>
                <st.icon strokeWidth={1.5} />
              </div>
              <h3>{st.title}</h3>
              <p>{st.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="l-section split" id="proof">
        <div className="split-media">
          <img
            src="/img/desk.webp"
            alt="Paper invoices and a calculator on a desk"
            width="1400"
            height="803"
            loading="lazy"
          />
        </div>
        <div className="split-copy">
          <h2>A claim your vendor can check</h2>
          <p>
            Billing teams push back on screenshots. They cannot push back on a receipt. Each figure
            in a Settled claim points to one paid Telegraph call, and its <code>receipt_hash</code>{' '}
            resolves to the miner's raw answer and a Merkle proof.
          </p>
          <pre className="mail">
            {`Subject: SLA service credit request: Vercel, 2026-10

Your SLA promises 99.99% monthly uptime.
In 2026-10 the measured uptime was 99.9645%.
I am requesting a 10% service credit (40 USD of 400 USD).

Receipts (Telegraph, testnet):
- uptimePct   0x2d74a4c9…1705bf
- breach      0x04c63f7d…3c8a4c`}
          </pre>
          <p className="muted">Every claim also gets a public proof page with the full receipts.</p>
        </div>
      </section>

      <section className="l-section">
        <div className="l-head">
          <h2>Built to be hard to fool</h2>
        </div>
        <div className="guards">
          {GUARDS.map((g) => (
            <div key={g.title}>
              <g.icon strokeWidth={1.5} />
              <h3>{g.title}</h3>
              <p>{g.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="l-cta">
        <div>
          <h2>See it decide a real month</h2>
          <p>
            Judge mode opens a funded testnet account with Vercel's October 2026 already filed.
            Press run and watch the receipts arrive.
          </p>
        </div>
        <Link to="/judge" className="button big-btn">
          Run the judge demo
        </Link>
      </section>

      <footer className="l-foot">
        <span className="brand">
          <Logo size={20} /> Settled
        </span>
        <span className="muted">
          Testnet only. Test USDC has no value. Credit rules come from your contract, not legal
          advice. Photos from Unsplash.
        </span>
      </footer>
    </div>
  );
}
