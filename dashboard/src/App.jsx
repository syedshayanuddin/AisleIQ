import React, { useEffect, useState } from 'react';
import { Camera, ShoppingCart, TrendingUp, AlertCircle, Package, DollarSign, Activity, Users, CheckCircle2 } from 'lucide-react';
import axios from 'axios';

const API_URL = 'http://localhost:8000/api/v1';

const SKU_CATALOG = {
  'SKU-001': { name: 'Coca Cola 1.5L', price: 85.00 },
  'SKU-006': { name: 'Pancit Canton Chilimansi', price: 10.00 },
  'SKU-008': { name: 'Safeguard Soap', price: 50.00 },
  'SKU-003': { name: 'Datu Puti Soy Sauce 200mL', price: 30.00 },
};

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('live'); 
  const [carts, setCarts] = useState([]);
  const [sales, setSales] = useState([]);

  useEffect(() => {
    const MOCK_SESSION = '69a7633f26e35f1ab5ab2916';
    const fetchData = async () => {
      try {
        if (activeTab === 'live') {
          const res = await axios.get(`${API_URL}/cart/${MOCK_SESSION}`);
          setCarts(res.data);
        } else {
          const res = await axios.get(`${API_URL}/analytics/sales-summary`);
          setSales(res.data);
        }
      } catch (err) { console.error("Fetch error:", err); }
    };
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const totalRevenue = sales.reduce((acc, item) => acc + item.revenue, 0);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-slate-900">
      {/* Sidebar - Professional Dark Theme */}
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
        
        <div className="mt-auto p-6 bg-slate-900/50 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Vision Node Active</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-10 overflow-y-auto">
        {activeTab === 'live' ? (
          <div className="max-w-6xl mx-auto animate-in fade-in duration-500">
            <header className="flex justify-between items-end mb-10">
              <div>
                <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">Store Front <span className="text-blue-600">Live</span></h2>
                <p className="text-slate-500 font-medium mt-2 italic">Scanning Session: <span className="text-slate-900 not-italic font-bold tracking-wider">user_123</span></p>
              </div>
              <div className="bg-white px-5 py-2.5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3">
                <Users className="w-5 h-5 text-blue-500" />
                <span className="font-bold text-slate-700">1 Active Shopper</span>
              </div>
            </header>

            {/* Live Feed Table */}
            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                <h3 className="font-bold text-xl text-slate-800 flex items-center gap-3">
                  <ShoppingCart className="text-blue-600" /> Real-time Cart Feed
                </h3>
                <span className="bg-blue-600 text-white px-4 py-1 rounded-full font-black text-sm shadow-md shadow-blue-200">{carts.length} ITEMS</span>
              </div>
              
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-400 text-xs uppercase tracking-[0.2em] bg-slate-50/50">
                    <th className="px-10 py-5 font-black">Product Identification</th>
                    <th className="px-10 py-5 font-black text-right">Unit Price</th>
                    <th className="px-10 py-5 font-black text-center">Vision Status</th>
                  </tr>
                </thead>
                <tbody>
                  {carts.length === 0 ? (
                    <tr><td colSpan="3" className="p-24 text-center text-slate-400 font-medium italic tracking-wide">Waiting for edge node detections...</td></tr>
                  ) : (
                    carts.map((item, i) => (
                      <tr key={i} className="group hover:bg-slate-50/80 transition-all border-b border-slate-50 last:border-0">
                        <td className="px-10 py-7">
                          <div className="flex items-center gap-5">
                            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center group-hover:bg-white group-hover:shadow-md transition-all">
                              <Package className="w-7 h-7 text-slate-400" />
                            </div>
                            <div>
                              <div className="font-bold text-slate-800 text-xl tracking-tight">{SKU_CATALOG[item.sku_id]?.name || item.sku_id}</div>
                              <div className="text-xs font-black text-blue-500/60 tracking-widest uppercase">SKU: {item.sku_id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-10 py-7 text-right font-black text-slate-700 text-2xl tabular-nums">₹{(SKU_CATALOG[item.sku_id]?.price || 0).toFixed(2)}</td>
                        <td className="px-10 py-7">
                          <div className="flex justify-center">
                            <span className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm shadow-emerald-100">
                              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                              IN_CART
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-6 duration-700">
            <header className="mb-10">
              <h2 className="text-5xl font-black tracking-tighter text-slate-950 uppercase italic">Aisle<span className="text-blue-600">Analytics</span></h2>
              <p className="text-slate-500 font-medium mt-2 tracking-wide uppercase text-xs font-bold">Historical Performance & Financial Insights</p>
            </header>

            {/* Total Revenue Section */}
            <div className="bg-slate-950 rounded-[3rem] p-12 mb-12 text-white flex justify-between items-center relative overflow-hidden shadow-2xl shadow-blue-900/30">
              <div className="relative z-10">
                <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-xs mb-4">Gross Projected Revenue</p>
                <h3 className="text-8xl font-black tabular-nums tracking-tighter italic">₹{totalRevenue.toLocaleString()}</h3>
              </div>
              <div className="w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] absolute -right-20 -top-20"></div>
              <div className="relative z-10 text-right">
                <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-6 py-3 rounded-[1.5rem] font-black text-3xl mb-3 inline-block shadow-lg">
                  +12.4%
                </div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em]">Efficiency Growth</p>
              </div>
            </div>

            {/* Vertical Layout Sections */}
            <div className="flex flex-col gap-12">
              
              {/* 1. Velocity Ranking (Progress Bars) */}
              <div className="bg-white p-12 rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-100">
                <h3 className="text-2xl font-black mb-10 flex items-center gap-4 text-slate-800 uppercase tracking-tight">
                  <Activity className="text-blue-500 w-8 h-8" /> Velocity Ranking
                </h3>
                <div className="space-y-10">
                  {sales.sort((a, b) => b.total_sold - a.total_sold).map((item, i) => (
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

              {/* 2. Profit Share (Circular Distribution) */}
              <div className="bg-white p-12 rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-100">
                <h3 className="text-2xl font-black mb-10 flex items-center gap-4 text-slate-800 uppercase tracking-tight">
                  <TrendingUp className="text-purple-600 w-8 h-8" /> Revenue Contribution Share
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                  {sales.map((item, i) => {
                    const percentage = Math.round((item.revenue / (totalRevenue || 1)) * 100);
                    return (
                      <div key={i} className="flex flex-col items-center p-8 bg-slate-50 rounded-[2.5rem] text-center border border-slate-100 hover:bg-white hover:shadow-xl hover:scale-105 transition-all duration-300">
                        <div className="relative w-28 h-28 mb-6">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="56" cy="56" r="50" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-200" />
                            <circle cx="56" cy="56" r="50" stroke="currentColor" strokeWidth="10" fill="transparent" 
                              strokeDasharray="314.15" 
                              strokeDashoffset={314.15 - (314.15 * (percentage / 100))}
                              strokeLinecap="round" className="text-purple-600 transition-all duration-1000" />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-2xl font-black text-purple-900">{percentage}%</span>
                        </div>
                        <span className="text-xs font-black text-slate-500 uppercase tracking-tighter leading-tight px-2">{item.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. Detailed SKU Financials (Detailed List) */}
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