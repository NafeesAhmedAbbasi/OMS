import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import AppLayout from '../../components/AppLayout';

function fmt(n) { return Number(n || 0).toLocaleString('en-PK'); }

export default function Handlers() {
  const [handlers, setHandlers] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const navigate = useNavigate();

  // Commission rate modal
  const [commModal, setCommModal]   = useState(null);
  const [commRate, setCommRate]     = useState('');
  const [commSaving, setCommSaving] = useState(false);

  useEffect(() => {
    api.get('/handlers')
      .then(res => { setHandlers(res.data); setError(''); })
      .catch(() => setError('Failed to load handlers. The server may still be deploying — please refresh in a moment.'))
      .finally(() => setLoading(false));
  }, []);

  function openCommissions(handler) {
    setCommModal(handler);
    setCommRate(String(handler.commissionRate || 0));
  }

  async function saveCommissionRate() {
    setCommSaving(true); setError('');
    try {
      const res = await api.put(`/handlers/${commModal.id}/commission-rate`, { rate_per_unit_pkr: parseFloat(commRate) || 0 });
      setHandlers(prev => prev.map(h => h.id === commModal.id ? { ...h, commissionRate: res.data.rate_per_unit_pkr } : h));
      setCommModal(null);
      setSuccess(`Commission rate saved for ${commModal.username}.`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed');
    } finally {
      setCommSaving(false);
    }
  }

  return (
    <AppLayout>
      <div className="page-container">
        <div className="page-header">
          <div><h2 className="page-title">Handlers</h2><p className="page-subtitle">Billing status, commissions and payments</p></div>
        </div>

        {error   && <p className="error-msg">{error}</p>}
        {success && <p className="success-msg">{success}</p>}

        {loading ? <div className="loading-state">Loading…</div> : !handlers ? null : handlers.length === 0 ? (
          <div className="table-card"><div className="no-data" style={{ padding: 32 }}>
            No handlers yet. <a href="/admin/users" style={{ color: 'var(--primary)' }}>Create a user with role "handler"</a> first.
          </div></div>
        ) : (
          <div className="table-card">
            <div className="table-wrapper">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Handler</th>
                    <th>Status</th>
                    <th>Orders</th>
                    <th>Commission Rate</th>
                    <th>Total Billed</th>
                    <th>Total Paid</th>
                    <th>Balance</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {handlers.map(h => {
                    const owed = h.balance;
                    return (
                      <tr key={h.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/admin/handlers/${h.id}`)}>
                        <td><strong>{h.username}</strong></td>
                        <td>
                          <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: h.is_active ? '#d1fae5' : '#fee2e2', color: h.is_active ? '#065f46' : '#991b1b' }}>
                            {h.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600 }}>{h.assignedOrderCount}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>assigned</span>
                        </td>
                        <td style={{ color: '#0369a1', fontWeight: 600 }}>
                          {h.commissionRate > 0 ? `PKR ${fmt(h.commissionRate)}/unit` : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Not set</span>}
                        </td>
                        <td style={{ color: '#dc2626', fontWeight: 600 }}>PKR {fmt(h.totalBilled)}</td>
                        <td style={{ color: '#059669', fontWeight: 600 }}>PKR {fmt(h.totalPaid)}</td>
                        <td>
                          {owed < 0 ? (
                            <span style={{ fontWeight: 700, color: '#dc2626' }}>PKR {fmt(Math.abs(owed))} <span style={{ fontSize: 11, fontWeight: 400 }}>owed</span></span>
                          ) : owed > 0 ? (
                            <span style={{ fontWeight: 700, color: '#059669' }}>PKR {fmt(owed)} <span style={{ fontSize: 11, fontWeight: 400 }}>surplus</span></span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
                          )}
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn-ghost btn-sm" onClick={() => openCommissions(h)}>Commission</button>
                            <button className="btn-primary btn-sm" onClick={() => navigate(`/admin/handlers/${h.id}`)}>View</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Commission Rate Modal ── */}
      {commModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setCommModal(null)}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 28, width: 'min(380px,95vw)', boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>{commModal.username} — Commission Rate</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>PKR per unit (piece/item). Commission = rate × quantity per order.</div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Rate per unit (PKR)</label>
              <input type="number" value={commRate} onChange={e => setCommRate(e.target.value)} min="0" step="1" placeholder="e.g. 200" autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setCommModal(null)}>Cancel</button>
              <button className="btn-primary" onClick={saveCommissionRate} disabled={commSaving}>{commSaving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
