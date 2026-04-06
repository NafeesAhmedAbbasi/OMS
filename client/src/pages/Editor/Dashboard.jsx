import { useEffect, useState } from 'react';
import api from '../../api';
import AppLayout from '../../components/AppLayout';
import ConfirmOrderModal from './ConfirmOrderModal';

export default function EditorDashboard() {
  const [orders, setOrders]       = useState([]);
  const [accounts, setAccounts]   = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [confirmOrder, setConfirmOrder] = useState(null);

  useEffect(() => {
    Promise.all([api.get('/orders'), api.get('/billing'), api.get('/billing/transfers')])
      .then(([ordRes, bilRes, tRes]) => {
        setOrders(ordRes.data);
        setAccounts(bilRes.data);
        setTransfers(tRes.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const countableOrders = orders.filter(o => o.status === 'confirmed' || o.status === 'dispute_won');
  const totalTransferCommission = transfers.reduce((sum, t) => sum + (t.commission || 0), 0);
  const totalTransferred = transfers.reduce((sum, t) => sum + (t.total_deducted || 0), 0);
  const grandTotal = countableOrders.reduce((sum, o) => sum + (o.net_amount || 0), 0) - totalTransferred;

  const transfersByAccount = accounts.map(acc => ({
    ...acc,
    transferred: transfers
      .filter(t => t.billing_account_id === acc.id)
      .reduce((sum, t) => sum + (t.total_deducted || 0), 0),
  })).filter(acc => acc.transferred > 0);

  const tilesByAccount = accounts.map(acc => ({
    ...acc,
    total: countableOrders
      .filter(o => o.confirmed_billing_account_id === acc.id)
      .reduce((sum, o) => sum + (o.net_amount || 0), 0)
      - transfers
        .filter(t => t.billing_account_id === acc.id)
        .reduce((sum, t) => sum + (t.total_deducted || 0), 0),
  }));

  const openOrders = orders.filter(o => o.status === 'open');

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
            <div className="dashboard-tiles">
              <div className="tile tile-grand">
                <div className="tile-label">Grand Total</div>
                <div className="tile-amount">CA${grandTotal.toFixed(2)}</div>
                <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-muted)' }}>
                  Earned: <strong style={{ color: 'var(--text-secondary)' }}>CA${(grandTotal + totalTransferred).toFixed(2)}</strong>
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
