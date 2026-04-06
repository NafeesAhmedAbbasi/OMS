import { useEffect, useState } from 'react';
import api from '../../api';
import AppLayout from '../../components/AppLayout';
import OrderModal from '../../components/OrderModal';

const STATUS_OPTIONS = ['open', 'confirmed', 'dispute_opened', 'dispute_won', 'dispute_lost', 'cancelled'];

function statusBadgeClass(status) {
  const map = {
    open:           'badge-status-open',
    confirmed:      'badge-status-confirmed',
    dispute_opened: 'badge-status-dispute',
    dispute_won:    'badge-status-won',
    dispute_lost:   'badge-status-lost',
    cancelled:      'badge-status-cancelled',
  };
  return map[status] || 'badge-none';
}

function formatStatus(s) {
  return s ? s.replace(/_/g, ' ') : '—';
}

export default function AdminOrderList() {
  const [orders, setOrders]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [modal, setModal]               = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterShipped, setFilterShipped] = useState('');

  useEffect(() => {
    api.get('/orders')
      .then(res => setOrders(res.data))
      .finally(() => setLoading(false));
  }, []);

  const filtered = orders
    .filter(o => !filterStatus  || o.status === filterStatus)
    .filter(o => !filterShipped || (filterShipped === 'shipped' ? !!o.shipping_service : !o.shipping_service));

  const shipped   = orders.filter(o =>  o.shipping_service).length;
  const unshipped = orders.filter(o => !o.shipping_service).length;

  return (
    <AppLayout>
      <div className="page-container">
        <div className="page-header">
          <div>
            <h2 className="page-title">All Orders</h2>
            <p className="page-subtitle">
              {shipped} shipped &nbsp;·&nbsp; {unshipped} unshipped &nbsp;·&nbsp; {orders.length} total
            </p>
          </div>
        </div>

        <div className="filter-bar">
          <div className="filter-bar-left">
            <div className="filter-group">
              <label>Status</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{formatStatus(s)}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Shipping</label>
              <select value={filterShipped} onChange={e => setFilterShipped(e.target.value)}>
                <option value="">All</option>
                <option value="shipped">Shipped</option>
                <option value="unshipped">Unshipped</option>
              </select>
            </div>
          </div>
          <div className="filter-summary">
            <span className="filter-count">{filtered.length} orders</span>
          </div>
        </div>

        <div className="table-card">
          {loading ? (
            <div className="loading-state">Loading orders…</div>
          ) : (
            <div className="table-wrapper">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th>Shipping</th>
                    <th>CAD Amount</th>
                    <th>Net (CAD)</th>
                    <th>Billing Account</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan="9" className="no-data">No orders.</td></tr>
                  )}
                  {filtered.map(o => (
                    <tr key={o.id} onClick={() => setModal(o)} style={{ cursor: 'pointer' }}>
                      <td><span className="order-num">{o.order_number}</span></td>
                      <td>{o.date}</td>
                      <td>{o.customer}</td>
                      <td>{o.source}</td>
                      <td>
                        <span className={`badge ${statusBadgeClass(o.status)}`}>
                          {formatStatus(o.status)}
                        </span>
                      </td>
                      <td>
                        {o.shipping_service
                          ? <span style={{ color: '#10b981', fontWeight: 600, fontSize: 12 }}>● {o.shipping_service}</span>
                          : <span style={{ color: '#f59e0b', fontSize: 12 }}>○ Unshipped</span>}
                      </td>
                      <td>{o.cad_amount != null ? `CA$${Number(o.cad_amount).toFixed(2)}` : '—'}</td>
                      <td>{o.net_amount != null ? `CA$${Number(o.net_amount).toFixed(2)}` : '—'}</td>
                      <td>{o.billing_account_name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <OrderModal
          order={modal}
          initialMode="view"
          onClose={() => setModal(null)}
          onSaved={updated => {
            setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
            setModal(null);
          }}
        />
      )}
    </AppLayout>
  );
}
