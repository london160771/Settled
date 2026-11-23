import { useEffect, useState } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
  Link,
  useLocation,
} from 'react-router-dom';
import {
  LayoutGrid,
  FileCheck2,
  ReceiptText,
  MessageSquare,
  Wallet2,
  Trophy,
  Gavel,
  Settings2,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { Logo } from './components/ui.jsx';
import Landing from './pages/Landing.jsx';
import { AuthProvider, useAuth } from './auth.jsx';
import AuthPage from './pages/Auth.jsx';
import Home from './pages/Home.jsx';
import AddCase from './pages/AddCase.jsx';
import Claims from './pages/Claims.jsx';
import CaseDetail from './pages/CaseDetail.jsx';
import Receipts from './pages/Receipts.jsx';
import Wallet from './pages/Wallet.jsx';
import Settings from './pages/Settings.jsx';
import Proof from './pages/Proof.jsx';
import Ask from './pages/Ask.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import Judge from './pages/Judge.jsx';

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutGrid, end: true },
  { to: '/claims', label: 'Claims', icon: FileCheck2 },
  { to: '/receipts', label: 'Receipts', icon: ReceiptText },
  { to: '/ask', label: 'Ask', icon: MessageSquare },
  { to: '/wallet', label: 'Wallet', icon: Wallet2 },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
];

function Shell({ children }) {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  if (!user) {
    // Signed out: the landing page draws its own header.
    if (pathname === '/') return children;
    return (
      <>
        <header className="pubbar">
          <Link to="/" className="brand">
            <Logo /> Settled
          </Link>
          <nav>
            <span className="net hide-sm">
              <span className="dot" /> Testnet
            </span>
            <Link to="/signin">Sign in</Link>
            <Link to="/judge" className="button">
              Try the demo
            </Link>
          </nav>
        </header>
        <main className="container">{children}</main>
      </>
    );
  }
  return (
    <div className="app">
      <aside className={`side${open ? ' open' : ''}`}>
        <Link to="/" className="brand">
          <Logo /> Settled
        </Link>
        <button
          className="secondary menu-btn"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
        <nav className="nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              <n.icon strokeWidth={1.5} /> {n.label}
            </NavLink>
          ))}
          <div className="nav-label">Account</div>
          {user.isDemo ? (
            <NavLink to="/judge">
              <Gavel strokeWidth={1.5} /> Judge mode
            </NavLink>
          ) : null}
          <NavLink to="/settings">
            <Settings2 strokeWidth={1.5} /> Settings
          </NavLink>
          <button onClick={signOut}>
            <LogOut strokeWidth={1.5} /> Sign out
          </button>
        </nav>
        <div className="side-foot">
          {user.isDemo ? <div className="demo-flag">Demo account</div> : null}
          <div className="net">
            <span className="dot" /> Testnet · Sepolia · test USDC
          </div>
        </div>
      </aside>
      <main className="main">
        <div className="container">{children}</div>
      </main>
    </div>
  );
}

function Private({ children }) {
  const { user } = useAuth();
  if (user === undefined) return <p className="muted">Loading…</p>;
  return user ? children : <Navigate to="/signin" replace />;
}

function HomeOrLanding() {
  const { user } = useAuth();
  if (user === undefined) return null;
  return user ? <Home /> : <Landing />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Shell>
          <Routes>
            <Route path="/signin" element={<AuthPage mode="signin" />} />
            <Route path="/signup" element={<AuthPage mode="signup" />} />
            <Route path="/proof/:publicId" element={<Proof />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/judge" element={<Judge />} />
            <Route path="/" element={<HomeOrLanding />} />
            <Route
              path="/add"
              element={
                <Private>
                  <AddCase />
                </Private>
              }
            />
            <Route
              path="/claims"
              element={
                <Private>
                  <Claims />
                </Private>
              }
            />
            <Route
              path="/cases/:id"
              element={
                <Private>
                  <CaseDetail />
                </Private>
              }
            />
            <Route
              path="/ask"
              element={
                <Private>
                  <Ask />
                </Private>
              }
            />
            <Route
              path="/receipts"
              element={
                <Private>
                  <Receipts />
                </Private>
              }
            />
            <Route
              path="/wallet"
              element={
                <Private>
                  <Wallet />
                </Private>
              }
            />
            <Route
              path="/settings"
              element={
                <Private>
                  <Settings />
                </Private>
              }
            />
            <Route
              path="*"
              element={
                <div className="empty">
                  This page does not exist. <Link to="/">Go to the start</Link>
                </div>
              }
            />
          </Routes>
        </Shell>
      </AuthProvider>
    </BrowserRouter>
  );
}
