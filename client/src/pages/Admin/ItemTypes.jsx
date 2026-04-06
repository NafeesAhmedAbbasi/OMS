import { useEffect, useState } from 'react';
import api from '../../api';
import AppLayout from '../../components/AppLayout';

export default function ItemTypes() {
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [saving, setSaving]   = useState(false);
  const [editId, setEditId]   = useState(null);
  const [editName, setEditName] = useState('');
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.get('/item-types')
      .then(res => setItems(res.data))
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd() {
    if (!newName.trim()) return;
    setError(''); setSaving(true);
    try {
      const res = await api.post('/item-types', { name: newName.trim() });
      setItems(prev => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName('');
      setSuccess(`"${res.data.name}" added.`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add');
    } finally { setSaving(false); }
  }

  async function handleEdit(item) {
    if (!editName.trim() || editName.trim() === item.name) { setEditId(null); return; }
    setError('');
    try {
      const res = await api.put(`/item-types/${item.id}`, { name: editName.trim() });
      setItems(prev => prev.map(i => i.id === res.data.id ? res.data : i).sort((a, b) => a.name.localeCompare(b.name)));
      setSuccess(`Renamed to "${res.data.name}".`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to rename');
    } finally { setEditId(null); }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Delete "${item.name}"? Orders using this type will keep the value.`)) return;
    setError('');
    try {
      await api.delete(`/item-types/${item.id}`);
      setItems(prev => prev.filter(i => i.id !== item.id));
      setSuccess(`"${item.name}" deleted.`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete');
    }
  }

  return (
    <AppLayout>
      <div className="page-container">
        <div className="page-header">
          <div>
            <h2 className="page-title">Item Types</h2>
            <p className="page-subtitle">Manage product categories (shoes, jackets, etc.)</p>
          </div>
        </div>

        {error   && <p className="error-msg">{error}</p>}
        {success && <p className="success-msg">{success}</p>}

        {/* Add form */}
        <div className="order-form-card" style={{ marginBottom: 24 }}>
          <div className="detail-section-title" style={{ marginBottom: 12 }}>Add Item Type</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ margin: 0, flex: 1, maxWidth: 320 }}>
              <label>Name <span className="required">*</span></label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="e.g. Jacket, Sneakers…"
              />
            </div>
            <button className="btn-primary" onClick={handleAdd} disabled={saving || !newName.trim()} style={{ marginBottom: 1 }}>
              {saving ? 'Adding…' : 'Add'}
            </button>
          </div>
        </div>

        {/* List */}
        <div className="table-card">
          {loading ? <div className="loading-state">Loading…</div> : (
            <div className="table-wrapper">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th style={{ width: 180 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && (
                    <tr><td colSpan="2" className="no-data">No item types yet.</td></tr>
                  )}
                  {items.map(item => (
                    <tr key={item.id}>
                      <td>
                        {editId === item.id ? (
                          <div className="form-group" style={{ margin: 0 }}>
                            <input
                              type="text"
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleEdit(item); if (e.key === 'Escape') setEditId(null); }}
                              autoFocus
                            />
                          </div>
                        ) : (
                          <strong>{item.name}</strong>
                        )}
                      </td>
                      <td>
                        {editId === item.id ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn-primary btn-sm" onClick={() => handleEdit(item)}>Save</button>
                            <button className="btn-ghost btn-sm" onClick={() => setEditId(null)}>Cancel</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn-ghost btn-sm" onClick={() => { setEditId(item.id); setEditName(item.name); }}>Rename</button>
                            <button
                              className="btn-ghost btn-sm"
                              style={{ borderColor: '#fecaca', color: 'var(--danger)' }}
                              onClick={() => handleDelete(item)}
                            >Delete</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
