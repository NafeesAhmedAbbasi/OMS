import { useEffect, useState } from 'react';
import api from '../../api';
import AppLayout from '../../components/AppLayout';
import { TRANSFER_SERVICES } from '../../constants';

const today = new Date().toISOString().slice(0, 10);
const EMPTY_FORM = { billing_account_id: '', amount: '', amount_pkr: '', date: today, service: '', tracking: '', comment: '' };

export default function Transfers() {
  const [transfers, setTransfers] = useState([]);
  const [accounts, setAccounts]   = useState([]);
  const [orders, setOrders]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');

  useEffect(() => {
    Promise.all([api.get('/billing/transfers'), api.get('/billing'), api.get('/orders')])
      .then(([tRes, aRes, oRes]) => {
        setTransfers(tRes.data);
        setAccounts(aRes.data);
        setOrders(oRes.data);
      })
      .finally(() => setLoading(false));
  }, []);

  function getAccountBalance(accountId) {
    if (!accountId) return null;
    const id = parseInt(accountId);
    const earned = orders
      .filter(o => (o.status === 'confirmed' || o.status === 'dispute_won') && o.confirmed_billing_account_id === id)
      .reduce((sum, o) => sum + (o.net_amount || 0), 0);
    const spent = transfers
      .filter(t => t.billing_account_id === id)
      .reduce((sum, t) => sum + (t.total_deducted || 0), 0);
    return earned - spent;
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  const previewCommission = form.amount ? (parseFloat(form.amount || 0) * 0.10).toFixed(2) : null;
  const previewTotal      = form.amount ? (parseFloat(form.amount || 0) * 1.10).toFixed(2) : null;

  async function handleSave() {
    if (!form.billing_account_id || !form.amount || !form.date || !form.service) {
      setError('Account, amount, date and service are required');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const res = await api.post('/billing/transfers', form);
      setTransfers(prev => [res.data, ...prev]);
      setForm(EMPTY_FORM);
      setSuccess('Transfer recorded.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(t) {
    if (!window.confirm(`Delete transfer of CA$${Number(t.amount).toFixed(2)} from ${t.billing_account_name}?`)) return;
    try {
      await api.delete(`/billing/transfers/${t.id}`);
      setTransfers(prev => prev.filter(x => x.id !== t.id));
      setSuccess('Transfer deleted.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete');
    }
  }

  return (
    <AppLayout>
      <div className="page-container">
        <div className="page-header">
          <div>
            <h2 className="page-title">Transfer History</h2>
            <p className="page-subtitle">Record withdrawals from billing accounts</p>
          </div>
        </div>

        {error   && <p className="error-msg">{error}</p>}
        {success && <p className="success-msg">{success}</p>}

        {/* ── Add Transfer Form ── */}
        <div className="order-form-card" style={{ marginBottom: 24 }}>
          <div className="detail-section-title" style={{ marginBottom: 16 }}>New Transfer</div>
          <div className="form-grid">
            <div className="form-group">
              <label>Billing Account <span className="required">*</span></label>
              <select name="billing_account_id" value={form.billing_account_id} onChange={handleChange}>
                <option value="">Select account</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
                ))}
              </select>
              {form.billing_account_id && (() => {
                const bal = getAccountBalance(form.billing_account_id);
                return (
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    Available: <strong style={{ color: bal >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      CA${(bal || 0).toFixed(2)}
                    </strong>
                  </div>
                );
              })()}
            </div>
            <div className="form-group">
              <label>Amount (CAD) <span className="required">*</span></label>
              <input
                type="number" name="amount" value={form.amount}
                onChange={handleChange} placeholder="e.g. 500.00"
                step="0.01" min="0"
              />
            </div>
            <div className="form-group">
              <label>Date <span className="required">*</span></label>
              <input type="date" name="date" value={form.date} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Service <span className="required">*</span></label>
              <select name="service" value={form.service} onChange={handleChange}>
                <option value="">Select service</option>
                {TRANSFER_SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Amount (PKR)</label>
              <input
                type="number" name="amount_pkr" value={form.amount_pkr}
                onChange={handleChange} placeholder="Optional"
                step="1" min="0"
              />
            </div>
            <div className="form-group">
              <label>Tracking / Transaction ID</label>
              <input
                type="text" name="tracking" value={form.tracking}
                onChange={handleChange} placeholder="Optional"
              />
            </div>
            <div className="form-group">
              <label>Comment</label>
              <input
                type="text" name="comment" value={form.comment}
                onChange={handleChange} placeholder="Optional"
              />
            </div>
          </div>

          {previewCommission && (
            <div style={{ display: 'flex', gap: 24, margin: '8px 0 16px', fontSize: 13 }}>
              <span>Commission (10%): <strong>CA${previewCommission}</strong></span>
              <span>Total Deducted: <strong style={{ color: 'var(--danger)' }}>CA${previewTotal}</strong></span>
            </div>
          )}

          <div className="form-actions">
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Record Transfer'}
            </button>
          </div>
        </div>

        {/* ── Transfer History Table ── */}
        <div className="table-card">
          {loading ? (
            <div className="loading-state">Loading…</div>
          ) : (
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
                      <td>{t.amount_pkr != null ? `PKR ${Number(t.amount_pkr).toLocaleString()}` : <span className="text-muted">—</span>}</td>
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
          )}
        </div>
      </div>
    </AppLayout>
  );
}
