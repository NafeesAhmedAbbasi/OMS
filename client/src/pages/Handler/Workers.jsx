import { useEffect, useState } from 'react';
import api from '../../api';
import AppLayout from '../../components/AppLayout';

const today = new Date().toISOString().slice(0, 10);

function fmt(n) {
  return Number(n || 0).toLocaleString('en-PK');
}

export default function Workers() {
  const [workers, setWorkers]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  // Add worker form
  const EMPTY_WORKER = { name: '', role: 'manufacturer', opening_balance_pkr: '' };
  const [form, setForm]         = useState(EMPTY_WORKER);
  const [saving, setSaving]     = useState(false);

  // Payment drawer
  const [payWorker, setPayWorker]   = useState(null);
  const [payments, setPayments]     = useState([]);
  const [payLoading, setPayLoading] = useState(false);
  const EMPTY_PAY = { amount_pkr: '', date: today, note: '' };
  const [payForm, setPayForm]       = useState(EMPTY_PAY);
  const [paySaving, setPaySaving]   = useState(false);
  const [editingOB, setEditingOB]   = useState('');
  const [obSaving, setObSaving]     = useState(false);

  // Inline edit
  const [editingWorker, setEditingWorker] = useState(null); // { id, name, opening_balance_pkr }
  const [editSaving, setEditSaving]       = useState(false);
  // but for workers we need the handler's own id. We store it on load.
  const [handlerId, setHandlerId] = useState(null);

  useEffect(() => {
    // Get handler id from current user info (stored in localStorage by auth)
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.id) {
      setHandlerId(user.id);
      loadWorkers(user.id);
    } else {
      setError('Could not identify handler. Please log in again.');
      setLoading(false);
    }
  }, []);

  async function loadWorkers(hid) {
    setLoading(true);
    try {
      const res = await api.get(`/handlers/${hid}/workers`);
      setWorkers(res.data);
    } catch {
      setError('Failed to load workers.');
    } finally {
      setLoading(false);
    }
  }

  async function addWorker() {
    if (!form.name.trim()) return setError('Name is required.');
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await api.post(`/handlers/${handlerId}/workers`, form);
      setWorkers(prev => [...prev, res.data]);
      setForm(EMPTY_WORKER);
      setSuccess(`${res.data.name} added.`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add worker.');
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    setEditSaving(true); setError(''); setSuccess('');
    try {
      const payload = {
        name: editingWorker.name.trim(),
        opening_balance_pkr: parseFloat(editingWorker.opening_balance_pkr) || 0,
      };
      await api.put(`/handlers/${handlerId}/workers/${editingWorker.id}`, payload);
      const ob = payload.opening_balance_pkr;
      setWorkers(prev => prev.map(w => {
        if (w.id !== editingWorker.id) return w;
        const diff = ob - (w.opening_balance_pkr || 0);
        return { ...w, name: payload.name, opening_balance_pkr: ob, total_owed: (w.total_owed || 0) + diff, balance: (w.balance || 0) + diff };
      }));
      setEditingWorker(null);
      setSuccess('Worker updated.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update.');
    } finally {
      setEditSaving(false);
    }
  }

  async function toggleActive(worker) {
    try {
      const res = await api.put(`/handlers/${handlerId}/workers/${worker.id}`, { is_active: !worker.is_active });
      setWorkers(prev => prev.map(w => w.id === worker.id ? { ...w, is_active: res.data.is_active } : w));
    } catch {
      setError('Failed to update worker.');
    }
  }

  async function deleteWorker(worker) {
    if (!window.confirm(`Delete ${worker.name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/handlers/${handlerId}/workers/${worker.id}`);
      setWorkers(prev => prev.filter(w => w.id !== worker.id));
      setSuccess(`${worker.name} deleted.`);
    } catch {
      setError('Failed to delete worker.');
    }
  }

  async function openPayments(worker) {
    setPayWorker(worker);
    setEditingOB(worker.opening_balance_pkr != null ? String(worker.opening_balance_pkr) : '0');
    setPayLoading(true);
    setPayForm(EMPTY_PAY);
    try {
      const res = await api.get(`/handlers/${handlerId}/workers/${worker.id}/payments`);
      setPayments(res.data);
    } catch {
      setError('Failed to load payments.');
    } finally {
      setPayLoading(false);
    }
  }

  async function addPayment() {
    if (!payForm.amount_pkr || !payForm.date) return setError('Amount and date are required.');
    setPaySaving(true); setError(''); setSuccess('');
    try {
      const res = await api.post(`/handlers/${handlerId}/workers/${payWorker.id}/payments`, payForm);
      setPayments(prev => [res.data, ...prev]);
      const paid = parseFloat(res.data.amount_pkr);
      setWorkers(prev => prev.map(w => w.id === payWorker.id
        ? { ...w, total_paid: (w.total_paid || 0) + paid, balance: (w.balance || 0) - paid }
        : w));
      setPayWorker(prev => ({ ...prev, total_paid: (prev.total_paid || 0) + paid, balance: (prev.balance || 0) - paid }));
      setPayForm(EMPTY_PAY);
      setSuccess('Payment recorded.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed.');
    } finally {
      setPaySaving(false);
    }
  }

  async function saveOpeningBalance() {
    setObSaving(true); setError(''); setSuccess('');
    try {
      const ob = parseFloat(editingOB) || 0;
      await api.put(`/handlers/${handlerId}/workers/${payWorker.id}`, { opening_balance_pkr: ob });
      const diff = ob - (payWorker.opening_balance_pkr || 0);
      setWorkers(prev => prev.map(w => w.id === payWorker.id
        ? { ...w, opening_balance_pkr: ob, total_owed: (w.total_owed || 0) + diff, balance: (w.balance || 0) + diff }
        : w));
      setPayWorker(prev => ({ ...prev, opening_balance_pkr: ob, total_owed: (prev.total_owed || 0) + diff, balance: (prev.balance || 0) + diff }));
      setSuccess('Previous balance updated.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed.');
    } finally {
      setObSaving(false);
    }
  }

  async function deletePayment(pay) {
    if (!window.confirm(`Delete payment of PKR ${fmt(pay.amount_pkr)}?`)) return;
    try {
      await api.delete(`/handlers/${handlerId}/workers/${payWorker.id}/payments/${pay.id}`);
      setPayments(prev => prev.filter(p => p.id !== pay.id));
      const amt = parseFloat(pay.amount_pkr);
      setWorkers(prev => prev.map(w => w.id === payWorker.id
        ? { ...w, total_paid: (w.total_paid || 0) - amt, balance: (w.balance || 0) + amt }
        : w));
      setPayWorker(prev => ({ ...prev, total_paid: (prev.total_paid || 0) - amt, balance: (prev.balance || 0) + amt }));
    } catch {
      setError('Failed to delete payment.');
    }
  }

  const manufacturers = workers.filter(w => w.role === 'manufacturer');
  const shippers      = workers.filter(w => w.role === 'shipper');

  return (
    <AppLayout>
      <div className="page-container">
        <div className="page-header">
          <div>
            <h2 className="page-title">My Workers</h2>
            <p className="page-subtitle">Manage manufacturers and shippers, track payments</p>
          </div>
        </div>

        {error   && <p className="error-msg">{error}</p>}
        {success && <p className="success-msg" onClick={() => setSuccess('')}>{success}</p>}

        {/* Add Worker */}
        <div className="table-card" style={{ marginBottom: 24, padding: '20px 24px' }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 14 }}>Add Worker</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 180 }}>
              <label>Name <span className="required">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Kashif"
              />
            </div>
            <div className="form-group" style={{ margin: 0, width: 160 }}>
              <label>Role <span className="required">*</span></label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="manufacturer">Manufacturer</option>
                <option value="shipper">Shipper</option>
              </select>
            </div>
            <div className="form-group" style={{ margin: 0, width: 160 }}>
              <label>Previous Balance (PKR)</label>
              <input
                type="number"
                value={form.opening_balance_pkr}
                onChange={e => setForm(f => ({ ...f, opening_balance_pkr: e.target.value }))}
                placeholder="0"
                min="0"
              />
            </div>
            <button className="btn-primary btn-sm" onClick={addWorker} disabled={saving} style={{ marginBottom: 1 }}>
              {saving ? 'Adding…' : 'Add Worker'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Loading…</div>
        ) : (
          <>
            {/* Manufacturers */}
            <WorkerSection
              title="Manufacturers"
              workers={manufacturers}
              onToggle={toggleActive}
              onDelete={deleteWorker}
              onPayments={openPayments}
              editingWorker={editingWorker}
              setEditingWorker={setEditingWorker}
              onSaveEdit={saveEdit}
              editSaving={editSaving}
            />

            {/* Shippers */}
            <WorkerSection
              title="Shippers"
              workers={shippers}
              onToggle={toggleActive}
              onDelete={deleteWorker}
              onPayments={openPayments}
              editingWorker={editingWorker}
              setEditingWorker={setEditingWorker}
              onSaveEdit={saveEdit}
              editSaving={editSaving}
            />
          </>
        )}
      </div>

      {/* ── Payment Drawer ── */}
      {payWorker && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.35)', display: 'flex', justifyContent: 'flex-end' }}
          onClick={() => { setPayWorker(null); setError(''); setSuccess(''); }}
        >
          <div
            style={{ width: 'min(520px,97vw)', height: '100%', background: 'var(--surface)', overflowY: 'auto', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17 }}>{payWorker.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize', marginTop: 2 }}>{payWorker.role}</div>
                <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 13 }}>
                  <span>Owed: <strong style={{ color: '#dc2626' }}>PKR {fmt(payWorker.total_owed)}</strong></span>
                  <span>Paid: <strong style={{ color: '#059669' }}>PKR {fmt(payWorker.total_paid)}</strong></span>
                  <span>
                    {payWorker.balance > 0
                      ? <><strong style={{ color: '#dc2626' }}>PKR {fmt(payWorker.balance)}</strong> <span style={{ color: 'var(--text-muted)' }}>outstanding</span></>
                      : payWorker.balance < 0
                        ? <><strong style={{ color: '#059669' }}>PKR {fmt(Math.abs(payWorker.balance))}</strong> <span style={{ color: 'var(--text-muted)' }}>overpaid</span></>
                        : <span style={{ color: 'var(--text-muted)' }}>Settled</span>}
                  </span>
                </div>
              </div>
              <button className="btn-ghost btn-sm" onClick={() => setPayWorker(null)} style={{ fontSize: 18, padding: '4px 10px' }}>✕</button>
            </div>

            <div style={{ padding: '20px 24px', flex: 1 }}>
              {error   && <p className="error-msg">{error}</p>}
              {success && <p className="success-msg">{success}</p>}

              {/* Previous Balance */}
              <div style={{ marginBottom: 28, padding: '12px 16px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div className="detail-section-title" style={{ marginBottom: 10 }}>Previous Balance (PKR)</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                  Amount owed before any orders were recorded in the system.
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ margin: 0, width: 160 }}>
                    <input type="number" value={editingOB} onChange={e => setEditingOB(e.target.value)} placeholder="0" min="0" />
                  </div>
                  <button className="btn-ghost btn-sm" onClick={saveOpeningBalance} disabled={obSaving} style={{ marginBottom: 1 }}>
                    {obSaving ? 'Saving…' : 'Update'}
                  </button>
                </div>
              </div>

              {/* Record Payment */}
              <div style={{ marginBottom: 28 }}>
                <div className="detail-section-title" style={{ marginBottom: 10 }}>Record Payment</div>
                {payWorker.balance > 0 && (
                  <div style={{ fontSize: 13, color: '#dc2626', marginBottom: 10 }}>
                    Outstanding: <strong>PKR {fmt(payWorker.balance)}</strong>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ margin: 0, width: 150 }}>
                    <label>Amount (PKR) <span className="required">*</span></label>
                    <input type="number" value={payForm.amount_pkr} onChange={e => setPayForm(f => ({ ...f, amount_pkr: e.target.value }))} placeholder="e.g. 5000" min="0" />
                  </div>
                  <div className="form-group" style={{ margin: 0, width: 150 }}>
                    <label>Date <span className="required">*</span></label>
                    <input type="date" value={payForm.date} onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 140 }}>
                    <label>Note</label>
                    <input type="text" value={payForm.note} onChange={e => setPayForm(f => ({ ...f, note: e.target.value }))} placeholder="Optional" />
                  </div>
                  <button className="btn-primary btn-sm" onClick={addPayment} disabled={paySaving} style={{ marginBottom: 1 }}>
                    {paySaving ? 'Saving…' : 'Record'}
                  </button>
                </div>
              </div>

              {/* Payment History */}
              <div>
                <div className="detail-section-title" style={{ marginBottom: 10 }}>Payment History</div>
                {payLoading ? (
                  <div className="loading-state">Loading…</div>
                ) : payments.length === 0 ? (
                  <div className="no-data">No payments recorded yet.</div>
                ) : (
                  <div className="table-wrapper">
                    <table className="orders-table">
                      <thead>
                        <tr><th>Date</th><th>Amount (PKR)</th><th>Note</th><th></th></tr>
                      </thead>
                      <tbody>
                        {payments.map(p => (
                          <tr key={p.id}>
                            <td>{p.date}</td>
                            <td><strong style={{ color: '#059669' }}>PKR {fmt(p.amount_pkr)}</strong></td>
                            <td style={{ color: '#6b7280' }}>{p.note || '—'}</td>
                            <td>
                              <button className="btn-ghost btn-sm" style={{ borderColor: '#fecaca', color: '#dc2626' }} onClick={() => deletePayment(p)}>✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function WorkerSection({ title, workers, onToggle, onDelete, onPayments, editingWorker, setEditingWorker, onSaveEdit, editSaving }) {
  return (
    <div className="table-card" style={{ marginBottom: 20 }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 600, fontSize: 14 }}>
        {title} ({workers.length})
      </div>
      {workers.length === 0 ? (
        <div className="empty-state" style={{ padding: '20px 24px', color: 'var(--text-muted)', fontSize: 13 }}>
          No {title.toLowerCase()} added yet.
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Total Owed (PKR)</th>
                <th>Total Paid (PKR)</th>
                <th>Outstanding (PKR)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {workers.map(w => {
                const isEditing = editingWorker?.id === w.id;
                return (
                  <tr key={w.id}>
                    <td>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingWorker.name}
                          onChange={e => setEditingWorker(prev => ({ ...prev, name: e.target.value }))}
                          style={{ width: '100%', maxWidth: 160 }}
                          autoFocus
                        />
                      ) : (
                        <strong>{w.name}</strong>
                      )}
                    </td>
                    <td>
                      <span style={{
                        fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 12,
                        background: w.is_active ? '#d1fae5' : '#f3f4f6',
                        color: w.is_active ? '#065f46' : '#6b7280',
                      }}>
                        {w.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ color: '#dc2626', fontWeight: 600 }}>
                      {Number(w.total_owed || 0).toLocaleString('en-PK')}
                      {!isEditing && w.opening_balance_pkr > 0 && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, display: 'block' }}>
                          incl. PKR {Number(w.opening_balance_pkr).toLocaleString('en-PK')} prev.
                        </span>
                      )}
                      {isEditing && (
                        <div style={{ marginTop: 4 }}>
                          <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Prev. balance</label>
                          <input
                            type="number"
                            value={editingWorker.opening_balance_pkr}
                            onChange={e => setEditingWorker(prev => ({ ...prev, opening_balance_pkr: e.target.value }))}
                            style={{ width: 110, marginTop: 2 }}
                            min="0"
                            placeholder="0"
                          />
                        </div>
                      )}
                    </td>
                    <td style={{ color: '#059669', fontWeight: 600 }}>
                      {Number(w.total_paid || 0).toLocaleString('en-PK')}
                    </td>
                    <td>
                      {w.balance > 0 ? (
                        <span style={{ fontWeight: 700, color: '#dc2626' }}>{Number(w.balance).toLocaleString('en-PK')}</span>
                      ) : w.balance < 0 ? (
                        <span style={{ color: '#059669', fontWeight: 600 }}>{Number(Math.abs(w.balance)).toLocaleString('en-PK')} <span style={{ fontSize: 11, fontWeight: 400 }}>(overpaid)</span></span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn-primary btn-sm" onClick={onSaveEdit} disabled={editSaving}>{editSaving ? 'Saving…' : 'Save'}</button>
                          <button className="btn-ghost btn-sm" onClick={() => setEditingWorker(null)}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn-ghost btn-sm" onClick={() => onPayments(w)}>Payments</button>
                          <button className="btn-ghost btn-sm" onClick={() => setEditingWorker({ id: w.id, name: w.name, opening_balance_pkr: String(w.opening_balance_pkr || 0) })}>Edit</button>
                          <button className="btn-ghost btn-sm" onClick={() => onToggle(w)}>
                            {w.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button className="btn-ghost btn-sm" style={{ borderColor: '#fecaca', color: '#dc2626' }} onClick={() => onDelete(w)}>Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
