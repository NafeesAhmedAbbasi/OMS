import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import AppLayout from '../../components/AppLayout';
import OrderForm from '../../components/OrderForm';

function guessItemType(productName) {
  const n = (productName || '').toLowerCase();
  if (n.includes('jacket') || n.includes('coat'))             return 'Jacket';
  if (n.includes('loafer'))                                    return 'Loafers';
  if (n.includes('cowboy') || n.includes('western boot'))     return 'Cowboy Boot';
  if (n.includes('oxford'))                                    return 'Oxford Shoes';
  if (n.includes('dress shoe') || n.includes('dress-shoe'))   return 'Dress Shoes';
  if (n.includes('leather') || n.includes('shoe') || n.includes('shoes')) return 'Leather Shoes';
  if (n.includes('boot'))                                      return 'Cowboy Boot';
  return productName || 'Unknown';
}

function mapPaymentMethod(processor) {
  const p = (processor || '').toLowerCase().trim();
  if (p.includes('stripe'))  return 'Stripe';
  if (p.includes('paypal'))  return 'PayPal';
  if (p.includes('store envy') || p.includes('storenvy')) return 'Store Envy';
  return processor || 'Store Envy';
}

function mapStoreEnvyOrder(o, accountName) {
  const addr    = o.address || {};
  const items   = (o.items || []).map(i => i.item || i);
  const first   = items[0] || {};
  const qty     = items.reduce((s, i) => s + (i.quantity || 1), 0);
  const addrStr = [addr.address_1, addr.address_2, addr.city, addr.state, addr.postal, addr.country]
    .filter(Boolean).join(', ');
  const sizeRaw = first.variant_name || '';
  const size    = sizeRaw.includes(':') ? sizeRaw.split(':').pop().trim() : (sizeRaw || 'N/A');
  return {
    date:             (o.confirmed_at || o.updated_at || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
    customer:         addr.name || '',
    store_ref:        String(o.id || ''),
    quantity:         String(qty || 1),
    source:           accountName || 'Store Envy',
    shoes_type:       guessItemType(first.product_name),
    size,
    color:            'N/A',
    country:          addr.country || '',
    order_amount:     String(o.price || ''),
    payment_method:   mapPaymentMethod(o.payment_processor),
    shipping_address: addrStr,
    mc_pkr: '', sc_pkr: '', tracking: '', comments: '', shipping_service: '',
  };
}

// ── Review modal — shows one order at a time for editing before import ──
function ReviewModal({ queue, accountName, onDone }) {
  const [index, setIndex]           = useState(0);
  const [form, setForm]             = useState(() => ({ ...mapStoreEnvyOrder(queue[0], accountName), images: [] }));
  const [nextNumber, setNextNumber] = useState('');
  const [customNumber, setCustomNumber] = useState('');
  const [numberError, setNumberError] = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [results, setResults]       = useState([]);

  const raw     = queue[index];
  const total   = queue.length;
  const isLast  = index === total - 1;

  // When index changes, reset form + fetch next number + prefetch image
  useEffect(() => {
    setForm({ ...mapStoreEnvyOrder(queue[index], accountName), images: [] });
    setError('');
    setNumberError('');

    api.get('/orders/next-number').then(res => {
      const n = String(res.data.next);
      setNextNumber(n);
      setCustomNumber(n);
    });

    // Try to pre-fetch Store Envy product image
    const items    = (queue[index].items || []).map(i => i.item || i);
    const imageUrl = items[0]?.image || items[0]?.image_url;
    if (imageUrl) {
      api.get('/settings/image-proxy', { params: { url: imageUrl }, responseType: 'blob' })
        .then(res => {
          const blob = res.data;
          const file = new File([blob], `storenvy_${queue[index].id}.jpg`, { type: blob.type || 'image/jpeg' });
          const url  = URL.createObjectURL(blob);
          setForm(f => ({ ...f, images: [{ url, file }] }));
        })
        .catch(() => {});
    }
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  function handleImagesChange(newImages) {
    setForm(f => ({ ...f, images: newImages }));
  }

  async function handleImport() {
    setError('');
    setNumberError('');
    setSaving(true);
    const fd = new FormData();
    const { images, image_url, ...fields } = form;
    Object.entries(fields).forEach(([k, v]) => { if (v != null) fd.append(k, v); });
    images.filter(img => img.file).forEach(img => fd.append('images', img.file));
    if (customNumber && customNumber !== nextNumber) fd.append('order_number', customNumber);
    try {
      const res = await api.post('/orders', fd);
      const newResults = [...results, { id: raw.id, ok: true, oms: res.data.order_number }];
      setResults(newResults);
      if (isLast) { onDone(newResults); return; }
      setIndex(i => i + 1);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to import order';
      if (msg.includes('already exists')) setNumberError(msg);
      else setError(msg);
    } finally {
      setSaving(false);
    }
  }

  function handleSkip() {
    const newResults = [...results, { id: raw.id, ok: false, msg: 'Skipped' }];
    setResults(newResults);
    if (isLast) { onDone(newResults); return; }
    setIndex(i => i + 1);
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && handleSkip()}>
      <div className="modal-dialog modal-dialog-wide" style={{ maxWidth: 760, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <div className="modal-header-left">
            <span className="modal-title">Review Order</span>
            <span className="modal-subtitle">Store Envy #{raw.id} &nbsp;·&nbsp; {index + 1} of {total}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* OMS order number */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>OMS #</label>
                <input
                  type="number"
                  value={customNumber}
                  onChange={e => { setCustomNumber(e.target.value); setNumberError(''); }}
                  style={{
                    width: 84, padding: '3px 8px', fontSize: 14, fontWeight: 700,
                    border: `1.5px solid ${numberError ? '#ef4444' : 'var(--border)'}`,
                    borderRadius: 8, textAlign: 'center', color: 'var(--primary)',
                  }}
                  min="1"
                />
              </div>
              {customNumber !== nextNumber && !numberError && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Next auto: #{nextNumber}</span>
              )}
              {numberError && <span style={{ fontSize: 11, color: '#ef4444' }}>{numberError}</span>}
            </div>
            {/* Progress dots */}
            <div style={{ display: 'flex', gap: 4 }}>
              {queue.map((_, i) => (
                <div key={i} style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: i < index
                    ? (results[i]?.ok ? '#059669' : '#9ca3af')
                    : i === index ? 'var(--primary)' : 'var(--border)',
                }} />
              ))}
            </div>
            <button className="modal-close" onClick={handleSkip} title="Skip this order">×</button>
          </div>
        </div>

        <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
          {error && <p className="error-msg" style={{ marginBottom: 12 }}>{error}</p>}
          <OrderForm
            form={form}
            onChange={handleChange}
            onImagesChange={handleImagesChange}
            compact
            hideCosts
          />
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={handleSkip} disabled={saving}>
            Skip
          </button>
          <button className="btn-primary" onClick={handleImport} disabled={saving}>
            {saving ? 'Importing…' : isLast ? 'Import & Finish' : 'Import & Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StoreEnvyImport() {
  const navigate = useNavigate();

  const [accounts, setAccounts]               = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  const [orders, setOrders]                   = useState([]);
  const [loadingOrders, setLoadingOrders]     = useState(false);
  const [fetchError, setFetchError]           = useState('');

  const [existingRefs, setExistingRefs]       = useState(new Set());
  const [selected, setSelected]               = useState(new Set());
  const [reviewQueue, setReviewQueue]         = useState(null); // null = closed
  const [results, setResults]                 = useState([]);

  useEffect(() => {
    api.get('/settings/storenvy-accounts')
      .then(res => {
        const accs = Array.isArray(res.data) ? res.data : [];
        setAccounts(accs);
        if (accs.length === 1) setSelectedAccount(String(accs[0].id));
      })
      .catch(() => setFetchError('Failed to load accounts'))
      .finally(() => setLoadingAccounts(false));

    api.get('/orders')
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : [];
        setExistingRefs(new Set(list.map(o => String(o.store_ref)).filter(Boolean)));
      })
      .catch(() => {});
  }, []);

  async function fetchOrders(accountId) {
    if (!accountId) return;
    setLoadingOrders(true); setFetchError(''); setOrders([]); setSelected(new Set()); setResults([]);
    try {
      const res = await api.get(`/settings/storenvy-accounts/${accountId}/orders`);
      setOrders(res.data.orders || []);
    } catch (err) {
      setFetchError(err.response?.data?.error || 'Failed to fetch orders');
    } finally { setLoadingOrders(false); }
  }

  function handleAccountChange(id) {
    setSelectedAccount(id);
    if (id) fetchOrders(id);
  }

  function toggleSelect(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const importable = orders.filter(o => !existingRefs.has(String(o.id)));

  function toggleAll() {
    setSelected(selected.size === importable.length ? new Set() : new Set(importable.map(o => o.id)));
  }

  function startReview() {
    const queue = orders.filter(o => selected.has(o.id));
    if (!queue.length) return;
    setReviewQueue(queue);
    setResults([]);
  }

  function handleReviewDone(finalResults) {
    setReviewQueue(null);
    setResults(finalResults);
    setSelected(new Set());
    // Update existingRefs so successfully imported orders show "In OMS"
    const imported = finalResults.filter(r => r.ok).map(r => String(r.id));
    if (imported.length) setExistingRefs(prev => new Set([...prev, ...imported]));
  }

  const successCount = results.filter(r => r.ok).length;

  return (
    <AppLayout>
      <div className="page-container">
        <div className="page-header">
          <div>
            <h2 className="page-title">Import from Store Envy</h2>
            <p className="page-subtitle">Select an account then choose which orders to import</p>
          </div>
          <button className="btn-ghost" onClick={() => navigate('/deo/orders')}>← Back to Orders</button>
        </div>

        {fetchError && <p className="error-msg">{fetchError}</p>}

        {/* Import results summary */}
        {results.length > 0 && (
          <div className="table-card" style={{ padding: '12px 20px', marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              Import complete — {successCount}/{results.length} imported
            </div>
            {results.map(r => (
              <div key={r.id} style={{ fontSize: 13, color: r.ok ? '#059669' : '#6b7280', padding: '2px 0' }}>
                {r.ok
                  ? `✓ Store Envy #${r.id} → OMS #${r.oms}`
                  : `— Store Envy #${r.id}: ${r.msg}`}
              </div>
            ))}
          </div>
        )}

        {/* Account selector */}
        <div className="table-card" style={{ padding: '16px 20px', marginBottom: 16 }}>
          {loadingAccounts ? (
            <div className="loading-state">Loading accounts…</div>
          ) : accounts.length === 0 ? (
            <div className="no-data">
              No Store Envy accounts configured.{' '}
              <a href="/admin/settings" style={{ color: 'var(--primary)' }}>Ask admin to add one in Settings.</a>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' }}>Store Envy Account</label>
              <select
                value={selectedAccount}
                onChange={e => handleAccountChange(e.target.value)}
                style={{ fontSize: 14, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', minWidth: 200 }}
              >
                <option value="">Select account…</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              {selectedAccount && (
                <button className="btn-ghost btn-sm" onClick={() => fetchOrders(selectedAccount)} disabled={loadingOrders}>
                  {loadingOrders ? 'Loading…' : 'Refresh'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Orders table */}
        {loadingOrders && <div className="loading-state">Fetching orders from Store Envy…</div>}

        {!loadingOrders && orders.length > 0 && (
          <div className="table-card">
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                {orders.length} orders · {importable.length} new
              </span>
              <button
                className="btn-primary"
                onClick={startReview}
                disabled={selected.size === 0}
              >
                Review & Import {selected.size > 0 ? `${selected.size} Selected` : ''}
              </button>
            </div>
            <div className="table-wrapper">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>
                      <input type="checkbox"
                        checked={selected.size > 0 && selected.size === importable.length}
                        onChange={toggleAll}
                      />
                    </th>
                    <th>Order #</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => {
                    const alreadyIn = existingRefs.has(String(o.id));
                    const items     = (o.items || []).map(i => i.item || i);
                    const first     = items[0] || {};
                    const qty       = items.reduce((s, i) => s + (i.quantity || 1), 0);
                    return (
                      <tr key={o.id} style={{ opacity: alreadyIn ? 0.5 : 1, background: alreadyIn ? 'var(--bg)' : undefined }}>
                        <td>
                          <input type="checkbox" disabled={alreadyIn}
                            checked={selected.has(o.id)} onChange={() => toggleSelect(o.id)} />
                        </td>
                        <td><span className="order-num">{o.id}</span></td>
                        <td>{(o.confirmed_at || o.updated_at || '').slice(0, 10)}</td>
                        <td>{o.address?.name || '—'}</td>
                        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {first.product_name || '—'}
                        </td>
                        <td>{qty}</td>
                        <td>${Number(o.price || 0).toFixed(2)}</td>
                        <td>
                          {alreadyIn
                            ? <span style={{ fontSize: 11, background: '#d1fae5', color: '#065f46', borderRadius: 8, padding: '2px 8px', fontWeight: 600 }}>In OMS</span>
                            : <span style={{ fontSize: 11, background: '#f0f9ff', color: '#0369a1', borderRadius: 8, padding: '2px 8px' }}>
                                {o.fulfillment_status || o.status || 'unfulfilled'}
                              </span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loadingOrders && selectedAccount && orders.length === 0 && !fetchError && (
          <div className="empty-state">No orders found in this Store Envy account.</div>
        )}
      </div>

      {/* Review modal — rendered outside page-container so it overlays correctly */}
      {reviewQueue && (
        <ReviewModal queue={reviewQueue} accountName={accounts.find(a => String(a.id) === selectedAccount)?.name} onDone={handleReviewDone} />
      )}
    </AppLayout>
  );
}
