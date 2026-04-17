import { useState, useEffect } from 'react';
import api from '../api';
import OrderForm from './OrderForm';

export default function EditPanel({ order, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [syncMsg, setSyncMsg] = useState('');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!order) return;
    // Parse existing image_path (comma-separated URLs) into images array
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
      image_url: '',
      images: existingImages,
    });
    setError('');
    setSyncMsg('');
  }, [order]);

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
        setError(`"${field.replace('_', ' ')}" is required.`);
        return;
      }
    }
    setError('');
    setSaving(true);

    const data = new FormData();
    // Append all non-image fields
    const { images, image_url, ...fields } = form;
    Object.entries(fields).forEach(([k, v]) => data.append(k, v ?? ''));

    // Separate kept URLs from new file uploads
    const keptUrls = images.filter(img => !img.file).map(img => img.url);
    const newFiles = images.filter(img => img.file).map(img => img.file);

    data.append('keep_images', keptUrls.join(','));
    newFiles.forEach(f => data.append('images', f));

    // If image_url was typed in and no images yet, send it
    if (image_url?.trim() && images.length === 0) {
      data.append('image_url', image_url.trim());
    }

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

  async function handleSyncStoreEnvy() {
    setSyncing(true);
    setSyncMsg('');
    try {
      await api.post(`/orders/${order.id}/sync-storenvy`);
      setSyncMsg('Shipped status synced to Store Envy.');
    } catch (err) {
      setSyncMsg(err.response?.data?.error || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  if (!order || !form) return null;

  const isStoreEnvy = order.source === 'Store Envy' && order.store_ref;

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
            onImagesChange={handleImagesChange}
            compact
          />
          {isStoreEnvy && order.tracking && (
            <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Sync shipping to Store Envy</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Mark order #{order.store_ref} as shipped with tracking {order.tracking}</div>
                {syncMsg && <div style={{ fontSize: 12, marginTop: 4, color: syncMsg.includes('ynced') ? '#059669' : '#ef4444' }}>{syncMsg}</div>}
              </div>
              <button className="btn-ghost btn-sm" onClick={handleSyncStoreEnvy} disabled={syncing} style={{ whiteSpace: 'nowrap' }}>
                {syncing ? 'Syncing…' : 'Sync Shipped'}
              </button>
            </div>
          )}
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
