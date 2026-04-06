import { useEffect, useState } from 'react';
import { SOURCES, SHIPPING_SERVICES, SHOE_SIZES, CLOTHING_SIZES, CLOTHING_KEYWORDS, PAYMENT_METHODS } from '../constants';
import api from '../api';

function isClothingType(typeName) {
  if (!typeName) return false;
  const lower = typeName.toLowerCase();
  return CLOTHING_KEYWORDS.some(kw => lower.includes(kw));
}

export default function OrderForm({ form, onChange, onImageChange, imagePreview, compact = false }) {
  const [itemTypes, setItemTypes] = useState([]);

  useEffect(() => {
    api.get('/item-types').then(res => setItemTypes(res.data));
  }, []);

  const clothing = isClothingType(form.shoes_type);
  const sizes    = clothing ? CLOTHING_SIZES : SHOE_SIZES;
  const sizeLabel = clothing ? 'Size' : 'Size (US)';
  return (
    <div className={`form-grid${compact ? ' compact' : ''}`}>

      {/* ── Order Info ── */}
      <div className="form-group">
        <label>Date <span className="required">*</span></label>
        <input type="date" name="date" value={form.date} onChange={onChange} required />
      </div>

      <div className="form-group">
        <label>Customer <span className="required">*</span></label>
        <input type="text" name="customer" value={form.customer} onChange={onChange} placeholder="Full name" required />
      </div>

      <div className="form-group">
        <label>Store-Ref #</label>
        <input type="text" name="store_ref" value={form.store_ref} onChange={onChange} placeholder="e.g. 21923738" />
      </div>

      {/* ── Product ── */}
      <div className="form-group">
        <label>Source <span className="required">*</span></label>
        <select name="source" value={form.source} onChange={onChange} required>
          <option value="">Select source</option>
          {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label>Item Type <span className="required">*</span></label>
        <select name="shoes_type" value={form.shoes_type} onChange={e => {
          onChange(e);
          // clear size when type category changes
          const wasClothing = isClothingType(form.shoes_type);
          const nowClothing = isClothingType(e.target.value);
          if (wasClothing !== nowClothing) onChange({ target: { name: 'size', value: '' } });
        }} required>
          <option value="">Select type</option>
          {itemTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label>{sizeLabel} <span className="required">*</span></label>
        <select name="size" value={form.size} onChange={onChange} required>
          <option value="">Select size</option>
          {clothing
            ? sizes.map(s => <option key={s} value={s}>{s}</option>)
            : sizes.map(s => <option key={s} value={s}>US {s}</option>)
          }
        </select>
      </div>

      <div className="form-group">
        <label>Color <span className="required">*</span></label>
        <input type="text" name="color" value={form.color} onChange={onChange} placeholder="e.g. Brown, Black" required />
      </div>

      <div className="form-group">
        <label>Country <span className="required">*</span></label>
        <input type="text" name="country" value={form.country} onChange={onChange} placeholder="e.g. US, Ukraine" required />
      </div>

      <div className="form-group">
        <label>Quantity</label>
        <input type="number" name="quantity" value={form.quantity} onChange={onChange} min="1" />
      </div>

      {/* ── Costs ── */}
      <div className="form-group">
        <label>MC (PKR)</label>
        <input type="number" name="mc_pkr" value={form.mc_pkr} onChange={onChange} placeholder="Optional" step="0.01" />
      </div>

      <div className="form-group">
        <label>SC (PKR)</label>
        <input type="number" name="sc_pkr" value={form.sc_pkr} onChange={onChange} placeholder="Optional" step="0.01" />
      </div>

      {/* ── Payment (hidden in list view) ── */}
      <div className="form-group">
        <label>Order Amount (USD) <span className="required">*</span></label>
        <input type="number" name="order_amount" value={form.order_amount} onChange={onChange} placeholder="e.g. 129.99" step="0.01" min="0" required />
      </div>

      <div className="form-group">
        <label>Payment Method <span className="required">*</span></label>
        <select name="payment_method" value={form.payment_method} onChange={onChange} required>
          <option value="">Select method</option>
          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* ── Shipping ── */}
      <div className="form-group">
        <label>Shipping Service</label>
        <select name="shipping_service" value={form.shipping_service} onChange={onChange}>
          <option value="">Select service</option>
          {SHIPPING_SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label>Tracking</label>
        <input type="text" name="tracking" value={form.tracking} onChange={onChange} placeholder="Optional" />
      </div>

      <div className="form-group full-span">
        <label>Shipping Address</label>
        <textarea name="shipping_address" value={form.shipping_address} onChange={onChange} placeholder="Street, City, State ZIP, Country" rows="3" />
      </div>

      <div className="form-group full-span">
        <label>Comments</label>
        <textarea name="comments" value={form.comments} onChange={onChange} placeholder="Optional notes" rows="3" />
      </div>

      <div className="form-group full-span">
        <label>Image</label>
        <div className="file-input-wrapper">
          <input type="file" accept="image/*" onChange={onImageChange} />
        </div>
        {imagePreview && (
          <div className="image-preview">
            <img src={imagePreview} alt="Preview" />
          </div>
        )}
      </div>

    </div>
  );
}
