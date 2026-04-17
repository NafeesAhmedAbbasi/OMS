import { useEffect, useState, useMemo } from 'react';
import api from '../../api';
import AppLayout from '../../components/AppLayout';
import ConfirmOrderModal from './ConfirmOrderModal';
import { MONTHS } from '../../constants';

export default function EditorDashboard() {
  const [orders, setOrders]       = useState([]);
  const [accounts, setAccounts]   = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [confirmOrder, setConfirmOrder] = useState(null);

  // Filters
  const [filterYear, setFilterYear]   = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd]     = useState('');

  useEffect(() => {
    Promise.all([api.get('/orders'), api.get('/billing'), api.get('/billing/transfers')])
      .then(([ordRes, bilRes, tRes]) => {
        setOrders(ordRes.data);
        setAccounts(bilRes.data);
        setTransfers(tRes.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const availableYears = useMemo(() => {
    const years = [...new Set(orders.map(o => o.date?.split('-')[0]).filter(Boolean))].sort().reverse();
    return years;
  }, [orders]);

  // Filter orders by date range / year / month
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (!o.date) return true;
      if (filterStart && o.date < filterStart) return false;
      if (filterEnd   && o.date > filterEnd)   return false;
      if (filterYear  && !o.date.startsWith(filterYear)) return false;
      if (filterMonth && o.date.split('-')[1] !== filterMonth.padStart(2, '0')) return false;
      return true;
    });
  }, [orders, filterYear, filterMonth, filterStart, filterEnd]);

  // Filter transfers by date range / year / month
  const filteredTransfers = useMemo(() => {
    return transfers.filter(t => {
      if (!t.date) return true;
      if (filterStart && t.date < filterStart) return false;
      if (filterEnd   && t.date > filterEnd)   return false;
      if (filterYear  && !t.date.startsWith(filterYear)) return false;
      if (filterMonth && t.date.split('-')[1] !== filterMonth.padStart(2, '0')) return false;
      return true;
    });
  }, [transfers, filterYear, filterMonth, filterStart, filterEnd]);

  const hasFilters = filterYear || filterMonth || filterStart || filterEnd;

  function clearFilters() {
    setFilterYear(''); setFilterMonth(''); setFilterStart(''); setFilterEnd('');
  }

  const countableOrders = filteredOrders.filter(o => o.status === 'confirmed' || o.status === 'dispute_won');
  const totalTransferCommission = filteredTransfers.reduce((sum, t) => sum + (t.commission || 0), 0);
  const totalTransferred = filteredTransfers.reduce((sum, t) => sum + (t.total_deducted || 0), 0);

  // Opening balance only applies when no date filter (it's a historical starting point)
  const totalOpeningBalance = hasFilters ? 0 : accounts.reduce((sum, a) => sum + (a.opening_balance || 0), 0);
  const grandTotal = totalOpeningBalance + countableOrders.reduce((sum, o) => sum + (o.net_amount || 0), 0) - totalTransferred;

  // USD stats
  const totalUSD = countableOrders.reduce((sum, o) => sum + (o.order_amount || 0), 0);
  const totalEarnedCAD = totalOpeningBalance + countableOrders.reduce((sum, o) => sum + (o.net_amount || 0), 0);
  const transferredRatio = totalEarnedCAD > 0 ? Math.min(totalTransferred / totalEarnedCAD, 1) : 0;
  const usdTransferred = totalUSD * transferredRatio;
  const usdRemaining = totalUSD - usdTransferred;

  const transfersByAccount = accounts.map(acc => ({
    ...acc,
    transferred: filteredTransfers
      .filter(t => t.billing_account_id === acc.id)
      .reduce((sum, t) => sum + (t.total_deducted || 0), 0),
  })).filter(acc => acc.transferred > 0);

  const tilesByAccount = accounts.map(acc => ({
    ...acc,
    total: (hasFilters ? 0 : (acc.opening_balance || 0))
      + countableOrders
          .filter(o => o.confirmed_billing_account_id === acc.id)
          .reduce((sum, o) => sum + (o.net_amount || 0), 0)
      - filteredTransfers
          .filter(t => t.billing_account_id === acc.id)
          .reduce((sum, t) => sum + (t.total_deducted || 0), 0),
  }));

  const openOrders = filteredOrders.filter(o => o.status === 'open');

  function handleConfirmed(updated) {
    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
    setConfirmOrder(null);
  }

  return (
    <AppLayout>
      <div className="page-container">
        <div className="page-header">
          <div>
            <h2 className="page-title">Editor Dashboard</h2>
            <p className="page-subtitle">Billing totals and open orders</p>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Loading…</div>
        ) : (
          <>
            {/* ── Filter Bar ── */}
            <div className="filter-bar" style={{ marginBottom: 16 }}>
              <div className="filter-bar-left" style={{ flexWrap: 'wrap', gap: 10 }}>
                <div className="filter-group">
                  <label>Year</label>
                  <select value={filterYear} onChange={e => { setFilterYear(e.target.value); setFilterMonth(''); setFilterStart(''); setFilterEnd(''); }}>
                    <option value="">All years</option>
                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div className="filter-group">
                  <label>Month</label>
                  <select value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setFilterStart(''); setFilterEnd(''); }} disabled={!filterYear}>
                    <option value="">All months</option>
                    {MONTHS.map((m, i) => <option key={i + 1} value={String(i + 1)}>{m}</option>)}
                  </select>
                </div>
                <div className="filter-group">
                  <label>From</label>
                  <input type="date" value={filterStart} onChange={e => { setFilterStart(e.target.value); setFilterYear(''); setFilterMonth(''); }} style={{ padding: '4px 8px' }} />
                </div>
                <div className="filter-group">
                  <label>To</label>
                  <input type="date" value={filterEnd} onChange={e => { setFilterEnd(e.target.value); setFilterYear(''); setFilterMonth(''); }} style={{ padding: '4px 8px' }} />
                </div>
                {hasFilters && (
                  <button className="btn-clear-filters" onClick={clearFilters}>Clear filters</button>
                )}
              </div>
              {hasFilters && (
                <div className="filter-summary">
                  <span className="filter-count">
                    <strong>{countableOrders.length}</strong> confirmed orders in range
                  </span>
                </div>
              )}
            </div>

            {/* ── Stat Tiles ── */}
            <div className="dashboard-tiles">
              <div className="tile tile-grand">
                <div className="tile-label">Grand Total {hasFilters && <span style={{ fontSize: 11, fontWeight: 400 }}>(filtered)</span>}</div>
                <div className="tile-amount">CA${grandTotal.toFixed(2)}</div>
                <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-muted)' }}>
                  Earned: <strong style={{ color: 'var(--text-secondary)' }}>CA${(grandTotal + totalTransferred).toFixed(2)}</strong>
                </div>
              </div>

              {/* USD balance card */}
              <div className="tile" style={{ borderLeft: '4px solid #10b981' }}>
                <div className="tile-label">USD Balance {hasFilters && <span style={{ fontSize: 11, fontWeight: 400 }}>(filtered)</span>}</div>
                <div className="tile-type">Confirmed orders · USD</div>
                <div className="tile-amount" style={{ color: '#10b981' }}>${totalUSD.toFixed(2)}</div>
                <div style={{ fontSize: 12, marginTop: 6, color: 'var(--text-muted)' }}>
                  Transferred out: <strong style={{ color: '#ef4444' }}>${usdTransferred.toFixed(2)}</strong>
                </div>
                <div style={{ fontSize: 12, marginTop: 2, color: 'var(--text-muted)' }}>
                  Remaining: <strong style={{ color: '#10b981' }}>${usdRemaining.toFixed(2)}</strong>
                </div>
              </div>

              <div className="tile" style={{ borderLeft: '4px solid #f59e0b' }}>
                <div className="tile-label">Total Commission Paid</div>
                <div className="tile-type">All accounts · transfers only</div>
                <div className="tile-amount" style={{ color: '#f59e0b' }}>CA${totalTransferCommission.toFixed(2)}</div>
              </div>
              <div className="tile" style={{ borderLeft: '4px solid #ef4444' }}>
                <div className="tile-label">Total Transferred</div>
                <div className="tile-type">All accounts · incl. commission</div>
                <div className="tile-amount" style={{ color: 'var(--danger)' }}>CA${totalTransferred.toFixed(2)}</div>
                {transfersByAccount.map(acc => (
                  <div key={acc.id} style={{ fontSize: 12, marginTop: 4, color: 'var(--text-muted)' }}>
                    {acc.name} ({acc.type}): <strong style={{ color: 'var(--text-secondary)' }}>CA${acc.transferred.toFixed(2)}</strong>
                  </div>
                ))}
              </div>
              {tilesByAccount.map(acc => (
                <div key={acc.id} className="tile">
                  <div className="tile-label">{acc.name}</div>
                  <div className="tile-type">{acc.type} · {acc.email}</div>
                  <div className="tile-amount">CA${acc.total.toFixed(2)}</div>
                  {!hasFilters && acc.opening_balance > 0 && (
                    <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-muted)' }}>
                      Incl. opening balance: <strong style={{ color: '#059669' }}>CA${Number(acc.opening_balance).toFixed(2)}</strong>
                    </div>
                  )}
                </div>
              ))}
              {accounts.length === 0 && (
                <div className="tile" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  No billing accounts yet. <a href="/editor/billing" style={{ color: 'var(--primary)' }}>Add one</a>
                </div>
              )}
            </div>

            <div className="page-header" style={{ marginTop: 8 }}>
              <div>
                <h3 className="page-title" style={{ fontSize: 18 }}>
                  Open Orders ({openOrders.length})
                </h3>
                <p className="page-subtitle">Click an order to confirm payment</p>
              </div>
            </div>

            <div className="table-card">
              <div className="table-wrapper">
                <table className="orders-table">
                  <thead>
                    <tr>
                      <th>Order #</th>
                      <th>Date</th>
                      <th>Customer</th>
                      <th>Source</th>
                      <th>Amount (USD)</th>
                      <th>Payment</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {openOrders.length === 0 && (
                      <tr><td colSpan="7" className="no-data">No open orders.</td></tr>
                    )}
                    {openOrders.map(o => (
                      <tr key={o.id} onClick={() => setConfirmOrder(o)} style={{ cursor: 'pointer' }}>
                        <td><span className="order-num">{o.order_number}</span></td>
                        <td>{o.date}</td>
                        <td>{o.customer}</td>
                        <td><span className="badge badge-none">{o.source}</span></td>
                        <td>{o.order_amount != null ? `$${Number(o.order_amount).toFixed(2)}` : '—'}</td>
                        <td>{o.payment_method || '—'}</td>
                        <td>
                          <button
                            className="btn-sm"
                            style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontWeight: 600 }}
                            onClick={e => { e.stopPropagation(); setConfirmOrder(o); }}
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {confirmOrder && (
        <ConfirmOrderModal
          order={confirmOrder}
          accounts={accounts}
          onClose={() => setConfirmOrder(null)}
          onConfirmed={handleConfirmed}
        />
      )}
    </AppLayout>
  );
}
