import React, { useEffect, useState } from 'react';
import { ShoppingCart, TrendingUp, AlertCircle, Package, DollarSign, Activity, Users, CheckCircle2, Wifi, RefreshCw, UserCheck, Boxes } from 'lucide-react';
import axios from 'axios';

const API_URL = 'http://localhost:8000/api/v1';

const SKU_CATALOG = {
  'SKU-001': { name: 'Coca Cola 1.5L',                   price: 85.00  },
  'SKU-002': { name: 'Coca Cola 290mL',                  price: 40.00  },
  'SKU-003': { name: 'Datu Puti Soy Sauce 200mL',        price: 30.00  },
  'SKU-004': { name: 'Datu Puti Soy Sauce 385mL',        price: 55.00  },
  'SKU-005': { name: 'Palmolive Soap',                   price: 45.00  },
  'SKU-006': { name: 'Pebbly - Packaged Drinking Water', price: 20.00  },
  'SKU-007': { name: 'Pancit Canton Extra Hot Chili',    price: 15.00  },
  'SKU-008': { name: 'Safeguard Soap',                   price: 50.00  },
};

// ── Session Detail Card ───────────────────────────────────────────────────────
function SessionCard({ session }) {
  const [cartItems, setCartItems] = useState([]);
  useEffect(() => {
    const fetch = async () => {
      try { const res = await axios.get(`${API_URL}/cart/${session.session_id}`); setCartItems(res.data); }
      catch {}
    };
    fetch();
    const t = setInterval(fetch, 3000);
    return () => clearInterval(t);
  }, [session.session_id]);

  const total = cartItems.reduce((s, i) => s + (SKU_CATALOG[i.sku_id]?.price ?? 0) * (i.quantity ?? 1), 0);

  return (
    <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
      <div className="px-8 py-5 bg-slate-950 flex justify-between items-center">
        <div>
          <div className="text-white font-bold text-lg">{session.display_name}</div>
          <div className="text-slate-500 text-xs font-mono mt-0.5 truncate max-w-[200px]">{session.session_id}</div>
        </div>
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 rounded-full">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-emerald-400 text-xs font-bold">{cartItems.length} ITEM{cartItems.length !== 1 ? 'S' : ''}</span>
        </div>
      </div>
      {cartItems.length === 0 ? (
        <div className="p-10 text-center text-slate-400 italic text-sm">Cart is empty</div>
      ) : (
        <table className="w-full text-left">
          <thead>
            <tr className="text-slate-400 text-xs uppercase tracking-widest bg-slate-50/60">
              <th className="px-8 py-4 font-black">Product</th>
              <th className="px-8 py-4 font-black text-right">Price</th>
            </tr>
          </thead>
          <tbody>
            {cartItems.map((item, i) => (
              <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-all">
                <td className="px-8 py-5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                      <Package className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">{SKU_CATALOG[item.sku_id]?.name || item.sku_id}</div>
                      <div className="text-xs text-blue-500/60 font-bold tracking-widest">{item.sku_id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-5 text-right font-black text-slate-700 text-lg">
                  ₹{(SKU_CATALOG[item.sku_id]?.price ?? 0).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {cartItems.length > 0 && (
        <div className="px-8 py-4 bg-blue-600 flex justify-between items-center">
          <span className="text-blue-100 text-sm font-bold uppercase tracking-wide">Cart Total</span>
          <span className="text-white font-black text-xl">₹{total.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}

// ── Root Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [activeTab, setActiveTab]     = useState('live');
  const [sessions, setSessions]       = useState([]);
  const [sales, setSales]             = useState([]);
  const [customers, setCustomers]     = useState([]);
  const [batches, setBatches]         = useState([]);
  const [recentPurchases, setRecentPurchases] = useState([]);
  const [status, setStatus]           = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // New batch form
  const [batchForm, setBatchForm] = useState({ sku_id: 'SKU-001', batch_id: '', expiry_date: '', quantity: '' });
  const [batchMsg, setBatchMsg]   = useState('');
  const [batchErr, setBatchErr]   = useState('');

  // ── Live sessions + recent purchases
  useEffect(() => {
    if (activeTab !== 'live') return;
    const go = async () => {
      try {
        const [s, st, rp] = await Promise.all([
          axios.get(`${API_URL}/sessions/active`),
          axios.get(`${API_URL}/status`),
          axios.get(`${API_URL}/analytics/recent-purchases?limit=20`),
        ]);
        setSessions(s.data); setStatus(st.data);
        setRecentPurchases(rp.data);
        setLastRefresh(new Date());
      } catch {}
    };
    go(); const t = setInterval(go, 4000); return () => clearInterval(t);
  }, [activeTab]);

  // ── Sales analytics
  useEffect(() => {
    if (activeTab !== 'sales') return;
    const go = async () => {
      try { const r = await axios.get(`${API_URL}/analytics/sales-summary`); setSales(r.data); } catch {}
    };
    go(); const t = setInterval(go, 5000); return () => clearInterval(t);
  }, [activeTab]);

  // ── Customer analytics
  useEffect(() => {
    if (activeTab !== 'customers') return;
    const go = async () => {
      try { const r = await axios.get(`${API_URL}/analytics/customers`); setCustomers(r.data); } catch {}
    };
    go(); const t = setInterval(go, 5000); return () => clearInterval(t);
  }, [activeTab]);

  // ── Inventory batches
  useEffect(() => {
    if (activeTab !== 'inventory') return;
    const go = async () => {
      try { const r = await axios.get(`${API_URL}/inventory/batches`); setBatches(r.data); } catch {}
    };
    go();
  }, [activeTab, batchMsg]);

  const handleReceiveBatch = async (e) => {
    e.preventDefault();
    setBatchMsg(''); setBatchErr('');
    if (!batchForm.batch_id || !batchForm.expiry_date || !batchForm.quantity) {
      setBatchErr('All fields are required.'); return;
    }
    try {
      const res = await axios.post(`${API_URL}/inventory/receive`, {
        sku_id: batchForm.sku_id,
        batch_id: batchForm.batch_id,
        expiry_date: batchForm.expiry_date,
        quantity: parseInt(batchForm.quantity),
      });
      setBatchMsg(`✓ Batch "${res.data.batch_id}" recorded — ${res.data.quantity} units of ${res.data.sku_name}`);
      setBatchForm(f => ({ ...f, batch_id: '', expiry_date: '', quantity: '' }));
    } catch (err) {
      setBatchErr(err.response?.data?.detail || 'Failed to record batch.');
    }
  };

  const totalRevenue = sales.reduce((a, i) => a + i.revenue, 0);
  const maxSold = sales.length ? Math.max(...sales.map(s => s.total_sold)) : 1;

  const navItems = [
    { id: 'live',      icon: <Activity className="w-5 h-5" />,   label: 'Live Monitor'  },
    { id: 'sales',     icon: <TrendingUp className="w-5 h-5" />, label: 'Business Intelligence' },
    { id: 'customers', icon: <UserCheck className="w-5 h-5" />,  label: 'Customer Analytics' },
    { id: 'inventory', icon: <Boxes className="w-5 h-5" />,      label: 'Inventory Manager' },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-slate-900">

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside className="w-72 bg-slate-950 text-white flex flex-col shadow-2xl">
        <div className="p-8">
          <h1 className="text-xl font-black tracking-tight uppercase italic mb-10">
            Aisle<span className="text-blue-500">IQ</span>
          </h1>
          <nav className="space-y-2">
            {navItems.map(n => (
              <button key={n.id} onClick={() => setActiveTab(n.id)}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 text-left
                  ${activeTab === n.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}>
                {n.icon}<span className="font-semibold tracking-wide">{n.label}</span>
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-auto p-6 bg-slate-900/50 border-t border-slate-800 space-y-3">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${status?.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              {status?.status === 'online' ? 'Backend Online' : 'Connecting…'}
            </span>
          </div>
          {status && (
            <>
              <div className="text-xs text-slate-500"><span className="font-bold text-slate-300">{status.active_sessions}</span> active sessions</div>
              <div className="text-xs text-slate-500"><span className="font-bold text-slate-300">{status.total_items}</span> items in carts</div>
              <div className="text-xs text-slate-600">Updated {lastRefresh.toLocaleTimeString()}</div>
            </>
          )}
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────────────── */}
      <main className="flex-1 p-10 overflow-y-auto">

        {/* ── LIVE MONITOR ── */}
        {activeTab === 'live' && (
          <div className="max-w-7xl mx-auto">
            <header className="flex justify-between items-end mb-10">
              <div>
                <h2 className="text-4xl font-extrabold tracking-tight">Store Front <span className="text-blue-600">Live</span></h2>
                <p className="text-slate-500 mt-2">Real-time view of all active shopping sessions</p>
              </div>
              <div className="bg-white px-5 py-2.5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3">
                <Users className="w-5 h-5 text-blue-500" />
                <span className="font-bold text-slate-700">{sessions.length} Active Shopper{sessions.length !== 1 ? 's' : ''}</span>
              </div>
            </header>

            {/* Two-column layout: sessions left, recent purchases right */}
            <div className="flex gap-8 items-start">
              {/* Session cards */}
              <div className="flex-1">
                {sessions.length === 0 ? (
                  <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-24 text-center">
                    <Users className="w-16 h-16 text-slate-200 mx-auto mb-6" />
                    <p className="text-slate-400 italic text-lg">No active shoppers right now.</p>
                    <p className="text-slate-300 text-sm mt-2">Sessions appear when a user taps "Start Shopping".</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    {sessions.map(s => <SessionCard key={s.session_id} session={s} />)}
                  </div>
                )}
              </div>

              {/* Recent Purchases Feed */}
              <div className="w-96 flex-shrink-0">
                <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden sticky top-0">
                  <div className="px-6 py-5 bg-slate-950 flex items-center justify-between">
                    <div>
                      <div className="text-white font-black uppercase tracking-wider text-sm">Recent Purchases</div>
                      <div className="text-slate-500 text-xs mt-0.5">All customers · Live</div>
                    </div>
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,.8)]" />
                  </div>
                  <div className="divide-y divide-slate-50 max-h-[680px] overflow-y-auto">
                    {recentPurchases.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-sm italic">No purchases yet.</div>
                    ) : recentPurchases.map((p, i) => {
                      const dt    = p.purchase_date ? new Date(p.purchase_date) : null;
                      const mins  = dt ? Math.round((Date.now() - dt) / 60000) : null;
                      const when  = mins === null ? '' : mins < 1 ? 'just now' : mins < 60 ? `${mins}m ago` : `${Math.round(mins/60)}h ago`;
                      return (
                        <div key={i} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50/60 transition-all">
                          {/* Avatar */}
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-base flex-shrink-0 mt-0.5">
                            {(p.user_id || '?')[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="font-bold text-slate-800 text-sm truncate">{p.name}</span>
                              <span className="text-emerald-600 font-black text-sm whitespace-nowrap">₹{(p.price * p.quantity).toFixed(0)}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-slate-400">@{p.user_id}</span>
                              <span className="text-slate-200">·</span>
                              <span className="text-xs text-slate-400">qty {p.quantity}</span>
                              {when && <><span className="text-slate-200">·</span><span className="text-xs text-blue-400">{when}</span></>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── BUSINESS INTELLIGENCE ── */}
        {activeTab === 'sales' && (
          <div className="max-w-5xl mx-auto">
            <header className="mb-10">
              <h2 className="text-5xl font-black tracking-tighter uppercase italic">Aisle<span className="text-blue-600">Analytics</span></h2>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Real Transaction Data · All-Time</p>
            </header>

            {/* Revenue hero */}
            <div className="bg-slate-950 rounded-[3rem] p-12 mb-12 text-white flex justify-between items-center relative overflow-hidden shadow-2xl shadow-blue-900/30">
              <div className="relative z-10">
                <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-xs mb-4">Total Revenue (All Time)</p>
                <h3 className="text-8xl font-black tabular-nums tracking-tighter italic">₹{totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
              </div>
              <div className="w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] absolute -right-20 -top-20" />
              <div className="relative z-10 text-right">
                <div className="text-slate-400 text-sm font-bold">{sales.reduce((a, s) => a + s.total_sold, 0)} units sold</div>
                <div className="text-slate-500 text-xs mt-1">{sales.length} SKUs tracked</div>
              </div>
            </div>

            <div className="flex flex-col gap-12">
              {/* Velocity Ranking — real data */}
              <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100">
                <h3 className="text-2xl font-black mb-10 flex items-center gap-4 uppercase">
                  <Activity className="text-blue-500 w-8 h-8" /> Velocity Ranking
                </h3>
                {sales.length === 0 ? (
                  <p className="text-slate-400 italic text-center py-8">No sales data yet — checkout some items on the mobile app!</p>
                ) : (
                  <div className="space-y-8">
                    {[...sales].sort((a, b) => b.total_sold - a.total_sold).map((item, i) => (
                      <div key={i}>
                        <div className="flex justify-between items-end mb-3">
                          <div>
                            <span className="font-black text-slate-900 text-lg block">{item.name}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.sku_id}</span>
                          </div>
                          <span className="text-blue-600 font-black text-sm bg-blue-50 px-4 py-1.5 rounded-xl border border-blue-100">{item.total_sold} units</span>
                        </div>
                        <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden shadow-inner p-1">
                          <div className="h-full bg-gradient-to-r from-blue-400 to-indigo-600 rounded-full transition-all duration-1000"
                            style={{ width: `${Math.max((item.total_sold / maxSold) * 100, 2)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Revenue Contribution */}
              <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100">
                <h3 className="text-2xl font-black mb-10 flex items-center gap-4 uppercase">
                  <TrendingUp className="text-purple-600 w-8 h-8" /> Revenue Contribution
                </h3>
                {sales.length === 0 ? (
                  <p className="text-slate-400 italic text-center py-8">No revenue data yet.</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {sales.map((item, i) => {
                      const pct = Math.round((item.revenue / (totalRevenue || 1)) * 100);
                      return (
                        <div key={i} className="flex flex-col items-center p-6 bg-slate-50 rounded-[2rem] text-center border border-slate-100 hover:shadow-xl hover:scale-105 transition-all duration-300">
                          <div className="relative w-24 h-24 mb-4">
                            <svg className="w-full h-full -rotate-90">
                              <circle cx="48" cy="48" r="42" stroke="#e2e8f0" strokeWidth="8" fill="transparent" />
                              <circle cx="48" cy="48" r="42" stroke="#7c3aed" strokeWidth="10" fill="transparent"
                                strokeDasharray="263.9" strokeDashoffset={263.9 - (263.9 * pct / 100)}
                                strokeLinecap="round" className="transition-all duration-1000" />
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-xl font-black text-purple-900">{pct}%</span>
                          </div>
                          <span className="text-xs font-black text-slate-500 uppercase leading-tight">{item.name}</span>
                          <span className="text-emerald-600 font-black text-lg mt-2">₹{item.revenue.toFixed(0)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SKU Financials table */}
              <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100 mb-4">
                <h3 className="text-2xl font-black mb-10 flex items-center gap-4 uppercase">
                  <DollarSign className="text-emerald-500 w-8 h-8" /> SKU Financials
                </h3>
                <div className="space-y-5">
                  {sales.map((item, i) => (
                    <div key={i} className="flex justify-between items-center p-8 bg-emerald-50/30 border border-emerald-100/50 rounded-[2rem] hover:bg-emerald-50 transition-all group">
                      <div className="flex items-center gap-6">
                        <div className="p-4 bg-white rounded-2xl shadow-sm border border-emerald-100">
                          <Package className="w-8 h-8 text-emerald-600" />
                        </div>
                        <div>
                          <span className="font-black text-slate-900 text-2xl block">{item.name}</span>
                          <span className="text-xs font-bold text-blue-500 uppercase tracking-widest">{item.sku_id} · {item.total_sold} units sold</span>
                        </div>
                      </div>
                      <span className="font-black text-emerald-700 text-4xl tabular-nums">₹{item.revenue.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── CUSTOMER ANALYTICS ── */}
        {activeTab === 'customers' && (
          <div className="max-w-5xl mx-auto">
            <header className="mb-10">
              <h2 className="text-5xl font-black tracking-tighter uppercase italic">Customer <span className="text-blue-600">Insights</span></h2>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Per-user purchase behaviour · Real data</p>
            </header>

            {customers.length === 0 ? (
              <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-24 text-center">
                <UserCheck className="w-16 h-16 text-slate-200 mx-auto mb-6" />
                <p className="text-slate-400 italic text-lg">No customer data yet.</p>
                <p className="text-slate-300 text-sm mt-2">Data appears here after users checkout on the mobile app.</p>
              </div>
            ) : (
              <>
                {/* Summary bar */}
                <div className="grid grid-cols-3 gap-6 mb-10">
                  {[
                    { label: 'Total Customers', value: customers.length, color: 'text-blue-600' },
                    { label: 'Total Revenue', value: `₹${customers.reduce((a, c) => a + c.total_spend, 0).toFixed(0)}`, color: 'text-emerald-600' },
                    { label: 'Avg Spend / Customer', value: `₹${(customers.reduce((a, c) => a + c.total_spend, 0) / customers.length).toFixed(0)}`, color: 'text-purple-600' },
                  ].map((s, i) => (
                    <div key={i} className="bg-white rounded-[2rem] shadow-lg border border-slate-100 p-8 text-center">
                      <div className={`text-4xl font-black tabular-nums ${s.color}`}>{s.value}</div>
                      <div className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Customer cards */}
                <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden">
                  <div className="px-10 py-6 bg-slate-950 flex gap-6 text-xs font-black uppercase tracking-widest text-slate-400">
                    <span className="w-10">#</span>
                    <span className="flex-1">User</span>
                    <span className="w-24 text-right">Items</span>
                    <span className="w-32 text-right">Total Spent</span>
                    <span className="w-48 text-right hidden lg:block">Favourite Item</span>
                  </div>
                  {customers.map((c, i) => (
                    <div key={i} className="flex items-center gap-6 px-10 py-6 border-b border-slate-50 hover:bg-slate-50/50 transition-all">
                      {/* Rank */}
                      <span className={`w-10 text-2xl font-black tabular-nums ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-amber-700' : 'text-slate-300'}`}>
                        {i + 1}
                      </span>
                      {/* Avatar + name */}
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xl flex-shrink-0">
                          {(c.user_id || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-lg">{c.user_id}</div>
                          <div className="text-xs text-slate-400">{c.last_purchase ? `Last: ${new Date(c.last_purchase).toLocaleDateString('en-IN')}` : 'No date'}</div>
                        </div>
                      </div>
                      {/* Items */}
                      <div className="w-24 text-right">
                        <span className="font-black text-slate-700 text-xl">{c.total_items}</span>
                        <span className="text-xs text-slate-400 block">items</span>
                      </div>
                      {/* Spend */}
                      <div className="w-32 text-right">
                        <span className="font-black text-emerald-600 text-xl">₹{c.total_spend.toFixed(0)}</span>
                      </div>
                      {/* Fav item */}
                      <div className="w-48 text-right hidden lg:block">
                        <span className="text-xs text-slate-500 font-medium">{c.top_sku || '—'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── INVENTORY MANAGER ── */}
        {activeTab === 'inventory' && (
          <div className="max-w-5xl mx-auto">
            <header className="mb-10">
              <h2 className="text-5xl font-black tracking-tighter uppercase italic">Inventory <span className="text-blue-600">Manager</span></h2>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">FIFO Batch Tracking · Log Stock Arrivals</p>
            </header>

            {/* Receive batch form */}
            <div className="bg-slate-950 p-10 rounded-[2.5rem] mb-10 shadow-2xl">
              <h3 className="text-white font-black text-2xl mb-8 uppercase">📦 Receive New Stock Batch</h3>
              <form onSubmit={handleReceiveBatch} className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-slate-400 text-xs font-black uppercase tracking-widest block mb-2">Product (SKU)</label>
                  <select value={batchForm.sku_id}
                    onChange={e => setBatchForm(f => ({ ...f, sku_id: e.target.value }))}
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-2xl px-5 py-3.5 font-semibold focus:outline-none focus:border-blue-500">
                    {Object.entries(SKU_CATALOG).map(([id, s]) => (
                      <option key={id} value={id}>{s.name} ({id})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 text-xs font-black uppercase tracking-widest block mb-2">Batch ID</label>
                  <input type="text" placeholder="e.g. BATCH-2025-07A"
                    value={batchForm.batch_id}
                    onChange={e => setBatchForm(f => ({ ...f, batch_id: e.target.value }))}
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-2xl px-5 py-3.5 font-semibold focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs font-black uppercase tracking-widest block mb-2">Expiry Date</label>
                  <input type="date" value={batchForm.expiry_date}
                    onChange={e => setBatchForm(f => ({ ...f, expiry_date: e.target.value }))}
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-2xl px-5 py-3.5 font-semibold focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs font-black uppercase tracking-widest block mb-2">Quantity Received</label>
                  <input type="number" min="1" placeholder="e.g. 200"
                    value={batchForm.quantity}
                    onChange={e => setBatchForm(f => ({ ...f, quantity: e.target.value }))}
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-2xl px-5 py-3.5 font-semibold focus:outline-none focus:border-blue-500" />
                </div>
                <div className="col-span-2">
                  {batchMsg && <p className="text-emerald-400 font-bold text-sm mb-3">{batchMsg}</p>}
                  {batchErr && <p className="text-red-400 font-bold text-sm mb-3">{batchErr}</p>}
                  <button type="submit"
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-xl rounded-2xl transition-all duration-200 shadow-lg shadow-blue-600/30">
                    Record Batch →
                  </button>
                </div>
              </form>
            </div>

            {/* Batch list */}
            <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
              <div className="px-10 py-6 bg-slate-950 flex gap-4 text-xs font-black uppercase tracking-widest text-slate-400">
                <span className="flex-1">Product</span>
                <span className="w-36">Batch ID</span>
                <span className="w-32 text-center">Expiry</span>
                <span className="w-28 text-right">Remaining</span>
                <span className="w-28 text-right">Received</span>
              </div>
              {batches.length === 0 ? (
                <div className="p-12 text-center text-slate-400 italic">No batches logged yet. Add your first batch above.</div>
              ) : (
                batches.map((b, i) => {
                  const exp   = new Date(b.expiry_date);
                  const days  = Math.ceil((exp - new Date()) / 86400000);
                  const color = days <= 30 ? 'text-red-500' : days <= 90 ? 'text-amber-500' : 'text-emerald-600';
                  const pct   = Math.round((b.quantity_remaining / b.quantity_received) * 100);
                  return (
                    <div key={i} className="flex items-center gap-4 px-10 py-6 border-b border-slate-50 hover:bg-slate-50/50">
                      <div className="flex-1">
                        <div className="font-bold text-slate-900">{b.sku_name}</div>
                        <div className="text-xs text-blue-500 font-bold">{b.sku_id}</div>
                      </div>
                      <div className="w-36 font-mono text-xs text-slate-500">{b.batch_id}</div>
                      <div className={`w-32 text-center font-black text-sm ${color}`}>
                        {exp.toLocaleDateString('en-IN')}<br />
                        <span className="text-xs font-medium">{days > 0 ? `${days}d left` : 'EXPIRED'}</span>
                      </div>
                      <div className="w-28 text-right">
                        <span className="font-black text-xl text-slate-700">{b.quantity_remaining}</span>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1">
                          <div className={`h-full rounded-full transition-all ${pct > 50 ? 'bg-emerald-500' : pct > 20 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="w-28 text-right text-slate-400 text-sm">{b.quantity_received} rcvd</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}