import React, { useEffect, useState } from 'react';
import { ShoppingCart, TrendingUp, AlertCircle, Package, DollarSign, Activity, Users, CheckCircle2, Wifi, RefreshCw } from 'lucide-react';
import axios from 'axios';

const API_URL = 'http://localhost:8000/api/v1';

const SKU_CATALOG = {
  'SKU-001': { name: 'Coca Cola 1.5L',               price: 85.00 },
  'SKU-002': { name: 'Coca Cola 290mL',               price: 40.00 },
  'SKU-003': { name: 'Datu Puti Soy Sauce 200mL',     price: 30.00 },
  'SKU-004': { name: 'Datu Puti Soy Sauce 385mL',     price: 55.00 },
  'SKU-005': { name: 'Palmolive Soap',                price: 45.00 },
  'SKU-006': { name: 'Pancit Canton Chilimansi',      price: 15.00 },
  'SKU-007': { name: 'Pancit Canton Extra Hot Chili', price: 15.00 },
  'SKU-008': { name: 'Safeguard Soap',                price: 50.00 },
};

// ── Session Detail Card ───────────────────────────────────────────────────────
function SessionCard({ session }) {
  const [cartItems, setCartItems] = useState([]);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await axios.get(`${API_URL}/cart/${session.session_id}`);
        setCartItems(res.data);
      } catch { }
    };
    fetch();
    const t = setInterval(fetch, 3000);
    return () => clearInterval(t);
  }, [session.session_id]);

  const total = cartItems.reduce((s, i) => s + (SKU_CATALOG[i.sku_id]?.price ?? 0) * (i.quantity ?? 1), 0);

  return (
    <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
      {/* Session header */}
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

      {/* Cart items */}
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

      {/* Total */}
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
  const [status, setStatus]           = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Live sessions + system status
  useEffect(() => {
    if (activeTab !== 'live') return;
    const fetchLive = async () => {
      try {
        const [sessRes, statRes] = await Promise.all([
          axios.get(`${API_URL}/sessions/active`),
          axios.get(`${API_URL}/status`),
        ]);
        setSessions(sessRes.data);
        setStatus(statRes.data);
        setLastRefresh(new Date());
      } catch (err) { console.error('Live fetch error:', err); }
    };
    fetchLive();
    const t = setInterval(fetchLive, 3000);
    return () => clearInterval(t);
  }, [activeTab]);

  // Sales analytics
  useEffect(() => {
    if (activeTab !== 'sales') return;
    const fetchSales = async () => {
      try {
        const res = await axios.get(`${API_URL}/analytics/sales-summary`);
        setSales(res.data);
      } catch (err) { console.error('Sales fetch error:', err); }
    };
    fetchSales();
    const t = setInterval(fetchSales, 5000);
    return () => clearInterval(t);
  }, [activeTab]);

  const totalRevenue = sales.reduce((acc, i) => acc + i.revenue, 0);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-slate-900">

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="w-72 bg-slate-950 text-white flex flex-col shadow-2xl">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-10">
            <h1 className="text-xl font-black tracking-tight uppercase italic">Aisle<span className="text-blue-500">IQ</span></h1>
          </div>
          <nav className="space-y-2">
            <button onClick={() => setActiveTab('live')}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 ${activeTab === 'live' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}>
              <Activity className="w-5 h-5" /> <span className="font-semibold tracking-wide">Live Monitor</span>
            </button>
            <button onClick={() => setActiveTab('sales')}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 ${activeTab === 'sales' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}>
              <TrendingUp className="w-5 h-5" /> <span className="font-semibold tracking-wide">Business Intelligence</span>
            </button>
          </nav>
        </div>

        {/* Status panel */}
        <div className="mt-auto p-6 bg-slate-900/50 border-t border-slate-800 space-y-3">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${status?.status === 'online' ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`} />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              {status?.status === 'online' ? 'Backend Online' : 'Connecting…'}
            </span>
          </div>
          {status && (
            <>
              <div className="text-xs text-slate-500">
                <span className="font-bold text-slate-300">{status.active_sessions}</span> active session{status.active_sessions !== 1 ? 's' : ''}
              </div>
              <div className="text-xs text-slate-500">
                <span className="font-bold text-slate-300">{status.total_items}</span> items in carts
              </div>
              <div className="text-xs text-slate-600">
                Updated {lastRefresh.toLocaleTimeString()}
              </div>
            </>
          )}
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────────────── */}
      <main className="flex-1 p-10 overflow-y-auto">

        {activeTab === 'live' ? (
          <div className="max-w-6xl mx-auto animate-in fade-in duration-500">
            {/* Header */}
            <header className="flex justify-between items-end mb-10">
              <div>
                <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">Store Front <span className="text-blue-600">Live</span></h2>
                <p className="text-slate-500 font-medium mt-2">Real-time view of all active shopping sessions</p>
              </div>
              <div className="bg-white px-5 py-2.5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3">
                <Users className="w-5 h-5 text-blue-500" />
                <span className="font-bold text-slate-700">{sessions.length} Active Shopper{sessions.length !== 1 ? 's' : ''}</span>
              </div>
            </header>

            {/* Session cards */}
            {sessions.length === 0 ? (
              <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-24 text-center">
                <Users className="w-16 h-16 text-slate-200 mx-auto mb-6" />
                <p className="text-slate-400 font-medium italic text-lg">No active shoppers right now.</p>
                <p className="text-slate-300 text-sm mt-2">Sessions appear here when a user opens the mobile app and detection starts.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {sessions.map(session => (
                  <SessionCard key={session.session_id} session={session} />
                ))}
              </div>
            )}
          </div>

        ) : (
          <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-6 duration-700">
            <header className="mb-10">
              <h2 className="text-5xl font-black tracking-tighter text-slate-950 uppercase italic">Aisle<span className="text-blue-600">Analytics</span></h2>
              <p className="text-slate-500 font-medium mt-2 tracking-wide uppercase text-xs font-bold">Historical Performance & Financial Insights</p>
            </header>

            {/* Total Revenue */}
            <div className="bg-slate-950 rounded-[3rem] p-12 mb-12 text-white flex justify-between items-center relative overflow-hidden shadow-2xl shadow-blue-900/30">
              <div className="relative z-10">
                <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-xs mb-4">Gross Projected Revenue</p>
                <h3 className="text-8xl font-black tabular-nums tracking-tighter italic">₹{totalRevenue.toLocaleString()}</h3>
              </div>
              <div className="w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] absolute -right-20 -top-20" />
              <div className="relative z-10 text-right">
                <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-6 py-3 rounded-[1.5rem] font-black text-3xl mb-3 inline-block shadow-lg">+12.4%</div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em]">Efficiency Growth</p>
              </div>
            </div>

            <div className="flex flex-col gap-12">
              {/* Velocity Ranking */}
              <div className="bg-white p-12 rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-100">
                <h3 className="text-2xl font-black mb-10 flex items-center gap-4 text-slate-800 uppercase tracking-tight">
                  <Activity className="text-blue-500 w-8 h-8" /> Velocity Ranking
                </h3>
                <div className="space-y-10">
                  {[...sales].sort((a, b) => b.total_sold - a.total_sold).map((item, i) => (
                    <div key={i}>
                      <div className="flex justify-between items-end mb-4">
                        <div>
                          <span className="font-black text-slate-900 text-xl tracking-tight block">{item.name}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Demand Index</span>
                        </div>
                        <span className="text-blue-600 font-black text-sm bg-blue-50 px-4 py-1.5 rounded-xl border border-blue-100">{item.total_sold} UNITS SOLD</span>
                      </div>
                      <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden shadow-inner p-1">
                        <div
                          className="h-full bg-gradient-to-r from-blue-400 via-blue-600 to-indigo-600 rounded-full transition-all duration-1000 ease-out shadow-lg"
                          style={{ width: `${Math.min((item.total_sold / 100) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Revenue Contribution */}
              <div className="bg-white p-12 rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-100">
                <h3 className="text-2xl font-black mb-10 flex items-center gap-4 text-slate-800 uppercase tracking-tight">
                  <TrendingUp className="text-purple-600 w-8 h-8" /> Revenue Contribution Share
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                  {sales.map((item, i) => {
                    const pct = Math.round((item.revenue / (totalRevenue || 1)) * 100);
                    return (
                      <div key={i} className="flex flex-col items-center p-8 bg-slate-50 rounded-[2.5rem] text-center border border-slate-100 hover:bg-white hover:shadow-xl hover:scale-105 transition-all duration-300">
                        <div className="relative w-28 h-28 mb-6">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="56" cy="56" r="50" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-200" />
                            <circle cx="56" cy="56" r="50" stroke="currentColor" strokeWidth="10" fill="transparent"
                              strokeDasharray="314.15" strokeDashoffset={314.15 - (314.15 * (pct / 100))}
                              strokeLinecap="round" className="text-purple-600 transition-all duration-1000" />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-2xl font-black text-purple-900">{pct}%</span>
                        </div>
                        <span className="text-xs font-black text-slate-500 uppercase tracking-tighter leading-tight px-2">{item.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SKU Financials */}
              <div className="bg-white p-12 rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-100 mb-10">
                <h3 className="text-2xl font-black mb-10 flex items-center gap-4 text-slate-800 uppercase tracking-tight">
                  <DollarSign className="text-emerald-500 w-8 h-8" /> Detailed SKU Financials
                </h3>
                <div className="space-y-5">
                  {sales.map((item, i) => (
                    <div key={i} className="flex justify-between items-center p-8 bg-emerald-50/30 border border-emerald-100/50 rounded-[2rem] hover:bg-emerald-50/60 transition-all group">
                      <div className="flex items-center gap-6">
                        <div className="p-4 bg-white rounded-2xl shadow-sm border border-emerald-100 group-hover:scale-110 transition-transform">
                          <Package className="w-8 h-8 text-emerald-600" />
                        </div>
                        <div>
                          <span className="font-black text-slate-900 text-2xl block tracking-tight">{item.name}</span>
                          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-[0.2em]">Verified Transaction Data</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-emerald-700 text-4xl block tabular-nums">₹{item.revenue.toFixed(2)}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Financial Impact</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}