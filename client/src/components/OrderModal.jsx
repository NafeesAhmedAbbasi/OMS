import { useState, useEffect } from 'react';
import api from '../api';
import OrderForm from './OrderForm';
import { MONTHS } from '../constants';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(d)} ${MONTHS[parseInt(m) - 1]}, ${y}`;
}

function DetailRow({ label, value, highlight }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className={`detail-value${highlight ? ' detail-value-highlight' : ''}`}>
        {value ?? <span className="text-muted">—</span>}
      </span>
    </div>
  );
}

export default function OrderModal({ order, initialMode = 'view', onClose, onSaved }) {
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [partialRefund, setPartialRefund] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);

  // Cancellation cost override form
  const [cancelExpanded, setCancelExpanded] = useState(false);
  const [cancelForm, setCancelForm] = useState({ manufacturing: '', shipping: '', commission: '', note: '' });

  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const isEditor = user?.role === 'editor' || user?.role === 'admin';
  const isAdmin  = user?.role === 'admin';

  const STATUS_TRANSITIONS = {
    open:           ['confirmed', 'dispute_opened', 'cancelled'],
    processing:     ['confirmed', 'open', 'cancelled'],
    dispute_opened: ['dispute_won', 'dispute_lost', ...(isAdmin ? ['cancelled'] : [])],
    confirmed:      isAdmin ? ['cancelled'] : [],
    dispute_won:    isAdmin ? ['cancelled'] : [],
    dispute_lost:   isAdmin ? ['cancelled'] : [],
    cancelled:      [],
  };

  const STATUS_LABELS = {
    confirmed:      { label: 'Mark Confirmed',   color: '#10b981' },
    dispute_opened: { label: 'Open Dispute',      color: '#ef4444' },
    dispute_won:    { label: 'Dispute Won',        color: '#6366f1' },
    dispute_lost:   { label: 'Dispute Lost',       color: '#94a3b8' },
    cancelled:      { label: 'Cancel Order',       color: '#64748b' },
  };

  async function handleStatusChange(status) {
    setStatusSaving(true);
    setError('');
    try {
      const body = { status };
      if (partialRefund) body.partial_refund = parseFloat(partialRefund);
      if (status === 'cancelled' && isAdmin) {
        if (cancelForm.manufacturing) body.cancel_manufacturing_pkr = parseFloat(cancelForm.manufacturing);
        if (cancelForm.shipping)      body.cancel_shipping_pkr      = parseFloat(cancelForm.shipping);
        if (cancelForm.commission)    body.cancel_commission_pkr    = parseFloat(cancelForm.commission);
        if (cancelForm.note)          body.cancel_note              = cancelForm.note;
      }
      const res = await api.put(`/orders/${order.id}/status`, body);
      onSaved(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update status');
    } finally {
      setStatusSaving(false);
    }
  }

  useEffect(() => {
    if (!order) return;
    setMode(initialMode);
    setError('');
    setCancelExpanded(false);
    setCancelForm({ manufacturing: '', shipping: '', commission: '', note: '' });
    const existingImages = order.image_path
      ? order.image_path.split(',').filter(Boolean).map(url => ({ url }))
      : [];
    setForm({
      date: order.date || '',
      customer: order.customer || '',
      store_ref: order.store_ref || '',
      mc_pkr: order.mc_pkr != null ? String(order.mc_pkr) : '',
      sc_pkr: order.sc_pkr != null ? String(order.sc_pkr) : '',
      quantity: String(order.quantity ?? 1),
      tracking: order.tracking || '',
      source: order.source || '',
      shoes_type: order.shoes_type || '',
      country: order.country || '',
      size: order.size || '',
      color: order.color || '',
      comments: order.comments || '',
      shipping_service: order.shipping_service || '',
      order_amount: order.order_amount != null ? String(order.order_amount) : '',
      payment_method: order.payment_method || '',
      shipping_address: order.shipping_address || '',
      image_url: '',
      images: existingImages,
    });
  }, [order, initialMode]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  function handleImagesChange(newImages) {
    setForm(f => ({ ...f, images: newImages }));
  }

  async function handleSave() {
    const required = ['date', 'customer', 'source', 'shoes_type', 'country', 'size', 'color', 'order_amount', 'payment_method'];
    for (const field of required) {
      if (!form[field]) {
        setError(`"${field.replace(/_/g, ' ')}" is required.`);
        return;
      }
    }
    setError('');
    setSaving(true);
    const data = new FormData();
    const { images, image_url, ...fields } = form;
    Object.entries(fields).forEach(([k, v]) => data.append(k, v ?? ''));

    const keptUrls = images.filter(img => !img.file).map(img => img.url);
    const newFiles = images.filter(img => img.file).map(img => img.file);
    data.append('keep_images', keptUrls.join(','));
    newFiles.forEach(f => data.append('images', f));
    if (image_url?.trim() && images.length === 0) data.append('image_url', image_url.trim());
    try {
      const res = await api.put(`/orders/${order.id}`, data);
      onSaved(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (!order || !form) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal-dialog${mode === 'edit' ? ' modal-dialog-wide' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="modal-header">
          <div className="modal-header-left">
            <div className="modal-title">
              {mode === 'view' ? 'Order Details' : 'Edit Order'}
            </div>
            <div className="modal-subtitle">Order # {order.order_number}</div>
          </div>
          <div className="modal-header-right">
            {mode === 'view' && (
              <button className="btn-secondary btn-sm" onClick={() => { setMode('edit'); setError(''); }}>
                Edit
              </button>
            )}
            {mode === 'edit' && (
              <button className="btn-ghost btn-sm" onClick={() => { setMode('view'); setError(''); }}>
                View
              </button>
            )}
            <button className="btn-close" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="modal-body">
          {error && <p className="error-msg">{error}</p>}

          {mode === 'view' ? (
            <div className="detail-grid">
              <div className="detail-col">
                <div className="detail-section">
                  <div className="detail-section-title">Order Info</div>
                  <DetailRow label="Date"        value={formatDate(order.date)} />
                  <DetailRow label="Order #"     value={order.order_number} highlight />
                  <DetailRow label="Customer"    value={order.customer} />
                  <DetailRow label="Store-Ref #" value={order.store_ref} />
                  <DetailRow label="Source"      value={order.source} />
                  <DetailRow label="Quantity"    value={order.quantity} />
                </div>
                <div className="detail-section">
                  <div className="detail-section-title">Product</div>
                  <DetailRow label="Shoes Type" value={order.shoes_type} />
                  <DetailRow label="Size"       value={order.size ? `US ${order.size}` : null} />
                  <DetailRow label="Color"      value={order.color} />
                  <DetailRow label="Country"    value={order.country} />
                </div>
              </div>
              <div className="detail-col">
                <div className="detail-section">
                  <div className="detail-section-title">Financials</div>
                  <DetailRow label="Order Amount" value={order.order_amount != null ? `$${Number(order.order_amount).toFixed(2)}` : null} highlight />
                  <DetailRow label="Payment"      value={order.payment_method} />
                  <DetailRow label="MC (PKR)"     value={order.mc_pkr != null ? Number(order.mc_pkr).toLocaleString() : null} />
                  <DetailRow label="SC (PKR)"     value={order.sc_pkr != null ? Number(order.sc_pkr).toLocaleString() : null} />
                </div>
                <div className="detail-section">
                  <div className="detail-section-title">Shipping</div>
                  <DetailRow label="Service"  value={order.shipping_service} />
                  <DetailRow label="Tracking" value={order.tracking} />
                  {order.shipping_address && (
                    <div style={{marginTop: 6}}>
                      <span className="detail-label">Address</span>
                      <p style={{fontSize:13, color:'var(--text)', marginTop:4, whiteSpace:'pre-wrap', lineHeight:1.5}}>{order.shipping_address}</p>
                    </div>
                  )}
                </div>
                {order.comments && (
                  <div className="detail-section">
                    <div className="detail-section-title">Comments</div>
                    <p className="detail-comments">{order.comments}</p>
                  </div>
                )}
                {order.image_path && (
                  <div className="detail-section">
                    <div className="detail-section-title">Images</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {order.image_path.split(',').filter(Boolean).map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer">
                          <img src={url} alt={`Image ${i + 1}`} className="detail-image" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }} />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {isEditor && (
                  <div className="detail-section" style={{ marginTop: 8 }}>
                    <div className="detail-section-title">Manage Status</div>
                    <DetailRow
                      label="Current Status"
                      value={<span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{(order.status || 'open').replace(/_/g, ' ')}</span>}
                    />
                    {order.cad_amount != null && (
                      <>
                        <DetailRow label="CAD Amount"  value={`CA$${Number(order.cad_amount).toFixed(2)}`} />
                        <DetailRow label="Commission"  value={`CA$${Number(order.commission).toFixed(2)}`} />
                        <DetailRow label="Net Amount"  value={`CA$${Number(order.net_amount).toFixed(2)}`} highlight />
                      </>
                    )}
                    {(STATUS_TRANSITIONS[order.status || 'open'] || []).length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        {(order.status === 'dispute_opened') && (
                          <div className="form-group" style={{ marginBottom: 10 }}>
                            <label>Partial Refund (CAD) — optional</label>
                            <input
                              type="number" step="0.01" min="0"
                              value={partialRefund}
                              onChange={e => setPartialRefund(e.target.value)}
                              placeholder="e.g. 20.00"
                            />
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {(STATUS_TRANSITIONS[order.status || 'open'] || []).filter(s => s !== 'cancelled').map(s => (
                            <button
                              key={s}
                              disabled={statusSaving}
                              onClick={() => handleStatusChange(s)}
                              style={{
                                padding: '6px 14px', borderRadius: 6, border: 'none',
                                background: STATUS_LABELS[s]?.color || '#64748b',
                                color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                              }}
                            >
                              {STATUS_LABELS[s]?.label || s}
                            </button>
                          ))}
                          {(STATUS_TRANSITIONS[order.status || 'open'] || []).includes('cancelled') && (
                            <button
                              disabled={statusSaving}
                              onClick={() => setCancelExpanded(v => !v)}
                              style={{
                                padding: '6px 14px', borderRadius: 6, border: 'none',
                                background: '#64748b', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                              }}
                            >
                              Cancel Order
                            </button>
                          )}
                        </div>

                        {/* ── Cancel cost override form ── */}
                        {cancelExpanded && (
                          <div style={{ marginTop: 14, padding: '14px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: '#991b1b' }}>
                              Cancellation Costs
                            </div>
                            <div style={{ fontSize: 12, color: '#b91c1c', marginBottom: 12 }}>
                              {order.handler_id
                                ? 'Enter any costs that still need to be paid to the handler. Leave blank to cancel with zero costs.'
                                : 'No handler assigned — costs will not create a bill.'}
                            </div>
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                              <div className="form-group" style={{ margin: 0, width: 150 }}>
                                <label>Manufacturing (PKR)</label>
                                <input
                                  type="number" min="0" placeholder="0"
                                  value={cancelForm.manufacturing}
                                  onChange={e => setCancelForm(f => ({ ...f, manufacturing: e.target.value }))}
                                />
                              </div>
                              <div className="form-group" style={{ margin: 0, width: 150 }}>
                                <label>Shipping (PKR)</label>
                                <input
                                  type="number" min="0" placeholder="0"
                                  value={cancelForm.shipping}
                                  onChange={e => setCancelForm(f => ({ ...f, shipping: e.target.value }))}
                                />
                              </div>
                              <div className="form-group" style={{ margin: 0, width: 150 }}>
                                <label>Commission (PKR)</label>
                                <input
                                  type="number" min="0" placeholder="0"
                                  value={cancelForm.commission}
                                  onChange={e => setCancelForm(f => ({ ...f, commission: e.target.value }))}
                                />
                              </div>
                              <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 160 }}>
                                <label>Note</label>
                                <input
                                  type="text" placeholder="e.g. Customer returned, paid mfg only"
                                  value={cancelForm.note}
                                  onChange={e => setCancelForm(f => ({ ...f, note: e.target.value }))}
                                />
                              </div>
                            </div>
                            {(cancelForm.manufacturing || cancelForm.shipping || cancelForm.commission) && (
                              <div style={{ fontSize: 12, color: '#991b1b', marginBottom: 10 }}>
                                Total cancellation cost: <strong>PKR {(
                                  (parseFloat(cancelForm.manufacturing) || 0) +
                                  (parseFloat(cancelForm.shipping) || 0) +
                                  (parseFloat(cancelForm.commission) || 0)
                                ).toLocaleString('en-PK')}</strong>
                                {order.handler_id && ' — will be added to handler bill'}
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                disabled={statusSaving}
                                onClick={() => handleStatusChange('cancelled')}
                                style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                              >
                                {statusSaving ? 'Cancelling…' : 'Confirm Cancellation'}
                              </button>
                              <button
                                onClick={() => setCancelExpanded(false)}
                                style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: 'none', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}
                              >
                                Back
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <OrderForm
              form={form}
              onChange={handleChange}
              onImagesChange={handleImagesChange}
              compact
            />
          )}
        </div>

        {/* ── Footer ── */}
        {mode === 'edit' && (
          <div className="modal-footer">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
