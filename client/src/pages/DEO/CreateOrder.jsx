import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import AppLayout from '../../components/AppLayout';
import OrderForm from '../../components/OrderForm';

const TODAY = new Date().toISOString().split('T')[0];

const EMPTY_FORM = {
  date: TODAY,
  customer: '',
  store_ref: '',
  mc_pkr: '',
  sc_pkr: '',
  quantity: '1',
  tracking: '',
  source: '',
  shoes_type: '',
  country: '',
  size: '',
  color: '',
  comments: '',
  shipping_service: '',
  order_amount: '',
  payment_method: '',
  shipping_address: '',
  image: null,
};

export default function CreateOrder() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [nextNumber, setNextNumber] = useState('');
  const [customNumber, setCustomNumber] = useState('');
  const [numberError, setNumberError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/orders/next-number').then(res => {
      setNextNumber(String(res.data.next));
      setCustomNumber(String(res.data.next));
    });
  }, []);

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

  async function submitOrder() {
    const required = ['date', 'customer', 'source', 'shoes_type', 'country', 'size', 'color', 'order_amount', 'payment_method'];
    for (const field of required) {
      if (!form[field]) {
        setError(`"${field.replace(/_/g, ' ')}" is required.`);
        return null;
      }
    }
    setError('');
    setSuccess('');
    setNumberError('');
    setSaving(true);

    const data = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      if (k === 'image') { if (v) data.append('image', v); }
      else data.append(k, v);
    });
    if (customNumber && customNumber !== nextNumber) {
      data.append('order_number', customNumber);
    }

    try {
      const res = await api.post('/orders', data);
      return res.data;
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to save order';
      if (msg.includes('already exists')) setNumberError(msg);
      else setError(msg);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    const saved = await submitOrder();
    if (saved) {
      setForm({ ...EMPTY_FORM, date: TODAY });
      setImagePreview(null);
      setSuccess(`Order #${saved.order_number} saved successfully.`);
      api.get('/orders/next-number').then(res => {
        setNextNumber(String(res.data.next));
        setCustomNumber(String(res.data.next));
      });
    }
  }

  async function handleGenerate(e) {
    e.preventDefault();
    const saved = await submitOrder();
    if (saved) navigate('/deo/orders');
  }

  return (
    <AppLayout>
      <div className="page-container">
        <div className="page-header">
          <div>
            <h2 className="page-title">Create Order</h2>
            <p className="page-subtitle">Fill in the details below</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn-ghost" onClick={() => navigate('/deo/import')} style={{ fontSize: 13 }}>
              ↓ Import from Store Envy
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Order #</label>
                <input
                  type="number"
                  value={customNumber}
                  onChange={e => { setCustomNumber(e.target.value); setNumberError(''); }}
                  style={{
                    width: 100, padding: '4px 10px', fontSize: 15, fontWeight: 700,
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
          </div>
        </div>

        {error   && <p className="error-msg">{error}</p>}
        {success && <p className="success-msg">{success}</p>}

        <div className="order-form-card">
          <OrderForm
            form={form}
            onChange={handleChange}
            onImageChange={handleImageChange}
            imagePreview={imagePreview}
          />

          <div className="form-actions">
            <button className="btn-secondary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button className="btn-primary" onClick={handleGenerate} disabled={saving}>
              {saving ? 'Saving…' : 'Generate'}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
