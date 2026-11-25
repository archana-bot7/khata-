import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';

const API = 'http://localhost:4000/api';
const money = n => 'NPR ' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export default function LandingPage() {
  const [dash, setDash] = useState(null);
  const [period, setPeriod] = useState('7d'); // not used for now

  // -----------------------------------------------------------------
  // Load dashboard data
  // -----------------------------------------------------------------
  useEffect(() => {
    axios.get(`${API}/dashboard`).then(r => setDash(r.data)).catch(e => console.error(e));
  }, []);

  // -----------------------------------------------------------------
  // Build chart data (Revenue vs Expenses). The API currently only returns
  // sales per day; we treat "expenses" as 0 for the demo.
  // -----------------------------------------------------------------
  const chartData = {
    labels: dash?.sales?.map(s => s.day) ?? [],
    datasets: [
      {
        label: 'Revenue',
        data: dash?.sales?.map(s => s.revenue) ?? [],
        borderColor: '#008080', // teal
        backgroundColor: 'rgba(0,128,128,0.2)',
        tension: 0.3,
      },
      {
        label: 'Expenses',
        data: dash?.sales?.map(() => 0) ?? [], // placeholder
        borderColor: '#8A2BE2', // violet
        backgroundColor: 'rgba(138,43,226,0.2)',
        tension: 0.3,
      },
    ],
  };

  // -----------------------------------------------------------------
  // Helper for CSV download
  // -----------------------------------------------------------------
  const downloadCsv = (url, filename) => {
    axios.get(url, { responseType: 'blob' })
      .then(res => {
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(new Blob([res.data]));
        link.download = filename;
        link.click();
        window.URL.revokeObjectURL(link.href);
      })
      .catch(console.error);
  };

  return (
    <div className="page-bg min-h-screen p-4">
      {/* 1️⃣ Welcome header */}
      <header className="header-bg p-4 rounded mb-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Welcome to Khata AI</h1>
          <p className="text-sm">Let's make today a productive business day.</p>
        </div>
        <button className="bg-white text-blue-600 font-medium py-1 px-3 rounded">
          {new Date().toLocaleDateString()}
        </button>
      </header>

      {/* 2️⃣ Getting‑started banner – shown when not logged in (simple check) */}
      {!(dash && dash.user && dash.user.id) && (
        <section className="bg-gray-100 p-4 rounded mb-4 text-center">
          <p className="mb-2">Start your own workspace to record your first transaction.</p>
          <button className="bg-blue-600 text-white py-2 px-4 rounded">
            Create your business
          </button>
        </section>
      )}

      {/* 3️⃣ Business metric cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="card-sales p-3 rounded shadow">
          <h3 className="font-semibold">Today's sales</h3>
          <p className="text-2xl">{dash?.today?.toFixed(2) ?? 0} NPR</p>
        </div>
        <div className="card-revenue p-3 rounded shadow">
          <h3 className="font-semibold">Monthly revenue</h3>
          <p className="text-2xl">{dash?.month?.toFixed(2) ?? 0} NPR</p>
        </div>
        <div className="card-expenses p-3 rounded shadow">
          <h3 className="font-semibold">Total expenses</h3>
          <p className="text-2xl">{dash?.expenses?.toFixed(2) ?? 0} NPR</p>
        </div>
        <div className="card-profit p-3 rounded shadow">
          <h3 className="font-semibold">Net profit</h3>
          <p className="text-2xl">{dash?.netProfit?.toFixed(2) ?? 0} NPR</p>
        </div>
        <div className="card-receivables p-3 rounded shadow">
          <h3 className="font-semibold">To receive</h3>
          <p className="text-2xl">{dash?.receivables?.toFixed(2) ?? 0} NPR</p>
        </div>
        <div className="card-payables p-3 rounded shadow">
          <h3 className="font-semibold">To pay</h3>
          <p className="text-2xl">{dash?.payables?.toFixed(2) ?? 0} NPR</p>
        </div>
      </section>

      {/* 4️⃣ Quick actions */}
      <section className="flex flex-wrap gap-3 mb-6 justify-center">
        {[
          {label:'Upload invoice',   icon:'📎',  onClick:()=>{}} ,
          {label:'Add sale',         icon:'💰',  onClick:()=>{}} ,
          {label:'Add product',      icon:'📦',  onClick:()=>{}} ,
          {label:'Purchase order',   icon:'🛒',  onClick:()=>{}} ,
          {label:'Record payment',   icon:'🏦',  onClick:()=>{}} ,
          {label:'Add expense',      icon:'✏️',  onClick:()=>{}} ,
        ].map(btn => (
          <button key={btn.label}
                  onClick={btn.onClick}
                  className="bg-blue-600 text-white py-2 px-4 rounded flex items-center gap-2">
            <span>{btn.icon}</span>{btn.label}
          </button>
        ))}
      </section>
      <p className="text-center text-sm mb-6">A little less admin. A lot more business.</p>

      {/* 5️⃣ Revenue vs Expenses chart */}
      <section className="bg-white p-4 rounded shadow mb-6">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold">Revenue & Expenses</h2>
          <select value={period}
                  onChange={e=>setPeriod(e.target.value)}
                  className="border rounded p-1">
            <option value="7d">Last 7 days</option>
            <option value="30d">This month</option>
          </select>
        </div>
        {dash?.sales?.length ? (
          <Line data={chartData} />
        ) : (
          <p className="text-center text-gray-500">No transactions yet – start recording sales!</p>
        )}
      </section>

      {/* 6️⃣ Business insights */}
      <section className="bg-white p-4 rounded shadow mb-6">
        <h2 className="text-lg font-semibold flex items-center">
          <span className="bg-green-200 text-green-800 px-2 py-1 rounded mr-2">Data‑driven</span>
          Business Insights
        </h2>
        {dash?.low?.length ? (
          <ul className="list-disc pl-5">
            {dash.low.map(p => (
              <li key={p.id}>Low stock: {p.name} ({p.stock}/{p.min_stock})</li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">All stocks are healthy.</p>
        )}
      </section>

      {/* 7️⃣ Recent sales table */}
      <section className="bg-white p-4 rounded shadow mb-6">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold">Recent sales</h2>
          <a href="/sales" className="text-blue-600">View all →</a>
        </div>
        {dash?.recent?.length ? (
          <table className="w-full table-auto">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Invoice</th>
                <th className="p-2 text-left">Customer</th>
                <th className="p-2 text-right">Amount</th>
                <th className="p-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {dash.recent.map(s => (
                <tr key={s.id} className="border-t">
                  <td className="p-2">{s.invoice_no}</td>
                  <td className="p-2">{s.customer_name || '—'}</td>
                  <td className="p-2 text-right">{s.total?.toFixed(2)} NPR</td>
                  <td className="p-2">
                    <span className={`px-2 py-1 rounded ${s.status==='approved' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>{s.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-500">Your first sale starts here.</p>
        )}
        <button className="mt-3 text-blue-600" onClick={() => downloadCsv('/api/sales/export', 'sales.csv')}>Download sales Excel (CSV)</button>
      </section>

      {/* 8️⃣ Stock overview */}
      <section className="bg-white p-4 rounded shadow mb-6">
        <h2 className="text-lg font-semibold flex justify-between items-center">
          Stock Overview
          <a href="/inventory" className="text-blue-600">Inventory →</a>
        </h2>
        {dash?.stock?.total ? (
          <div className="grid grid-cols-2 gap-4 mt-2">
            <p>Total products: {dash.stock.total}</p>
            <p>Low‑stock items: {dash.low?.length ?? 0}</p>
            <p>Units in stock: {dash.stock.units}</p>
            <p>Stock value: {dash.stock.value?.toFixed(2)} NPR</p>
          </div>
        ) : (
          <p className="text-gray-500">A clear view of your stock.</p>
        )}
      </section>

      {/* Footer */}
      <footer className="text-center text-sm text-gray-600 py-4">
        © {new Date().getFullYear()} Khata AI — Built for better business days.
      </footer>
    </div>
  );
}
