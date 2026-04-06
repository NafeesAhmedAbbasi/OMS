import { useEffect, useState } from 'react';
import api from '../../api';
import AppLayout from '../../components/AppLayout';

function fmt(n) {
  return n != null ? Number(n).toLocaleString('en-PK') : '—';
}

export default function HandlerDashboard() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    api.get('/handlers/my/dashboard')
      .then(res => setData(res.data))
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <AppLayout><div className="loading-state">Loading…</div></AppLayout>;
  if (error)   return <AppLayout><div className="empty-state">{error}</div></AppLayout>;

  const { orders, bills, payments, totalBilled, totalPaid, balance } = data;

  // Map bills by order_id for quick lookup
  const billsByOrder = {};
  for (const b of bills) {
    if (b.order_id) {
      if (!billsByOrder[b.order_id]) billsByOrder[b.order_id] = [];
      billsByOrder[b.order_id].push(b);
    }
  }

  // Bills with no order linkage
  const unlinkedBills = bills.filter(b => !b.order_id);

  return (
    <AppLayout>
      <div className="page-container">
        <div className="page-header">
          <div>
            <h2 className="page-title">My Dashboard</h2>
            <p className="page-subtitle">{orders.length} assigned orders</p>
          </div>
        </div>

        {/* Balance summary */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <div className="stat-card" style={{ flex: 1, minWidth: 160 }}>
            <div className="stat-label">Total Billed</div>
            <div className="stat-value" style={{ color: '#dc2626' }}>PKR {fmt(totalBilled)}</div>
          </div>
          <div className="stat-card" style={{ flex: 1, minWidth: 160 }}>
            <div className="stat-label">Total Paid</div>
            <div className="stat-value" style={{ color: '#059669' }}>PKR {fmt(totalPaid)}</div>
          </div>
          <div className="stat-card" style={{ flex: 1, minWidth: 160 }}>
            <div className="stat-label">Balance</div>
            <div className="stat-value" style={{ color: balance >= 0 ? '#059669' : '#dc2626' }}>
              PKR {fmt(Math.abs(balance))}
              <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 4 }}>
                {balance >= 0 ? '(surplus)' : '(owed)'}
              </span>
            </div>
          </div>
        </div>

        {/* Assigned orders with bills */}
        <div className="table-card" style={{ marginBottom: 24 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 600 }}>
            Assigned Orders
          </div>
          {orders.length === 0 ? (
            <div className="empty-state">No orders assigned yet.</div>
          ) : (
            <div className="table-wrapper">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Item Type</th>
                    <th>Status</th>
                    <th>Shipping (PKR)</th>
                    <th>Manufacturing (PKR)</th>
                    <th>Commission (PKR)</th>
                    <th>Total Bill (PKR)</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => {
                    const orderBills = billsByOrder[o.id] || [];
                    const shipping   = orderBills.reduce((s, b) => s + (b.shipping_cost_pkr || 0), 0);
                    const mfg        = orderBills.reduce((s, b) => s + (b.manufacturing_cost_pkr || 0), 0);
                    const comm       = orderBills.reduce((s, b) => s + (b.commission_pkr || 0), 0);
                    const total      = orderBills.reduce((s, b) => s + (b.total_pkr || 0), 0);
                    const hasBill    = orderBills.length > 0;

                    return (
                      <tr key={o.id}>
                        <td><span className="order-num">{o.order_number}</span></td>
                        <td>{o.date}</td>
                        <td>{o.customer}</td>
                        <td>{o.shoes_type}</td>
                        <td>
                          <span className={`badge badge-status-${o.status}`}>
                            {o.status?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td style={{ color: hasBill ? '#374151' : '#9ca3af' }}>
                          {hasBill ? fmt(shipping) : '—'}
                        </td>
                        <td style={{ color: hasBill ? '#374151' : '#9ca3af' }}>
                          {hasBill ? fmt(mfg) : '—'}
                        </td>
                        <td style={{ color: hasBill ? '#374151' : '#9ca3af' }}>
                          {hasBill ? fmt(comm) : '—'}
                        </td>
                        <td style={{ fontWeight: hasBill ? 600 : 400, color: hasBill ? '#111827' : '#9ca3af' }}>
                          {hasBill ? fmt(total) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Unlinked bills (not tied to a specific order) */}
        {unlinkedBills.length > 0 && (
          <div className="table-card" style={{ marginBottom: 24 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 600 }}>
              Other Bills
            </div>
            <div className="table-wrapper">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Item Type</th>
                    <th>Shipping (PKR)</th>
                    <th>Manufacturing (PKR)</th>
                    <th>Commission (PKR)</th>
                    <th>Total (PKR)</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {unlinkedBills.map(b => (
                    <tr key={b.id}>
                      <td>{b.date}</td>
                      <td>{b.item_type || '—'}</td>
                      <td>{fmt(b.shipping_cost_pkr)}</td>
                      <td>{fmt(b.manufacturing_cost_pkr)}</td>
                      <td>{fmt(b.commission_pkr)}</td>
                      <td style={{ fontWeight: 600 }}>{fmt(b.total_pkr)}</td>
                      <td style={{ color: '#6b7280' }}>{b.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payments received */}
        {payments.length > 0 && (
          <div className="table-card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 600 }}>
              Payments Received
            </div>
            <div className="table-wrapper">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount (PKR)</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id}>
                      <td>{p.date}</td>
                      <td style={{ fontWeight: 600, color: '#059669' }}>PKR {fmt(p.amount_pkr)}</td>
                      <td style={{ color: '#6b7280' }}>{p.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
