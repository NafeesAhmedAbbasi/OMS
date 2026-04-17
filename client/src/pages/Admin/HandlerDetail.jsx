import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api';
import AppLayout from '../../components/AppLayout';

const today = new Date().toISOString().slice(0, 10);

function fmt(n) { return Number(n || 0).toLocaleString('en-PK'); }

export default function HandlerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [balance, setBalance]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  const EMPTY_BILL = { order_id: '', order_number: '', item_type: '', shipping_cost_pkr: '', manufacturing_cost_pkr: '', commission_pkr: '', note: '', date: today };
  const [billForm, setBillForm]     = useState(EMPTY_BILL);
  const [billSaving, setBillSaving] = useState(false);

  const EMPTY_PAY = { amount_pkr: '', date: today, note: '' };
  const [payForm, setPayForm]     = useState(EMPTY_PAY);
  const [paySaving, setPaySaving] = useState(false);

  // Bill editing
  const [editingBill, setEditingBill] = useState(null);
  const [editSaving, setEditSaving]   = useState(false);

  // Order cost editing (admin override of mfg/ship/commission)
  const [editingOrder, setEditingOrder] = useState(null); // { orderId, mfg, ship, commission }
  const [orderEditSaving, setOrderEditSaving] = useState(false);

  useEffect(() => {
    api.get(`/handlers/${id}/balance`)
      .then(res => setBalance(res.data))
      .catch(() => setError('Failed to load handler data.'))
      .finally(() => setLoading(false));
  }, [id]);

  function prefillBillFromOrder(order) {
    if (!balance) return;
    // If already billed, find the existing bill and open it in edit mode
    const existingBill = balance.bills.find(b => b.order_id === order.id || String(b.order_number) === String(order.order_number));
    if (existingBill) {
      setEditingBill({
        id: existingBill.id,
        date: existingBill.date,
        order_number: existingBill.order_number || '',
        item_type: existingBill.item_type || '',
        shipping_cost_pkr: String(existingBill.shipping_cost_pkr || 0),
        manufacturing_cost_pkr: String(existingBill.manufacturing_cost_pkr || 0),
        commission_pkr: String(existingBill.commission_pkr || 0),
        note: existingBill.note || '',
      });
      setTimeout(() => document.getElementById('bills-section')?.scrollIntoView({ behavior: 'smooth' }), 50);
      return;
    }
    const assignments = balance.assignments || [];
    const mfgAssign   = assignments.find(a => a.order_id === order.id && a.role === 'manufacturer');
    const shipAssign  = assignments.find(a => a.order_id === order.id && a.role === 'shipper');
    const qty         = order.quantity || 1;
    setBillForm({
      order_id:               String(order.id),
      order_number:           String(order.order_number),
      item_type:              order.shoes_type || '',
      manufacturing_cost_pkr: mfgAssign  ? String(mfgAssign.rate_per_unit_pkr * qty)  : '',
      shipping_cost_pkr:      shipAssign ? String(shipAssign.rate_per_unit_pkr * qty) : '',
      commission_pkr:         balance.commissionRate ? String(balance.commissionRate * qty) : '',
      note:                   '',
      date:                   today,
    });
    document.getElementById('add-bill-section')?.scrollIntoView({ behavior: 'smooth' });
  }

  async function addBill() {
    setBillSaving(true); setError(''); setSuccess('');
    try {
      const res = await api.post(`/handlers/${id}/bills`, billForm);
      const newBill = res.data;
      setBalance(prev => {
        const billedOrderIds = new Set([...prev.bills.filter(b => b.order_id).map(b => b.order_id), newBill.order_id].filter(Boolean).map(Number));
        return {
          ...prev,
          orders: prev.orders.map(o => ({ ...o, hasBill: billedOrderIds.has(o.id) })),
          bills: [newBill, ...prev.bills],
          totalBilled: prev.totalBilled + newBill.total_pkr,
          balance: prev.balance - newBill.total_pkr,
        };
      });
      setBillForm(EMPTY_BILL);
      setSuccess('Bill added.');
    } catch (err) { setError(err.response?.data?.error || 'Failed'); }
    finally { setBillSaving(false); }
  }

  async function deleteBill(bill) {
    if (!window.confirm(`Delete bill of PKR ${fmt(bill.total_pkr)}?`)) return;
    try {
      await api.delete(`/handlers/${id}/bills/${bill.id}`);
      setBalance(prev => {
        const remaining = prev.bills.filter(b => b.id !== bill.id);
        const billedOrderIds = new Set(remaining.filter(b => b.order_id).map(b => Number(b.order_id)));
        return {
          ...prev,
          orders: prev.orders.map(o => ({ ...o, hasBill: billedOrderIds.has(o.id) })),
          bills: remaining,
          totalBilled: prev.totalBilled - bill.total_pkr,
          balance: prev.balance + bill.total_pkr,
        };
      });
    } catch (err) { setError(err.response?.data?.error || 'Failed'); }
  }

  async function saveBillEdit() {
    setEditSaving(true); setError('');
    try {
      const res = await api.put(`/handlers/${id}/bills/${editingBill.id}`, editingBill);
      const updated = res.data;
      setBalance(prev => {
        const oldBill = prev.bills.find(b => b.id === updated.id);
        const diff = updated.total_pkr - (oldBill?.total_pkr || 0);
        const updatedBills = prev.bills.map(b => b.id === updated.id ? updated : b);
        const billedOrderIds = new Set(updatedBills.filter(b => b.order_id).map(b => Number(b.order_id)));
        return {
          ...prev,
          bills: updatedBills,
          orders: prev.orders.map(o => ({ ...o, hasBill: billedOrderIds.has(o.id) })),
          totalBilled: prev.totalBilled + diff,
          balance: prev.balance - diff,
        };
      });
      setEditingBill(null);
      setSuccess('Bill updated.');
    } catch (err) { setError(err.response?.data?.error || 'Failed'); }
    finally { setEditSaving(false); }
  }

  async function saveOrderCosts() {
    setOrderEditSaving(true); setError('');
    try {
      const { orderId, mfg, ship, commission } = editingOrder;
      await api.put(`/handlers/${id}/orders/${orderId}/costs`, {
        manufacturing_cost_pkr: parseFloat(mfg) || 0,
        shipping_cost_pkr: parseFloat(ship) || 0,
        commission_pkr: parseFloat(commission) || 0,
      });
      // Reflect in prefillBillFromOrder by updating assignments locally
      setBalance(prev => ({
        ...prev,
        costOverrides: {
          ...(prev.costOverrides || {}),
          [orderId]: {
            mfg: parseFloat(mfg) || 0,
            ship: parseFloat(ship) || 0,
            commission: parseFloat(commission) || 0,
          },
        },
      }));
      setEditingOrder(null);
      setSuccess('Costs updated.');
    } catch (err) { setError(err.response?.data?.error || 'Failed'); }
    finally { setOrderEditSaving(false); }
  }

  async function addPayment() {
    setPaySaving(true); setError(''); setSuccess('');
    try {
      const res = await api.post(`/handlers/${id}/payments`, payForm);
      setBalance(prev => ({
        ...prev,
        payments: [res.data, ...prev.payments],
        totalPaid: prev.totalPaid + res.data.amount_pkr,
        balance: prev.balance + res.data.amount_pkr,
      }));
      setPayForm(EMPTY_PAY);
      setSuccess('Payment recorded.');
    } catch (err) { setError(err.response?.data?.error || 'Failed'); }
    finally { setPaySaving(false); }
  }

  async function deletePayment(pay) {
    if (!window.confirm(`Delete payment of PKR ${fmt(pay.amount_pkr)}?`)) return;
    try {
      await api.delete(`/handlers/${id}/payments/${pay.id}`);
      setBalance(prev => ({
        ...prev,
        payments: prev.payments.filter(p => p.id !== pay.id),
        totalPaid: prev.totalPaid - pay.amount_pkr,
        balance: prev.balance - pay.amount_pkr,
      }));
    } catch (err) { setError(err.response?.data?.error || 'Failed'); }
  }

  return (
    <AppLayout>
      <div className="page-container">

        {/* ── Back + Header ── */}
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="btn-ghost btn-sm"
              onClick={() => navigate('/admin/handlers')}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Handlers
            </button>
            <div>
              <h2 className="page-title" style={{ margin: 0 }}>
                {balance ? balance.handler.username : '…'}
              </h2>
              <p className="page-subtitle" style={{ margin: 0 }}>Bills, payments &amp; orders</p>
            </div>
          </div>
        </div>

        {error   && <p className="error-msg">{error}</p>}
        {success && <p className="success-msg" onClick={() => setSuccess('')}>{success}</p>}

        {loading ? <div className="loading-state">Loading…</div> : !balance ? null : (
          <>
            {/* ── Summary cards ── */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
              <div className="stat-card" style={{ flex: 1, minWidth: 140 }}>
                <div className="stat-label">Total Billed</div>
                <div className="stat-value" style={{ color: '#dc2626' }}>PKR {fmt(balance.totalBilled)}</div>
              </div>
              <div className="stat-card" style={{ flex: 1, minWidth: 140 }}>
                <div className="stat-label">Total Paid</div>
                <div className="stat-value" style={{ color: '#059669' }}>PKR {fmt(balance.totalPaid)}</div>
              </div>
              {balance.openingBalance > 0 && (
                <div className="stat-card" style={{ flex: 1, minWidth: 140 }}>
                  <div className="stat-label">Previous Balance</div>
                  <div className="stat-value" style={{ color: '#059669', fontSize: 16 }}>PKR {fmt(balance.openingBalance)}</div>
                </div>
              )}
              {balance.totalMisc > 0 && (
                <div className="stat-card" style={{ flex: 1, minWidth: 140 }}>
                  <div className="stat-label">Misc Charges</div>
                  <div className="stat-value" style={{ color: '#7c3aed' }}>PKR {fmt(balance.totalMisc)}</div>
                </div>
              )}
              <div className="stat-card" style={{ flex: 1, minWidth: 140 }}>
                <div className="stat-label">Balance</div>
                <div className="stat-value" style={{ color: balance.balance < 0 ? '#dc2626' : balance.balance > 0 ? '#059669' : 'var(--text-muted)' }}>
                  {balance.balance < 0
                    ? <>PKR {fmt(Math.abs(balance.balance))} <span style={{ fontSize: 12, fontWeight: 400 }}>owed</span></>
                    : balance.balance > 0
                      ? <>PKR {fmt(balance.balance)} <span style={{ fontSize: 12, fontWeight: 400 }}>surplus</span></>
                      : 'Settled'}
                </div>
              </div>
              {balance.commissionRate > 0 && (
                <div className="stat-card" style={{ flex: 1, minWidth: 140 }}>
                  <div className="stat-label">Commission Rate</div>
                  <div className="stat-value" style={{ color: '#0369a1', fontSize: 16 }}>PKR {fmt(balance.commissionRate)}/unit</div>
                </div>
              )}
            </div>

            {/* ── Workers summary ── */}
            {balance.workers && balance.workers.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div className="detail-section-title" style={{ marginBottom: 12 }}>Workers</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {balance.workers.map(w => (
                    <div key={w.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 18px', minWidth: 170 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{w.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize', marginBottom: 8 }}>{w.role}</div>
                      <div style={{ fontSize: 13 }}>Owed: <strong style={{ color: '#dc2626' }}>PKR {fmt(w.total_owed)}</strong></div>
                      <div style={{ fontSize: 13 }}>Paid: <strong style={{ color: '#059669' }}>PKR {fmt(w.total_paid)}</strong></div>
                      {w.balance > 0 && (
                        <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 600, marginTop: 4 }}>PKR {fmt(w.balance)} outstanding</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Assigned Orders ── */}
            {balance.orders && balance.orders.length > 0 && (
              <div className="table-card" style={{ marginBottom: 28 }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 600 }}>
                  Assigned Orders ({balance.orders.length})
                </div>
                <div className="table-wrapper">
                  <table className="orders-table">
                    <thead>
                      <tr>
                        <th>Order #</th><th>Date</th><th>Customer</th><th>Item</th><th>Qty</th>
                        <th>Status</th><th>Manufacturer</th><th>Shipper</th>
                        <th>Mfg Cost</th><th>Ship Cost</th><th>Commission</th><th>Bill</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {balance.orders.map(o => {
                        const assignments = balance.assignments || [];
                        const mfgA  = assignments.find(a => a.order_id === o.id && a.role === 'manufacturer');
                        const shipA = assignments.find(a => a.order_id === o.id && a.role === 'shipper');
                        const qty   = o.quantity || 1;
                        const overrides = balance.costOverrides?.[o.id] || balance._orderCostOverrides?.[o.id];
                        const mfgCost  = overrides ? overrides.mfg  : (mfgA  ? mfgA.rate_per_unit_pkr * qty  : null);
                        const shipCost = overrides ? overrides.ship : (shipA ? shipA.rate_per_unit_pkr * qty : null);
                        const commCost = overrides ? overrides.commission : (balance.commissionRate ? balance.commissionRate * qty : null);
                        const isEditingCosts = editingOrder?.orderId === o.id;
                        if (isEditingCosts) return (
                          <tr key={o.id} style={{ background: '#f0f9ff' }}>
                            <td colSpan={13} style={{ padding: '12px 16px' }}>
                              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--text-secondary)' }}>
                                Edit Costs — Order #{o.order_number} · {o.customer} · Qty {o.quantity || 1}
                              </div>
                              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                <div className="form-group" style={{ margin: 0, minWidth: 150 }}>
                                  <label style={{ fontSize: 11 }}>Manufacturing (PKR)</label>
                                  <input type="number" value={editingOrder.mfg} onChange={e => setEditingOrder(f => ({ ...f, mfg: e.target.value }))} min="0" placeholder="0" />
                                </div>
                                <div className="form-group" style={{ margin: 0, minWidth: 150 }}>
                                  <label style={{ fontSize: 11 }}>Shipping (PKR)</label>
                                  <input type="number" value={editingOrder.ship} onChange={e => setEditingOrder(f => ({ ...f, ship: e.target.value }))} min="0" placeholder="0" />
                                </div>
                                <div className="form-group" style={{ margin: 0, minWidth: 150 }}>
                                  <label style={{ fontSize: 11 }}>Commission (PKR)</label>
                                  <input type="number" value={editingOrder.commission} onChange={e => setEditingOrder(f => ({ ...f, commission: e.target.value }))} min="0" placeholder="0" />
                                </div>
                              </div>
                              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>
                                  Total: PKR {fmt((parseFloat(editingOrder.mfg)||0)+(parseFloat(editingOrder.ship)||0)+(parseFloat(editingOrder.commission)||0))}
                                </div>
                                <button className="btn-primary btn-sm" onClick={saveOrderCosts} disabled={orderEditSaving}>{orderEditSaving ? 'Saving…' : 'Save'}</button>
                                <button className="btn-ghost btn-sm" onClick={() => setEditingOrder(null)}>Cancel</button>
                              </div>
                            </td>
                          </tr>
                        );
                        return (
                          <tr key={o.id}>
                            <td><span className="order-num">{o.order_number}</span></td>
                            <td>{o.date}</td>
                            <td>{o.customer}</td>
                            <td>{o.shoes_type}</td>
                            <td style={{ textAlign: 'center' }}>{qty}</td>
                            <td><span className={`badge badge-status-${o.status}`}>{o.status?.replace(/_/g, ' ')}</span></td>
                            <td>
                              {mfgA ? (
                                <div>
                                  <div style={{ fontWeight: 500, fontSize: 12 }}>{mfgA.worker_name}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>PKR {fmt(mfgA.rate_per_unit_pkr)}/unit</div>
                                </div>
                              ) : <span style={{ color: '#9ca3af', fontSize: 11 }}>—</span>}
                            </td>
                            <td>
                              {shipA ? (
                                <div>
                                  <div style={{ fontWeight: 500, fontSize: 12 }}>{shipA.worker_name}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>PKR {fmt(shipA.rate_per_unit_pkr)}/unit</div>
                                </div>
                              ) : <span style={{ color: '#9ca3af', fontSize: 11 }}>—</span>}
                            </td>
                            <td style={{ fontSize: 12 }}>
                              {mfgCost != null ? fmt(mfgCost) : '—'}
                            </td>
                            <td style={{ fontSize: 12 }}>
                              {shipCost != null ? fmt(shipCost) : '—'}
                            </td>
                            <td style={{ fontSize: 12 }}>
                              {commCost != null ? fmt(commCost) : '—'}
                            </td>
                            <td>
                              {o.hasBill
                                ? <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>✓ Billed</span>
                                : <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>Pending</span>}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                <button className="btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setEditingOrder({ orderId: o.id, mfg: String(mfgCost ?? ''), ship: String(shipCost ?? ''), commission: String(commCost ?? '') })}>Costs</button>
                                <button className="btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => prefillBillFromOrder(o)}>{o.hasBill ? 'Edit Bill' : 'Add Bill'}</button>
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

            {/* ── Misc Charges ── */}
            {balance.miscCharges && balance.miscCharges.length > 0 && (
              <div className="table-card" style={{ marginBottom: 28 }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 600 }}>
                  Miscellaneous Charges — PKR {fmt(balance.totalMisc)}
                </div>
                <div className="table-wrapper">
                  <table className="orders-table">
                    <thead><tr><th>Date</th><th>Description</th><th>Amount (PKR)</th><th>Note</th></tr></thead>
                    <tbody>
                      {balance.miscCharges.map(c => (
                        <tr key={c.id}>
                          <td>{c.date}</td>
                          <td>{c.description}</td>
                          <td style={{ fontWeight: 600, color: '#7c3aed' }}>PKR {fmt(c.amount_pkr)}</td>
                          <td style={{ color: '#6b7280' }}>{c.note || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Add Bill ── */}
            <div className="table-card" style={{ marginBottom: 28 }} id="add-bill-section">
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 600 }}>Add Bill</div>
              <div style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                  Commission rate: <strong>PKR {fmt(balance.commissionRate)}/unit</strong>. Click "Add Bill" on an order above to auto-fill costs from worker assignments.
                </div>
                <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Order #</label>
                    <input type="text" value={billForm.order_number} onChange={e => setBillForm(f => ({ ...f, order_number: e.target.value }))} placeholder="Optional" />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Item Type</label>
                    <input type="text" value={billForm.item_type} onChange={e => setBillForm(f => ({ ...f, item_type: e.target.value }))} placeholder="Optional" />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Shipping (PKR)</label>
                    <input type="number" value={billForm.shipping_cost_pkr} onChange={e => setBillForm(f => ({ ...f, shipping_cost_pkr: e.target.value }))} placeholder="0" min="0" />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Manufacturing (PKR)</label>
                    <input type="number" value={billForm.manufacturing_cost_pkr} onChange={e => setBillForm(f => ({ ...f, manufacturing_cost_pkr: e.target.value }))} placeholder="0" min="0" />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Commission (PKR)</label>
                    <input type="number" value={billForm.commission_pkr} onChange={e => setBillForm(f => ({ ...f, commission_pkr: e.target.value }))} placeholder="0" min="0" />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Date <span className="required">*</span></label>
                    <input type="date" value={billForm.date} onChange={e => setBillForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                    <label>Note</label>
                    <input type="text" value={billForm.note} onChange={e => setBillForm(f => ({ ...f, note: e.target.value }))} placeholder="Optional" />
                  </div>
                </div>
                {(billForm.shipping_cost_pkr || billForm.manufacturing_cost_pkr || billForm.commission_pkr) && (
                  <div style={{ fontSize: 13, marginTop: 10, color: 'var(--text-secondary)' }}>
                    Total: <strong style={{ color: '#dc2626' }}>PKR {fmt((parseFloat(billForm.shipping_cost_pkr)||0)+(parseFloat(billForm.manufacturing_cost_pkr)||0)+(parseFloat(billForm.commission_pkr)||0))}</strong>
                    <span style={{ marginLeft: 12, color: 'var(--text-muted)', fontSize: 12 }}>
                      Ship {fmt(billForm.shipping_cost_pkr||0)} + Mfg {fmt(billForm.manufacturing_cost_pkr||0)} + Commission {fmt(billForm.commission_pkr||0)}
                    </span>
                  </div>
                )}
                <div style={{ marginTop: 12 }}>
                  <button className="btn-primary btn-sm" onClick={addBill} disabled={billSaving}>{billSaving ? 'Adding…' : 'Add Bill'}</button>
                </div>
              </div>
            </div>

            {/* ── Bills table ── */}
            <div className="table-card" style={{ marginBottom: 28 }} id="bills-section">
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 600 }}>
                Bills ({balance.bills.length})
              </div>
              {balance.bills.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px 24px', color: 'var(--text-muted)', fontSize: 13 }}>No bills yet.</div>
              ) : (
                <div className="table-wrapper">
                  <table className="orders-table">
                    <thead><tr><th>Date</th><th>Order #</th><th>Item</th><th>Shipping</th><th>Mfg</th><th>Commission</th><th>Total</th><th>Note</th><th></th></tr></thead>
                    <tbody>
                      {balance.bills.map(b => {
                        const isEditing = editingBill?.id === b.id;
                        if (isEditing) return (
                          <tr key={b.id} style={{ background: '#f0f9ff' }}>
                            <td colSpan={9} style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                <div className="form-group" style={{ margin: 0, minWidth: 120 }}>
                                  <label style={{ fontSize: 11 }}>Date</label>
                                  <input type="date" value={editingBill.date} onChange={e => setEditingBill(f => ({ ...f, date: e.target.value }))} />
                                </div>
                                <div className="form-group" style={{ margin: 0, minWidth: 90 }}>
                                  <label style={{ fontSize: 11 }}>Order #</label>
                                  <input type="text" value={editingBill.order_number} onChange={e => setEditingBill(f => ({ ...f, order_number: e.target.value }))} placeholder="—" />
                                </div>
                                <div className="form-group" style={{ margin: 0, minWidth: 110 }}>
                                  <label style={{ fontSize: 11 }}>Item Type</label>
                                  <input type="text" value={editingBill.item_type} onChange={e => setEditingBill(f => ({ ...f, item_type: e.target.value }))} placeholder="—" />
                                </div>
                                <div className="form-group" style={{ margin: 0, minWidth: 110 }}>
                                  <label style={{ fontSize: 11 }}>Shipping (PKR)</label>
                                  <input type="number" value={editingBill.shipping_cost_pkr} onChange={e => setEditingBill(f => ({ ...f, shipping_cost_pkr: e.target.value }))} min="0" />
                                </div>
                                <div className="form-group" style={{ margin: 0, minWidth: 130 }}>
                                  <label style={{ fontSize: 11 }}>Manufacturing (PKR)</label>
                                  <input type="number" value={editingBill.manufacturing_cost_pkr} onChange={e => setEditingBill(f => ({ ...f, manufacturing_cost_pkr: e.target.value }))} min="0" />
                                </div>
                                <div className="form-group" style={{ margin: 0, minWidth: 120 }}>
                                  <label style={{ fontSize: 11 }}>Commission (PKR)</label>
                                  <input type="number" value={editingBill.commission_pkr} onChange={e => setEditingBill(f => ({ ...f, commission_pkr: e.target.value }))} min="0" />
                                </div>
                                <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 140 }}>
                                  <label style={{ fontSize: 11 }}>Note</label>
                                  <input type="text" value={editingBill.note} onChange={e => setEditingBill(f => ({ ...f, note: e.target.value }))} placeholder="Optional" />
                                </div>
                              </div>
                              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>
                                  Total: PKR {fmt((parseFloat(editingBill.shipping_cost_pkr)||0)+(parseFloat(editingBill.manufacturing_cost_pkr)||0)+(parseFloat(editingBill.commission_pkr)||0))}
                                </div>
                                <button className="btn-primary btn-sm" onClick={saveBillEdit} disabled={editSaving}>{editSaving ? 'Saving…' : 'Save'}</button>
                                <button className="btn-ghost btn-sm" onClick={() => setEditingBill(null)}>Cancel</button>
                              </div>
                            </td>
                          </tr>
                        );
                        return (
                          <tr key={b.id}>
                            <td>{b.date}</td>
                            <td>{b.order_number || <span className="text-muted">—</span>}</td>
                            <td>{b.item_type || <span className="text-muted">—</span>}</td>
                            <td>{fmt(b.shipping_cost_pkr)}</td>
                            <td>{fmt(b.manufacturing_cost_pkr)}</td>
                            <td>{fmt(b.commission_pkr)}</td>
                            <td><strong style={{ color: '#dc2626' }}>PKR {fmt(b.total_pkr)}</strong></td>
                            <td>{b.note || <span className="text-muted">—</span>}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button className="btn-ghost btn-sm" onClick={() => setEditingBill({ id: b.id, date: b.date, order_number: b.order_number || '', item_type: b.item_type || '', shipping_cost_pkr: String(b.shipping_cost_pkr || 0), manufacturing_cost_pkr: String(b.manufacturing_cost_pkr || 0), commission_pkr: String(b.commission_pkr || 0), note: b.note || '' })}>Edit</button>
                                <button className="btn-ghost btn-sm" style={{ borderColor: '#fecaca', color: '#dc2626' }} onClick={() => deleteBill(b)}>✕</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── Transfer Payment ── */}
            <div className="table-card" style={{ marginBottom: 28 }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 600 }}>Transfer Payment to Handler</div>
              <div style={{ padding: '16px 20px' }}>
                {balance.balance < 0 && (
                  <div style={{ fontSize: 13, color: '#dc2626', marginBottom: 12 }}>
                    Outstanding: <strong>PKR {fmt(Math.abs(balance.balance))}</strong> owed to handler
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ margin: 0, width: 160 }}>
                    <label>Amount (PKR) <span className="required">*</span></label>
                    <input type="number" value={payForm.amount_pkr} onChange={e => setPayForm(f => ({ ...f, amount_pkr: e.target.value }))} placeholder="e.g. 10000" min="0" />
                  </div>
                  <div className="form-group" style={{ margin: 0, width: 150 }}>
                    <label>Date <span className="required">*</span></label>
                    <input type="date" value={payForm.date} onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 160 }}>
                    <label>Note</label>
                    <input type="text" value={payForm.note} onChange={e => setPayForm(f => ({ ...f, note: e.target.value }))} placeholder="e.g. Bank transfer, cash" />
                  </div>
                  <button className="btn-primary btn-sm" onClick={addPayment} disabled={paySaving} style={{ marginBottom: 1 }}>
                    {paySaving ? 'Saving…' : 'Record Transfer'}
                  </button>
                </div>
              </div>
            </div>

            {/* ── Payment History ── */}
            <div className="table-card">
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 600 }}>
                Payment History ({balance.payments.length})
              </div>
              {balance.payments.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px 24px', color: 'var(--text-muted)', fontSize: 13 }}>No payments yet.</div>
              ) : (
                <div className="table-wrapper">
                  <table className="orders-table">
                    <thead><tr><th>Date</th><th>Amount (PKR)</th><th>Note</th><th></th></tr></thead>
                    <tbody>
                      {balance.payments.map(p => (
                        <tr key={p.id}>
                          <td>{p.date}</td>
                          <td><strong style={{ color: '#059669' }}>PKR {fmt(p.amount_pkr)}</strong></td>
                          <td>{p.note || <span className="text-muted">—</span>}</td>
                          <td><button className="btn-ghost btn-sm" style={{ borderColor: '#fecaca', color: '#dc2626' }} onClick={() => deletePayment(p)}>✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
