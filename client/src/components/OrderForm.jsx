import { useEffect, useState, useRef } from 'react';
import { SHIPPING_SERVICES, SHOE_SIZES, CLOTHING_SIZES, CLOTHING_KEYWORDS, PAYMENT_METHODS } from '../constants';
import api from '../api';

function isClothingType(typeName) {
  if (!typeName) return false;
  const lower = typeName.toLowerCase();
  return CLOTHING_KEYWORDS.some(kw => lower.includes(kw));
}

export default function OrderForm({ form, onChange, onImagesChange, imagePreview, compact = false, hideCosts = false }) {
  const [itemTypes, setItemTypes] = useState([]);
  const [sources, setSources]     = useState([]);

  useEffect(() => {
    api.get('/item-types').then(res => setItemTypes(res.data));
    api.get('/settings/sources').then(res => setSources(res.data));
  }, []);

  const clothing = isClothingType(form.shoes_type);
  const sizes    = clothing ? CLOTHING_SIZES : SHOE_SIZES;
  const sizeLabel = clothing ? 'Size' : 'Size (US)';

  // images: array of { url, file? } — passed down as form.images or derived from imagePreview
  const images = form.images || (imagePreview ? [{ url: imagePreview }] : []);

  function handleRemoveImage(idx) {
    const next = images.filter((_, i) => i !== idx);
    onImagesChange(next);
  }

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
          {sources.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
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

      <div className="form-group full-span">
        <label>Comments</label>
        <textarea name="comments" value={form.comments} onChange={onChange} placeholder="Optional notes" rows="3" />
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
      {!hideCosts && (
        <div className="form-group">
          <label>MC (PKR)</label>
          <input type="number" name="mc_pkr" value={form.mc_pkr} onChange={onChange} placeholder="Optional" step="0.01" />
        </div>
      )}

      {!hideCosts && (
        <div className="form-group">
          <label>SC (PKR)</label>
          <input type="number" name="sc_pkr" value={form.sc_pkr} onChange={onChange} placeholder="Optional" step="0.01" />
        </div>
      )}

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

      {/* ── Images (up to 4) ── */}
      <div className="form-group full-span">
        <label>Images {images.length > 0 && <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12 }}>({images.length}/4)</span>}</label>

        {/* Existing image thumbnails */}
        {images.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {images.map((img, idx) => (
              <div key={idx} style={{ position: 'relative', width: 80, height: 80 }}>
                <img
                  src={img.url}
                  alt={`Image ${idx + 1}`}
                  style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(idx)}
                  style={{
                    position: 'absolute', top: -6, right: -6,
                    width: 20, height: 20, borderRadius: '50%',
                    background: '#ef4444', color: '#fff', border: 'none',
                    cursor: 'pointer', fontSize: 12, lineHeight: '20px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 0,
                  }}
                  aria-label="Remove image"
                >✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Drop zone — hidden when 4 images already added */}
        {images.length < 4 && (
          <>
            <ImageDropZone onImagesChange={onImagesChange} existingImages={images} />
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>or paste URL</span>
              <input
                type="url"
                name="image_url"
                value={form.image_url || ''}
                onChange={onChange}
                placeholder="https://example.com/image.jpg"
                style={{ flex: 1 }}
              />
            </div>
          </>
        )}
      </div>

    </div>
  );
}

// ── Resize image to max 1200px on longest side, quality 0.85 ──
function resizeImage(file, maxSize = 1200, quality = 0.85) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width <= maxSize && height <= maxSize) {
        resolve(file); // no resize needed
        return;
      }
      if (width > height) { height = Math.round(height * maxSize / width); width = maxSize; }
      else                { width = Math.round(width * maxSize / height); height = maxSize; }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        resolve(new File([blob], file.name, { type: 'image/jpeg' }));
      }, 'image/jpeg', quality);
    };
    img.src = url;
  });
}

function ImageDropZone({ onImagesChange, existingImages }) {
  const [dragging, setDragging] = useState(false);
  const [pasted, setPasted]     = useState(false);
  const inputRef  = useRef(null);

  async function processFiles(files) {
    const remaining = 4 - existingImages.length;
    const toProcess = Array.from(files).slice(0, remaining);
    const resized = await Promise.all(toProcess.map(f => resizeImage(f)));
    const newImages = resized.map(f => ({ url: URL.createObjectURL(f), file: f }));
    onImagesChange([...existingImages, ...newImages]);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    processFiles(e.dataTransfer.files);
  }

  function handleFileInput(e) {
    processFiles(e.target.files);
    e.target.value = '';
  }

  // Global paste listener
  useEffect(() => {
    async function handlePaste(e) {
      const items = Array.from(e.clipboardData?.items || []);
      const imageItem = items.find(item => item.type.startsWith('image/'));
      if (!imageItem) return;
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (file) {
        await processFiles([file]);
        setPasted(true);
        setTimeout(() => setPasted(false), 2000);
      }
    }
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [existingImages]);

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragging || pasted ? 'var(--primary)' : 'var(--border)'}`,
        borderRadius: 8,
        padding: '18px 16px',
        textAlign: 'center',
        cursor: 'pointer',
        background: dragging ? 'var(--primary-soft, #ede9fe)' : pasted ? '#f0fdf4' : 'var(--bg)',
        transition: 'border-color 0.15s, background 0.15s',
        userSelect: 'none',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileInput}
      />
      <div style={{ fontSize: 22, marginBottom: 4 }}>{pasted ? '✓' : '🖼'}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: pasted ? '#059669' : 'var(--text-secondary)' }}>
        {pasted ? 'Image pasted!' : dragging ? 'Drop to upload' : 'Drag & drop or paste images'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
        or click to browse · Ctrl+V / Cmd+V to paste · up to 4 images · auto-resized
      </div>
    </div>
  );
}
