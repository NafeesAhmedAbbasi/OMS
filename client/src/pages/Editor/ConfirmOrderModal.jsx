import { useState } from 'react';
import api from '../../api';
import { MONTHS } from '../../constants';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(d)} ${MONTHS[parseInt(m) - 1]}, ${y}`;
}

function DetailRow({ label, value }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value ?? <span className="text-muted">—</span>}</span>
    </div>
  );
}

export default function ConfirmOrderModal({ order, accounts, onClose, onConfirmed }) {
  const [cadAmount, setCadAmount]       = useState('');
  const [commission, setCommission]     = useState('');
  const [billingAccountId, setBillingAccountId] = useState('');
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');

  const netAmount = cadAmount !== '' && commission !== ''
    ? (parseFloat(cadAmount || 0) - parseFloat(commission || 0)).toFixed(2)
    : null;

  async function handleConfirm() {
    if (!cadAmount || !commission || !billingAccountId) {
      setError('All fields are required');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const res = await api.put(`/orders/${order.id}/confirm`, {
        cad_amount: parseFloat(cadAmount),
        commission: parseFloat(commission),
        confirmed_billing_account_id: parseInt(billingAccountId),
      });
      onConfirmed(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to confirm');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(status) {
    setError('');
    setSaving(true);
    try {
      const res = await api.put(`/orders/${order.id}/status`, { status });
      onConfirmed(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update status');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-left">
            <div className="modal-title">Confirm Order</div>
            <div className="modal-subtitle">Order # {order.order_number} · {formatDate(order.date)}</div>
          </div>
          <div className="modal-header-right">
            <button className="btn-close" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        <div className="modal-body">
          {error && <p className="error-msg">{error}</p>}

          <div className="detail-section">
            <div className="detail-section-title">Order Info</div>
            <DetailRow label="Customer"     value={order.customer} />
            <DetailRow label="Amount (USD)" value={order.order_amount != null ? `$${Number(order.order_amount).toFixed(2)}` : null} />
            <DetailRow label="Payment"      value={order.payment_method} />
            <DetailRow label="Source"       value={order.source} />
            <DetailRow label="Shoes Type"   value={order.shoes_type} />
            <DetailRow label="Size"         value={order.size ? `US ${order.size}` : null} />
            <DetailRow label="Color"        value={order.color} />
          </div>

          <div className="detail-section" style={{ marginTop: 20 }}>
            <div className="detail-section-title">Confirmation Details</div>

            <div className="form-group">
              <label>CAD Amount Received <span className="required">*</span></label>
              <input
                type="number"
                value={cadAmount}
                onChange={e => setCadAmount(e.target.value)}
                placeholder="e.g. 145.00"
                step="0.01"
                min="0"
              />
            </div>

            <div className="form-group">
              <label>Commission Deducted <span className="required">*</span></label>
              <input
                type="number"
                value={commission}
                onChange={e => setCommission(e.target.value)}
                placeholder="e.g. 5.00"
                step="0.01"
                min="0"
              />
            </div>

            {netAmount !== null && (
              <div className="detail-row" style={{ marginBottom: 12 }}>
                <span className="detail-label">Net Amount (CAD)</span>
                <span className="detail-value detail-value-highlight">CA${netAmount}</span>
              </div>
            )}

            <div className="form-group">
              <label>Billing Account <span className="required">*</span></label>
              <select value={billingAccountId} onChange={e => setBillingAccountId(e.target.value)}>
                <option value="">Select account</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.type} · {acc.email})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={() => handleStatusChange('dispute_opened')} disabled={saving}>
            Open Dispute
          </button>
          <button className="btn-ghost" onClick={() => handleStatusChange('cancelled')} disabled={saving}>
            Cancel Order
          </button>
          <button className="btn-ghost" onClick={onClose}>Close</button>
          <button className="btn-primary" onClick={handleConfirm} disabled={saving}>
            {saving ? 'Saving…' : 'Confirm Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}
