import { useEffect, useState } from 'react';
import api from '../../api';
import AppLayout from '../../components/AppLayout';

const today = new Date().toISOString().slice(0, 10);

function fmt(n) { return Number(n || 0).toLocaleString('en-PK'); }

export default function Handlers() {
  const [handlers, setHandlers]   = useState(null); // null = not loaded yet
  const [itemTypes, setItemTypes] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');

  // Commission edit modal
  const [commModal, setCommModal] = useState(null);
  const [commDraft, setCommDraft] = useState({});
  const [commSaving, setCommSaving] = useState(false);

  // Balance drawer
  const [balanceHandler, setBalanceHandler] = useState(null);
  const [balance, setBalance] = useState(null);
  const [balLoading, setBalLoading] = useState(false);

  // Add bill form
  const EMPTY_BILL = { order_id: '', order_number: '', item_type: '', shipping_cost_pkr: '', manufacturing_cost_pkr: '', commission_pkr: '', note: '', date: today };
  const [billForm, setBillForm] = useState(EMPTY_BILL);
  const [billSaving, setBillSaving] = useState(false);

  // Add payment form
  const EMPTY_PAY = { amount_pkr: '', date: today, note: '' };
  const [payForm, setPayForm] = useState(EMPTY_PAY);
  const [paySaving, setPaySaving] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/handlers'), api.get('/item-types')])
      .then(([hRes, iRes]) => { setHandlers(hRes.data); setItemTypes(iRes.data); setError(''); })
      .catch(() => setError('Failed to load handlers. The server may still be deploying — please refresh in a moment.'))
      .finally(() => setLoading(false));
  }, []);

  // ── Commissions ──
  function openCommissions(handler) {
    setCommModal(handler);
    const d = {};
    itemTypes.forEach(it => {
      const ex = handler.commissions.find(c => c.item_type_id === it.id);
      d[it.id] = ex ? String(ex.amount_pkr) : '0';
    });
    setCommDraft(d);
  }

  async function saveCommissions() {
    setCommSaving(true); setError('');
    try {
      const commissions = itemTypes.map(it => ({ item_type_id: it.id, amount_pkr: parseFloat(commDraft[it.id]) || 0 }));
      const res = await api.put(`/handlers/${commModal.id}/commissions`, { commissions });
      setHandlers(prev => prev.map(h => h.id === commModal.id ? { ...h, commissions: res.data } : h));
      setCommModal(null);
      setSuccess(`Commissions saved for ${commModal.username}.`);
    } catch (err) { setError(err.response?.data?.error || 'Failed'); }
    finally { setCommSaving(false); }
  }

  // ── Balance drawer ──
  async function openBalance(handler) {
    setBalanceHandler(handler);
    setBalance(null);
    setBalLoading(true);
    setBillForm({ ...EMPTY_BILL, commission_pkr: getDefaultCommission(handler, '') });
    setPayForm(EMPTY_PAY);
    try {
      const res = await api.get(`/handlers/${handler.id}/balance`);
      setBalance(res.data);
    } finally { setBalLoading(false); }
  }

  function getDefaultCommission(handler, itemTypeName) {
    const it = itemTypes.find(t => t.name === itemTypeName);
    if (!it) return '';
    const c = handler.commissions.find(c => c.item_type_id === it.id);
    return c ? String(c.amount_pkr) : '0';
  }

  // Pre-fill bill form from an assigned order
  function prefillBillFromOrder(order) {
    setBillForm(f => ({
      ...f,
      order_id: String(order.id),
      order_number: String(order.order_number),
      item_type: order.shoes_type || '',
      commission_pkr: getDefaultCommission(balanceHandler, order.shoes_type || ''),
    }));
    // Scroll to add bill form
    document.getElementById('add-bill-section')?.scrollIntoView({ behavior: 'smooth' });
  }

  async function addBill() {
    setBillSaving(true); setError('');
    try {
      const res = await api.post(`/handlers/${balanceHandler.id}/bills`, billForm);
      const newBill = res.data;
      setBalance(prev => {
        const billedOrderIds = new Set([...prev.bills.filter(b => b.order_id).map(b => b.order_id), newBill.order_id].filter(Boolean).map(Number));
        const updatedOrders = prev.orders.map(o => ({ ...o, hasBill: billedOrderIds.has(o.id) }));
        return {
          ...prev,
          orders: updatedOrders,
          bills: [newBill, ...prev.bills],
          totalBilled: prev.totalBilled + newBill.total_pkr,
          balance: prev.balance - newBill.total_pkr,
        };
      });
      setBillForm(EMPTY_BILL);
      setSuccess('Bill added.');
      // Also update handler list row
      setHandlers(prev => prev.map(h => h.id === balanceHandler.id
        ? { ...h, totalBilled: h.totalBilled + newBill.total_pkr, balance: h.balance - newBill.total_pkr }
        : h));
    } catch (err) { setError(err.response?.data?.error || 'Failed'); }
    finally { setBillSaving(false); }
  }

  async function deleteBill(bill) {
    if (!window.confirm(`Delete bill of PKR ${fmt(bill.total_pkr)}?`)) return;
    try {
      await api.delete(`/handlers/${balanceHandler.id}/bills/${bill.id}`);
      setBalance(prev => {
        const remainingBills = prev.bills.filter(b => b.id !== bill.id);
        const billedOrderIds = new Set(remainingBills.filter(b => b.order_id).map(b => Number(b.order_id)));
        const updatedOrders = prev.orders.map(o => ({ ...o, hasBill: billedOrderIds.has(o.id) }));
        return {
          ...prev,
          orders: updatedOrders,
          bills: remainingBills,
          totalBilled: prev.totalBilled - bill.total_pkr,
          balance: prev.balance + bill.total_pkr,
        };
      });
      setHandlers(prev => prev.map(h => h.id === balanceHandler.id
        ? { ...h, totalBilled: h.totalBilled - bill.total_pkr, balance: h.balance + bill.total_pkr }
        : h));
    } catch (err) { setError(err.response?.data?.error || 'Failed'); }
  }

  async function addPayment() {
    setPaySaving(true); setError('');
    try {
      const res = await api.post(`/handlers/${balanceHandler.id}/payments`, payForm);
      setBalance(prev => ({
        ...prev,
        payments: [res.data, ...prev.payments],
        totalPaid: prev.totalPaid + res.data.amount_pkr,
        balance: prev.balance + res.data.amount_pkr,
      }));
      setHandlers(prev => prev.map(h => h.id === balanceHandler.id
        ? { ...h, totalPaid: h.totalPaid + res.data.amount_pkr, balance: h.balance + res.data.amount_pkr }
        : h));
      setPayForm(EMPTY_PAY);
      setSuccess('Payment recorded.');
    } catch (err) { setError(err.response?.data?.error || 'Failed'); }
    finally { setPaySaving(false); }
  }

  async function deletePayment(pay) {
    if (!window.confirm(`Delete payment of PKR ${fmt(pay.amount_pkr)}?`)) return;
    try {
      await api.delete(`/handlers/${balanceHandler.id}/payments/${pay.id}`);
      setBalance(prev => ({
        ...prev,
        payments: prev.payments.filter(p => p.id !== pay.id),
        totalPaid: prev.totalPaid - pay.amount_pkr,
        balance: prev.balance - pay.amount_pkr,
      }));
      setHandlers(prev => prev.map(h => h.id === balanceHandler.id
        ? { ...h, totalPaid: h.totalPaid - pay.amount_pkr, balance: h.balance - pay.amount_pkr }
        : h));
    } catch (err) { setError(err.response?.data?.error || 'Failed'); }
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
                    <th>Total Billed</th>
                    <th>Total Paid</th>
                    <th>Balance</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {handlers.map(h => {
                    const owed = h.balance; // positive = surplus (admin paid more), negative = admin owes
                    return (
                      <tr key={h.id}>
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
                        <td style={{ color: '#dc2626', fontWeight: 600 }}>PKR {fmt(h.totalBilled)}</td>
                        <td style={{ color: '#059669', fontWeight: 600 }}>PKR {fmt(h.totalPaid)}</td>
                        <td>
                          {owed < 0 ? (
                            <span style={{ fontWeight: 700, color: '#dc2626' }}>
                              PKR {fmt(Math.abs(owed))} <span style={{ fontSize: 11, fontWeight: 400 }}>owed</span>
                            </span>
                          ) : owed > 0 ? (
                            <span style={{ fontWeight: 700, color: '#059669' }}>
                              PKR {fmt(owed)} <span style={{ fontSize: 11, fontWeight: 400 }}>surplus</span>
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn-ghost btn-sm" onClick={() => openCommissions(h)}>Commissions</button>
                            <button className="btn-primary btn-sm" onClick={() => openBalance(h)}>Bills & Pay</button>
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

      {/* ── Commissions Modal ── */}
      {commModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setCommModal(null)}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 28, width: 'min(460px,95vw)', boxShadow: 'var(--shadow-lg)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>{commModal.username} — Commissions</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>PKR per order for each item type. Use 0 for no commission.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {itemTypes.map(it => (
                <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{it.name}</label>
                  <div className="form-group" style={{ margin: 0, width: 130 }}>
                    <input type="number" value={commDraft[it.id] ?? '0'} onChange={e => setCommDraft(d => ({ ...d, [it.id]: e.target.value }))} min="0" step="1" />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 30 }}>PKR</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setCommModal(null)}>Cancel</button>
              <button className="btn-primary" onClick={saveCommissions} disabled={commSaving}>{commSaving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bills & Payments Drawer ── */}
      {balanceHandler && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.35)', display: 'flex', justifyContent: 'flex-end' }} onClick={() => setBalanceHandler(null)}>
          <div style={{ width: 'min(760px,97vw)', height: '100%', background: 'var(--surface)', overflowY: 'auto', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17 }}>{balanceHandler.username}</div>
                {balance && (
                  <div style={{ display: 'flex', gap: 20, marginTop: 6, fontSize: 13 }}>
                    <span>Billed: <strong style={{ color: '#dc2626' }}>PKR {fmt(balance.totalBilled)}</strong></span>
                    <span>Paid: <strong style={{ color: '#059669' }}>PKR {fmt(balance.totalPaid)}</strong></span>
                    <span>
                      {balance.balance < 0
                        ? <><strong style={{ color: '#dc2626' }}>PKR {fmt(Math.abs(balance.balance))}</strong> <span style={{ color: 'var(--text-muted)' }}>owed to handler</span></>
                        : balance.balance > 0
                          ? <><strong style={{ color: '#059669' }}>PKR {fmt(balance.balance)}</strong> <span style={{ color: 'var(--text-muted)' }}>surplus</span></>
                          : <span style={{ color: 'var(--text-muted)' }}>Settled</span>}
                    </span>
                  </div>
                )}
              </div>
              <button className="btn-ghost btn-sm" onClick={() => setBalanceHandler(null)} style={{ fontSize: 18, padding: '4px 10px' }}>✕</button>
            </div>

            {balLoading ? <div className="loading-state">Loading…</div> : balance && (
              <div style={{ padding: '20px 24px', flex: 1 }}>

                {/* ── Assigned Orders ── */}
                {balance.orders && balance.orders.length > 0 && (
                  <div style={{ marginBottom: 28 }}>
                    <div className="detail-section-title" style={{ marginBottom: 10 }}>
                      Assigned Orders ({balance.orders.length})
                    </div>
                    <div className="table-wrapper">
                      <table className="orders-table">
                        <thead>
                          <tr><th>Order #</th><th>Date</th><th>Customer</th><th>Item Type</th><th>Status</th><th>Bill</th><th></th></tr>
                        </thead>
                        <tbody>
                          {balance.orders.map(o => (
                            <tr key={o.id}>
                              <td><span className="order-num">{o.order_number}</span></td>
                              <td>{o.date}</td>
                              <td>{o.customer}</td>
                              <td>{o.shoes_type}</td>
                              <td>
                                <span className={`badge badge-status-${o.status}`}>
                                  {o.status?.replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td>
                                {o.hasBill
                                  ? <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>✓ Billed</span>
                                  : <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>Pending</span>}
                              </td>
                              <td>
                                {!o.hasBill && (
                                  <button
                                    className="btn-ghost btn-sm"
                                    style={{ fontSize: 11 }}
                                    onClick={() => prefillBillFromOrder(o)}
                                  >
                                    Add Bill
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ── Add Bill ── */}
                <div style={{ marginBottom: 28 }} id="add-bill-section">
                  <div className="detail-section-title" style={{ marginBottom: 12 }}>Add Bill</div>
                  <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 10 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Order #</label>
                      <input type="text" value={billForm.order_number} onChange={e => setBillForm(f => ({ ...f, order_number: e.target.value }))} placeholder="Optional" />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Item Type</label>
                      <select value={billForm.item_type} onChange={e => {
                        const val = e.target.value;
                        const comm = getDefaultCommission(balanceHandler, val);
                        setBillForm(f => ({ ...f, item_type: val, commission_pkr: comm }));
                      }}>
                        <option value="">Select</option>
                        {itemTypes.map(it => <option key={it.id} value={it.name}>{it.name}</option>)}
                      </select>
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
                    <div style={{ fontSize: 13, marginTop: 8, color: 'var(--text-secondary)' }}>
                      Total: <strong style={{ color: '#dc2626' }}>PKR {fmt((parseFloat(billForm.shipping_cost_pkr)||0)+(parseFloat(billForm.manufacturing_cost_pkr)||0)+(parseFloat(billForm.commission_pkr)||0))}</strong>
                      <span style={{ marginLeft: 12, color: 'var(--text-muted)', fontSize: 12 }}>
                        Shipping {fmt(billForm.shipping_cost_pkr||0)} + Mfg {fmt(billForm.manufacturing_cost_pkr||0)} + Commission {fmt(billForm.commission_pkr||0)}
                      </span>
                    </div>
                  )}
                  <div style={{ marginTop: 10 }}>
                    <button className="btn-primary btn-sm" onClick={addBill} disabled={billSaving}>{billSaving ? 'Adding…' : 'Add Bill'}</button>
                  </div>
                </div>

                {/* ── Bills table ── */}
                <div style={{ marginBottom: 28 }}>
                  <div className="detail-section-title" style={{ marginBottom: 10 }}>Bills ({balance.bills.length})</div>
                  {balance.bills.length === 0 ? <div className="no-data">No bills yet.</div> : (
                    <div className="table-wrapper">
                      <table className="orders-table">
                        <thead><tr><th>Date</th><th>Order #</th><th>Item</th><th>Shipping</th><th>Mfg</th><th>Commission</th><th>Total</th><th>Note</th><th></th></tr></thead>
                        <tbody>
                          {balance.bills.map(b => (
                            <tr key={b.id}>
                              <td>{b.date}</td>
                              <td>{b.order_number || <span className="text-muted">—</span>}</td>
                              <td>{b.item_type || <span className="text-muted">—</span>}</td>
                              <td>{fmt(b.shipping_cost_pkr)}</td>
                              <td>{fmt(b.manufacturing_cost_pkr)}</td>
                              <td>{fmt(b.commission_pkr)}</td>
                              <td><strong style={{ color: '#dc2626' }}>PKR {fmt(b.total_pkr)}</strong></td>
                              <td>{b.note || <span className="text-muted">—</span>}</td>
                              <td><button className="btn-ghost btn-sm" style={{ borderColor: '#fecaca', color: '#dc2626' }} onClick={() => deleteBill(b)}>✕</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* ── Transfer Payment ── */}
                <div style={{ marginBottom: 20 }}>
                  <div className="detail-section-title" style={{ marginBottom: 4 }}>Transfer Payment to Handler</div>
                  {balance.balance < 0 && (
                    <div style={{ fontSize: 13, color: '#dc2626', marginBottom: 10 }}>
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

                {/* ── Payments table ── */}
                <div>
                  <div className="detail-section-title" style={{ marginBottom: 10 }}>Payment History ({balance.payments.length})</div>
                  {balance.payments.length === 0 ? <div className="no-data">No payments yet.</div> : (
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

              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
