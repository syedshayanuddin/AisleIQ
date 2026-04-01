import React, { useEffect, useState } from 'react';
import { Camera, ShoppingCart, TrendingUp, AlertCircle, Package } from 'lucide-react';
import axios from 'axios';

const API_URL = 'http://localhost:8000/api/v1';

// Mirrors the LABEL_TO_SKU mapping in api_client.py
const SKU_CATALOG = {
  'SKU-001': { name: 'Coca Cola 1.5L', price: 85.00 },
  'SKU-002': { name: 'Coca Cola 290mL', price: 40.00 },
  'SKU-003': { name: 'Datu Puti Soy Sauce 200mL', price: 30.00 },
  'SKU-004': { name: 'Datu Puti Soy Sauce 385mL', price: 55.00 },
  'SKU-005': { name: 'Palmolive Soap', price: 45.00 },
  'SKU-006': { name: 'Pancit Canton Chilimansi', price: 15.00 },
  'SKU-007': { name: 'Pancit Canton Extra Hot Chili', price: 15.00 },
  'SKU-008': { name: 'Safeguard Soap', price: 50.00 },
  'SKU-000': { name: 'Unknown Item', price: 0.00 },
};

function skuName(id) { return SKU_CATALOG[id]?.name ?? id; }
function skuPrice(id) { return SKU_CATALOG[id]?.price ?? 0; }

export default function Dashboard() {
  const [carts, setCarts] = useState([]);

  useEffect(() => {
    // In a real app we'd fetch active sessions and their carts
    // For MVP, hardcoding our test session ID
    const MOCK_SESSION = '69a7633f26e35f1ab5ab2916';

    const fetchCart = async () => {
      try {
        const cartRes = await axios.get(`${API_URL}/cart/${MOCK_SESSION}`);
        setCarts(cartRes.data);
      } catch (err) {
        console.error("Could not fetch cart:", err);
      }
    };

    fetchCart();
    // Poll every 2 seconds for live vision updates
    const interval = setInterval(fetchCart, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-md">
        <div className="p-6 border-b">
          <h1 className="text-2xl font-bold text-blue-600 flex items-center gap-2">
            <Camera className="w-8 h-8" /> AisleIQ
          </h1>
        </div>
        <nav className="p-4 space-y-2">
          <a href="#" className="flex items-center gap-3 p-3 bg-blue-50 text-blue-700 rounded-lg font-medium">
            <ShoppingCart className="w-5 h-5" /> Live Sessions
          </a>
          <a href="#" className="flex items-center gap-3 p-3 text-gray-600 hover:bg-gray-100 rounded-lg">
            <Package className="w-5 h-5" /> Inventory Mgmt
          </a>
          <a href="#" className="flex items-center gap-3 p-3 text-gray-600 hover:bg-gray-100 rounded-lg">
            <TrendingUp className="w-5 h-5" /> Sales Analytics
          </a>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Live Store Monitoring</h2>
            <p className="text-gray-500 mt-1">Real-time cart updates from vision edge nodes.</p>
          </div>
          <div className="flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2 rounded-full font-medium">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            System Online
          </div>
        </header>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-gray-500 font-medium text-sm mb-2">Active Shoppers</h3>
            <p className="text-3xl font-bold text-gray-800">1</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-gray-500 font-medium text-sm mb-2">Items Picked Today</h3>
            <p className="text-3xl font-bold text-blue-600">{carts.length}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-gray-500 font-medium text-sm mb-2">System Accuracy (Est.)</h3>
            <p className="text-3xl font-bold text-green-600">98.4%</p>
          </div>
        </div>

        {/* Live Cart Feed */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-blue-500" />
              Live Cart Feed: Session user_123
            </h3>
            <span className="text-sm font-medium text-gray-500">{carts.length} items total</span>
          </div>

          <div className="p-0">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-sm">
                  <th className="p-4 border-b font-medium">Product Name</th>
                  <th className="p-4 border-b font-medium">SKU</th>
                  <th className="p-4 border-b font-medium">Price</th>
                  <th className="p-4 border-b font-medium">Time Added</th>
                  <th className="p-4 border-b font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {carts.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="p-8 text-center text-gray-400">
                      Cart is currently empty. Waiting for vision node...
                    </td>
                  </tr>
                ) : (
                  carts.map((item, i) => (
                    <tr key={i} className="hover:bg-gray-50 border-b last:border-0 transition-colors">
                      <td className="p-4 font-medium text-gray-800">{skuName(item.sku_id)}</td>
                      <td className="p-4 font-mono text-xs text-gray-400">{item.sku_id}</td>
                      <td className="p-4 text-gray-700 font-medium">₹{skuPrice(item.sku_id).toFixed(2)}</td>
                      <td className="p-4 text-gray-600 text-sm">
                        {new Date(item.added_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {item.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
