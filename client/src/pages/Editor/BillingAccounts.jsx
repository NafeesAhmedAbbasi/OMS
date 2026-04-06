import { useEffect, useState } from 'react';
import api from '../../api';
import AppLayout from '../../components/AppLayout';
import { BILLING_ACCOUNT_TYPES } from '../../constants';

const EMPTY_FORM = { name: '', type: '', email: '' };

export default function BillingAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [editing, setEditing]   = useState(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  useEffect(() => {
    api.get('/billing')
      .then(res => setAccounts(res.data))
      .finally(() => setLoading(false));
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  function startEdit(acc) {
    setEditing(acc);
    setForm({ name: acc.name, type: acc.type, email: acc.email });
    setError('');
    setSuccess('');
  }

  function cancelEdit() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
  }

  async function handleSave() {
    if (!form.name || !form.type || !form.email) {
      setError('All fields are required');
      return;
    }
    setError('');
    setSaving(true);
    try {
      if (editing) {
        const res = await api.put(`/billing/${editing.id}`, form);
        setAccounts(prev => prev.map(a => a.id === editing.id ? res.data : a));
        setSuccess('Account updated.');
      } else {
        const res = await api.post('/billing', form);
        setAccounts(prev => [...prev, res.data]);
        setSuccess('Account created.');
      }
      setEditing(null);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(acc) {
    if (!window.confirm(`Delete "${acc.name}"?`)) return;
    try {
      await api.delete(`/billing/${acc.id}`);
      setAccounts(prev => prev.filter(a => a.id !== acc.id));
      setSuccess('Account deleted.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete');
    }
  }

  return (
    <AppLayout>
      <div className="page-container">
        <div className="page-header">
          <div>
            <h2 className="page-title">Billing Accounts</h2>
            <p className="page-subtitle">Manage PayPal and Stripe accounts</p>
          </div>
        </div>

        {error   && <p className="error-msg">{error}</p>}
        {success && <p className="success-msg">{success}</p>}

        <div className="order-form-card" style={{ marginBottom: 24 }}>
          <div className="detail-section-title" style={{ marginBottom: 16 }}>
            {editing ? `Edit: ${editing.name}` : 'Add New Account'}
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label>Name <span className="required">*</span></label>
              <input
                type="text" name="name" value={form.name}
                onChange={handleChange} placeholder="e.g. PayPal Main"
              />
            </div>
            <div className="form-group">
              <label>Type <span className="required">*</span></label>
              <select name="type" value={form.type} onChange={handleChange}>
                <option value="">Select type</option>
                {BILLING_ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Email <span className="required">*</span></label>
              <input
                type="email" name="email" value={form.email}
                onChange={handleChange} placeholder="account@example.com"
              />
            </div>
          </div>
          <div className="form-actions">
            {editing && (
              <button className="btn-ghost" onClick={cancelEdit}>Cancel</button>
            )}
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Update Account' : 'Add Account'}
            </button>
          </div>
        </div>

        <div className="table-card">
          {loading ? (
            <div className="loading-state">Loading…</div>
          ) : (
            <div className="table-wrapper">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Email</th>
                    <th>Created</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.length === 0 && (
                    <tr><td colSpan="5" className="no-data">No billing accounts yet.</td></tr>
                  )}
                  {accounts.map(acc => (
                    <tr key={acc.id}>
                      <td>{acc.name}</td>
                      <td><span className="badge badge-none">{acc.type}</span></td>
                      <td>{acc.email}</td>
                      <td>{acc.created_at?.slice(0, 10) || '—'}</td>
                      <td style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button className="btn-secondary btn-sm" onClick={() => startEdit(acc)}>Edit</button>
                        <button
                          className="btn-ghost btn-sm"
                          style={{ borderColor: '#fecaca', color: 'var(--danger)' }}
                          onClick={() => handleDelete(acc)}
                        >
                          Delete
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
    </AppLayout>
  );
}
