import { useEffect, useState } from 'react';
import api from '../../api';
import AppLayout from '../../components/AppLayout';

export default function AdminTransfers() {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    api.get('/billing/transfers')
      .then(res => setTransfers(res.data))
      .finally(() => setLoading(false));
  }, []);

  const totalCad    = transfers.reduce((s, t) => s + (t.total_deducted || 0), 0);
  const totalPkr    = transfers.reduce((s, t) => s + (t.amount_pkr || 0), 0);
  const hasPkr      = transfers.some(t => t.amount_pkr != null);

  return (
    <AppLayout>
      <div className="page-container">
        <div className="page-header">
          <div>
            <h2 className="page-title">Transfers Overview</h2>
            <p className="page-subtitle">All withdrawals recorded by editors</p>
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
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => setDrawerOpen(true)}
                title="Click to view transfer history"
              >
                <div className="tile-label">Total Transferred</div>
                {hasPkr && (
                  <div className="tile-amount">PKR {totalPkr.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</div>
                )}
                <div style={{ fontSize: hasPkr ? 14 : undefined }} className={hasPkr ? undefined : 'tile-amount'}>
                  {hasPkr
                    ? <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>CA${totalCad.toFixed(2)} sent</span>
                    : `CA$${totalCad.toFixed(2)}`}
                </div>
                <div style={{ fontSize: 11, marginTop: 6, color: 'var(--primary)', fontWeight: 500 }}>
                  {transfers.length} transfer{transfers.length !== 1 ? 's' : ''} · click to view
                </div>
              </div>
            </div>

            {/* ── Drawer Overlay ── */}
            {drawerOpen && (
              <div
                style={{
                  position: 'fixed', inset: 0, zIndex: 200,
                  background: 'rgba(0,0,0,0.35)',
                  display: 'flex', justifyContent: 'flex-end',
                }}
                onClick={() => setDrawerOpen(false)}
              >
                <div
                  style={{
                    width: 'min(860px, 95vw)', height: '100%',
                    background: 'var(--surface)', overflowY: 'auto',
                    boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
                    display: 'flex', flexDirection: 'column',
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <div style={{
                    padding: '20px 24px', borderBottom: '1px solid var(--border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 17 }}>Transfer History</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {transfers.length} record{transfers.length !== 1 ? 's' : ''}
                        {hasPkr && ` · PKR ${totalPkr.toLocaleString('en-PK', { maximumFractionDigits: 0 })} · `}
                        {` CA$${totalCad.toFixed(2)} total deducted`}
                      </div>
                    </div>
                    <button
                      className="btn-ghost btn-sm"
                      onClick={() => setDrawerOpen(false)}
                      style={{ fontSize: 18, lineHeight: 1, padding: '4px 10px' }}
                    >✕</button>
                  </div>

                  <div style={{ padding: '16px 24px', flex: 1 }}>
                    <div className="table-wrapper">
                      <table className="orders-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Account</th>
                            <th>Amount (CAD)</th>
                            <th>Amount (PKR)</th>
                            <th>Commission</th>
                            <th>Total Deducted</th>
                            <th>Service</th>
                            <th>Tracking</th>
                            <th>Comment</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transfers.length === 0 && (
                            <tr><td colSpan="9" className="no-data">No transfers yet.</td></tr>
                          )}
                          {transfers.map(t => (
                            <tr key={t.id}>
                              <td>{t.date}</td>
                              <td>{t.billing_account_name}</td>
                              <td>CA${Number(t.amount).toFixed(2)}</td>
                              <td>
                                {t.amount_pkr != null
                                  ? <strong>PKR {Number(t.amount_pkr).toLocaleString('en-PK', { maximumFractionDigits: 0 })}</strong>
                                  : <span className="text-muted">—</span>}
                              </td>
                              <td>CA${Number(t.commission).toFixed(2)} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>(10%)</span></td>
                              <td style={{ fontWeight: 600, color: 'var(--danger)' }}>CA${Number(t.total_deducted).toFixed(2)}</td>
                              <td>{t.service}</td>
                              <td>{t.tracking || <span className="text-muted">—</span>}</td>
                              <td>{t.comment || <span className="text-muted">—</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
