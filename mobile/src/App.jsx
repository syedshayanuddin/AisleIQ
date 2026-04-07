import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import './index.css';
import Webcam from "react-webcam";

// 🔧 TESTING: Swap this URL depending on your setup:
// Local (same WiFi, no HTTPS):  'http://192.168.0.105:8000/api/v1'
// ngrok (HTTPS, for phone cam): 'https://madalyn-rebuffable-hilda.ngrok-free.dev/api/v1'
const API = 'https://madalyn-rebuffable-hilda.ngrok-free.dev/api/v1';
const SESSION = '69a7633f26e35f1ab5ab2916';
const USER_ID = 'demo_user';

const SKU_PRICES = {
  'SKU-001': 85, 'SKU-002': 40, 'SKU-003': 30, 'SKU-004': 55,
  'SKU-005': 45, 'SKU-006': 10, 'SKU-007': 15, 'SKU-008': 50,
};



function CartTab({ onCheckoutDone }) {
  const [items, setItems] = useState([]);
  const [checking, setChecking] = useState(false);
  const webcamRef = useRef(null);

  // Capture a frame and POST it to the detect-frame endpoint
  const capture = useCallback(async () => {
    if (!webcamRef.current) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    const blob = await fetch(imageSrc).then(res => res.blob());
    const formData = new FormData();
    formData.append('file', blob, 'frame.jpg');

    try {
      await axios.post(`${API}/detect-frame/${SESSION}`, formData, {
        headers: {
          'bypass-tunnel-reminder': 'true',
          'Content-Type': 'multipart/form-data',
        },
      });
    } catch { /* silently ignore network hiccups */ }
  }, [webcamRef]);

  // Frame capture heartbeat — 1 FPS (every 1000 ms)
  useEffect(() => {
    const interval = setInterval(capture, 1000);
    return () => clearInterval(interval);
  }, [capture]);

  // Poll cart every 2 s for UI updates
  useEffect(() => {
    const fetchCart = async () => {
      try {
        const res = await axios.get(`${API}/cart/${SESSION}`);
        setItems(res.data);
      } catch { }
    };
    fetchCart();
    const t = setInterval(fetchCart, 2000);
    return () => clearInterval(t);
  }, []);

  const total = items.reduce((s, i) => s + (SKU_PRICES[i.sku_id] ?? 0) * (i.quantity ?? 1), 0);

  const handleCheckout = async () => {
    if (!items.length) return;
    setChecking(true);
    try {
      await axios.post(`${API}/checkout/${SESSION}?user_id=${USER_ID}`);
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
        <div className="badge"><span className="pulse" /> Camera Streaming</div>
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



function getSkuName(skuId) {
  const names = {
    'SKU-001': 'Coca Cola 1.5L', 'SKU-002': 'Coca Cola 290mL', 'SKU-003': 'Datu Puti Soy Sauce 200mL',
    'SKU-004': 'Datu Puti Soy Sauce 385mL', 'SKU-005': 'Palmolive Soap', 'SKU-006': 'Pancit Canton Chilimansi',
    'SKU-007': 'Pancit Canton Extra Hot Chili', 'SKU-008': 'Safeguard Soap',
  };
  return names[skuId] ?? skuId;
}

// ── Pantry Tab ────────────────────────────────────────────────────────────────
function PantryTab({ refresh }) {
  const [items, setItems] = useState([]);
  const [toast, setToast] = useState('');

  const fetchPantry = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/pantry/${USER_ID}`);
      setItems(res.data);
    } catch { }
  }, []);

  useEffect(() => { fetchPantry(); }, [fetchPantry, refresh]);

  const consume = async (item) => {
    try {
      await axios.patch(`${API}/pantry/${USER_ID}/${item._id}`);
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
function AlertsTab() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/pantry/${USER_ID}`);
        setItems(res.data.filter(i => daysUntil(i.expiry_date) <= 5));
      } catch { }
    })();
  }, []);

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
function HistoryTab() {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/purchases/${USER_ID}`);
        setHistory(res.data);
      } catch { }
    })();
  }, []);

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

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('cart');
  const [pantryRefresh, setPantryRefresh] = useState(0);
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/pantry/${USER_ID}`);
        setAlertCount(res.data.filter(i => daysUntil(i.expiry_date) <= 5).length);
      } catch { }
    })();
  }, [pantryRefresh]);

  const handleCheckoutDone = () => {
    setPantryRefresh(r => r + 1);
    setTab('pantry');
  };

  return (
    <>
      <div className="page">
        {tab === 'cart' && <CartTab onCheckoutDone={handleCheckoutDone} />}
        {tab === 'pantry' && <PantryTab refresh={pantryRefresh} />}
        {tab === 'alerts' && <AlertsTab />}
        {tab === 'history' && <HistoryTab />}
      </div>

      <nav className="bottom-nav">
        {[
          { id: 'cart', icon: <CartIcon />, label: 'Cart' },
          { id: 'pantry', icon: <PantryIcon />, label: 'Pantry' },
          { id: 'alerts', icon: <AlertIcon />, label: 'Alerts', badge: alertCount },
          { id: 'history', icon: <HistoryIcon />, label: 'History' },
        ].map(({ id, icon, label, badge }) => (
          <button key={id} className={`nav-btn ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)} style={{ position: 'relative' }}>
            {icon}
            {badge > 0 && <span className="nav-dot" />}
            {label}
          </button>
        ))}
      </nav>
    </>
  );
}
