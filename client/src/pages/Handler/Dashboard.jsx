import { useEffect, useState } from 'react';
import api from '../../api';
import AppLayout from '../../components/AppLayout';

const today = new Date().toISOString().slice(0, 10);

function fmt(n) {
  return n != null ? Number(n).toLocaleString('en-PK') : '—';
}

export default function HandlerDashboard() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  // Assign workers modal
  const [assignOrder, setAssignOrder]   = useState(null);
  const [assignForm, setAssignForm]     = useState({ manufacturer_id: '', manufacturer_rate: '', shipper_id: '', shipper_rate: '' });
  const [assignSaving, setAssignSaving] = useState(false);

  // Misc charges form
  const EMPTY_MISC = { description: '', amount_pkr: '', date: today, note: '' };
  const [miscForm, setMiscForm]   = useState(EMPTY_MISC);
  const [miscSaving, setMiscSaving] = useState(false);

  const handlerId = JSON.parse(localStorage.getItem('user') || '{}').id;

  useEffect(() => {
    api.get('/handlers/my/dashboard')
      .then(res => setData(res.data))
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  // ── Assign workers to order ──
  function openAssign(order) {
    // Pre-fill from existing assignments
    const existing = (data?.assignments || []).filter(a => a.order_id === order.id);
    const mfg = existing.find(a => a.role === 'manufacturer');
    const shp = existing.find(a => a.role === 'shipper');
    setAssignForm({
      manufacturer_id:   mfg ? String(mfg.worker_id) : '',
      manufacturer_rate: mfg ? String(mfg.rate_per_unit_pkr) : '',
      shipper_id:        shp ? String(shp.worker_id) : '',
      shipper_rate:      shp ? String(shp.rate_per_unit_pkr) : '',
    });
    setAssignOrder(order);
  }

  async function saveAssignment() {
    setAssignSaving(true); setError('');
    try {
      const payload = {};
      if (assignForm.manufacturer_id) {
        payload.manufacturer_id   = parseInt(assignForm.manufacturer_id);
        payload.manufacturer_rate = parseFloat(assignForm.manufacturer_rate) || 0;
      }
      if (assignForm.shipper_id) {
        payload.shipper_id   = parseInt(assignForm.shipper_id);
        payload.shipper_rate = parseFloat(assignForm.shipper_rate) || 0;
      }
      const res = await api.post(`/handlers/${handlerId}/orders/${assignOrder.id}/assignment`, payload);
      // Update local assignments
      setData(prev => {
        const otherAssignments = (prev.assignments || []).filter(a => a.order_id !== assignOrder.id);
        return { ...prev, assignments: [...otherAssignments, ...res.data] };
      });
      setAssignOrder(null);
      setSuccess('Workers assigned.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save assignment.');
    } finally {
      setAssignSaving(false);
    }
  }

  async function removeAssignment(orderId, role) {
    try {
      await api.delete(`/handlers/${handlerId}/orders/${orderId}/assignment/${role}`);
      setData(prev => ({
        ...prev,
        assignments: (prev.assignments || []).filter(a => !(a.order_id === orderId && a.role === role)),
      }));
    } catch {
      setError('Failed to remove assignment.');
    }
  }

  // ── Misc charges ──
  async function addMiscCharge() {
    if (!miscForm.description.trim() || !miscForm.amount_pkr || !miscForm.date) {
      return setError('Description, amount, and date are required.');
    }
    setMiscSaving(true); setError('');
    try {
      const res = await api.post(`/handlers/${handlerId}/misc-charges`, miscForm);
      setData(prev => ({
        ...prev,
        miscCharges: [res.data, ...(prev.miscCharges || [])],
        totalMisc: (prev.totalMisc || 0) + res.data.amount_pkr,
      }));
      setMiscForm(EMPTY_MISC);
      setSuccess('Charge added.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed.');
    } finally {
      setMiscSaving(false);
    }
  }

  async function deleteMiscCharge(charge) {
    if (!window.confirm(`Delete "${charge.description}" (PKR ${fmt(charge.amount_pkr)})?`)) return;
    try {
      await api.delete(`/handlers/${handlerId}/misc-charges/${charge.id}`);
      setData(prev => ({
        ...prev,
        miscCharges: (prev.miscCharges || []).filter(c => c.id !== charge.id),
        totalMisc: (prev.totalMisc || 0) - charge.amount_pkr,
      }));
    } catch {
      setError('Failed to delete charge.');
    }
  }

  if (loading) return <AppLayout><div className="loading-state">Loading…</div></AppLayout>;
  if (error && !data) return <AppLayout><div className="empty-state">{error}</div></AppLayout>;

  const { orders, bills, payments, totalBilled, totalPaid, balance, workers, assignments, miscCharges, totalMisc, commissionRate, workerPayments } = data;

  const manufacturers = (workers || []).filter(w => w.role === 'manufacturer' && w.is_active);
  const shippers      = (workers || []).filter(w => w.role === 'shipper' && w.is_active);

  // Map bills by order_id
  const billsByOrder = {};
  for (const b of bills) {
    if (b.order_id) {
      if (!billsByOrder[b.order_id]) billsByOrder[b.order_id] = [];
      billsByOrder[b.order_id].push(b);
    }
  }

  // Map assignments by order_id
  const assignmentsByOrder = {};
  for (const a of (assignments || [])) {
    if (!assignmentsByOrder[a.order_id]) assignmentsByOrder[a.order_id] = {};
    assignmentsByOrder[a.order_id][a.role] = a;
  }

  const unlinkedBills = bills.filter(b => !b.order_id);

  return (
    <AppLayout>
      <div className="page-container">
        <div className="page-header">
          <div>
            <h2 className="page-title">My Dashboard</h2>
            <p className="page-subtitle">{orders.length} assigned orders</p>
          </div>
        </div>

        {error   && <p className="error-msg">{error}</p>}
        {success && <p className="success-msg" onClick={() => setSuccess('')}>{success}</p>}

        {/* Balance summary */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <div className="stat-card" style={{ flex: 1, minWidth: 140 }}>
            <div className="stat-label">Total Billed</div>
            <div className="stat-value" style={{ color: '#dc2626' }}>PKR {fmt(totalBilled)}</div>
          </div>
          <div className="stat-card" style={{ flex: 1, minWidth: 140 }}>
            <div className="stat-label">Total Paid</div>
            <div className="stat-value" style={{ color: '#059669' }}>PKR {fmt(totalPaid)}</div>
          </div>
          <div className="stat-card" style={{ flex: 1, minWidth: 140 }}>
            <div className="stat-label">Misc Charges</div>
            <div className="stat-value" style={{ color: '#7c3aed' }}>PKR {fmt(totalMisc)}</div>
          </div>
          <div className="stat-card" style={{ flex: 1, minWidth: 140 }}>
            <div className="stat-label">Balance</div>
            <div className="stat-value" style={{ color: balance >= 0 ? '#059669' : '#dc2626' }}>
              PKR {fmt(Math.abs(balance))}
              <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 4 }}>
                {balance >= 0 ? '(surplus)' : '(owed)'}
              </span>
            </div>
          </div>
          {commissionRate > 0 && (
            <div className="stat-card" style={{ flex: 1, minWidth: 140 }}>
              <div className="stat-label">My Commission Rate</div>
              <div className="stat-value" style={{ color: '#0369a1', fontSize: 16 }}>PKR {fmt(commissionRate)}/unit</div>
            </div>
          )}
        </div>

        {/* Assigned orders */}
        <div className="table-card" style={{ marginBottom: 24 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 600 }}>
            Assigned Orders
          </div>
          {orders.length === 0 ? (
            <div className="empty-state">No orders assigned yet.</div>
          ) : (
            <div className="table-wrapper">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Item Type</th>
                    <th>Qty</th>
                    <th>Status</th>
                    <th>Manufacturer</th>
                    <th>Shipper</th>
                    <th>Mfg Cost</th>
                    <th>Ship Cost</th>
                    <th>Commission</th>
                    <th>Total Bill</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => {
                    const orderBills  = billsByOrder[o.id] || [];
                    const shipping    = orderBills.reduce((s, b) => s + (b.shipping_cost_pkr || 0), 0);
                    const mfg         = orderBills.reduce((s, b) => s + (b.manufacturing_cost_pkr || 0), 0);
                    const comm        = orderBills.reduce((s, b) => s + (b.commission_pkr || 0), 0);
                    const total       = orderBills.reduce((s, b) => s + (b.total_pkr || 0), 0);
                    const hasBill     = orderBills.length > 0;
                    const oa          = assignmentsByOrder[o.id] || {};
                    const mfgAssign   = oa['manufacturer'];
                    const shipAssign  = oa['shipper'];

                    // Calculate costs from assignments (preview before bill is added)
                    const qty = o.quantity || 1;
                    const calcMfgCost  = mfgAssign  ? mfgAssign.rate_per_unit_pkr * qty  : null;
                    const calcShipCost = shipAssign ? shipAssign.rate_per_unit_pkr * qty : null;
                    const calcComm     = commissionRate ? commissionRate * qty : null;

                    return (
                      <tr key={o.id}>
                        <td><span className="order-num">{o.order_number}</span></td>
                        <td>{o.date}</td>
                        <td>{o.customer}</td>
                        <td>{o.shoes_type}</td>
                        <td style={{ textAlign: 'center' }}>{qty}</td>
                        <td>
                          <span className={`badge badge-status-${o.status}`}>
                            {o.status?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td>
                          {mfgAssign ? (
                            <div>
                              <span style={{ fontWeight: 500 }}>{mfgAssign.worker_name}</span>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>
                                PKR {fmt(mfgAssign.rate_per_unit_pkr)}/unit
                              </span>
                            </div>
                          ) : <span style={{ color: '#f59e0b', fontSize: 12 }}>Unassigned</span>}
                        </td>
                        <td>
                          {shipAssign ? (
                            <div>
                              <span style={{ fontWeight: 500 }}>{shipAssign.worker_name}</span>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>
                                PKR {fmt(shipAssign.rate_per_unit_pkr)}/unit
                              </span>
                            </div>
                          ) : <span style={{ color: '#f59e0b', fontSize: 12 }}>Unassigned</span>}
                        </td>
                        <td style={{ color: hasBill ? '#374151' : '#9ca3af' }}>
                          {hasBill ? fmt(mfg) : calcMfgCost != null ? <span style={{ color: '#a78bfa' }}>{fmt(calcMfgCost)}</span> : '—'}
                        </td>
                        <td style={{ color: hasBill ? '#374151' : '#9ca3af' }}>
                          {hasBill ? fmt(shipping) : calcShipCost != null ? <span style={{ color: '#a78bfa' }}>{fmt(calcShipCost)}</span> : '—'}
                        </td>
                        <td style={{ color: hasBill ? '#374151' : '#9ca3af' }}>
                          {hasBill ? fmt(comm) : calcComm != null ? <span style={{ color: '#a78bfa' }}>{fmt(calcComm)}</span> : '—'}
                        </td>
                        <td style={{ fontWeight: hasBill ? 600 : 400, color: hasBill ? '#111827' : '#9ca3af' }}>
                          {hasBill ? fmt(total) : (calcMfgCost != null || calcShipCost != null || calcComm != null)
                            ? <span style={{ color: '#a78bfa' }}>{fmt((calcMfgCost || 0) + (calcShipCost || 0) + (calcComm || 0))}</span>
                            : '—'}
                        </td>
                        <td>
                          <button className="btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => openAssign(o)}>
                            Assign
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Misc Charges */}
        <div className="table-card" style={{ marginBottom: 24 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 600 }}>
            Miscellaneous Charges
          </div>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ margin: 0, flex: 2, minWidth: 180 }}>
                <label>Description <span className="required">*</span></label>
                <input type="text" value={miscForm.description} onChange={e => setMiscForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Bought packaging material" />
              </div>
              <div className="form-group" style={{ margin: 0, width: 130 }}>
                <label>Amount (PKR) <span className="required">*</span></label>
                <input type="number" value={miscForm.amount_pkr} onChange={e => setMiscForm(f => ({ ...f, amount_pkr: e.target.value }))} placeholder="0" min="0" />
              </div>
              <div className="form-group" style={{ margin: 0, width: 140 }}>
                <label>Date <span className="required">*</span></label>
                <input type="date" value={miscForm.date} onChange={e => setMiscForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 140 }}>
                <label>Note</label>
                <input type="text" value={miscForm.note} onChange={e => setMiscForm(f => ({ ...f, note: e.target.value }))} placeholder="Optional" />
              </div>
              <button className="btn-primary btn-sm" onClick={addMiscCharge} disabled={miscSaving} style={{ marginBottom: 1 }}>
                {miscSaving ? 'Adding…' : 'Add Charge'}
              </button>
            </div>
          </div>
          {(!miscCharges || miscCharges.length === 0) ? (
            <div className="empty-state" style={{ padding: '16px 24px', color: 'var(--text-muted)', fontSize: 13 }}>No miscellaneous charges yet.</div>
          ) : (
            <div className="table-wrapper">
              <table className="orders-table">
                <thead>
                  <tr><th>Date</th><th>Description</th><th>Amount (PKR)</th><th>Note</th><th></th></tr>
                </thead>
                <tbody>
                  {miscCharges.map(c => (
                    <tr key={c.id}>
                      <td>{c.date}</td>
                      <td>{c.description}</td>
                      <td style={{ fontWeight: 600, color: '#7c3aed' }}>PKR {fmt(c.amount_pkr)}</td>
                      <td style={{ color: '#6b7280' }}>{c.note || '—'}</td>
                      <td>
                        <button className="btn-ghost btn-sm" style={{ borderColor: '#fecaca', color: '#dc2626' }} onClick={() => deleteMiscCharge(c)}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Unlinked bills */}
        {unlinkedBills.length > 0 && (
          <div className="table-card" style={{ marginBottom: 24 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 600 }}>Other Bills</div>
            <div className="table-wrapper">
              <table className="orders-table">
                <thead>
                  <tr><th>Date</th><th>Item Type</th><th>Shipping</th><th>Manufacturing</th><th>Commission</th><th>Total</th><th>Note</th></tr>
                </thead>
                <tbody>
                  {unlinkedBills.map(b => (
                    <tr key={b.id}>
                      <td>{b.date}</td>
                      <td>{b.item_type || '—'}</td>
                      <td>{fmt(b.shipping_cost_pkr)}</td>
                      <td>{fmt(b.manufacturing_cost_pkr)}</td>
                      <td>{fmt(b.commission_pkr)}</td>
                      <td style={{ fontWeight: 600 }}>{fmt(b.total_pkr)}</td>
                      <td style={{ color: '#6b7280' }}>{b.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payments received */}
        {payments.length > 0 && (
          <div className="table-card" style={{ marginBottom: 24 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 600 }}>
              Payments Received
            </div>
            <div className="table-wrapper">
              <table className="orders-table">
                <thead>
                  <tr><th>Date</th><th>Amount (PKR)</th><th>Note</th></tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id}>
                      <td>{p.date}</td>
                      <td style={{ fontWeight: 600, color: '#059669' }}>PKR {fmt(p.amount_pkr)}</td>
                      <td style={{ color: '#6b7280' }}>{p.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Worker payments made */}
        {workerPayments && workerPayments.length > 0 && (
          <div className="table-card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 600 }}>
              Payments to Workers
            </div>
            <div className="table-wrapper">
              <table className="orders-table">
                <thead>
                  <tr><th>Date</th><th>Worker</th><th>Role</th><th>Amount (PKR)</th><th>Note</th></tr>
                </thead>
                <tbody>
                  {workerPayments.map(p => (
                    <tr key={p.id}>
                      <td>{p.date}</td>
                      <td style={{ fontWeight: 500 }}>{p.worker_name}</td>
                      <td>
                        <span style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                          background: p.worker_role === 'manufacturer' ? '#ede9fe' : '#dbeafe',
                          color:      p.worker_role === 'manufacturer' ? '#7c3aed'  : '#1d4ed8',
                        }}>
                          {p.worker_role === 'manufacturer' ? 'Mfg' : 'Shipper'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: '#dc2626' }}>PKR {fmt(p.amount_pkr)}</td>
                      <td style={{ color: '#6b7280' }}>{p.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Assign Workers Modal ── */}
      {assignOrder && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setAssignOrder(null)}
        >
          <div
            style={{ background: 'var(--surface)', borderRadius: 12, padding: 28, width: 'min(520px,95vw)', boxShadow: 'var(--shadow-lg)', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
              Assign Workers — Order #{assignOrder.order_number}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              {assignOrder.shoes_type} · Qty: {assignOrder.quantity || 1}
            </div>

            {error && <p className="error-msg">{error}</p>}

            {/* Manufacturer */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: '#374151' }}>Manufacturer</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 160 }}>
                  <label>Select Manufacturer</label>
                  <select value={assignForm.manufacturer_id} onChange={e => setAssignForm(f => ({ ...f, manufacturer_id: e.target.value }))}>
                    <option value="">— None —</option>
                    {manufacturers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                {assignForm.manufacturer_id && (
                  <div className="form-group" style={{ margin: 0, width: 150 }}>
                    <label>Rate / unit (PKR)</label>
                    <input type="number" value={assignForm.manufacturer_rate} onChange={e => setAssignForm(f => ({ ...f, manufacturer_rate: e.target.value }))} placeholder="0" min="0" />
                  </div>
                )}
              </div>
              {assignForm.manufacturer_id && assignForm.manufacturer_rate && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Total mfg cost: PKR {fmt(parseFloat(assignForm.manufacturer_rate || 0) * (assignOrder.quantity || 1))}
                </div>
              )}
              {assignmentsByOrder[assignOrder.id]?.['manufacturer'] && (
                <button
                  className="btn-ghost btn-sm"
                  style={{ marginTop: 6, fontSize: 11, color: '#dc2626', borderColor: '#fecaca' }}
                  onClick={() => { removeAssignment(assignOrder.id, 'manufacturer'); setAssignOrder(null); }}
                >
                  Remove manufacturer
                </button>
              )}
            </div>

            {/* Shipper */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: '#374151' }}>Shipper</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 160 }}>
                  <label>Select Shipper</label>
                  <select value={assignForm.shipper_id} onChange={e => setAssignForm(f => ({ ...f, shipper_id: e.target.value }))}>
                    <option value="">— None —</option>
                    {shippers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                {assignForm.shipper_id && (
                  <div className="form-group" style={{ margin: 0, width: 150 }}>
                    <label>Rate / unit (PKR)</label>
                    <input type="number" value={assignForm.shipper_rate} onChange={e => setAssignForm(f => ({ ...f, shipper_rate: e.target.value }))} placeholder="0" min="0" />
                  </div>
                )}
              </div>
              {assignForm.shipper_id && assignForm.shipper_rate && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Total shipping cost: PKR {fmt(parseFloat(assignForm.shipper_rate || 0) * (assignOrder.quantity || 1))}
                </div>
              )}
              {assignmentsByOrder[assignOrder.id]?.['shipper'] && (
                <button
                  className="btn-ghost btn-sm"
                  style={{ marginTop: 6, fontSize: 11, color: '#dc2626', borderColor: '#fecaca' }}
                  onClick={() => { removeAssignment(assignOrder.id, 'shipper'); setAssignOrder(null); }}
                >
                  Remove shipper
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setAssignOrder(null)}>Cancel</button>
              <button className="btn-primary" onClick={saveAssignment} disabled={assignSaving}>
                {assignSaving ? 'Saving…' : 'Save Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
