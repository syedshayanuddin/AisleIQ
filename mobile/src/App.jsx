import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import './index.css';
import Webcam from "react-webcam";

// 🔧 API URL — update if ngrok URL changes
const API = 'https://madalyn-rebuffable-hilda.ngrok-free.dev/api/v1';


// ── Session helpers ──────────────────────────────────────────────────────────────
const HEADERS = { 'bypass-tunnel-reminder': 'true' };

function saveAuth(data) { localStorage.setItem('aisleiq_auth', JSON.stringify(data)); }
function getStoredAuth() {
  try { const s = localStorage.getItem('aisleiq_auth'); return s ? JSON.parse(s) : null; }
  catch { return null; }
}
function clearAuth() { localStorage.removeItem('aisleiq_auth'); }

// ── Login / Register Screen ──────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [mode, setMode]         = useState('login');   // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  const reset = () => { setError(''); setSuccess(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required'); return;
    }
    if (mode === 'register' && !displayName.trim()) {
      setError('Please enter your display name'); return;
    }
    setLoading(true); setError('');
    try {
      if (mode === 'register') {
        await axios.post(`${API}/auth/register`,
          { username: username.trim(), password, display_name: displayName.trim() },
          { headers: HEADERS }
        );
        setSuccess('Account created! Logging you in…');
      }
      // Login (after register or directly)
      const res = await axios.post(`${API}/auth/login`,
        { username: username.trim(), password },
        { headers: HEADERS }
      );
      const data = {
        user_id:      res.data.user_id,
        display_name: res.data.display_name,
      };
      saveAuth(data);
      onLogin(data);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Connection failed. Check your network.';
      setError(msg);
    } finally { setLoading(false); }
  };

  return (
    <div className="login-screen">
      <div className="login-card">

        <div className="login-logo">🛒</div>
        <h1 className="login-title">Aisle<span style={{color:'var(--accent2)'}}>IQ</span></h1>
        <p className="login-sub">Smart shopping, zero waiting</p>

        {/* Mode toggle */}
        <div className="login-tabs">
          <button className={`login-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); reset(); }}>Log In</button>
          <button className={`login-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => { setMode('register'); reset(); }}>Register</button>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {mode === 'register' && (
            <div className="login-field">
              <label className="login-label">Display Name</label>
              <input className="login-input" type="text" placeholder="How should we call you?"
                value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={40} />
            </div>
          )}
          <div className="login-field">
            <label className="login-label">Username</label>
            <input className="login-input" type="text" placeholder="Enter username"
              value={username} onChange={e => { setUsername(e.target.value); reset(); }}
              autoCapitalize="none" autoCorrect="off" maxLength={30} />
          </div>
          <div className="login-field">
            <label className="login-label">Password</label>
            <input className="login-input" type="password" placeholder="Enter password"
              value={password} onChange={e => { setPassword(e.target.value); reset(); }}
              maxLength={100} />
          </div>

          {error   && <p className="login-error">{error}</p>}
          {success && <p className="login-success">{success}</p>}

          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? 'Please wait…'
              : mode === 'login' ? 'Log In →'
              : 'Create Account →'}
          </button>
        </form>

        <p className="login-note">Your session is saved on this device.</p>
      </div>
    </div>
  );
}

const SKU_PRICES = {
  'SKU-001': 85, 'SKU-002': 40, 'SKU-003': 30, 'SKU-004': 55,
  'SKU-005': 45, 'SKU-006': 20, 'SKU-007': 15, 'SKU-008': 50,
};




function CartTab({ session, onCheckoutDone }) {
  const [items, setItems] = useState([]);
  const [checking, setChecking] = useState(false);
  const webcamRef = useRef(null);

  const sessionId = session.session_id;
  const userId    = session.user_id;        // username — must match pantry/history lookups

  // Capture a frame and POST it to the detect-frame endpoint
  const capture = useCallback(async () => {
    if (!webcamRef.current || !sessionId) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    const blob = await fetch(imageSrc).then(res => res.blob());
    const formData = new FormData();
    formData.append('file', blob, 'frame.jpg');

    try {
      await axios.post(`${API}/detect-frame/${sessionId}`, formData, {
        headers: {
          'bypass-tunnel-reminder': 'true',
          'Content-Type': 'multipart/form-data',
        },
      });
    } catch { /* silently ignore network hiccups */ }
  }, [webcamRef, sessionId]);

  // Frame capture heartbeat — 1 FPS (every 1000 ms)
  useEffect(() => {
    const interval = setInterval(capture, 1000);
    return () => clearInterval(interval);
  }, [capture]);

  // Poll cart every 2 s for UI updates
  useEffect(() => {
    if (!sessionId) return;
    const fetchCart = async () => {
      try {
        const res = await axios.get(`${API}/cart/${sessionId}`, {
          headers: { 'bypass-tunnel-reminder': 'true' },
        });
        setItems(res.data);
      } catch { }
    };
    fetchCart();
    const t = setInterval(fetchCart, 2000);
    return () => clearInterval(t);
  }, [sessionId]);

  const total = items.reduce((s, i) => s + (SKU_PRICES[i.sku_id] ?? 0) * (i.quantity ?? 1), 0);

  const handleCheckout = async () => {
    if (!items.length || !sessionId) return;
    setChecking(true);
    try {
      await axios.post(`${API}/checkout/${sessionId}?user_id=${encodeURIComponent(userId)}`, null, {
        headers: { 'bypass-tunnel-reminder': 'true' },
      });
      setItems([]);
      onCheckoutDone();
    } catch (e) {
      alert('Checkout failed: ' + (e.response?.data?.detail || e.message));
    } finally { setChecking(false); }
  };

  return (
    <>
      <div className="header">
        <h1>🛒 Mobile Scanner</h1>
        <div className="badge"><span className="pulse" /> {session.display_name}</div>
      </div>

      {/* Camera Preview with Zone Overlay */}
      <div className="camera-container" style={{ position: 'relative', overflow: 'hidden', borderRadius: '20px', margin: '10px' }}>
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          videoConstraints={{ facingMode: "environment" }}
          style={{ width: '100%', display: 'block' }}
        />
        <div style={{ position: 'absolute', top: '50%', width: '100%', height: '2px', background: 'red', boxShadow: '0 0 10px red' }} />
        <div style={{ position: 'absolute', top: '10%', left: '10px', color: 'white', fontSize: '10px', fontWeight: 'bold' }}>SHELF</div>
        <div style={{ position: 'absolute', bottom: '10%', left: '10px', color: 'white', fontSize: '10px', fontWeight: 'bold' }}>CART</div>
      </div>

      {/* Cart Items */}
      {items.length === 0 ? (
        <div className="empty">
          <CartIcon />
          <p>Your cart is empty.<br />Move a product below the red line<br />to add it to your cart.</p>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="card-header">
              Cart Items <span className="label">{items.length} item(s)</span>
            </div>
            {items.map((item, i) => (
              <div className="cart-item" key={i}>
                <div>
                  <div className="item-name">{getSkuName(item.sku_id)}</div>
                  <div className="item-sub">Qty: {item.quantity ?? 1} · Added {new Date(item.added_at).toLocaleTimeString()}</div>
                </div>
                <div className="item-price">₹{(SKU_PRICES[item.sku_id] ?? 0).toFixed(2)}</div>
              </div>
            ))}
          </div>

          <div className="total-bar">
            <div>
              <div className="label">Cart Total</div>
              <div className="amount">₹{total.toFixed(2)}</div>
            </div>
            <div style={{ fontSize: 13, opacity: .8 }}>{items.length} items</div>
          </div>

          <button className="btn-checkout" onClick={handleCheckout} disabled={checking}>
            {checking ? 'Processing…' : '✓ Checkout & Pay'}
          </button>
        </>
      )}
    </>
  );
}


function daysUntil(dateStr) {
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / 86400000);
}

function expiryClass(days) {
  if (days <= 0) return 'dot-red';
  if (days <= 5) return 'dot-yellow';
  return 'dot-green';
}

function expiryLabel(days) {
  if (days <= 0) return `Expired ${Math.abs(days)} day(s) ago`;
  if (days === 1) return 'Expires tomorrow!';
  if (days <= 5) return `Expires in ${days} days`;
  return `Expires in ${days} days`;
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const CartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
);
const PantryIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3h18v18H3z" /><path d="M3 9h18M9 21V9" />
  </svg>
);
const AlertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);
const HistoryIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="12 8 12 12 14 14" /><path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" />
  </svg>
);
const HomeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);



function getSkuName(skuId) {
  const names = {
    'SKU-001': 'Coca Cola 1.5L', 'SKU-002': 'Coca Cola 290mL', 'SKU-003': 'Datu Puti Soy Sauce 200mL',
    'SKU-004': 'Datu Puti Soy Sauce 385mL', 'SKU-005': 'Palmolive Soap', 'SKU-006': 'Pebbly - Packaged Drinking Water',
    'SKU-007': 'Pancit Canton Extra Hot Chili', 'SKU-008': 'Safeguard Soap',
  };
  return names[skuId] ?? skuId;
}

// ── Home Tab ──────────────────────────────────────────────────────────────────
function HomeTab({ auth, alertCount, onStartShopping, onLogout }) {
  const [starting, setStarting] = useState(false);

  const handleStart = async () => {
    setStarting(true);
    try { await onStartShopping(); }
    catch { alert('Could not start session. Check your connection.'); }
    finally { setStarting(false); }
  };

  const initial = (auth.display_name || auth.user_id || '?')[0].toUpperCase();

  return (
    <>
      <div className="header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontStyle:'italic', fontWeight:900, textTransform:'uppercase', letterSpacing:'-0.5px', fontSize:'22px' }}>
          Aisle<span style={{color:'var(--accent2)'}}>IQ</span>
        </h1>
        <button className="logout-btn" onClick={onLogout}>Log Out</button>
      </div>

      <div className="home-welcome">
        <div className="home-avatar">{initial}</div>
        <h2 className="home-name">
          Welcome back,<br /><span>{auth.display_name || auth.user_id}</span>
        </h2>
        <p className="home-sub">@{auth.user_id}</p>
      </div>

      {alertCount > 0 && (
        <div className="home-alert-banner">
          ⚠️ {alertCount} item{alertCount > 1 ? 's are' : ' is'} expiring soon!
        </div>
      )}

      <div className="home-actions">
        <button className="btn-start-shopping" onClick={handleStart} disabled={starting}>
          {starting ? 'Starting…' : '🛒 Start Shopping'}
        </button>
        <p className="home-hint">A new cart session will be created when you tap Start Shopping.</p>
      </div>
    </>
  );
}


// ── Pantry Tab ────────────────────────────────────────────────────────────────
// ── Pantry Tab ─────────────────────────────────────────────────────────────────────
function PantryTab({ userId, refresh }) {
  const [items, setItems] = useState([]);
  const [toast, setToast] = useState('');

  const fetchPantry = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/pantry/${encodeURIComponent(userId)}`);
      setItems(res.data);
    } catch { }
  }, [userId]);

  useEffect(() => { fetchPantry(); }, [fetchPantry, refresh]);

  const consume = async (item) => {
    try {
      await axios.patch(`${API}/pantry/${encodeURIComponent(userId)}/${item._id}`);
      setItems(prev => prev.filter(i => i._id !== item._id));
      setToast(`✓ ${item.name} marked as consumed`);
      setTimeout(() => setToast(''), 2500);
    } catch { }
  };

  return (
    <>
      {toast && <div className="toast">{toast}</div>}
      <div className="header">
        <h1>📦 My Pantry</h1>
        <p>Items at home — sorted by expiry</p>
      </div>
      {items.length === 0 ? (
        <div className="empty">
          <PantryIcon />
          <p>Your pantry is empty.<br />Checkout your cart to add items.</p>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            Pantry Items <span className="label">{items.length} item(s)</span>
          </div>
          {items.map((item, i) => {
            const days = daysUntil(item.expiry_date);
            return (
              <div className="pantry-item" key={i}>
                <span className={`expiry-dot ${expiryClass(days)}`} />
                <div className="pantry-info">
                  <div className="pantry-name">{item.name}</div>
                  <div className="pantry-expiry">{expiryLabel(days)} · Qty {item.quantity}</div>
                </div>
                <button className="btn-consume" onClick={() => consume(item)}>Used</button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── Alerts Tab ────────────────────────────────────────────────────────────────
function AlertsTab({ userId }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/pantry/${encodeURIComponent(userId)}`);
        setItems(res.data.filter(i => daysUntil(i.expiry_date) <= 5));
      } catch { }
    })();
  }, [userId]);

  return (
    <>
      <div className="header">
        <h1>🔔 Alerts</h1>
        <p>Items expiring within 5 days</p>
      </div>
      {items.length === 0 ? (
        <div className="empty">
          <AlertIcon />
          <p>No expiry alerts right now!<br />All your items are fresh. ✅</p>
        </div>
      ) : (
        items.map((item, i) => {
          const days = daysUntil(item.expiry_date);
          const type = days <= 0 ? 'expired' : 'soon';
          return (
            <div className={`alert-card ${type}`} key={i}>
              <div className="alert-title">{days <= 0 ? '⛔' : '⚠️'} {item.name}</div>
              <div className="alert-sub">{expiryLabel(days)} · Use it or lose it!</div>
            </div>
          );
        })
      )}
    </>
  );
}

// ── History Tab ───────────────────────────────────────────────────────────────
function HistoryTab({ userId }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/purchases/${encodeURIComponent(userId)}`);
        setHistory(res.data);
      } catch { }
    })();
  }, [userId]);

  return (
    <>
      <div className="header">
        <h1>📜 History</h1>
        <p>Your past purchases</p>
      </div>
      {history.length === 0 ? (
        <div className="empty">
          <HistoryIcon />
          <p>No purchase history yet.<br />Checkout your cart to see history.</p>
        </div>
      ) : (
        history.map((group, i) => (
          <div className="history-group" key={i}>
            <div className="history-date">{new Date(group.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>
            <div className="history-card">
              {group.items.map((item, j) => (
                <div className="history-row" key={j}>
                  <span>{item.name}</span>
                  <span style={{ color: 'var(--accent2)', fontWeight: 600 }}>₹{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="history-total">
                <span>Total</span>
                <span>₹{group.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        ))
      )}
    </>
  );
}

// ── Root App helpers ──────────────────────────────────────────────────
function saveCartSession(userId, data) {
  if (data) localStorage.setItem(`aisleiq_cart_${userId}`, JSON.stringify(data));
  else       localStorage.removeItem(`aisleiq_cart_${userId}`);
}
function getStoredCart(userId) {
  try { const s = localStorage.getItem(`aisleiq_cart_${userId}`); return s ? JSON.parse(s) : null; }
  catch { return null; }
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [auth, setAuth]               = useState(getStoredAuth);
  const [cartSession, setCartSession] = useState(() => {
    const a = getStoredAuth(); return a ? getStoredCart(a.user_id) : null;
  });
  const [tab, setTab]                 = useState('home');
  const [pantryRefresh, setPantryRefresh] = useState(0);
  const [alertCount, setAlertCount]   = useState(0);

  const userId = auth?.user_id ?? '';

  useEffect(() => {
    if (!auth) return;
    (async () => {
      try {
        const res = await axios.get(`${API}/pantry/${encodeURIComponent(userId)}`);
        setAlertCount(res.data.filter(i => daysUntil(i.expiry_date) <= 5).length);
      } catch { }
    })();
  }, [pantryRefresh, auth]);

  const handleLogin = (data) => { setAuth(data); setTab('home'); };

  const handleStartShopping = async () => {
    // Pass user_id so backend abandons stale sessions for this user
    const params = new URLSearchParams({ display_name: auth.display_name, user_id: auth.user_id });
    const res = await axios.post(`${API}/session/create?${params}`, null, { headers: HEADERS });
    const session = { session_id: res.data.session_id };
    setCartSession(session);
    saveCartSession(auth.user_id, session);   // survive page refresh
    setTab('cart');
  };

  const handleCheckoutDone = () => {
    saveCartSession(auth.user_id, null);      // clear persisted session
    setCartSession(null);
    setPantryRefresh(r => r + 1);
    setTab('pantry');
  };

  const handleLogout = () => {
    if (auth) saveCartSession(auth.user_id, null);
    clearAuth(); setAuth(null); setCartSession(null); setTab('home');
  };

  if (!auth) return <LoginScreen onLogin={handleLogin} />;

  const fullSession = cartSession
    ? { ...cartSession, user_id: auth.user_id, display_name: auth.display_name }
    : null;

  return (
    <>
      <div className="page">
        {tab === 'home'    && <HomeTab auth={auth} alertCount={alertCount} onStartShopping={handleStartShopping} onLogout={handleLogout} />}
        {tab === 'cart'    && fullSession  && <CartTab session={fullSession} onCheckoutDone={handleCheckoutDone} />}
        {tab === 'cart'    && !fullSession && <HomeTab auth={auth} alertCount={alertCount} onStartShopping={handleStartShopping} onLogout={handleLogout} />}
        {tab === 'pantry'  && <PantryTab userId={userId} refresh={pantryRefresh} />}
        {tab === 'alerts'  && <AlertsTab userId={userId} />}
        {tab === 'history' && <HistoryTab userId={userId} />}
      </div>

      <nav className="bottom-nav">
        {[
          { id: 'home',    icon: <HomeIcon />,    label: 'Home' },
          { id: 'pantry',  icon: <PantryIcon />,  label: 'Pantry' },
          { id: 'alerts',  icon: <AlertIcon />,   label: 'Alerts',  badge: alertCount },
          { id: 'history', icon: <HistoryIcon />, label: 'History' },
          ...(cartSession ? [{ id: 'cart', icon: <CartIcon />, label: 'Cart', badge: 0 }] : []),
        ].map(({ id, icon, label, badge }) => (
          <button key={id} className={`nav-btn ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id)} style={{ position: 'relative' }}>
            {icon}
            {badge > 0 && <span className="nav-dot" />}
            {label}
          </button>
        ))}
      </nav>
    </>
  );
}

