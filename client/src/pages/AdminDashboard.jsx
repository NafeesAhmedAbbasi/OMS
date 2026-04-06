import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import api from '../api';
import AppLayout from '../components/AppLayout';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getLast6Months() {
  const result = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({ year: d.getFullYear(), month: d.getMonth() + 1, label: MONTH_NAMES[d.getMonth()] });
  }
  return result;
}

export default function AdminDashboard() {
  const [orders, setOrders]       = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api.get('/orders'), api.get('/billing/transfers'), api.get('/users')])
      .then(([oRes, tRes, uRes]) => {
        setOrders(oRes.data);
        setTransfers(tRes.data);
        setUsers(uRes.data);
      })
      .finally(() => setLoading(false));
  }, []);

  // Orders stats
  const shipped   = orders.filter(o =>  o.shipping_service).length;
  const unshipped = orders.filter(o => !o.shipping_service).length;
  const confirmed = orders.filter(o => o.status === 'confirmed' || o.status === 'dispute_won').length;
  const open      = orders.filter(o => o.status === 'open').length;

  // Transfer stats
  const totalCad = transfers.reduce((s, t) => s + (t.total_deducted || 0), 0);
  const totalPkr = transfers.reduce((s, t) => s + (t.amount_pkr || 0), 0);
  const hasPkr   = transfers.some(t => t.amount_pkr != null);

  // Users stats
  const activeUsers   = users.filter(u => u.is_active).length;
  const inactiveUsers = users.filter(u => !u.is_active).length;

  // Monthly sales (confirmed/dispute_won orders by date)
  const last6 = getLast6Months();
  const monthlySales = last6.map(({ year, month, label }) => {
    const mo = String(month).padStart(2, '0');
    const prefix = `${year}-${mo}`;
    const count = orders.filter(o =>
      (o.status === 'confirmed' || o.status === 'dispute_won') && o.date?.startsWith(prefix)
    ).length;
    const revenue = orders
      .filter(o => (o.status === 'confirmed' || o.status === 'dispute_won') && o.date?.startsWith(prefix))
      .reduce((s, o) => s + (o.net_amount || 0), 0);
    return { label, count, revenue };
  });

  return (
    <AppLayout>
      <div className="page-container">
        <div className="page-header">
          <div>
            <h2 className="page-title">Admin Dashboard</h2>
            <p className="page-subtitle">System overview</p>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Loading…</div>
        ) : (
          <>
            {/* ── Monthly Sales Chart ── */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '20px 24px',
              boxShadow: 'var(--shadow-sm)', marginBottom: 24,
            }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Sales per Month</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Confirmed orders — last 6 months</div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlySales} margin={{ top: 4, right: 16, left: 0, bottom: 0 }} barSize={36}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip
                    cursor={{ fill: 'var(--primary-light)' }}
                    contentStyle={{ border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
                    formatter={(value, name) => name === 'count'
                      ? [value, 'Orders']
                      : [`CA$${Number(value).toFixed(2)}`, 'Revenue']}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {monthlySales.map((m, i) => (
                      <Cell
                        key={m.label}
                        fill={i === monthlySales.length - 1 ? '#4f46e5' : '#a5b4fc'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {/* Revenue sub-row */}
              <div style={{ display: 'flex', gap: 0, marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                {monthlySales.map((m, i) => (
                  <div key={m.label} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: i === monthlySales.length - 1 ? 'var(--success)' : 'var(--text-muted)', fontWeight: 600 }}>
                      {m.revenue > 0 ? `CA$${m.revenue.toFixed(0)}` : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Main Tiles ── */}
            <div className="dashboard-tiles">

              {/* Orders tile */}
              <div
                className="tile tile-grand"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate('/admin/orders/list')}
              >
                <div className="tile-label">All Orders</div>
                <div className="tile-amount">{orders.length}</div>
                <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap', fontSize: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                    Shipped <strong style={{ marginLeft: 3 }}>{shipped}</strong>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                    Unshipped <strong style={{ marginLeft: 3 }}>{unshipped}</strong>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
                    Confirmed <strong style={{ marginLeft: 3 }}>{confirmed}</strong>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-muted)', display: 'inline-block' }} />
                    Open <strong style={{ marginLeft: 3 }}>{open}</strong>
                  </span>
                </div>
                <div style={{ fontSize: 11, marginTop: 8, color: 'var(--primary)', fontWeight: 500 }}>click to view all →</div>
              </div>

              {/* Transfers tile */}
              <div
                className="tile"
                style={{ borderLeft: '4px solid #ef4444', cursor: 'pointer' }}
                onClick={() => navigate('/admin/transfers')}
              >
                <div className="tile-label">Total Transferred</div>
                {hasPkr && (
                  <div className="tile-amount" style={{ color: 'var(--danger)' }}>
                    PKR {totalPkr.toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                  </div>
                )}
                <div style={{ fontSize: hasPkr ? 14 : 24, fontWeight: hasPkr ? 500 : 800, color: hasPkr ? 'var(--text-secondary)' : 'var(--danger)', marginTop: hasPkr ? 2 : 0 }}>
                  CA${totalCad.toFixed(2)} {hasPkr ? 'sent' : ''}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                  {transfers.length} transfer{transfers.length !== 1 ? 's' : ''}
                </div>
                <div style={{ fontSize: 11, marginTop: 6, color: 'var(--primary)', fontWeight: 500 }}>click to view history →</div>
              </div>

              {/* Users tile */}
              <div
                className="tile"
                style={{ borderLeft: '4px solid #8b5cf6', cursor: 'pointer' }}
                onClick={() => navigate('/admin/users')}
              >
                <div className="tile-label">Users</div>
                <div className="tile-amount" style={{ color: '#8b5cf6' }}>{users.length}</div>
                <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                    Active <strong style={{ marginLeft: 3 }}>{activeUsers}</strong>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                    Inactive <strong style={{ marginLeft: 3 }}>{inactiveUsers}</strong>
                  </span>
                </div>
                <div style={{ fontSize: 11, marginTop: 8, color: 'var(--primary)', fontWeight: 500 }}>click to manage →</div>
              </div>

            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
