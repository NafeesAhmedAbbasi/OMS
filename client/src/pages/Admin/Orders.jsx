import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

export default function AdminOrders() {
  const [orders, setOrders]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/orders')
      .then(res => setOrders(res.data))
      .finally(() => setLoading(false));
  }, []);

  const shipped   = orders.filter(o => o.shipping_service);
  const unshipped = orders.filter(o => !o.shipping_service);
  const filtered  = filterStatus ? orders.filter(o => o.status === filterStatus) : orders;

  return (
    <AppLayout>
      <div className="page-container">
        <div className="page-header">
          <div>
            <h2 className="page-title">Orders</h2>
            <p className="page-subtitle">All orders across the system</p>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Loading…</div>
        ) : (
          <>
            {/* ── Summary Tile ── */}
            <div className="dashboard-tiles" style={{ marginBottom: 24 }}>
              <div
                className="tile tile-grand"
                style={{ cursor: 'pointer', userSelect: 'none', minWidth: 200 }}
                onClick={() => navigate('/admin/orders/list')}
                title="Click to view all orders"
              >
                <div className="tile-label">All Orders</div>
                <div className="tile-amount">{orders.length}</div>
                <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 13 }}>
                  <span>
                    <span style={{
                      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                      background: '#10b981', marginRight: 5,
                    }} />
                    Shipped <strong>{shipped.length}</strong>
                  </span>
                  <span>
                    <span style={{
                      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                      background: '#f59e0b', marginRight: 5,
                    }} />
                    Unshipped <strong>{unshipped.length}</strong>
                  </span>
                </div>
                <div style={{ fontSize: 11, marginTop: 6, color: 'var(--primary)', fontWeight: 500 }}>
                  click to view all orders
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
