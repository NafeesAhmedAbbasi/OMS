import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import api from '../../api';
import AppLayout from '../../components/AppLayout';
import OrderModal from '../../components/OrderModal';

const STATUS_OPTIONS = ['open', 'processing', 'confirmed', 'dispute_opened', 'dispute_won', 'dispute_lost', 'cancelled'];

function statusBadgeClass(status) {
  const map = {
    open:           'badge-status-open',
    processing:     'badge-status-processing',
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
  const [handlers, setHandlers]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [modal, setModal]               = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterShipped, setFilterShipped] = useState('');
  const [assigning, setAssigning]       = useState({}); // orderId -> selected handler_id

  useEffect(() => {
    Promise.all([api.get('/orders'), api.get('/handlers')])
      .then(([ordersRes, handlersRes]) => {
        setOrders(ordersRes.data);
        setHandlers(handlersRes.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = orders
    .filter(o => !filterStatus  || o.status === filterStatus)
    .filter(o => !filterShipped || (filterShipped === 'shipped' ? !!o.shipping_service : !o.shipping_service));

  const shipped   = orders.filter(o =>  o.shipping_service).length;
  const unshipped = orders.filter(o => !o.shipping_service).length;

  async function handleAssign(orderId) {
    const handlerId = assigning[orderId];
    if (!handlerId) return;
    try {
      const res = await api.put(`/orders/${orderId}/assign`, { handler_id: handlerId });
      setOrders(prev => prev.map(o => o.id === orderId ? res.data : o));
      setAssigning(prev => { const n = { ...prev }; delete n[orderId]; return n; });
    } catch {}
  }

  async function handleUnassign(orderId) {
    try {
      const res = await api.put(`/orders/${orderId}/assign`, { handler_id: null });
      setOrders(prev => prev.map(o => o.id === orderId ? res.data : o));
    } catch {}
  }

  function exportExcel() {
    const rows = filtered.map(o => ({
      'Order #':         o.order_number,
      'Date':            o.date,
      'Customer':        o.customer,
      'Source':          o.source,
      'Item Type':       o.shoes_type,
      'Size':            o.size,
      'Color':           o.color,
      'Quantity':        o.quantity,
      'Country':         o.country,
      'Store Ref':       o.store_ref || '',
      'Order Amount (USD)': o.order_amount != null ? Number(o.order_amount) : '',
      'Payment Method':  o.payment_method || '',
      'Shipping Service': o.shipping_service || '',
      'Tracking':        o.tracking || '',
      'Status':          o.status?.replace(/_/g, ' '),
      'Handler':         o.handler_username || '',
      'CAD Amount':      o.cad_amount != null ? Number(o.cad_amount) : '',
      'Commission':      o.commission != null ? Number(o.commission) : '',
      'Net (CAD)':       o.net_amount != null ? Number(o.net_amount) : '',
      'Billing Account': o.billing_account_name || '',
      'MC (PKR)':        o.mc_pkr != null ? Number(o.mc_pkr) : '',
      'SC (PKR)':        o.sc_pkr != null ? Number(o.sc_pkr) : '',
      'Comments':        o.comments || '',
      'Shipping Address': o.shipping_address || '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');

    const label = filterStatus ? `_${filterStatus}` : '';
    const date  = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `orders${label}_${date}.xlsx`);
  }

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
          <button className="btn-ghost" onClick={exportExcel} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export Excel
          </button>
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
                    <th>Handler</th>
                    <th>Shipping</th>
                    <th>CAD Amount</th>
                    <th>Net (CAD)</th>
                    <th>Billing Account</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan="10" className="no-data">No orders.</td></tr>
                  )}
                  {filtered.map(o => (
                    <tr key={o.id} onClick={e => { if (e.target.closest('.handler-cell')) return; setModal(o); }} style={{ cursor: 'pointer' }}>
                      <td><span className="order-num">{o.order_number}</span></td>
                      <td>{o.date}</td>
                      <td>{o.customer}</td>
                      <td>{o.source}</td>
                      <td>
                        <span className={`badge ${statusBadgeClass(o.status)}`}>
                          {formatStatus(o.status)}
                        </span>
                      </td>
                      <td className="handler-cell" onClick={e => e.stopPropagation()}>
                        {o.handler_id ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, color: '#6366f1' }}>{o.handler_username}</span>
                            <button
                              onClick={() => handleUnassign(o.id)}
                              title="Unassign"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 14, lineHeight: 1, padding: '0 2px' }}
                            >×</button>
                          </span>
                        ) : (
                          handlers.length > 0 ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <select
                                value={assigning[o.id] || ''}
                                onChange={e => setAssigning(prev => ({ ...prev, [o.id]: e.target.value }))}
                                style={{ fontSize: 12, padding: '2px 4px', borderRadius: 4, border: '1px solid #d1d5db' }}
                              >
                                <option value="">Select…</option>
                                {handlers.filter(h => h.is_active).map(h => (
                                  <option key={h.id} value={h.id}>{h.username}</option>
                                ))}
                              </select>
                              {assigning[o.id] && (
                                <button
                                  onClick={e => { e.stopPropagation(); handleAssign(o.id); }}
                                  style={{ fontSize: 11, padding: '2px 8px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                >Assign</button>
                              )}
                            </span>
                          ) : (
                            <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>
                          )
                        )}
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
