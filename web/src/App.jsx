import { BrowserRouter, Routes, Route, NavLink, Navigate, Link } from 'react-router-dom';
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

function Shell({ children }) {
  const { user, signOut } = useAuth();
  return (
    <>
      <div className="banner">
        TESTNET · Ethereum Sepolia · test USDC
        {user?.isDemo ? <strong> · DEMO ACCOUNT</strong> : null}
      </div>
      <header className="top">
        <Link to="/" className="brand">
          Settled
        </Link>
        {user ? (
          <nav>
            <NavLink to="/" end>
              Home
            </NavLink>
            <NavLink to="/claims">Claims</NavLink>
            <NavLink to="/ask">Ask</NavLink>
            <NavLink to="/receipts">Receipts</NavLink>
            <NavLink to="/wallet">Wallet</NavLink>
            <NavLink to="/leaderboard">Leaderboard</NavLink>
            {user.isDemo ? <NavLink to="/judge">Judge</NavLink> : null}
            <NavLink to="/settings">Settings</NavLink>
            <button className="link" onClick={signOut}>
              Sign out
            </button>
          </nav>
        ) : null}
      </header>
      <main className="container">{children}</main>
    </>
  );
}

function Private({ children }) {
  const { user } = useAuth();
  if (user === undefined) return <p className="muted">Loading…</p>;
  return user ? children : <Navigate to="/signin" replace />;
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
            <Route
              path="/"
              element={
                <Private>
                  <Home />
                </Private>
              }
            />
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
                <p>
                  Page not found. <Link to="/">Home</Link>
                </p>
              }
            />
          </Routes>
        </Shell>
      </AuthProvider>
    </BrowserRouter>
  );
}
