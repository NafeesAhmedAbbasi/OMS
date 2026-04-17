import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import AppLayout from '../../components/AppLayout';
import OrderModal from '../../components/OrderModal';
import OrderCard from '../../components/OrderCard';
import { MONTHS, CLOTHING_KEYWORDS } from '../../constants';

function isClothingType(name) {
  if (!name) return false;
  const lower = name.toLowerCase();
  return CLOTHING_KEYWORDS.some(kw => lower.includes(kw));
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(d)} ${MONTHS[parseInt(m) - 1].slice(0, 3)}, ${y}`;
}

function getWeekNumber(dateStr) {
  const d = new Date(dateStr);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
}

function statusDot(status) {
  const map = {
    open:           { color: '#f59e0b', title: 'Open' },
    confirmed:      { color: '#10b981', title: 'Confirmed' },
    dispute_opened: { color: '#ef4444', title: 'Dispute Opened' },
    dispute_won:    { color: '#6366f1', title: 'Dispute Won' },
    dispute_lost:   { color: '#94a3b8', title: 'Dispute Lost' },
    cancelled:      { color: '#cbd5e1', title: 'Cancelled' },
  };
  const s = map[status] || { color: '#f59e0b', title: 'Open' };
  return (
    <span
      title={s.title}
      style={{
        display: 'inline-block',
        width: 10, height: 10,
        borderRadius: '50%',
        background: s.color,
        flexShrink: 0,
      }}
    />
  );
}

function sourceBadgeClass(source) {
  const map = { TLH: 'badge-tlh', Lajuria: 'badge-lajuria', UHMLS: 'badge-uhmls' };
  return map[source] || 'badge-none';
}

function isShippingDelayed(order) {
  if (order.shipping_service) return false; // already shipped
  if (!order.date) return false;
  const orderDate = new Date(order.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today - orderDate) / 86400000);
  return diffDays > 14;
}

export default function OrderList() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [cardOrder, setCardOrder] = useState(null);
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const isDeo = user?.role === 'deo';

  // Filters
  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterWeek, setFilterWeek] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterDelayed, setFilterDelayed] = useState(false);
  const [sources, setSources] = useState([]);

  useEffect(() => {
    api.get('/orders')
      .then(res => setOrders(res.data))
      .catch(() => setError('Failed to load orders'))
      .finally(() => setLoading(false));
    api.get('/settings/sources').then(res => setSources(res.data)).catch(() => {});
  }, []);

  const availableYears = useMemo(() => {
    const years = [...new Set(orders.map(o => o.date?.split('-')[0]).filter(Boolean))].sort().reverse();
    return years;
  }, [orders]);

  const availableWeeks = useMemo(() => {
    if (!filterYear) return [];
    const filtered = orders.filter(o => {
      if (!o.date) return false;
      const [y, m] = o.date.split('-');
      if (y !== filterYear) return false;
      if (filterMonth && m !== filterMonth.padStart(2, '0')) return false;
      return true;
    });
    return [...new Set(filtered.map(o => getWeekNumber(o.date)))].sort((a, b) => a - b);
  }, [orders, filterYear, filterMonth]);

  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (!o.date) return true;
      const [y, m] = o.date.split('-');
      if (filterYear && y !== filterYear) return false;
      if (filterMonth && m !== filterMonth.padStart(2, '0')) return false;
      if (filterWeek && getWeekNumber(o.date) !== parseInt(filterWeek)) return false;
      if (filterSource && o.source !== filterSource) return false;
      if (filterDelayed && !isShippingDelayed(o)) return false;
      return true;
    });
  }, [orders, filterYear, filterMonth, filterWeek, filterSource]);

  const sourceStats = useMemo(() => {
    // Count filtered orders per source, sorted descending
    const counts = {};
    filtered.forEach(o => {
      const src = o.source || 'Unknown';
      counts[src] = (counts[src] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const maxSourceCount = sourceStats.length ? sourceStats[0][1] : 1;

  function handleSaved(updated) {
    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
    setModal(null);
    // keep cardOrder in sync so Generate card shows fresh data
    setCardOrder(prev => prev?.id === updated.id ? updated : prev);
  }

  function clearFilters() {
    setFilterYear(''); setFilterMonth(''); setFilterWeek(''); setFilterSource(''); setFilterDelayed(false);
  }

  const hasFilters = filterYear || filterMonth || filterWeek || filterSource || filterDelayed;

  return (
    <AppLayout>
      <div className="page-container">

        <div className="page-header">
          <div>
            <h2 className="page-title">Orders</h2>
            <p className="page-subtitle">Click a row to edit · click 👁 to view details</p>
          </div>
          <Link to="/deo/orders/new" className="btn-primary">+ New Order</Link>
        </div>

        {error && <p className="error-msg">{error}</p>}

        {/* ── Filter Bar ── */}
        <div className="filter-bar">
          <div className="filter-bar-left">
            <div className="filter-group">
              <label>Year</label>
              <select value={filterYear} onChange={e => { setFilterYear(e.target.value); setFilterMonth(''); setFilterWeek(''); }}>
                <option value="">All years</option>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label>Month</label>
              <select value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setFilterWeek(''); }} disabled={!filterYear}>
                <option value="">All months</option>
                {MONTHS.map((m, i) => <option key={i + 1} value={String(i + 1)}>{m}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label>Week</label>
              <select value={filterWeek} onChange={e => setFilterWeek(e.target.value)} disabled={!filterYear}>
                <option value="">All weeks</option>
                {availableWeeks.map(w => <option key={w} value={w}>Week {w}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label>Source</label>
              <select value={filterSource} onChange={e => setFilterSource(e.target.value)}>
                <option value="">All sources</option>
                {sources.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            {hasFilters && (
              <button className="btn-clear-filters" onClick={clearFilters}>Clear filters</button>
            )}
            <button
              className="btn-clear-filters"
              onClick={() => setFilterDelayed(f => !f)}
              style={{
                background: filterDelayed ? '#ef4444' : undefined,
                color: filterDelayed ? '#fff' : undefined,
                borderColor: filterDelayed ? '#ef4444' : undefined,
                fontWeight: filterDelayed ? 700 : undefined,
              }}
            >
              {filterDelayed ? '✕ Delayed only' : 'Show delayed'}
            </button>
          </div>
          <div className="filter-summary">
            <span className="filter-count">
              {hasFilters
                ? <><strong>{filtered.length}</strong> of {orders.length} orders</>
                : <>{orders.length} orders total</>}
            </span>
          </div>
        </div>

        {/* ── Source Chart ── */}
        {!loading && sourceStats.length > 0 && (
          <div className="table-card" style={{ padding: '16px 20px', marginBottom: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Orders by Source {hasFilters && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(filtered)</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sourceStats.map(([src, count]) => (
                <div
                  key={src}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                  onClick={() => setFilterSource(filterSource === src ? '' : src)}
                  title={filterSource === src ? 'Click to clear filter' : `Click to filter by ${src}`}
                >
                  <div style={{ width: 90, fontSize: 13, fontWeight: 600, color: filterSource === src ? 'var(--primary)' : 'var(--text)', textAlign: 'right', flexShrink: 0 }}>
                    {src}
                  </div>
                  <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 6, height: 24, overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                      width: `${(count / maxSourceCount) * 100}%`,
                      height: '100%',
                      background: filterSource === src ? 'var(--primary)' : 'var(--primary-soft, #ede9fe)',
                      borderRadius: 6,
                      transition: 'width 0.3s ease, background 0.15s',
                      display: 'flex',
                      alignItems: 'center',
                      paddingLeft: 8,
                    }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: filterSource === src ? '#fff' : 'var(--primary)', whiteSpace: 'nowrap' }}>
                        {count}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Table ── */}
        <div className="table-card">
          {loading ? (
            <div className="loading-state">Loading orders…</div>
          ) : (
            <div className="table-wrapper">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Date</th>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th>Store-Ref #</th>
                    {!isDeo && <th>MC (PKR)</th>}
                    {!isDeo && <th>SC (PKR)</th>}
                    <th>Q</th>
                    <th>Tracking</th>
                    <th>Source</th>
                    <th>Shoes Type</th>
                    <th>Country</th>
                    <th>Size</th>
                    <th>Color</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={isDeo ? 13 : 15} className="no-data">
                        {hasFilters ? 'No orders match the selected filters.' : 'No orders yet.'}
                      </td>
                    </tr>
                  )}
                  {filtered.map(o => (
                    <tr key={o.id} onClick={() => setModal({ order: o, mode: 'edit' })}>
                      <td className="col-actions" onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {statusDot(o.status)}
                          {isShippingDelayed(o) && (
                            <span
                              title="Shipping delayed — not shipped within 14 days"
                              style={{
                                fontSize: 10, fontWeight: 700, color: '#fff',
                                background: '#ef4444', borderRadius: 4,
                                padding: '1px 5px', lineHeight: '16px',
                                flexShrink: 0,
                              }}
                            >LATE</span>
                          )}
                          <button
                            className="btn-eye"
                            onClick={() => setModal({ order: o, mode: 'view' })}
                            title="View details"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                              <circle cx="12" cy="12" r="3"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                      <td>{formatDate(o.date)}</td>
                      <td><span className="order-num">{o.order_number}</span></td>
                      <td>{o.customer}</td>
                      <td>{o.store_ref || <span className="text-muted">—</span>}</td>
                      {!isDeo && <td>{o.mc_pkr != null ? Number(o.mc_pkr).toLocaleString() : <span className="text-muted">—</span>}</td>}
                      {!isDeo && <td>{o.sc_pkr != null ? Number(o.sc_pkr).toLocaleString() : <span className="text-muted">—</span>}</td>}
                      <td>{o.quantity}</td>
                      <td>{o.tracking || <span className="text-muted">—</span>}</td>
                      <td><span className={`badge ${sourceBadgeClass(o.source)}`}>{o.source}</span></td>
                      <td>{o.shoes_type}</td>
                      <td>{o.country}</td>
                      <td>{isClothingType(o.shoes_type) ? o.size : `US ${o.size}`}</td>
                      <td>{o.color}</td>
                      <td className="col-generate" onClick={e => e.stopPropagation()}>
                        <button
                          className="btn-generate"
                          onClick={() => setCardOrder(o)}
                          title="Generate order card"
                        >
                          Generate
                        </button>
                      </td>
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
          order={modal.order}
          initialMode={modal.mode}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {cardOrder && (
        <OrderCard
          order={cardOrder}
          onClose={() => setCardOrder(null)}
        />
      )}
    </AppLayout>
  );
}
