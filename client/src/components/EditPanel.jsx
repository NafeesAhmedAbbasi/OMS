import { useState, useEffect } from 'react';
import api from '../api';
import OrderForm from './OrderForm';

export default function EditPanel({ order, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!order) return;
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
      image: null,
    });
    setImagePreview(order.image_path ? `/uploads/${order.image_path.split('/').pop()}` : null);
    setError('');
  }, [order]);

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
        setError(`"${field.replace('_', ' ')}" is required.`);
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
      const res = await api.put(`/orders/${order.id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onSaved(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (!order || !form) return null;

  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <div className="edit-panel">
        <div className="edit-panel-header">
          <div>
            <div className="edit-panel-title">Edit Order</div>
            <div className="edit-panel-order-num">Order # {order.order_number}</div>
          </div>
          <button className="btn-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="edit-panel-body">
          {error && <p className="error-msg">{error}</p>}
          <OrderForm
            form={form}
            onChange={handleChange}
            onImageChange={handleImageChange}
            imagePreview={imagePreview}
            compact
          />
        </div>

        <div className="edit-panel-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  );
}
