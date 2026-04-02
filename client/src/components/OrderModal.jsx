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
  const [imagePreview, setImagePreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!order) return;
    setMode(initialMode);
    setError('');
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
      image: null,
    });
    setImagePreview(order.image_path || null);
  }, [order, initialMode]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  function handleImageChange(e) {
    const file = e.target.files[0];
    if (file) {
      setForm(f => ({ ...f, image: file }));
      setImagePreview(URL.createObjectURL(file));
    }
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
    Object.entries(form).forEach(([k, v]) => {
      if (k === 'image') { if (v) data.append('image', v); }
      else data.append(k, v);
    });
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
                    <div className="detail-section-title">Image</div>
                    <a href={order.image_path} target="_blank" rel="noreferrer">
                      <img src={order.image_path} alt="Order" className="detail-image" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <OrderForm
              form={form}
              onChange={handleChange}
              onImageChange={handleImageChange}
              imagePreview={imagePreview}
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
